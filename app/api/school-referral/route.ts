import { body, json, errorResponse } from '@/lib/security';
import { resolveSchoolReferral, clearSchoolReferral } from '@/lib/schools';
import { referralToken, referralCookie, publicSchool } from '@/lib/school-policy.mjs';
import { CommerceError } from '@/lib/commerce.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const selected=await resolveSchoolReferral(referralToken(request));return json({school:selected?publicSchool(selected):null,expiresAt:selected?.expires_at??null});}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{const value=await body(request);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length)throw new CommerceError('No extra fields are accepted.');await clearSchoolReferral(referralToken(request));const response=json({school:null});response.headers.set('Set-Cookie',referralCookie('',request,true));return response;}catch(error){return errorResponse(error);}}
