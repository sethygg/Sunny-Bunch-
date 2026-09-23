import { owner, body, json, errorResponse } from '@/lib/security';
import { adminSnapshot, initialize, stageProposal, applyProposal, rejectProposal } from '@/lib/database';
import { CommerceError } from '@/lib/commerce.mjs';
import { schoolReport, saveSchoolPartner } from '@/lib/schools';
import { influencerReport, saveInfluencer, recordCharityTransfer, reverseCharityTransfer } from '@/lib/influencers';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{await owner();const path=new URL(request.url).pathname;if(path==='/api/admin/snapshot')return json(await adminSnapshot());if(path==='/api/admin/schools')return json(await schoolReport());if(path==='/api/admin/influencers')return json(await influencerReport());throw new CommerceError('Not found.',404);}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{const user=await owner();const input=await body(request);const path=new URL(request.url).pathname;
  if(path==='/api/admin/proposals')return json(await stageProposal(input,user.userId),201);
  if(path==='/api/admin/schools')return json(await saveSchoolPartner(input,user.userId));
  if(path==='/api/admin/influencers')return json(await saveInfluencer(input,user.userId));
  if(path==='/api/admin/donations')return json(await recordCharityTransfer(input,user.userId));
  if(path==='/api/admin/donations/reverse')return json(await reverseCharityTransfer(input,user.userId));
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new CommerceError('This action does not accept extra fields.');
  if(path==='/api/admin/initialize')return json(await initialize(user.userId));
  const match=path.match(/^\/api\/admin\/proposals\/([a-f0-9-]{36})\/(apply|reject)$/i);
  if(match)return json(match[2]==='apply'?await applyProposal(match[1],user.userId):await rejectProposal(match[1],user.userId));
  throw new CommerceError('Not found.',404);
}catch(error){return errorResponse(error);}}
