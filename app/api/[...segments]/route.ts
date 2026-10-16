import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleApi } from '../../../lib/api';
import { anonymousSession } from '../../../lib/session';
export const dynamic='force-dynamic';
async function route(request:Request){
 const runtime=env as typeof env & {PUBLIC_DEMO?:string};
 if(runtime.PUBLIC_DEMO==='1'){
  const session=await anonymousSession(request);const response=await handleApi(request,runtime,session.user);
  if(session.cookie)response.headers.append('Set-Cookie',session.cookie);return response;
 }
 return handleApi(request,runtime,await getChatGPTUser());
}
export const GET=route;
export const POST=route;
