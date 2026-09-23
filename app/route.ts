import storefront from '../content/storefront.html?raw';
import { snapshot } from '@/lib/database';
import { renderStorefront } from '@/lib/render-storefront.mjs';
export const dynamic='force-dynamic';
export async function GET(){let html=storefront;try{html=renderStorefront(storefront,await snapshot());}catch{ /* Preserve public copy; the catalog API fails closed. */ }
return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
