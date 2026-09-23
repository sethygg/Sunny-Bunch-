import { CommerceError } from './commerce.mjs';
export const SCHOOL_POLICY='last-link-30-days-subscription-lifetime-v1';
export const REFERRAL_SECONDS=30*24*60*60;
export const REFERRAL_COOKIE='sunnybunch_school';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validSchoolCode(code){return typeof code==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)&&code.length>=3&&code.length<=60;}
export function validateSchoolPartner(input){
  const keys=['id','code','name','program','contactEmail','status','revision'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw new CommerceError('Send only the district fields shown in the form.');
  const text=(key,max)=>{const v=input[key];if(typeof v!=='string'||!v.trim()||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))throw new CommerceError(`Enter a valid ${key}.`);return v.trim();};
  const value={id:text('id',36),code:text('code',60).toLowerCase(),name:text('name',140),program:text('program',200),contactEmail:typeof input.contactEmail==='string'?input.contactEmail.trim().toLowerCase():'',status:input.status,revision:input.revision};
  if(!uuid.test(value.id)||!validSchoolCode(value.code))throw new CommerceError('Use a district link code with 3–60 lowercase letters, numbers or single hyphens.');
  if(value.contactEmail.length>254||(value.contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail)))throw new CommerceError('Enter a valid district contact email, or leave it blank.');
  if(!['draft','active','paused'].includes(value.status))throw new CommerceError('Choose draft, active or paused.');
  if(!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>2147483646)throw new CommerceError('Refresh the district before saving.');
  return value;
}
export function referralToken(request){
  const values=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(REFERRAL_COOKIE+'='));
  if(values.length!==1)return null;
  const token=values[0].slice(REFERRAL_COOKIE.length+1);
  return /^[a-f0-9]{64}$/.test(token)?token:null;
}
export function referralCookie(token,request,clear=false){
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  return `${REFERRAL_COOKIE}=${clear?'':token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:REFERRAL_SECONDS}${secure}`;
}
export async function hashReferral(token){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
}
export function publicSchool(row){return {code:row.code,name:row.name,program:row.program};}
