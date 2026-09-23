import { db, snapshot } from './database';
import { CommerceError } from './commerce.mjs';
import { SCHOOL_POLICY, REFERRAL_SECONDS, validateSchoolPartner, validSchoolCode, hashReferral, publicSchool } from './school-policy.mjs';

const fromRow=(p:any)=>({id:p.id,code:p.code,name:p.name,program:p.program,contactEmail:p.contact_email,status:p.status,revision:p.revision,referralVisits:p.referral_visits,createdAt:p.created_at,updatedAt:p.updated_at});
export async function schoolReport(){
  const rows=await db().prepare(`SELECT p.*,
    (SELECT count(*) FROM school_order_attributions a JOIN orders o ON o.id=a.order_id WHERE a.partner_id=p.id AND o.payment_status='paid') AS paid_orders,
    (SELECT sum(o.total_cents) FROM school_order_attributions a JOIN orders o ON o.id=a.order_id WHERE a.partner_id=p.id AND o.payment_status='paid' AND o.currency='USD') AS gross_paid_cents,
    (SELECT count(*) FROM school_subscription_attributions a JOIN subscriptions s ON s.id=a.subscription_id WHERE a.partner_id=p.id AND s.status='active') AS active_subscriptions
    FROM school_partners p ORDER BY p.name COLLATE NOCASE`).all<any>();
  return {partners:rows.results.map(p=>({...fromRow(p),paidOrders:p.paid_orders,grossPaidCents:p.gross_paid_cents??0,activeSubscriptions:p.active_subscriptions,profitCents:null,donatedCents:null})),policy:SCHOOL_POLICY,windowDays:30,billingConnected:false,accountingConnected:false};
}
export async function saveSchoolPartner(input:unknown,actor:string){
  const value=validateSchoolPartner(input);
  if(!(await snapshot()).initialized)throw new CommerceError('Initialize your store first.',409);
  const existing=await db().prepare('SELECT * FROM school_partners WHERE id=?').bind(value.id).first<any>();
  const duplicate=await db().prepare('SELECT id FROM school_partners WHERE code=? AND id<>?').bind(value.code,value.id).first<any>();
  if(duplicate)throw new CommerceError('That district link code is already in use. Choose another.',409);
  if(existing&&existing.code!==value.code)throw new CommerceError('A district link code is permanent. Edit its name or program instead.',409);
  if(existing&&value.revision===0){
    const previous=fromRow(existing);
    if(['id','code','name','program','contactEmail','status'].every(k=>(previous as any)[k]===(value as any)[k]))return previous;
    throw new CommerceError('This district already exists. Refresh before editing it.',409);
  }
  if((existing?.revision??0)!==value.revision)throw new CommerceError('This district changed. Refresh and review your edits again.',409);
  const operation=crypto.randomUUID(),at=new Date().toISOString(),revision=value.revision+1;
  const write=existing?db().prepare('UPDATE school_partners SET name=?,program=?,contact_email=?,status=?,revision=?,last_operation=?,updated_at=? WHERE id=? AND revision=?').bind(value.name,value.program,value.contactEmail,value.status,revision,operation,at,value.id,value.revision)
    :db().prepare('INSERT INTO school_partners(id,code,name,program,contact_email,status,revision,last_operation,referral_visits,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,0,?,?) ON CONFLICT DO NOTHING').bind(value.id,value.code,value.name,value.program,value.contactEmail,value.status,operation,at,at);
  const result=await db().batch([write,db().prepare("INSERT INTO audit(id,actor,action,before_data,after_data,created_at) SELECT ?,?,'save_school_partner',?,?,? WHERE EXISTS(SELECT 1 FROM school_partners WHERE id=? AND last_operation=?)").bind(operation,actor,JSON.stringify(existing?fromRow(existing):null),JSON.stringify({...value,revision}),at,value.id,operation)]);
  if(!result[0].meta.changes)throw new CommerceError('The district or its link code changed. Refresh before retrying.',409);
  return fromRow(await db().prepare('SELECT * FROM school_partners WHERE id=?').bind(value.id).first());
}
export async function createSchoolReferral(code:string,now=new Date()){
  if(!validSchoolCode(code))throw new CommerceError('This school partner link is unavailable.',404);
  const partner=await db().prepare("SELECT * FROM school_partners WHERE code=? AND status='active'").bind(code).first<any>();
  if(!partner)throw new CommerceError('This school partner link is unavailable.',404);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const hash=await hashReferral(token),at=now.toISOString(),expires=new Date(now.getTime()+REFERRAL_SECONDS*1000).toISOString();
  const result=await db().batch([
    db().prepare("INSERT INTO school_referrals(token_hash,partner_id,policy,created_at,expires_at) SELECT ?,id,?,?,? FROM school_partners WHERE id=? AND status='active'").bind(hash,SCHOOL_POLICY,at,expires,partner.id),
    db().prepare('UPDATE school_partners SET referral_visits=referral_visits+1 WHERE id=? AND EXISTS(SELECT 1 FROM school_referrals WHERE token_hash=?)').bind(partner.id,hash),
    db().prepare('DELETE FROM school_referrals WHERE token_hash IN (SELECT token_hash FROM school_referrals WHERE expires_at<=? ORDER BY expires_at LIMIT 100)').bind(at)
  ]);
  if(!result[0].meta.changes)throw new CommerceError('This school partner link is unavailable.',404);
  return {token,school:publicSchool(partner),expiresAt:expires};
}
export async function resolveSchoolReferral(token:string|null,now=new Date()){
  const hash=await hashReferral(token);if(!hash)return null;
  return db().prepare(`SELECT p.id,p.code,p.name,p.program,r.token_hash,r.policy,r.expires_at FROM school_referrals r JOIN school_partners p ON p.id=r.partner_id
    WHERE r.token_hash=? AND r.expires_at>? AND r.created_at<=? AND p.status='active'`).bind(hash,now.toISOString(),now.toISOString()).first<any>();
}
export async function clearSchoolReferral(token:string|null){const hash=await hashReferral(token);if(hash)await db().prepare('DELETE FROM school_referrals WHERE token_hash=?').bind(hash).run();}

// Internal payment-integration boundary. Never expose these functions to public or admin mutation routes.
// Invoke subscription locking at creation and paid-order locking in the verified provider event workflow.
// Even an unattributed subscription gets a row, preventing a later referral from claiming its renewals.
export async function lockSchoolSubscription(subscriptionId:string,token:string|null,now=new Date()){
  const existing=await db().prepare('SELECT * FROM school_subscription_attributions WHERE subscription_id=?').bind(subscriptionId).first();if(existing)return existing;
  if(!await db().prepare('SELECT id FROM subscriptions WHERE id=?').bind(subscriptionId).first())throw new CommerceError('Subscription not found.',404);
  const school=await resolveSchoolReferral(token,now);
  await db().prepare('INSERT INTO school_subscription_attributions(subscription_id,partner_id,district_name,program_name,referral_hash,policy,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(subscription_id) DO NOTHING').bind(subscriptionId,school?.id??null,school?.name??null,school?.program??null,school?.token_hash??null,SCHOOL_POLICY,now.toISOString()).run();
  return db().prepare('SELECT * FROM school_subscription_attributions WHERE subscription_id=?').bind(subscriptionId).first<any>();
}
export async function lockSchoolOrder(orderId:string,token:string|null,subscriptionId:string|null=null,now=new Date()){
  const existing=await db().prepare('SELECT * FROM school_order_attributions WHERE order_id=?').bind(orderId).first();if(existing)return existing;
  const order=await db().prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first<any>();
  if(!order||order.payment_status!=='paid'||!order.provider_payment_id)throw new CommerceError('A verified paid order is required.',409);
  let school:any;
  if(subscriptionId){
    const sub=await db().prepare('SELECT * FROM subscriptions WHERE id=?').bind(subscriptionId).first<any>();
    if(!sub||!sub.provider_subscription_id||sub.provider_subscription_id!==order.provider_subscription_id||sub.customer_email!==order.customer_email)throw new CommerceError('Order and subscription do not match.',409);
    school=await db().prepare('SELECT * FROM school_subscription_attributions WHERE subscription_id=?').bind(subscriptionId).first<any>();
    if(!school)throw new CommerceError('Lock the original subscription attribution before processing its order.',409);
  }else{if(order.provider_subscription_id)throw new CommerceError('This order requires its original subscription attribution.',409);const referral=await resolveSchoolReferral(token,now);school=referral?{partner_id:referral.id,district_name:referral.name,program_name:referral.program,referral_hash:referral.token_hash}:null;}
  await db().prepare('INSERT INTO school_order_attributions(order_id,partner_id,subscription_id,district_name,program_name,referral_hash,policy,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO NOTHING').bind(orderId,school?.partner_id??null,subscriptionId,school?.district_name??null,school?.program_name??null,school?.referral_hash??null,school?.policy??SCHOOL_POLICY,now.toISOString()).run();
  return db().prepare('SELECT * FROM school_order_attributions WHERE order_id=?').bind(orderId).first<any>();
}
