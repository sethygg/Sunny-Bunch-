import { db } from './database';
import { CommerceError } from './commerce.mjs';
import { validateInfluencer, validateDonation, validateReversal } from './influencer-policy.mjs';
import { saveReferralPartner, partnerFromRow } from './schools';
import { validSchoolCode } from './school-policy.mjs';

const impactSql=`SELECT COALESCE(sum(CASE WHEN t.status='completed' THEN a.amount_cents ELSE 0 END),0) AS donated_cents,
  max(CASE WHEN t.status='completed' THEN t.transferred_on END) AS last_donation_on,
  max(COALESCE(t.reversed_at,t.created_at)) AS updated_at
  FROM charity_allocations a JOIN charity_transfers t ON t.id=a.transfer_id WHERE a.partner_id=?`;
export async function saveInfluencer(input:unknown,actor:string){const v=validateInfluencer(input);return saveReferralPartner(v,actor,'influencer',v.intro);}
export async function influencerReport(){
 const result=await db().batch([
  db().prepare(`SELECT p.*,
    (SELECT count(*) FROM school_order_attributions a JOIN orders o ON o.id=a.order_id WHERE a.partner_id=p.id AND o.payment_status='paid') AS paid_orders,
    (SELECT count(*) FROM school_subscription_attributions a JOIN subscriptions s ON s.id=a.subscription_id WHERE a.partner_id=p.id AND s.status='active') AS active_subscriptions,
    (SELECT COALESCE(sum(a.amount_cents),0) FROM charity_allocations a JOIN charity_transfers t ON t.id=a.transfer_id WHERE a.partner_id=p.id AND t.status='completed') AS donated_cents
    FROM school_partners p WHERE p.kind='influencer' ORDER BY p.name COLLATE NOCASE`),
  db().prepare('SELECT * FROM charity_transfers ORDER BY created_at DESC LIMIT 100'),
  db().prepare('SELECT a.* FROM charity_allocations a WHERE a.transfer_id IN (SELECT id FROM charity_transfers ORDER BY created_at DESC LIMIT 100)')
 ]);
 return {partners:result[0].results.map((p:any)=>({...partnerFromRow(p),paidOrders:p.paid_orders,activeSubscriptions:p.active_subscriptions,donatedCents:p.donated_cents})),transfers:result[1].results.map((t:any)=>({...t,payload:undefined,allocations:result[2].results.filter((a:any)=>a.transfer_id===t.id)})),billingConnected:false,donationsSource:'Owner-confirmed completed transfers',commissionPercent:0};
}
export async function influencerImpact(code:string){
 if(!validSchoolCode(code))throw new CommerceError('Community page not found.',404);
 // Paused pages retain their history; only draft pages are private.
 const p=await db().prepare("SELECT id,code,name,intro,status FROM school_partners WHERE code=? AND kind='influencer' AND status IN ('active','paused')").bind(code).first<any>();
 if(!p)throw new CommerceError('Community page not found.',404);
 const total=await db().prepare(impactSql).bind(p.id).first<any>();
 return {code:p.code,name:p.name,intro:p.intro,acceptingReferrals:p.status==='active',donatedCents:total.donated_cents,currency:'USD',lastDonationOn:total.last_donation_on,updatedAt:total.updated_at,recipient:'Mia’s Place',source:'Completed donations recorded by Sunnybunch',checkoutAvailable:false};
}
export async function recordCharityTransfer(input:unknown,actor:string,now=new Date()){
 const v=validateDonation(input,now),payload=JSON.stringify(v);
 const previous=await db().prepare('SELECT id,payload,status FROM charity_transfers WHERE id=?').bind(v.id).first<any>();
 if(previous){if(previous.payload!==payload)throw new CommerceError('This record ID belongs to a different donation.',409);return {id:v.id,status:previous.status,alreadyRecorded:true};}
 const reference=await db().prepare('SELECT id FROM charity_transfers WHERE reference=?').bind(v.reference).first();
 if(reference)throw new CommerceError('This donation reference is already recorded. Allocate a transfer only once.',409);
 for(const a of v.allocations){const partner=await db().prepare("SELECT id FROM school_partners WHERE id=? AND kind='influencer' AND status IN ('active','paused')").bind(a.partnerId).first();if(!partner)throw new CommerceError('Allocate only to an active or paused influencer community.',400);}
 const at=now.toISOString(),operation=crypto.randomUUID();
 // Guard every dependent statement by the unique audit operation generated for this attempt.
 // A conflicting INSERT with zero changed rows cannot create allocations or a phantom audit.
 const placeholders=v.allocations.map(()=>'?').join(',');
 const statements=[db().prepare(`INSERT INTO charity_transfers(id,reference,transferred_on,amount_cents,currency,recipient,payload,status,actor,created_at,operation) SELECT ?,?,?,?,'USD','Mia’s Place',?,'completed',?,?,? WHERE (SELECT count(*) FROM school_partners WHERE kind='influencer' AND status IN ('active','paused') AND id IN (${placeholders}))=? ON CONFLICT DO NOTHING`).bind(v.id,v.reference,v.transferredOn,v.amountCents,payload,actor,at,operation,...v.allocations.map((a:any)=>a.partnerId),v.allocations.length),
  db().prepare("INSERT INTO audit(id,actor,action,before_data,after_data,created_at) SELECT ?,?,'record_charity_transfer','null',?,? WHERE EXISTS(SELECT 1 FROM charity_transfers WHERE id=? AND operation=?)").bind(operation,actor,payload,at,v.id,operation)
 ];
 for(const a of v.allocations)statements.push(db().prepare('INSERT INTO charity_allocations(id,transfer_id,partner_id,amount_cents) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM audit WHERE id=?)').bind(`${v.id}:${a.partnerId}`,v.id,a.partnerId,a.amountCents,operation));
 const result=await db().batch(statements);
 if(!result[0].meta.changes){const stored=await db().prepare('SELECT payload,status FROM charity_transfers WHERE id=?').bind(v.id).first<any>();if(stored?.payload===payload)return {id:v.id,status:stored.status,alreadyRecorded:true};throw new CommerceError('This donation or reference was already recorded. Refresh before retrying.',409);}
 return {id:v.id,status:'completed',alreadyRecorded:false};
}
export async function reverseCharityTransfer(input:unknown,actor:string){
 const v=validateReversal(input),at=new Date().toISOString(),operation=`reverse-donation:${v.id}`;
 const transfer=await db().prepare('SELECT * FROM charity_transfers WHERE id=?').bind(v.id).first<any>();
 if(!transfer)throw new CommerceError('Donation record not found.',404);
 if(transfer.status==='reversed'){if(transfer.reversal_reason===v.reason)return {reversed:true,alreadyReversed:true};throw new CommerceError('This donation was already reversed with another reason.',409);}
 const result=await db().batch([
  db().prepare("UPDATE charity_transfers SET status='reversed',reversed_at=?,reversal_reason=? WHERE id=? AND status='completed'").bind(at,v.reason,v.id),
  db().prepare("INSERT OR IGNORE INTO audit(id,actor,action,before_data,after_data,created_at) SELECT ?,?,'reverse_charity_transfer',?,?,? WHERE EXISTS(SELECT 1 FROM charity_transfers WHERE id=? AND status='reversed' AND reversal_reason=? AND reversed_at=?)").bind(operation,actor,JSON.stringify({id:v.id,status:'completed'}),JSON.stringify({id:v.id,status:'reversed',reason:v.reason}),at,v.id,v.reason,at)
 ]);
 if(!result[0].meta.changes){const stored=await db().prepare('SELECT status,reversal_reason FROM charity_transfers WHERE id=?').bind(v.id).first<any>();if(stored?.status==='reversed'&&stored.reversal_reason===v.reason)return {reversed:true,alreadyReversed:true};throw new CommerceError('This donation changed. Refresh before retrying.',409);}
 return {reversed:true};
}
