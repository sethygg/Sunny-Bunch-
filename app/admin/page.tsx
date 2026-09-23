import { requireChatGPTUser, chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { isOwner } from '@/lib/commerce.mjs';
import { runtime } from '@/lib/database';
import Studio from './studio';
export const dynamic='force-dynamic';
export default async function Admin(){
  const user=await requireChatGPTUser('/admin');
  if(!isOwner(user,runtime().ADMIN_OWNER_EMAIL))return <main className="access-page"><span className="studio-logo">Sunnybunch ☀</span><h1>Owner access required</h1><p>This account does not have access to store management.</p><p>Signed in as {user.email}</p><a href={chatGPTSignOutPath('/admin')} target="_top">Sign out to use your owner account</a><a href="/">Back to the store</a></main>;
  return <Studio email={user.email}/>;
}
