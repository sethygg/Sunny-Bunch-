import { influencerImpact } from '@/lib/influencers';
import { json, errorResponse } from '@/lib/security';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return json(await influencerImpact(new URL(request.url).pathname.split('/').filter(Boolean).at(-1)!));}catch(error){return errorResponse(error);}}
