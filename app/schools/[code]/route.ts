import { createSchoolReferral } from '@/lib/schools';
import { referralCookie } from '@/lib/school-policy.mjs';
import { schoolPage } from '@/lib/school-pages.mjs';
import { CommerceError } from '@/lib/commerce.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const headers:Record<string,string>={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
  try{
    const code=new URL(request.url).pathname.split('/').filter(Boolean).at(-1)!;
    const result=await createSchoolReferral(code);
    headers['Set-Cookie']=referralCookie(result.token,request);
    return new Response(schoolPage(result.school),{headers});
  }catch(error){
    if(error instanceof CommerceError)return new Response(schoolPage(null,true),{status:error.status,headers});
    return new Response('School Partner tracking is temporarily unavailable. Please try your district link again shortly.',{status:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  }
}
