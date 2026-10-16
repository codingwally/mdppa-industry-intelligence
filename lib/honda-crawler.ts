import * as cheerio from 'cheerio';
import {robotsAllowed} from './crawler';
import {digest} from './scoring';
import type {HondaLead,HondaCheck} from './honda-types';

const UA='MDPPAIntelligenceBot/0.1 (+https://mdppa.site; public brand-protection research)';
const LIMIT=2_000_000;
type Fetcher=typeof fetch;
async function bounded(response:Response){
 const reader=response.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let total=0;
 while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>LIMIT){await reader.cancel();throw new Error('Response exceeds 2 MB.');}chunks.push(value);}
 const data=new Uint8Array(total);let at=0;for(const c of chunks){data.set(c,at);at+=c.length;}return new TextDecoder().decode(data);
}
async function download(url:URL,fetcher:Fetcher){
 const response=await fetcher(url,{headers:{'User-Agent':UA,Accept:'text/html,text/plain;q=0.9'},redirect:'manual',signal:AbortSignal.timeout(9000)});
 // A fixed target never follows redirects to another host or a sign-in service.
 if(response.status>=300&&response.status<400)throw new Error('Redirect requires manual source review; no redirect was followed.');
 return {status:response.status,body:response.ok?await bounded(response):''};
}
export function inspectHondaPage(html:string,lead:HondaLead){
 const $=cheerio.load(html);const meta=[$('meta[property="og:title"]').attr('content'),$('meta[property="og:description"]').attr('content'),$('title').text()].filter(Boolean).join(' ');
 const headings=$('h1,h2').map((_,e)=>$(e).text()).get().join(' ');
 $('script,style,nav,header,footer,aside,.related-products,.recommendations').remove();
 const text=$('body').text().replace(/\s+/g,' ').trim();
 const normalize=(v:string)=>v.toLowerCase().replace(/[’'‼️]/g,'').replace(/\s+/g,' ');
 const identity=(v:string)=>lead.identityTerms.every(term=>normalize(v).includes(normalize(term)));
 if(/access denied|verify you are human|checking your browser|captcha/i.test(headings+' '+meta))return {state:'restricted' as const,text:''};
 // Facebook feeds can show a different recommended post while retaining the requested
 // post in metadata. Metadata alone is never promoted to a fresh product observation.
 if(lead.channel==='Facebook'){
  if(identity(text))return {state:'observed' as const,text};
  return {state:identity(meta)?'metadata' as const:'mismatch' as const,text:meta};
 }
 // Identity checks are availability checks, never authenticity verdicts. A matching
 // product heading is required so navigation and related products cannot qualify.
 const canonical=$('link[rel="canonical"]').attr('href');
 const canonicalMatches=!!canonical&&new URL(canonical,lead.url).pathname===new URL(lead.url).pathname;
 if(identity(text)&&(identity(headings)||(canonicalMatches&&identity(meta))))return {state:'observed' as const,text};
 return {state:'mismatch' as const,text};
}
export async function checkHondaLead(lead:HondaLead,options:{fetcher?:Fetcher;now?:Date}={}):Promise<HondaCheck>{
 const now=options.now||new Date(),fetcher=options.fetcher||fetch;
 const check:HondaCheck={id:crypto.randomUUID(),leadId:lead.id,channel:lead.channel,checkedAt:now.toISOString(),status:'Unavailable',detail:'No fresh observation established.',httpStatus:null,contentHash:null,changed:false,observationVerified:false};
 try{
  const target=new URL(lead.url);if(target.protocol!=='https:')throw new Error('Only registered HTTPS targets are permitted.');
  const robots=await download(new URL('/robots.txt',target.origin),fetcher);
  if(robots.status!==200&&robots.status!==404){check.status='Access restricted';check.httpStatus=robots.status;check.detail=`robots.txt returned HTTP ${robots.status}; the product was not requested. Last research observation retained.`;return check;}
  if(robots.status===200&&!robotsAllowed(robots.body,target.pathname+target.search)){check.status='Blocked by robots';check.detail='robots.txt disallows automated retrieval. Last research observation retained; no bypass attempted.';return check;}
  const page=await download(target,fetcher);check.httpStatus=page.status;
  if(page.status!==200){check.status=[401,403,429].includes(page.status)?'Access restricted':'Unavailable';check.detail=`Product returned HTTP ${page.status}. Availability and authenticity are not inferred; previous evidence retained.`;return check;}
  const result=inspectHondaPage(page.body,lead);
  if(result.state==='restricted'){check.status='Access restricted';check.detail='The source presented an access challenge. No bypass attempted; previous evidence retained.';return check;}
  if(result.state==='metadata'){check.status='Metadata only';check.detail='The requested product appears in metadata, but the visible post body could not be matched. Stock and fresh observation remain unconfirmed.';return check;}
  if(result.state==='mismatch'){check.status='Identity not verified';check.detail='The named motorcycle product could not be matched to the returned page. Previous evidence retained.';return check;}
  check.status='Observed';check.observationVerified=true;check.contentHash=await digest(result.text);check.detail='The registered motorcycle product was matched in public page content. Captured price and photo need analyst review; inventory and authenticity are not established.';return check;
 }catch(error){check.detail=(error instanceof Error?error.message:'Source request failed.')+' Previous evidence retained.';return check;}
}
