import * as cheerio from 'cheerio';
import { assess, RELEVANT } from './analysis';
import { canonicalUrl } from './scoring';
import type { Intelligence, Source, SourceHealth } from './types';

const USER_AGENT = 'MDPPAIntelligenceBot/0.1 (+https://mdppa.site; research proof of concept)';
const MAX_BYTES = 2_000_000;
export class RobotsDenied extends Error {}
export function robotsAllowed(body: string, pathname: string): boolean {
 const groups: {agents:string[];rules:{allow:boolean;path:string}[]}[] = []; let current={agents:[] as string[],rules:[] as {allow:boolean;path:string}[]}; let hasRules=false;
 for (const raw of body.split(/\r?\n/)) {
  const line=raw.replace(/#.*/,'').trim(); const colon=line.indexOf(':'); if(colon<0)continue;
  const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
  if(key==='user-agent') { if(hasRules){groups.push(current);current={agents:[],rules:[]};hasRules=false;}current.agents.push(value.toLowerCase()); }
  if((key==='allow'||key==='disallow')&&current.agents.length){hasRules=true;if(value)current.rules.push({allow:key==='allow',path:value});}
 }
 groups.push(current);
 const matches=groups.filter(g=>g.agents.some(a=>a==='*'||USER_AGENT.toLowerCase().includes(a)));
 const specific=matches.filter(g=>g.agents.some(a=>a!=='*'&&USER_AGENT.toLowerCase().includes(a)));
 const rules=(specific.length?specific:matches).flatMap(g=>g.rules).filter(r=>{
  const expr=r.path.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$');
  return new RegExp('^'+expr).test(pathname);
 }).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
 return !rules.length || rules[0].allow;
}
async function readBounded(response: Response): Promise<string> {
 const reader=response.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let total=0;
 while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES){await reader.cancel();throw new Error('Source response exceeds the 2 MB limit.');}chunks.push(value);}
 const joined=new Uint8Array(total);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.length;}return new TextDecoder().decode(joined);
}
async function download(url:string,origin:string,retries=1):Promise<{body:string;status:number}> {
 const u=new URL(url);if(u.origin!==origin||u.protocol!=='https:')throw new Error('Cross-origin source request refused.');
 for(let attempt=0;attempt<=retries;attempt++){
  try {
   let response=await fetch(url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html,application/rss+xml,application/xml,text/plain;q=0.9'},signal:AbortSignal.timeout(12000),redirect:'manual'});
   if(response.status>=300&&response.status<400){const next=new URL(response.headers.get('location')||'',url);if(next.origin!==origin)throw new Error('Source redirects to another origin; manual review required.');response=await fetch(next,{headers:{'User-Agent':USER_AGENT},signal:AbortSignal.timeout(12000),redirect:'error'});}
   if(response.status===429||response.status===403)throw new Error(`HTTP ${response.status}: source access restricted; no bypass attempted.`);
   if(!response.ok&&response.status!==404)throw new Error(`HTTP ${response.status}`);
   return {body:await readBounded(response),status:response.status};
  } catch(error){if(attempt===retries||/403|429|origin|redirect/.test(String(error)))throw error;}
 }
 throw new Error('Source fetch failed.');
}
export function articleText(html:string):string {
 const $=cheerio.load(html);$('script,style,nav,header,footer,aside,.related-posts,.comments,.sidebar').remove();
 const main=$('article .entry-content,article,.entry-content,main,#content').first();
 return (main.length?main:$('body')).text().replace(/\s+/g,' ').trim().slice(0,80000);
}
export function extractEntries(html:string,source:Source):{headline:string;url:string;publishedAt:string|null;text:string}[]{
 const xml=source.kind==='rss';const $=cheerio.load(html,{xmlMode:xml});const results:{headline:string;url:string;publishedAt:string|null;text:string}[]=[];
 if(xml){$('item,entry').each((_,el)=>{const n=$(el);const raw=n.find('link').first().text()||n.find('link').attr('href')||'';
  const headline=n.find('title').first().text().trim();if(!raw||!headline)return;
  try{const u=new URL(raw,source.url);if(u.origin!==new URL(source.url).origin)return;const d=n.find('pubDate,published').first().text();const parsed=d?new Date(d):null;
   results.push({headline,url:canonicalUrl(u.toString()),publishedAt:parsed&&!Number.isNaN(parsed.getTime())?parsed.toISOString():null,text:articleText(n.find('description,summary,content').first().text())});}catch{}
 });}else if(source.kind==='document'){
  results.push({headline:$('title').text().trim()||source.name,url:source.url,publishedAt:null,text:articleText(html)});
 }else{
  const scope=$('main,article,#content').first();(scope.length?scope:$('body')).find('a[href]').each((_,el)=>{const n=$(el);let headline=n.text().replace(/\s+/g,' ').trim();if(source.category==='Legal archive'){const row=n.closest('tr').text().replace(/\s+/g,' ').trim();if(row&&row.length<900)headline=row;}if(headline.length<18||!RELEVANT.test(headline))return;
   try{const url=new URL(n.attr('href')!,source.url);if(url.origin!==new URL(source.url).origin||url.hash||url.pathname===new URL(source.url).pathname)return;results.push({headline,url:canonicalUrl(url.toString()),publishedAt:null,text:''});}catch{}
  });
 }
 const seen=new Set<string>();return results.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;});
}
export async function crawlSource(source:Source, now=new Date()):Promise<{health:SourceHealth;records:Intelligence[]}>{
 const health:SourceHealth={...source,status:source.enabled?'Not checked':'Manual review',checkedAt:source.enabled?now.toISOString():null,lastSuccessAt:null,error:null,candidates:0,ingested:0,robots:null};
 if(!source.enabled||source.kind==='manual')return {health,records:[]};
 try{
  const base=new URL(source.url),robots=await download(base.origin+'/robots.txt',base.origin,0);
  if(robots.status!==200&&robots.status!==404)throw new Error('robots.txt cannot be checked.');
  health.robots=robots.status===404?'No robots.txt (HTTP 404)':'robots.txt checked';
  const allowed=(path:string)=>robots.status===404||robotsAllowed(robots.body,path);
  if(!allowed(base.pathname+base.search))throw new RobotsDenied('robots.txt disallows this source path.');
  await new Promise(resolve=>setTimeout(resolve,600));
  const listing=await download(source.url,base.origin);if(listing.status!==200)throw new Error(`HTTP ${listing.status}`);
  if(source.kind==='rss'&&!/<(?:rss|feed)\b/i.test(listing.body))throw new Error('Source did not return a valid RSS/Atom document; manual adapter review required.');
  if(/<title[^>]*>\s*(?:just a moment|access denied|attention required|verify)/i.test(listing.body))throw new Error('Source returned an access challenge; no bypass attempted.');
  const entries=extractEntries(listing.body,source);health.candidates=entries.length;
  const candidates=entries.filter(x=>source.kind==='document'||RELEVANT.test(x.headline+' '+x.text)).slice(0,source.kind==='document'?1:5);
  const records:Intelligence[]=[];
  for(const entry of candidates){
   if(!/\.pdf(?:\?|$)/i.test(entry.url)&&source.kind!=='document'){
    const u=new URL(entry.url);if(!allowed(u.pathname+u.search))continue;
    await new Promise(resolve=>setTimeout(resolve,750));
    try{const detail=await download(entry.url,base.origin,0);if(detail.status===200){entry.text=articleText(detail.body);const $=cheerio.load(detail.body);const d=$('meta[property="article:published_time"]').attr('content')||$('time[datetime]').first().attr('datetime');if(d&&!Number.isNaN(new Date(d).getTime()))entry.publishedAt=new Date(d).toISOString();}}
    catch{ /* A title-only candidate is retained as explicitly unverified. */ }
   }
   records.push(await assess({...entry,source},now));
  }
  health.status='Healthy';health.lastSuccessAt=now.toISOString();health.ingested=records.length;
  return {health,records};
 }catch(error){health.status=error instanceof RobotsDenied?'Blocked by robots':'Unavailable';health.error=String(error instanceof Error?error.message:error).slice(0,300);return {health,records:[]};}
}
