import { CommerceError } from './commerce.mjs';
import { validateSchoolPartner } from './school-policy.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function object(input,keys){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw new CommerceError('Send only the fields shown in this form.');}
function text(value,label,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw new CommerceError(`Enter a valid ${label}.`);return value.trim();}
function id(value){if(typeof value!=='string'||!uuid.test(value))throw new CommerceError('A valid record ID is required.');return value;}
function cents(value){if(!Number.isSafeInteger(value)||value<1||value>100000000)throw new CommerceError('Amounts must be positive whole cents, up to $1,000,000.');return value;}
export function validateInfluencer(input){
  object(input,['id','code','name','intro','contactEmail','status','revision']);
  const intro=text(input.intro,'community introduction',500);
  const partner=validateSchoolPartner({id:input.id,code:input.code,name:input.name,program:'Mia’s Place',contactEmail:input.contactEmail,status:input.status,revision:input.revision});
  return {...partner,intro};
}
export function validateDonation(input,now=new Date()){
  object(input,['id','reference','transferredOn','amountCents','allocations','confirmed']);
  if(input.confirmed!==true)throw new CommerceError('Confirm that the donation is completed and its community allocations have been reconciled.');
  const reference=text(input.reference,'private transfer reference',180).toLowerCase().replace(/\s+/g,' ');
  const date=text(input.transferredOn,'transfer date',10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>now.toISOString().slice(0,10))throw new CommerceError('Use the actual completed transfer date, which cannot be in the future.');
  if(!Array.isArray(input.allocations)||input.allocations.length<1||input.allocations.length>25)throw new CommerceError('Allocate this donation to between 1 and 25 communities.');
  const allocations=input.allocations.map(a=>{object(a,['partnerId','amountCents']);return {partnerId:id(a.partnerId),amountCents:cents(a.amountCents)};}).sort((a,b)=>a.partnerId.localeCompare(b.partnerId));
  const amountCents=cents(input.amountCents);
  if(new Set(allocations.map(a=>a.partnerId)).size!==allocations.length)throw new CommerceError('List each community only once.');
  if(allocations.reduce((sum,a)=>sum+a.amountCents,0)>amountCents)throw new CommerceError('Community allocations cannot exceed the completed donation.');
  return {id:id(input.id),reference,transferredOn:date,amountCents,allocations,confirmed:true};
}
export function validateReversal(input){object(input,['id','reason']);return {id:id(input.id),reason:text(input.reason,'correction reason',500)};}
