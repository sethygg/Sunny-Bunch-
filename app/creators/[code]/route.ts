import { influencerImpact } from '@/lib/influencers';
import { createPartnerReferral } from '@/lib/schools';
import { referralCookie } from '@/lib/school-policy.mjs';
import { influencerPage } from '@/lib/influencer-pages.mjs';
import { CommerceError } from '@/lib/commerce.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers:Record<string,string>={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
 try{const code=new URL(request.url).pathname.split('/').filter(Boolean).at(-1)!;const impact=await influencerImpact(code);if(impact.acceptingReferrals){const ref=await createPartnerReferral(code,'influencer');headers['Set-Cookie']=referralCookie(ref.token,request);}return new Response(influencerPage(impact),{headers});}
 catch(error){if(error instanceof CommerceError)return new Response(influencerPage(null,true),{status:error.status,headers});return new Response('Community impact is temporarily unavailable. Please try again shortly.',{status:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});}
}
