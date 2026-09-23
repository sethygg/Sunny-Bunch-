import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { DEFAULT_PRODUCTS, DEFAULT_CONTENT, validateProposal, applyChanges, isOwner, validateOrigin, publicCatalog } from '../lib/commerce.mjs';
import { renderStorefront } from '../lib/render-storefront.mjs';
mkdirSync('.sites-runtime',{recursive:true});
await build({entryPoints:['lib/database.ts'],outfile:'.sites-runtime/test-database.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-cloudflare',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__sunnybunchTestEnv;'}));}}]});
globalThis.__sunnybunchTestEnv={};
const repo=await import('../.sites-runtime/test-database.mjs');
class D1 {
  constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(readFileSync('drizzle/0000_sloppy_killraven.sql','utf8'));this.failOn=null;}
  prepare(sql){const database=this;return {args:[],sql,bind(...args){this.args=args;return this;},execute(){if(database.failOn&&sql.includes(database.failOn))throw new Error('Simulated write failure');const st=database.sqlite.prepare(sql);if(st.columns().length)return {results:st.all(...this.args),meta:{changes:0}};return {results:[],meta:{changes:Number(st.run(...this.args).changes)}};},async run(){return this.execute();},async all(){return this.execute();},async first(){return this.execute().results[0]??null;}};}
  async batch(statements){this.sqlite.exec('BEGIN');try{const results=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return results;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
}
function reset(){const db=new D1();globalThis.__sunnybunchTestEnv.DB=db;return db;}
const proposal=(revision,changes)=>({id:crypto.randomUUID(),baseRevision:revision,source:'owner',summary:'Test update',changes});
const base=()=>({revision:1,products:structuredClone(DEFAULT_PRODUCTS),content:{...DEFAULT_CONTENT}});

test('owner authorization fails closed for missing config and other signed-in users',()=>{
 assert.equal(isOwner(null,'owner@example.com'),false);
 assert.equal(isOwner({userId:'id',email:'owner@example.com'},undefined),false);
 assert.equal(isOwner({userId:'stranger',email:'other@example.com'},'owner@example.com'),false);
 assert.equal(isOwner({userId:'owner',email:'OWNER@example.com'},'owner@example.com'),true);
 assert.throws(()=>validateOrigin(new Request('https://shop.example/api/admin/proposals',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'}})));
 assert.throws(()=>validateOrigin(new Request('https://shop.example/api/admin/proposals',{method:'POST'})));
});
test('catalog initialization is idempotent, without fabricated stock, orders or subscriptions',async()=>{
 reset();await repo.initialize('owner');await repo.initialize('owner');const s=await repo.adminSnapshot();assert.equal(s.products.length,2);assert.equal(s.revision,1);assert.ok(s.products.every(p=>p.stock===null));assert.equal(s.audit.length,1);assert.equal(s.orders.length,0);assert.equal(s.subscriptions.length,0);assert.equal(s.billing.connected,false);
});
test('applying a proposal updates data, stock history and audit atomically and once',async()=>{
 reset();await repo.initialize('owner');const p=proposal(1,[{type:'update_product',id:'raspberry',patch:{priceCents:3200}},{type:'set_inventory',id:'raspberry',quantity:40,reason:'Opening count'}]);await repo.stageProposal(p,'owner');await repo.applyProposal(p.id,'owner');await repo.applyProposal(p.id,'owner');const s=await repo.adminSnapshot();assert.equal(s.revision,2);assert.equal(s.products[0].priceCents,3200);assert.equal(s.products[0].stock,40);assert.equal(s.movements.length,1);assert.equal(s.audit.length,2);assert.equal(s.proposals[0].status,'applied');
});
test('simultaneous proposals from one revision have exactly one winner and no phantom audits',async()=>{
 reset();await repo.initialize('owner');const a=proposal(1,[{type:'set_inventory',id:'raspberry',quantity:10,reason:'Count A'}]);const b=proposal(1,[{type:'set_inventory',id:'raspberry',quantity:20,reason:'Count B'}]);await repo.stageProposal(a,'owner');await repo.stageProposal(b,'owner');const results=await Promise.allSettled([repo.applyProposal(a.id,'owner'),repo.applyProposal(b.id,'owner')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected')[0].reason.status,409);const s=await repo.adminSnapshot();assert.equal(s.revision,2);assert.equal(s.movements.length,1);assert.equal(s.audit.length,2);assert.equal(s.proposals.filter(p=>p.status==='applied').length,1);
});
test('retrying a proposal ID with different content is rejected',async()=>{
 reset();await repo.initialize('owner');const p=proposal(1,[{type:'set_inventory',id:'raspberry',quantity:10,reason:'Count'}]);await repo.stageProposal(p,'owner');await repo.stageProposal(p,'owner');await assert.rejects(()=>repo.stageProposal({...p,summary:'Other content'},'owner'),e=>e.status===409);assert.equal((await repo.adminSnapshot()).proposals.length,1);
});
test('a write failure rolls back catalog, ledger, audit and proposal state',async()=>{
 const db=reset();await repo.initialize('owner');const p=proposal(1,[{type:'set_inventory',id:'raspberry',quantity:5,reason:'Count'}]);await repo.stageProposal(p,'owner');db.failOn='INSERT INTO inventory_movements';await assert.rejects(()=>repo.applyProposal(p.id,'owner'));db.failOn=null;const s=await repo.adminSnapshot();assert.equal(s.revision,1);assert.equal(s.products[0].stock,null);assert.equal(s.audit.length,1);assert.equal(s.movements.length,0);assert.equal(s.proposals[0].status,'pending');
});
test('invalid prices, unknown fields and inventory underflow cannot become proposals',()=>{
 for(const change of [{type:'update_product',id:'raspberry',patch:{priceCents:30.5}},{type:'update_product',id:'raspberry',patch:{secret:'x'}},{type:'set_inventory',id:'raspberry',quantity:-1,reason:'bad'},{type:'delete_orders',id:'all'}])assert.throws(()=>validateProposal(proposal(1,[change])));
 assert.throws(()=>applyChanges(base(),[{type:'adjust_inventory',id:'raspberry',delta:5,reason:'Not initialized'}]));
 const state=base();state.products[0].stock=2;assert.throws(()=>applyChanges(state,[{type:'adjust_inventory',id:'raspberry',delta:-3,reason:'Underflow'}]));assert.equal(state.products[0].stock,2);
});
test('rejecting an already processed proposal cannot alter the store or duplicate its audit',async()=>{
 reset();await repo.initialize('owner');const p=proposal(1,[{type:'update_product',id:'raspberry',patch:{name:'New name'}}]);await repo.stageProposal(p,'owner');await repo.rejectProposal(p.id,'owner');await assert.rejects(()=>repo.rejectProposal(p.id,'owner'));const s=await repo.adminSnapshot();assert.equal(s.audit.length,2);assert.equal(s.products[0].name,'Natural Raspberry');assert.equal(s.revision,1);
});
test('public catalog excludes private data and unpublished products; HTML escapes editable text',()=>{
 const state=base();state.products[0].published=false;state.products[1].priceCents=3500;state.products[1].name='<script>alert(1)</script>';state.content.missionLead='<img src=x onerror=alert(1)>';state.audit=[{secret:'private'}];const catalog=publicCatalog(state);assert.equal(catalog.products.length,1);assert.equal(catalog.audit,undefined);assert.equal(catalog.checkoutAvailable,false);const html=renderStorefront(readFileSync('content/storefront.html','utf8'),state);assert.ok(!html.includes('id="raspberry"'));assert.ok(html.includes('data-price="tropical">$35.00'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});
