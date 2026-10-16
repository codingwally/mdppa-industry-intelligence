import { crawlSource } from './crawler';
import { SOURCES } from './sources';
import { getSnapshot,logAudit,seed,getConfig,upsertRecords,saveReview,type Db } from './store';
import { validateConfig,digest,scoreRecord } from './scoring';
import { emailDraft } from './email';
import {getHondaSnapshot,saveHondaSnapshot,applyHondaCheck} from './honda-store';
import {checkHondaLead} from './honda-crawler';
import type { QueueEntry,ScoringConfig,Intelligence,CrawlRun } from './types';
type Runtime={DB?:Db;EMAIL_MODE?:string;RESEND_API_KEY?:string;EMAIL_FROM?:string;PRIVATE_OWNER_SITE?:string;SCHEDULE_STATUS?:string;PUBLIC_DEMO?:string;CRAWLER_SERVICE_TOKEN?:string};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function handleApi(request:Request,env:Runtime,user:{userId:string;email:string}|null):Promise<Response>{
 try{
  if(!env.DB)return json({error:'Persistent database is unavailable.'},503);const db=env.DB;
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\//,'');
  const servicePath=['crawl-service','service-status'].includes(path);
  const publicDemo=env.PUBLIC_DEMO==='1';
  const supplied=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
  const service=servicePath&&((!publicDemo&&env.PRIVATE_OWNER_SITE==='1')||!!(env.CRAWLER_SERVICE_TOKEN&&supplied&&await digest(supplied)===await digest(env.CRAWLER_SERVICE_TOKEN)));
  if(servicePath&&!service)return json({error:'Collector service authorization required.'},403);
  const ownerKey=publicDemo?user?.userId||'no-session':'owner';
  if(!user&&!service)return json({error:'An evaluation session is unavailable. Refresh the page.'},401);
  if(request.method==='POST'){
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Cross-origin write refused.'},403);
   const length=Number(request.headers.get('content-length')||0);if(length>100_000)return json({error:'Request too large.'},413);
   if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required.'},415);
  }
  await seed(db);const actor=publicDemo?'Demo reviewer':user?.email||'Authorized collector service';
  const audit=(action:string,recordId:string|null,actorName:string,detail:string)=>logAudit(db,action,recordId,actorName,detail,ownerKey);
  const mode={access:publicDemo?'Public — no sign-in':'Private evaluation',email:!publicDemo&&env.EMAIL_MODE==='live'&&env.RESEND_API_KEY&&env.EMAIL_FROM?'Live provider configured; per-digest approval required':'Sandbox — previews only; no emails delivered',schedule:env.SCHEDULE_STATUS||'Daily schedule not yet confirmed',github:'Public Board dashboard: https://codingwally.github.io/mdppa-industry-intelligence/'};
  if(request.method==='GET'&&path==='honda-watch')return json(await getHondaSnapshot(db));
  if(request.method==='GET'&&path==='snapshot')return json(await getSnapshot(db,mode,ownerKey));
  if(request.method==='GET'&&path==='service-status'){
   const snapshot=await getSnapshot(db,mode,ownerKey);return json({sources:snapshot.sources,records:snapshot.records.filter(r=>!r.demo),runs:snapshot.runs,mode});
  }
  if(request.method!=='POST')return json({error:'Endpoint not found.'},404);
  const body=await request.json() as Record<string,any>;
  if(path==='honda-watch/check'){
   const snapshot=await getHondaSnapshot(db),lead=snapshot.cases.find(c=>c.id===body.leadId);
   if(!lead)return json({error:'Choose a registered Honda watch target.'},400);
   const slot='honda-check:'+lead.id+':'+Math.floor(Date.now()/300000);
   const claim=await db.prepare('INSERT OR IGNORE INTO settings (id,payload) VALUES (?,?)').bind(slot,'{}').run();
   if(claim.meta?.changes===0)return json({snapshot,reused:true});
   const check=await checkHondaLead(lead);const latest=await getHondaSnapshot(db);const next=applyHondaCheck(latest,check);await saveHondaSnapshot(db,next);
   await audit('Honda watch source checked',lead.id,actor,check.status+': '+check.detail);return json({snapshot:next,check,reused:false});
  }
  if(path==='crawl'||path==='crawl-service'){
   if(!Array.isArray(body.sourceIds)||body.sourceIds.length<1||body.sourceIds.length>3)return json({error:'Choose one to three registered sources per request.'},400);
   let selected=body.sourceIds.map((id:string)=>SOURCES.find(s=>s.id===id&&s.enabled));if(selected.some((s:unknown)=>!s))return json({error:'Unknown or unsupported source.'},400);
   if(publicDemo&&!service){const allowed=[];for(const source of selected){const slot='public-crawl:'+source!.id+':'+Math.floor(Date.now()/300000);const claimed=await db.prepare('INSERT OR IGNORE INTO settings (id,payload) VALUES (?,?)').bind(slot,'{}').run();if(claimed.meta?.changes!==0)allowed.push(source);}selected=allowed;if(!selected.length)return json({run:{status:'Recent source check retained',sourcesChecked:0,recordsFound:0,errors:0}});}
   const run:CrawlRun={id:crypto.randomUUID(),startedAt:new Date().toISOString(),finishedAt:null,status:'Running',sourcesChecked:selected.length,recordsFound:0,errors:0,trigger:service?'Collector service':'Manual'};
   await db.prepare('INSERT INTO crawl_runs (id,payload) VALUES (?,?)').bind(run.id,JSON.stringify(run)).run();
   for(const source of selected){
    const result=await crawlSource(source!);const old=await db.prepare('SELECT payload FROM source_health WHERE id=?').bind(source!.id).first();
    if(!result.health.lastSuccessAt&&old)result.health.lastSuccessAt=JSON.parse(old.payload).lastSuccessAt;
    await db.prepare('INSERT INTO source_health (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(source!.id,JSON.stringify(result.health)).run();
    run.recordsFound+=await upsertRecords(db,result.records,actor);if(result.health.status!=='Healthy')run.errors++;
   }
   run.finishedAt=new Date().toISOString();run.status=run.errors?'Completed with source errors':'Completed';
   await db.prepare('UPDATE crawl_runs SET payload=? WHERE id=?').bind(JSON.stringify(run),run.id).run();
   await audit('Crawl completed',null,actor,JSON.stringify(run));return json({run});
  }
  const snapshot=await getSnapshot(db,mode,ownerKey);
  if(path==='queue'){
   const item=snapshot.records.find(r=>r.id===body.recordId);if(!item)return json({error:'Unknown intelligence record.'},404);
   const entry:QueueEntry={id:ownerKey+':'+crypto.randomUUID(),recordId:item.id,status:'Review required',createdAt:new Date().toISOString(),approvedAt:null,recipientIds:[]};
   await db.prepare('INSERT OR IGNORE INTO review_queue (id,record_id,payload) VALUES (?,?,?)').bind(entry.id,ownerKey+':'+item.id,JSON.stringify(entry)).run();
   await audit('Added to review queue',item.id,actor,'No email sent.');return json({ok:true});
  }
  if(path==='queue/remove'){
   await db.prepare('DELETE FROM review_queue WHERE record_id=?').bind(ownerKey+':'+String(body.recordId)).run();await audit('Removed from review queue',String(body.recordId),actor,'Queue entry removed.');return json({ok:true});
  }
  if(path==='recipients'){
   const email=String(body.email||'').trim(),name=String(body.name||'').trim();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254||!name||name.length>100)return json({error:'Enter a valid recipient name and email.'},400);
   const id=ownerKey+':'+crypto.randomUUID();await db.prepare('INSERT INTO recipients (id,name,email,active) VALUES (?,?,?,1)').bind(id,name,email).run();await audit('Recipient added',null,actor,'An authorized recipient was stored privately.');return json({id});
  }
  if(path==='recipients/remove'){
   await db.prepare('UPDATE recipients SET active=0 WHERE id=? AND id LIKE ?').bind(String(body.id),ownerKey+':%').run();await audit('Recipient deactivated',null,actor,'Recipient excluded from future delivery.');return json({ok:true});
  }
  if(path==='preview'||path==='send'){
   if(!Array.isArray(body.recordIds)||!body.recordIds.length)return json({error:'Select at least one queued item.'},400);
   const found=body.recordIds.map((id:string)=>snapshot.records.find(r=>r.id===id)) as (Intelligence|undefined)[];
   if(found.some(r=>!r))return json({error:'Unknown record.'},400);
   const items=found as Intelligence[];
   if(items.some(r=>!snapshot.queue.some(q=>q.recordId===r.id)))return json({error:'Each item must be in the review queue.'},400);
   const subject=String(body.subject||'MDPPA Daily Industry Intelligence').replace(/[\r\n]/g,' ').slice(0,180);const draft=emailDraft(items,subject);
   const approvalHash=await digest(JSON.stringify({draft,recipientIds:[...(body.recipientIds||[])].sort()}));
   if(path==='preview')return json({...draft,approvalHash});
   if(body.approved!==true)return json({error:'Human approval is required for this digest.'},400);
   if(body.approvalHash!==approvalHash)return json({error:'The briefing or recipients changed. Generate and approve a fresh preview.'},409);
   const ids=Array.isArray(body.recipientIds)?[...new Set(body.recipientIds)]:[];
   const selected=await db.prepare('SELECT id,name,email FROM recipients WHERE active=1 AND id LIKE ?').bind(ownerKey+':%').all();const recipients=selected.results.filter((r:any)=>ids.includes(r.id));
   if(recipients.length!==ids.length)return json({error:'Recipient list changed; review it again.'},400);
   let status='Sandbox saved — not delivered',detail='Approved email draft saved. No provider request was made.';
   const id=ownerKey+':'+crypto.randomUUID();
   // Reserve an idempotency key in durable storage before any provider call.
   const token=String(body.idempotencyKey||'');if(!/^[a-zA-Z0-9-]{16,100}$/.test(token))return json({error:'A valid send idempotency key is required.'},400);
   const reserved=await db.prepare('INSERT OR IGNORE INTO settings (id,payload) VALUES (?,?)').bind('send-'+ownerKey+':'+token,JSON.stringify({id,createdAt:new Date().toISOString()})).run();
   if(reserved.meta?.changes===0)return json({error:'This send was already processed. Check the delivery history.'},409);
   if(!publicDemo&&env.EMAIL_MODE==='live'&&env.RESEND_API_KEY&&env.EMAIL_FROM){
    if(items.some((r:Intelligence)=>r.demo))return json({error:'Fictional demonstration records cannot be sent through the live provider.'},400);
    if(!recipients.length)return json({error:'Select an authorized recipient.'},400);
    status='Sending';
    await db.prepare('INSERT INTO send_history (id,payload) VALUES (?,?)').bind(id,JSON.stringify({id,subject,status,createdAt:new Date().toISOString(),detail:'Provider request started.'})).run();
    try{
     const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':token},body:JSON.stringify({from:env.EMAIL_FROM,to:[env.EMAIL_FROM],bcc:recipients.map((r:any)=>r.email),subject,html:draft.html,text:draft.text}),signal:AbortSignal.timeout(15000)});
     if(!response.ok)throw new Error(`Email provider rejected the request (HTTP ${response.status}).`);
     const result=await response.json() as {id?:string};status='Accepted by provider';detail=`Provider reference: ${result.id||'not supplied'}. Inbox delivery is not verified.`;
    }catch(error){status='Provider failed / delivery uncertain';detail=error instanceof Error?error.message:'Provider request failed.';}
   }
   const history={id,subject,status,createdAt:new Date().toISOString(),detail,draftText:draft.text};
   await db.prepare('INSERT INTO send_history (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,JSON.stringify(history)).run();
   for(const entry of snapshot.queue.filter(q=>body.recordIds.includes(q.recordId))){entry.approvedAt=new Date().toISOString();entry.recipientIds=ids as string[];entry.status=status;await db.prepare('UPDATE review_queue SET payload=? WHERE id=?').bind(JSON.stringify(entry),entry.id).run();}
   await audit(status,null,actor,`${items.length} approved items; ${recipients.length} selected recipients. ${detail}`);return json({history,draft});
  }
  if(path==='scoring'){
   const config=body.config as ScoringConfig;validateConfig(config);await db.prepare('INSERT INTO settings (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind('scoring:'+ownerKey,JSON.stringify(config)).run();
   await audit('Scoring configuration updated',null,actor,JSON.stringify(config));return json({ok:true});
  }
  if(path==='override'){
   const item=snapshot.records.find(r=>r.id===body.recordId&&!r.demo);const reason=String(body.reason||'').trim();if(!item||reason.length<15)return json({error:'Choose a real record and provide a reason of at least 15 characters.'},400);
   if(!['P1','P2','Archived'].includes(body.priority))return json({error:'Overrides may set P1, P2 or Archived. P0 requires verified evidence and algorithm rules.'},400);
   item.priority=body.priority;item.reviewNote=reason;await saveReview(db,item,ownerKey);await audit('Human priority override',item.id,actor,JSON.stringify({priority:item.priority,reason}));return json({ok:true});
  }
  if(path==='verify'){
   const item=snapshot.records.find(r=>r.id===body.recordId&&!r.demo),note=String(body.note||'').trim();
   const statuses=['Proposed / Pending','Approved / Enacted','Published','Effective / Enforceable','Suspended','Amended','Repealed','Status Unverified','Not a legal issuance'];
   if(!item||note.length<30||!statuses.includes(body.legalStatus)||!['Direct','Indirect','Uncertain','Not applicable'].includes(body.applicability))return json({error:'Provide a real record, valid scope/status and at least 30 characters of supporting evidence.'},400);
   const evidenceUrl=new URL(String(body.evidenceUrl));if(evidenceUrl.protocol!=='https:')return json({error:'Evidence must link to an HTTPS source.'},400);
   for(const key of ['deadline','effectiveAt'])if(body[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(body[key])||Number.isNaN(new Date(body[key]).getTime())))return json({error:'Enter valid dates in YYYY-MM-DD format.'},400);
   const ratings=body.ratings;if(!Array.isArray(ratings)||ratings.length!==5||ratings.some((r:unknown)=>typeof r!=='number'||!Number.isFinite(r)||r<0||r>5))return json({error:'Each criterion rating must be between zero and five.'},400);
   const confidence=Number(body.confidence);if(!Number.isFinite(confidence)||confidence<0||confidence>100)return json({error:'Confidence must be between zero and 100.'},400);
   const updated=scoreRecord({...item,legalStatus:body.legalStatus,applicability:body.applicability,coverageVerified:body.coverageVerified===true,confidence,deadline:body.deadline||null,effectiveAt:body.effectiveAt||null,deadlineVerified:!!(body.deadline||body.effectiveAt),dateEvidence:body.deadline||body.effectiveAt?note:null,riskEvidence:body.riskEvidence===true,severeDisruption:body.severeDisruption===true&&body.riskEvidence===true,verification:'Analyst evidence review: '+note,reviewNote:undefined,criteria:item.criteria.map((c,i)=>({...c,rating:ratings[i],reason:'Analyst assessment: '+note})),evidence:[...item.evidence,{label:'Analyst verification',detail:note,url:evidenceUrl.toString()}]},await getConfig(db,ownerKey));
   await saveReview(db,updated,ownerKey);
   const queued=snapshot.queue.find(q=>q.recordId===item.id);if(queued){queued.approvedAt=null;queued.status='Evidence changed — review required';await db.prepare('UPDATE review_queue SET payload=? WHERE id=?').bind(JSON.stringify(queued),queued.id).run();}
   await audit('Evidence verified and re-scored',item.id,actor,JSON.stringify({note,evidenceUrl:evidenceUrl.toString(),priority:updated.priority,score:updated.score}));return json({record:updated});
  }
  return json({error:'Endpoint not found.'},404);
 }catch(error){return json({error:error instanceof Error?error.message:'Operation failed.'},400);}
}
