import storefront from '../content/storefront.html?raw';
import { snapshot } from '@/lib/database';
import { renderStorefront } from '@/lib/render-storefront.mjs';
import { schoolBanner } from '@/lib/school-pages.mjs';
import { influencerBanner } from '@/lib/influencer-pages.mjs';
import { resolveSchoolReferral } from '@/lib/schools';
import { referralToken } from '@/lib/school-policy.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){let html=storefront;try{html=renderStorefront(storefront,await snapshot());}catch{ /* Preserve public copy; the catalog API fails closed. */ }
let banner='';try{const partner=await resolveSchoolReferral(referralToken(request));banner=partner?.kind==='influencer'?influencerBanner(partner):schoolBanner(partner);}catch{if(referralToken(request))banner='<aside class="school-support" role="status">Your referral selection could not be verified. Please revisit your partner link before purchasing.</aside>';}
html=html.replace('<!--SCHOOL_SUPPORT-->',()=>banner);
return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});}
