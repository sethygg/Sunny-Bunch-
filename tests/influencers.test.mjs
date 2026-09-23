import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { validateDonation, validateInfluencer } from '../lib/influencer-policy.mjs';
import { influencerPage, influencerBanner } from '../lib/influencer-pages.mjs';
mkdirSync('.sites-runtime',{recursive:true});
globalThis.__influencerTestEnv={};
await build({stdin:{contents:"export * from './lib/influencers.ts';export * from './lib/schools.ts';",resolveDir:process.cwd()},outfile:'.sites-runtime/test-influencers.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-cloudflare',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__influencerTestEnv;'}));}}]});
const repo=await import('../.sites-runtime/test-influencers.mjs');
class D1 {
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec('PRAGMA foreign_keys=ON');for(const entry of JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries)this.sqlite.exec(readFileSync(`drizzle/${entry.tag}.sql`,'utf8'));this.failOn=null;this.beforeBatch=null;}
 prepare(sql){const database=this;return {args:[],sql,bind(...args){this.args=args;return this;},execute(){if(database.failOn&&sql.includes(database.failOn))throw new Error('Simulated failure');const st=database.sqlite.prepare(sql);if(st.columns().length)return {results:st.all(...this.args),meta:{changes:0}};return {results:[],meta:{changes:Number(st.run(...this.args).changes)}};},async run(){return this.execute();},async all(){return this.execute();},async first(){return this.execute().results[0]??null;}};}
 async batch(statements){if(this.beforeBatch){const fn=this.beforeBatch;this.beforeBatch=null;fn();}this.sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return result;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
}
function setup(){const db=new D1();globalThis.__influencerTestEnv.DB=db;db.sqlite.exec("INSERT INTO shop VALUES('main',1,'test','{}','2026-09-22')");return db;}
const now=new Date('2026-09-22T12:00:00.000Z');
const creator=(code='creator-a')=>({id:crypto.randomUUID(),code,name:'Creator '+code,intro:'A community coming together for opportunity.',contactEmail:'private@example.com',status:'active',revision:0});
const school=()=>({id:crypto.randomUUID(),code:'school-a',name:'School A',program:'Special education',contactEmail:'school@example.com',status:'active',revision:0});
const donation=(p,overrides={})=>({id:crypto.randomUUID(),reference:'receipt-'+crypto.randomUUID(),transferredOn:'2026-09-21',amountCents:10000,allocations:[{partnerId:p.id,amountCents:7000}],confirmed:true,...overrides});
const edit=p=>({id:p.id,code:p.code,name:p.name,intro:p.intro,contactEmail:p.contactEmail,status:p.status,revision:p.revision});
function order(db,id,sub=null){db.sqlite.prepare('INSERT INTO orders(id,provider_payment_id,provider_subscription_id,customer_email,total_cents,currency,payment_status,fulfillment_status,items,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'payment-'+id,sub?'provider-'+sub:null,'customer@example.com',3000,'USD','paid','unfulfilled','[]',now.toISOString());}
test('school and creator records are isolated but share one order and subscription attribution',async()=>{
 const db=setup(),a=await repo.saveInfluencer(creator(),'owner'),s=await repo.saveSchoolPartner(school(),'owner');
 assert.equal((await repo.influencerReport()).partners.length,1);assert.equal((await repo.schoolReport()).partners.length,1);
 await assert.rejects(repo.createPartnerReferral(s.code,'influencer',now));await assert.rejects(repo.createSchoolReferral(a.code,now));
 await assert.rejects(repo.saveSchoolPartner({...school(),id:a.id,code:a.code,revision:1},'owner'),/different partner program/);
 await assert.rejects(repo.saveInfluencer({...creator(),id:s.id,code:s.code,revision:1},'owner'),/different partner program/);
 const schoolRef=await repo.createSchoolReferral(s.code,now),creatorRef=await repo.createPartnerReferral(a.code,'influencer',now);
 order(db,'order-1');assert.equal((await repo.lockSchoolOrder('order-1',creatorRef.token,null,now)).partner_id,a.id);assert.equal((await repo.lockSchoolOrder('order-1',schoolRef.token,null,now)).partner_id,a.id);
 order(db,'order-2');assert.equal((await repo.lockSchoolOrder('order-2',schoolRef.token,null,now)).partner_id,s.id);
 db.sqlite.prepare('INSERT INTO subscriptions(id,provider_subscription_id,customer_email,status,items,created_at) VALUES(?,?,?,?,?,?)').run('sub','provider-sub','customer@example.com','active','[]',now.toISOString());
 await repo.lockSchoolSubscription('sub',creatorRef.token,now);await repo.saveInfluencer({...edit(a),status:'paused'},'owner');order(db,'renewal','sub');
 assert.equal((await repo.lockSchoolOrder('renewal',schoolRef.token,'sub',new Date(now.getTime()+60*86400000))).partner_id,a.id);
 const publicPaused=await repo.influencerImpact(a.code);assert.equal(publicPaused.acceptingReferrals,false);await assert.rejects(repo.createPartnerReferral(a.code,'influencer',now));
});
test('donation validation rejects false confirmation, invalid cents/dates, duplicate or excessive allocations',()=>{
 const p=creator();
 for(const patch of [{confirmed:false},{amountCents:0},{amountCents:1.5},{transferredOn:'2026-09-23'},{transferredOn:'2026-02-30'},{allocations:[{partnerId:p.id,amountCents:10001}]},{allocations:[{partnerId:p.id,amountCents:1},{partnerId:p.id,amountCents:1}]},{allocations:[]},{unknown:true}])assert.throws(()=>validateDonation(donation(p,patch),now));
 assert.equal(validateDonation(donation(p,{reference:'  BANK   Ref 123  '}),now).reference,'bank ref 123');
 assert.throws(()=>validateInfluencer({...creator(),donatedCents:1000}));const upper=creator();upper.id=upper.id.toUpperCase();assert.equal(validateDonation(donation(upper),now).allocations[0].partnerId,validateInfluencer(upper).id);
});
test('completed allocations update exact public totals; private financial and contact fields never appear',async()=>{
 setup();const a=await repo.saveInfluencer(creator(),'owner'),b=await repo.saveInfluencer(creator('creator-b'),'owner'),s=await repo.saveSchoolPartner(school(),'owner');
 assert.equal((await repo.influencerImpact(a.code)).donatedCents,0);
 const v=donation(a,{allocations:[{partnerId:a.id,amountCents:7000},{partnerId:b.id,amountCents:2000}]});await repo.recordCharityTransfer(v,'owner',now);
 assert.equal((await repo.influencerImpact(a.code)).donatedCents,7000);assert.equal((await repo.influencerImpact(b.code)).donatedCents,2000);
 const impact=await repo.influencerImpact(a.code),encoded=JSON.stringify(impact);for(const secret of [a.id,'private@example.com',v.reference,'allocations','customer_email'])assert.ok(!encoded.includes(secret));
 assert.equal(impact.lastDonationOn,'2026-09-21');assert.equal(impact.checkoutAvailable,false);await assert.rejects(repo.influencerImpact(s.code));
 await assert.rejects(repo.recordCharityTransfer(donation(s),'owner',now),/only to an active or paused influencer/);
 const draft=await repo.saveInfluencer({...creator('draft-creator'),status:'draft'},'owner');await assert.rejects(repo.influencerImpact(draft.code));await assert.rejects(repo.recordCharityTransfer(donation(draft),'owner',now));
 const html=influencerPage({...impact,name:'<script>alert(1)</script>',intro:'<img src=x>'});assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('<img src=x>'));assert.ok(html.includes('?refresh='));assert.ok(!influencerBanner({...impact,name:'<img src=x>'}).includes('<img src=x>'));
});
test('duplicate transfer retries, references and concurrent writes cannot double public totals',async()=>{
 const db=setup(),p=await repo.saveInfluencer(creator(),'owner'),v=donation(p);
 const result=await Promise.allSettled([repo.recordCharityTransfer(v,'owner',now),repo.recordCharityTransfer(v,'owner',now)]);assert.ok(result.every(r=>r.status==='fulfilled'));
 assert.equal((await repo.influencerImpact(p.code)).donatedCents,7000);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM audit WHERE action='record_charity_transfer'").get().n,1);
 await assert.rejects(repo.recordCharityTransfer({...v,amountCents:10001},'owner',now),/different donation/);
 await assert.rejects(repo.recordCharityTransfer({...v,id:crypto.randomUUID(),reference:v.reference.toUpperCase()},'owner',now),/already recorded/);
 const v2=donation(p);const sameReference=await Promise.allSettled([repo.recordCharityTransfer(v2,'owner',now),repo.recordCharityTransfer({...v2,id:crypto.randomUUID()},'owner',now)]);assert.equal(sameReference.filter(r=>r.status==='fulfilled').length,1);assert.equal((await repo.influencerImpact(p.code)).donatedCents,14000);
});
test('failed allocation/audit and eligibility races leave no partial donation record',async()=>{
 const db=setup(),p=await repo.saveInfluencer(creator(),'owner');
 for(const fragment of ['INSERT INTO charity_allocations','INSERT INTO audit']){db.failOn=fragment;await assert.rejects(repo.recordCharityTransfer(donation(p),'owner',now));db.failOn=null;assert.equal(db.sqlite.prepare('SELECT count(*) n FROM charity_transfers').get().n,0);assert.equal((await repo.influencerImpact(p.code)).donatedCents,0);}
 db.beforeBatch=()=>db.sqlite.prepare("UPDATE school_partners SET status='draft' WHERE id=?").run(p.id);
 await assert.rejects(repo.recordCharityTransfer(donation(p),'owner',now));assert.equal(db.sqlite.prepare('SELECT count(*) n FROM charity_transfers').get().n,0);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM audit WHERE action='record_charity_transfer'").get().n,0);
});
test('reversals preserve records, correct totals exactly once, and cannot be resurrected by retries',async()=>{
 const db=setup(),p=await repo.saveInfluencer(creator(),'owner'),v=donation(p);await repo.recordCharityTransfer(v,'owner',now);
 const reversal={id:v.id,reason:'Allocation was entered incorrectly'};const results=await Promise.allSettled([repo.reverseCharityTransfer(reversal,'owner'),repo.reverseCharityTransfer(reversal,'owner')]);assert.ok(results.every(r=>r.status==='fulfilled'));
 assert.equal((await repo.influencerImpact(p.code)).donatedCents,0);assert.ok((await repo.influencerImpact(p.code)).updatedAt);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM charity_transfers').get().n,1);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM charity_allocations').get().n,1);assert.equal(db.sqlite.prepare("SELECT count(*) n FROM audit WHERE action='reverse_charity_transfer'").get().n,1);
 assert.equal((await repo.recordCharityTransfer(v,'owner',now)).status,'reversed');assert.equal((await repo.influencerImpact(p.code)).donatedCents,0);await assert.rejects(repo.reverseCharityTransfer({...reversal,reason:'Different reason'},'owner'));
});
