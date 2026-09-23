import { snapshot } from '@/lib/database';
import { publicCatalog } from '@/lib/commerce.mjs';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(publicCatalog(await snapshot()),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({error:'Our catalog is temporarily unavailable.',checkoutAvailable:false},{status:503,headers:{'Cache-Control':'no-store'}});}}
