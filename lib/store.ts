import type { Snapshot, Intelligence, SourceHealth, Audit, ScoringConfig } from './types';
import initial from '../data/initial.json';
import { SOURCES } from './sources';
import { demoRecords } from './demos';
import { DEFAULT_CONFIG, scoreRecord, canonicalUrl, documentKey } from './scoring';

export interface Db { prepare(sql:string):{bind(...v:unknown[]):any;all():Promise<{results:any[]}>;first():Promise<any>;run():Promise<any>}; batch(statements:any[]):Promise<any> }
export async function logAudit(db:Db,action:string,recordId:string|null,actor:string,detail:string,ownerKey='system'){
 const item:Audit={id:ownerKey+':'+crypto.randomUUID(),createdAt:new Date().toISOString(),action,recordId,actor,detail};
 await db.prepare('INSERT INTO audit_log (id,created_at,payload) VALUES (?,?,?)').bind(item.id,item.createdAt,JSON.stringify(item)).run();
}
export async function seed(db:Db){
 const existing=await db.prepare("SELECT id FROM settings WHERE id='seed-v1'").first();if(existing)return;
 const bootstrap=initial as unknown as Snapshot;const statements=[];
 for(const r of bootstrap.records)statements.push(db.prepare('INSERT OR IGNORE INTO intelligence (id,url,payload,updated_at) VALUES (?,?,?,?)').bind(r.id,canonicalUrl(r.url),JSON.stringify(r),r.scoredAt));
 for(const s of bootstrap.sources)statements.push(db.prepare('INSERT OR IGNORE INTO source_health (id,payload) VALUES (?,?)').bind(s.id,JSON.stringify(s)));
 for(const r of bootstrap.runs)statements.push(db.prepare('INSERT OR IGNORE INTO crawl_runs (id,payload) VALUES (?,?)').bind(r.id,JSON.stringify(r)));
 statements.push(db.prepare('INSERT OR IGNORE INTO settings (id,payload) VALUES (?,?)').bind('seed-v1',JSON.stringify({at:new Date().toISOString()})));
 for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
}
export async function getConfig(db:Db,ownerKey='global'):Promise<ScoringConfig>{const row=await db.prepare('SELECT payload FROM settings WHERE id=?').bind('scoring:'+ownerKey).first();return row?JSON.parse(row.payload):DEFAULT_CONFIG;}
async function payloads<T>(db:Db,table:string,limit=1000,ownerKey?:string):Promise<T[]>{
 if(!['intelligence','source_health','crawl_runs','review_queue','send_history','audit_log'].includes(table))throw new Error('Invalid table.');
 const sql=ownerKey?`SELECT payload FROM ${table} WHERE id LIKE ? ORDER BY rowid DESC LIMIT ${limit}`:`SELECT payload FROM ${table} ORDER BY rowid DESC LIMIT ${limit}`;const query=db.prepare(sql);const {results}=await (ownerKey?query.bind(ownerKey+':%'):query).all();return results.map((r:any)=>JSON.parse(r.payload));
}
export async function getSnapshot(db:Db,mode:Snapshot['mode'],ownerKey='owner'):Promise<Snapshot>{
 await seed(db);
 const [records,sources,runs,queue,history,audit,config,recipientRows]=await Promise.all([
  payloads<Intelligence>(db,'intelligence'),payloads<SourceHealth>(db,'source_health'),payloads<Snapshot['runs'][0]>(db,'crawl_runs',90),payloads<Snapshot['queue'][0]>(db,'review_queue',1000,ownerKey),payloads<Snapshot['history'][0]>(db,'send_history',100,ownerKey),payloads<Audit>(db,'audit_log',100,ownerKey),getConfig(db,ownerKey),db.prepare('SELECT id,name,email,active FROM recipients WHERE id LIKE ?').bind(ownerKey+':%').all()
 ]);
 const reviewRows=await db.prepare('SELECT payload FROM settings WHERE id LIKE ?').bind('review:'+ownerKey+':%').all();const reviews:Intelligence[]=reviewRows.results.map((row:any)=>JSON.parse(row.payload) as Intelligence);
 return {records:[...records.map(original=>{const r=reviews.find(v=>v.id===original.id&&v.contentHash===original.contentHash)||original;return r.reviewNote?r:scoreRecord(r,config);}),...demoRecords().map(r=>scoreRecord(r,config))],sources:SOURCES.map(s=>sources.find(h=>h.id===s.id)||{...s,status:s.enabled?'Not checked':'Manual review',checkedAt:null,lastSuccessAt:null,error:null,candidates:0,ingested:0,robots:null}),runs,queue,history,audit,config,recipients:recipientRows.results.map((r:any)=>({id:r.id,name:r.name,email:r.email.replace(/^(.).+(@.+)$/,'$1•••$2'),active:!!r.active})),mode};
}
export async function upsertRecords(db:Db,records:Intelligence[],actor:string){
 const existing=await payloads<Intelligence>(db,'intelligence');const config=await getConfig(db);let created=0;
 for(const raw of records){
  const url=canonicalUrl(raw.url);const exact=existing.find(x=>canonicalUrl(x.url)===url);
  const key=raw.documentId?documentKey(raw.documentId):null;
  const same=exact||existing.find(x=>key&&documentKey(x.documentId||'')===key&&((x.issuedAt&&raw.issuedAt&&x.issuedAt.slice(0,4)===raw.issuedAt.slice(0,4))||new URL(x.url).pathname===new URL(raw.url).pathname));
  if(same&&same.contentHash===raw.contentHash)continue;
  const item=scoreRecord({...raw,id:same?.id||raw.id,discoveredAt:same?.discoveredAt||raw.discoveredAt,relatedUrls:[...new Set([...(same?.relatedUrls||[]),...(same&&same.url!==url?[url]:[])])]},config);
  if(same?.reviewNote){item.reviewNote=undefined;await logAudit(db,'Override expired',item.id,actor,'Source content changed. Previous human override cleared; fresh review is required.');}
  await db.prepare('INSERT INTO intelligence (id,url,payload,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at').bind(item.id,same?canonicalUrl(same.url):url,JSON.stringify(item),new Date().toISOString()).run();
  await logAudit(db,same?'Source updated and re-scored':'Source ingested',item.id,actor,JSON.stringify({score:item.score,priority:item.priority,version:item.scoringVersion,hash:item.contentHash}));if(!same){created++;existing.push(item);}
 }
 return created;
}

export async function saveReview(db:Db,item:Intelligence,ownerKey:string){await db.prepare('INSERT INTO settings (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind('review:'+ownerKey+':'+item.id,JSON.stringify(item)).run();}
