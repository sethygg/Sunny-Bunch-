import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { validateSchoolPartner, referralToken, referralCookie, publicSchool } from '../lib/school-policy.mjs';
import { schoolPage, schoolBanner } from '../lib/school-pages.mjs';
mkdirSync('.sites-runtime',{recursive:true});
globalThis.__schoolTestEnv={};
await build({entryPoints:['lib/schools.ts'],outfile:'.sites-runtime/test-schools.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-cloudflare',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__schoolTestEnv;'}));}}]});
const repo=await import('../.sites-runtime/test-schools.mjs');
class D1 {
 constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec('PRAGMA foreign_keys=ON');for(const entry of JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries)this.sqlite.exec(readFileSync(`drizzle/${entry.tag}.sql`,'utf8'));this.failOn=null;}
 prepare(sql){const database=this;return {args:[],sql,bind(...args){this.args=args;return this;},execute(){if(database.failOn&&sql.includes(database.failOn))throw new Error('Simulated failure');const st=database.sqlite.prepare(sql);if(st.columns().length)return {results:st.all(...this.args),meta:{changes:0}};return {results:[],meta:{changes:Number(st.run(...this.args).changes)}};},async run(){return this.execute();},async all(){return this.execute();},async first(){return this.execute().results[0]??null;}};}
 async batch(statements){this.sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return result;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
}
const district=(code='test-district')=>({id:crypto.randomUUID(),code,name:'Test district',program:'Special education program',contactEmail:'contact@example.com',status:'active',revision:0});
const edit=p=>({id:p.id,code:p.code,name:p.name,program:p.program,contactEmail:p.contactEmail,status:p.status,revision:p.revision});
const now=new Date('2026-09-22T12:00:00.000Z');
function setup(){const db=new D1();globalThis.__schoolTestEnv.DB=db;db.sqlite.exec("INSERT INTO shop VALUES('main',1,'test','{}','2026-09-22')");return db;}
function sub(db,id){db.sqlite.prepare('INSERT INTO subscriptions(id,provider_subscription_id,customer_email,status,items,created_at) VALUES(?,?,?,?,?,?)').run(id,'provider-'+id,'family@example.com','active','[]',now.toISOString());}
function order(db,id,status='paid',subscriptionId=null){db.sqlite.prepare('INSERT INTO orders(id,provider_payment_id,provider_subscription_id,customer_email,total_cents,currency,payment_status,fulfillment_status,items,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,'payment-'+id,subscriptionId?'provider-'+subscriptionId:null,'family@example.com',3000,'USD',status,'unfulfilled','[]',now.toISOString());}
test('district creation is idempotent, link codes permanent, duplicates rejected, writes audited atomically',async()=>{
 const db=setup(),input=district();const p=await repo.saveSchoolPartner(input,'owner');assert.equal(p.revision,1);assert.equal((await repo.saveSchoolPartner(input,'owner')).id,p.id);
 await assert.rejects(repo.saveSchoolPartner({...district(),id:crypto.randomUUID()},'owner'),/already in use/);
 await assert.rejects(repo.saveSchoolPartner({...edit(p),code:'another-code'},'owner'),/permanent/);
 const results=await Promise.allSettled([repo.saveSchoolPartner({...edit(p),name:'First'},'owner'),repo.saveSchoolPartner({...edit(p),name:'Second'},'owner')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM audit').get().n,2);
 db.failOn='INSERT INTO audit';await assert.rejects(repo.saveSchoolPartner(district('rollback-district'),'owner'));assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM school_partners WHERE code='rollback-district'").get().n,0);
 assert.throws(()=>validateSchoolPartner({...district(),profitCents:1000}));
});
test('opaque tokens use exact 30-day expiry; invalid or modified tokens cannot choose a district',async()=>{
 const db=setup();const p=await repo.saveSchoolPartner(district(),'owner');const ref=await repo.createSchoolReferral(p.code,now);assert.equal(ref.token.length,64);
 assert.equal((await repo.resolveSchoolReferral(ref.token,now)).id,p.id);
 assert.equal(await repo.resolveSchoolReferral('0'.repeat(64),now),null);
 assert.equal(await repo.resolveSchoolReferral(ref.token,new Date(now.getTime()-1)),null);
 assert.ok(await repo.resolveSchoolReferral(ref.token,new Date(now.getTime()+30*86400000-1)));
 assert.equal(await repo.resolveSchoolReferral(ref.token,new Date(now.getTime()+30*86400000)),null);
 assert.notEqual(db.sqlite.prepare('SELECT token_hash FROM school_referrals').get().token_hash,ref.token);
 const req=new Request('https://shop.example',{headers:{cookie:`sunnybunch_school=${ref.token}`}});assert.equal(referralToken(req),ref.token);
 const cookie=referralCookie(ref.token,req);for(const rule of ['HttpOnly','Secure','SameSite=Lax','Max-Age=2592000'])assert.ok(cookie.includes(rule));
 assert.equal(referralToken(new Request('https://shop.example',{headers:{cookie:`sunnybunch_school=${ref.token}; sunnybunch_school=${ref.token}`}})),null);
 assert.deepEqual(Object.keys(publicSchool({...p,contact_email:'secret'})),['code','name','program']);
});
test('last active link selects future orders; expired and paused links never claim new orders',async()=>{
 const db=setup();const a=await repo.saveSchoolPartner(district('district-a'),'owner'),b=await repo.saveSchoolPartner(district('district-b'),'owner');
 const one=await repo.createSchoolReferral(a.code,now),two=await repo.createSchoolReferral(b.code,now);
 order(db,'order-1');const record=await repo.lockSchoolOrder('order-1',two.token,null,now);assert.equal(record.partner_id,b.id);
 assert.equal((await repo.lockSchoolOrder('order-1',one.token,null,now)).partner_id,b.id);
 await assert.rejects(repo.createSchoolReferral('missing-district',now),/unavailable/);assert.equal((await repo.resolveSchoolReferral(two.token,now)).id,b.id);
 await repo.saveSchoolPartner({...edit(b),status:'paused'},'owner');assert.equal(await repo.resolveSchoolReferral(two.token,now),null);await assert.rejects(repo.createSchoolReferral(b.code,now));
 order(db,'order-2');assert.equal((await repo.lockSchoolOrder('order-2',two.token,null,now)).partner_id,null);
 order(db,'order-3');assert.equal((await repo.lockSchoolOrder('order-3',one.token,null,new Date(now.getTime()+31*86400000))).partner_id,null);
 order(db,'unpaid','pending');await assert.rejects(repo.lockSchoolOrder('unpaid',one.token,null,now),/verified paid order/);
});
test('subscription renewals keep original district despite later click, rename, pause and cookie expiry',async()=>{
 const db=setup(),a=await repo.saveSchoolPartner(district('district-a'),'owner'),b=await repo.saveSchoolPartner(district('district-b'),'owner');
 const one=await repo.createSchoolReferral(a.code,now),two=await repo.createSchoolReferral(b.code,now);sub(db,'sub-1');
 await repo.lockSchoolSubscription('sub-1',one.token,now);db.sqlite.prepare('UPDATE school_subscription_attributions SET policy=? WHERE subscription_id=?').run('original-policy','sub-1');await repo.lockSchoolSubscription('sub-1',two.token,now);
 await repo.saveSchoolPartner({...edit(a),name:'Renamed district',status:'paused'},'owner');order(db,'renewal-1','paid','sub-1');
 const renewal=await repo.lockSchoolOrder('renewal-1',two.token,'sub-1',new Date(now.getTime()+60*86400000));assert.equal(renewal.partner_id,a.id);assert.equal(renewal.policy,'original-policy');assert.equal(renewal.district_name,'Test district');
 await repo.lockSchoolOrder('renewal-1',null,'sub-1',now);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM school_order_attributions').get().n,1);
 sub(db,'sub-none');await repo.lockSchoolSubscription('sub-none',null,now);order(db,'renewal-none','paid','sub-none');assert.equal((await repo.lockSchoolOrder('renewal-none',two.token,'sub-none',now)).partner_id,null);
 order(db,'wrong-sub','paid','sub-none');await assert.rejects(repo.lockSchoolOrder('wrong-sub',two.token,'sub-1',now),/do not match/);await assert.rejects(repo.lockSchoolOrder('wrong-sub',two.token,null,now),/requires its original subscription/);
 sub(db,'sub-unlocked');order(db,'renewal-unlocked','paid','sub-unlocked');await assert.rejects(repo.lockSchoolOrder('renewal-unlocked',two.token,'sub-unlocked',now),/original subscription attribution/);
});
test('reports aggregate real records, keep missing profit/donation data pending, and removal revokes referral',async()=>{
 const db=setup(),p=await repo.saveSchoolPartner(district(),'owner'),ref=await repo.createSchoolReferral(p.code,now);order(db,'sale');await repo.lockSchoolOrder('sale',ref.token,null,now);
 const report=await repo.schoolReport(),row=report.partners[0];assert.equal(row.referralVisits,1);assert.equal(row.paidOrders,1);assert.equal(row.grossPaidCents,3000);assert.equal(row.profitCents,null);assert.equal(row.donatedCents,null);assert.equal(report.billingConnected,false);
 await repo.clearSchoolReferral(ref.token);assert.equal(await repo.resolveSchoolReferral(ref.token,now),null);assert.equal((await repo.schoolReport()).partners[0].referralVisits,1);
 const malicious={name:'<script>alert(1)</script>',program:'<img src=x onerror=1>'};assert.ok(!schoolPage(malicious).includes('<script>alert'));assert.ok(!schoolBanner(malicious).includes('<img src=x'));
});
