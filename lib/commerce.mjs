import { MISSION_LEAD, MISSION_SUMMARY } from './mission-copy.mjs';
export const IDS = ['raspberry', 'tropical'];
export const CONFIRMED_NUTRITION = Object.freeze({totalSugarsGramsPerSachet:1,gramsPerSachet:20,gummiesPerSachet:8,appliesTo:Object.freeze([...IDS]),source:'Founder confirmed for both final recipes',completeNutritionPanelAvailable:false});
export const DEFAULT_PRODUCTS = [
  {id:'raspberry',name:'Natural Raspberry',description:'Bright raspberry flavor, a tangy bite, and a satisfying chew.',image:'/assets/sunnybunch-raspberry-brand-first.jpg',priceCents:3000,subscriptionPriceCents:2499,published:true,stock:null},
  {id:'tropical',name:'Pineapple Orange Guava',description:'A tropical trio of fruit flavors with a playful sour finish.',image:'/assets/sunnybunch-tropical-brand-first.jpg',priceCents:3000,subscriptionPriceCents:2499,published:true,stock:null}
];
export const DEFAULT_CONTENT = {
  announcement:'Our promise: 100% of profits to Mia’s Place.',
  heroDescription:'Big fruit flavor. A little sour pucker. Sugar-coated gummy suns in perfectly portable packs, ready to brighten your day.',
  missionLead:MISSION_LEAD,
  missionStatement:MISSION_SUMMARY
};
export class CommerceError extends Error { constructor(message,status=400){ super(message);this.status=status; } }
const fail = message => { throw new CommerceError(message); };
const object = (value, keys) => { if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!keys.includes(key))) fail('The change contains unsupported fields.'); };
const text = (value, max=600) => { if(typeof value!=='string' || !value.trim() || value.length>max) fail(`Use text between 1 and ${max} characters.`); return value.trim(); };
const integer = (value,min,max) => { if(!Number.isInteger(value)||value<min||value>max) fail(`Use a whole number from ${min} to ${max}.`);return value; };
export function validateProposal(input) {
  object(input,['id','baseRevision','summary','source','changes']);
  if(typeof input.id!=='string'|| !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.id)) fail('A valid operation ID is required.');
  integer(input.baseRevision,1,2147483647);
  if(!['owner','ai'].includes(input.source)) fail('Choose owner or AI as the source.');
  const summary=text(input.summary,180);
  if(!Array.isArray(input.changes)||input.changes.length<1||input.changes.length>10) fail('Propose between one and ten changes.');
  const changes=input.changes.map(change=>{
    object(change,['type','id','patch','quantity','delta','reason']);
    if(change.type==='update_product') {
      if(!IDS.includes(change.id)) fail('Unknown flavor.');
      object(change,['type','id','patch']);object(change.patch,['name','description','priceCents','subscriptionPriceCents','published']);
      if(!Object.keys(change.patch).length) fail('Provide at least one product change.');
      const patch={};
      for(const [key,value] of Object.entries(change.patch)) {
        if(key==='name') patch[key]=text(value,90);
        else if(key==='description')patch[key]=text(value,400);
        else if(key==='published'){ if(typeof value!=='boolean')fail('Publication must be true or false.');patch[key]=value; }
        else patch[key]=integer(value,1,100000);
      }
      return {type:change.type,id:change.id,patch};
    }
    if(['set_inventory','adjust_inventory'].includes(change.type)) {
      if(!IDS.includes(change.id))fail('Unknown flavor.');
      const field=change.type==='set_inventory'?'quantity':'delta';
      object(change,['type','id',field,'reason']);
      const quantity=integer(change[field],field==='quantity'?0:-1000000,1000000);
      if(field==='delta'&&quantity===0)fail('The inventory adjustment must change the count.');
      return {type:change.type,id:change.id,[field]:quantity,reason:text(change.reason,250)};
    }
    if(change.type==='update_content'){
      object(change,['type','patch']);object(change.patch,Object.keys(DEFAULT_CONTENT));
      if(!Object.keys(change.patch).length)fail('Provide at least one content change.');
      return {type:change.type,patch:Object.fromEntries(Object.entries(change.patch).map(([key,value])=>[key,text(value,key==='announcement'?120:500)]))};
    }
    fail('This kind of change is not supported.');
  });
  return {id:input.id,baseRevision:input.baseRevision,summary,source:input.source,changes};
}
export function applyChanges(snapshot, changes) {
  const next=structuredClone(snapshot);const movements=[];
  for(const change of changes) {
    if(change.type==='update_content'){ Object.assign(next.content,change.patch);continue; }
    const product=next.products.find(product=>product.id===change.id);
    if(!product)fail('The flavor is not in the catalog.');
    if(change.type==='update_product'){Object.assign(product,change.patch);}
    else {
      if(change.type==='adjust_inventory'&&product.stock===null)fail('Set an opening stock count before adjusting inventory.');
      const after=change.type==='set_inventory'?change.quantity:product.stock+change.delta;
      integer(after,0,1000000);
      movements.push({productId:product.id,before:product.stock,after,reason:change.reason});product.stock=after;
    }
  }
  for(const product of next.products) if(product.subscriptionPriceCents>product.priceCents)fail('Subscription price cannot exceed the one-time price.');
  return {next,movements};
}
export function isOwner(user,email){return !!(user?.userId && user?.email && typeof email==='string' && email.trim() && user.email.trim().toLowerCase()===email.trim().toLowerCase());}
export function validateOrigin(request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new CommerceError('This request must come from your admin page.',403);if(!request.headers.get('content-type')?.startsWith('application/json'))throw new CommerceError('Send JSON content.',415);}
export function publicCatalog(snapshot){return {products:snapshot.products.filter(p=>p.published).map(({id,name,description,image,priceCents,subscriptionPriceCents,stock})=>({id,name,description,image,priceCents,subscriptionPriceCents,inStock:stock===null?null:stock>0,sachetsPerPouch:25,gramsPerSachet:20,gummiesPerSachet:8,totalSugarsGramsPerSachet:CONFIRMED_NUTRITION.totalSugarsGramsPerSachet})),content:snapshot.content,revision:snapshot.revision,currency:'USD',subscriptionIntervalDays:30,checkoutAvailable:false};}
