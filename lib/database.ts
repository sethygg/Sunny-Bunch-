import { env } from 'cloudflare:workers';
import { DEFAULT_PRODUCTS, DEFAULT_CONTENT, CommerceError, applyChanges, validateProposal } from './commerce.mjs';
import { LEGACY_MISSION_CONTENT, MISSION_RELEASE_CUTOFF, MISSION_RELEASE_ID } from './mission-copy.mjs';
export function runtime(){return env as unknown as {DB?:D1Database;ADMIN_OWNER_EMAIL?:string};}
export function db(){const binding=runtime().DB;if(!binding)throw new CommerceError('Store data is temporarily unavailable. Please try again.',503);return binding;}
const productFromRow=(p:any)=>({id:p.id,name:p.name,description:p.description,image:p.image,priceCents:p.price_cents,subscriptionPriceCents:p.subscription_price_cents,published:!!p.published,stock:p.stock});
export async function snapshot(allowMissionUpdate=true):Promise<any>{
  const results=await db().batch([db().prepare("SELECT * FROM shop WHERE id='main'"),db().prepare('SELECT * FROM products ORDER BY id')]);
  const row=results[0].results[0] as any;
  if(!row)return {initialized:false,revision:0,products:structuredClone(DEFAULT_PRODUCTS),content:{...DEFAULT_CONTENT}};
  if(allowMissionUpdate&&row.updated_at<=MISSION_RELEASE_CUTOFF){
    const before=JSON.parse(row.content),content={...before};
    for(const [key,legacy] of Object.entries(LEGACY_MISSION_CONTENT))if(content[key]===legacy)content[key]=(DEFAULT_CONTENT as any)[key];
    if(JSON.stringify(before)!==JSON.stringify(content)&&!await db().prepare('SELECT id FROM audit WHERE id=?').bind(MISSION_RELEASE_ID).first()){
      const operation=crypto.randomUUID(),at=new Date().toISOString();
      await db().batch([
        db().prepare("UPDATE shop SET content=?,revision=revision+1,last_operation=?,updated_at=? WHERE id='main' AND revision=? AND content=? AND updated_at<=? AND NOT EXISTS(SELECT 1 FROM audit WHERE id=?)").bind(JSON.stringify(content),operation,at,row.revision,row.content,MISSION_RELEASE_CUTOFF,MISSION_RELEASE_ID),
        db().prepare("INSERT INTO audit(id,actor,action,before_data,after_data,created_at) SELECT ?,'site_release','broaden_mias_place_mission',?,?,? WHERE EXISTS(SELECT 1 FROM shop WHERE id='main' AND last_operation=?)").bind(MISSION_RELEASE_ID,JSON.stringify({content:before,revision:row.revision}),JSON.stringify({content,revision:row.revision+1}),at,operation)
      ]);
      return snapshot(false);
    }
  }
  return {initialized:true,revision:row.revision,products:results[1].results.map(productFromRow),content:JSON.parse(row.content)};
}
export async function initialize(actor:string){
  const operation=crypto.randomUUID(),at=new Date().toISOString();
  const statements=[db().prepare("INSERT INTO shop(id,revision,last_operation,content,updated_at) VALUES('main',1,?,?,?) ON CONFLICT(id) DO NOTHING").bind(operation,JSON.stringify(DEFAULT_CONTENT),at)];
  for(const p of DEFAULT_PRODUCTS)statements.push(db().prepare("INSERT INTO products(id,name,description,image,price_cents,subscription_price_cents,published,stock,updated_at) SELECT ?,?,?,?,?,?,1,NULL,? WHERE EXISTS(SELECT 1 FROM shop WHERE id='main' AND last_operation=?)").bind(p.id,p.name,p.description,p.image,p.priceCents,p.subscriptionPriceCents,at,operation));
  statements.push(db().prepare("INSERT INTO audit(id,actor,action,before_data,after_data,created_at) SELECT ?,?,'initialize','{}',?,? WHERE EXISTS(SELECT 1 FROM shop WHERE id='main' AND last_operation=?)").bind(operation,actor,JSON.stringify({products:DEFAULT_PRODUCTS,content:DEFAULT_CONTENT}),at,operation));
  await db().batch(statements);return snapshot();
}
export async function adminSnapshot(){
  const state=await snapshot();
  const results=await db().batch([
    db().prepare('SELECT * FROM proposals ORDER BY created_at DESC LIMIT 50'),
    db().prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100'),
    db().prepare('SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT 100'),
    db().prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100'),
    db().prepare('SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 100')
  ]);
  return {...state,proposals:results[0].results.map((p:any)=>({...p,changes:JSON.parse(p.changes)})),audit:results[1].results.map((p:any)=>({...p,before:JSON.parse(p.before_data),after:JSON.parse(p.after_data),before_data:undefined,after_data:undefined})),movements:results[2].results,orders:results[3].results,subscriptions:results[4].results,billing:{connected:false,checkoutAvailable:false,provider:'Not connected'}};
}
export async function stageProposal(input:unknown,actor:string){
  const value=validateProposal(input);const state=await snapshot();
  if(!state.initialized)throw new CommerceError('Initialize your store first.',409);
  if(state.revision!==value.baseRevision)throw new CommerceError('The store changed. Refresh and review your proposal again.',409);
  applyChanges(state,value.changes);
  const previous=await db().prepare('SELECT * FROM proposals WHERE id=?').bind(value.id).first<any>();
  if(previous){if(previous.changes!==JSON.stringify(value.changes)||previous.base_revision!==value.baseRevision||previous.summary!==value.summary||previous.source!==value.source||previous.actor!==actor)throw new CommerceError('This operation ID belongs to another change.',409);return previous;}
  await db().prepare("INSERT INTO proposals(id,base_revision,changes,summary,source,status,actor,created_at) VALUES(?,?,?,?,?,'pending',?,?) ON CONFLICT(id) DO NOTHING").bind(value.id,value.baseRevision,JSON.stringify(value.changes),value.summary,value.source,actor,new Date().toISOString()).run();
  const stored=await db().prepare('SELECT * FROM proposals WHERE id=?').bind(value.id).first<any>();
  if(!stored||stored.changes!==JSON.stringify(value.changes)||stored.base_revision!==value.baseRevision||stored.actor!==actor||stored.summary!==value.summary||stored.source!==value.source)throw new CommerceError('This operation ID belongs to another change.',409);
  return stored;
}
export async function applyProposal(id:string,actor:string){
  const proposal=await db().prepare('SELECT * FROM proposals WHERE id=?').bind(id).first<any>();
  if(!proposal)throw new CommerceError('Proposal not found.',404);
  if(proposal.status==='applied')return {applied:true,alreadyApplied:true};
  if(proposal.status!=='pending')throw new CommerceError('This proposal is no longer pending.',409);
  const before=await snapshot();
  if(before.revision!==proposal.base_revision)throw new CommerceError('The store changed since this proposal. Create a fresh proposal before applying it.',409);
  const validated=validateProposal({id:proposal.id,baseRevision:proposal.base_revision,summary:proposal.summary,source:proposal.source,changes:JSON.parse(proposal.changes)});
  const {next,movements}=applyChanges(before,validated.changes);const revision=before.revision+1,at=new Date().toISOString(),operation=crypto.randomUUID();
  const guard="EXISTS(SELECT 1 FROM shop WHERE id='main' AND last_operation=? AND revision=?)";
  const statements=[db().prepare("UPDATE shop SET revision=revision+1,last_operation=?,content=?,updated_at=? WHERE id='main' AND revision=? AND EXISTS(SELECT 1 FROM proposals WHERE id=? AND status='pending')").bind(operation,JSON.stringify(next.content),at,before.revision,id)];
  for(const p of next.products)statements.push(db().prepare(`UPDATE products SET name=?,description=?,price_cents=?,subscription_price_cents=?,published=?,stock=?,updated_at=? WHERE id=? AND ${guard}`).bind(p.name,p.description,p.priceCents,p.subscriptionPriceCents,p.published?1:0,p.stock,at,p.id,operation,revision));
  movements.forEach((m:any,i:number)=>statements.push(db().prepare(`INSERT INTO inventory_movements(id,proposal_id,product_id,before_quantity,after_quantity,reason,actor,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`).bind(`${id}:${i}`,id,m.productId,m.before,m.after,m.reason,actor,at,operation,revision)));
  statements.push(db().prepare(`INSERT INTO audit(id,actor,action,before_data,after_data,created_at) SELECT ?,?,'apply_proposal',?,?,? WHERE ${guard}`).bind(id,actor,JSON.stringify(before),JSON.stringify({...next,revision}),at,operation,revision));
  statements.push(db().prepare(`UPDATE proposals SET status='applied',applied_at=? WHERE id=? AND status='pending' AND ${guard}`).bind(at,id,operation,revision));
  const result=await db().batch(statements);
  if(!result[0].meta.changes)throw new CommerceError('The store changed before this update was saved. Refresh and review again.',409);
  return {applied:true,revision};
}
export async function rejectProposal(id:string,actor:string){
  const at=new Date().toISOString(),operation=`reject:${id}`;
  const result=await db().batch([
    db().prepare("UPDATE proposals SET status='rejected',applied_at=? WHERE id=? AND status='pending'").bind(at,id),
    db().prepare("INSERT OR IGNORE INTO audit(id,actor,action,before_data,after_data,created_at) SELECT ?,?,'reject_proposal',?, ?,? WHERE EXISTS(SELECT 1 FROM proposals WHERE id=? AND status='rejected' AND applied_at=?)").bind(operation,actor,JSON.stringify({proposalId:id,status:'pending'}),JSON.stringify({proposalId:id,status:'rejected'}),at,id,at)
  ]);
  if(!result[0].meta.changes)throw new CommerceError('This proposal is no longer pending.',409);
  return {rejected:true};
}
