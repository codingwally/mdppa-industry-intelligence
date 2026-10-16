import {digest} from './scoring';
export async function anonymousSession(request:Request){
 const current=request.headers.get('cookie')?.match(/(?:^|;\s*)mdppa_session=([a-f0-9-]{36})(?:;|$)/i)?.[1];
 const token=current||crypto.randomUUID();
 return {user:{userId:'anon-'+(await digest(token)).slice(0,24),email:'Demo reviewer'},cookie:current?null:`mdppa_session=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=None; Partitioned`};
}
