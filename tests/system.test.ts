import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {DEFAULT_CONFIG,scoreRecord,canonicalUrl,validateConfig} from '../lib/scoring';
import {demoRecords} from '../lib/demos';
import {robotsAllowed,extractEntries} from '../lib/crawler';
import {assess} from '../lib/analysis';
import {SOURCES} from '../lib/sources';
import {handleApi} from '../lib/api';
import {emailDraft} from '../lib/email';
import {getSnapshot,upsertRecords} from '../lib/store';
import {anonymousSession} from '../lib/session';
import type {Db} from '../lib/store';

const now=new Date('2026-10-16T00:00:00Z');
test('P0 requires verified scope, risk, confidence and a real near-term date',()=>{
 const item=demoRecords(now)[0];assert.equal(item.priority,'P0');assert.equal(item.urgent,true);
 for(const patch of [{deadlineVerified:false},{coverageVerified:false},{riskEvidence:false},{confidence:50},{deadline:null},{deadline:'2026-12-01T00:00:00Z'},{legalStatus:'Status Unverified' as const}])assert.notEqual(scoreRecord({...item,...patch},DEFAULT_CONFIG,now).priority,'P0');
});
test('unknown restamping scope cannot become a high-priority motorcycle obligation',()=>{const r=demoRecords(now)[1];assert.equal(r.applicability,'Uncertain');assert.equal(r.score,59);assert.equal(r.priority,'P2');assert.equal(r.threat,'Uncertain');assert.equal(r.urgent,false);});
test('a proposed high-impact bill is important but not enforceable or urgent',()=>{const r=demoRecords(now)[2];assert.equal(r.priority,'P1');assert.equal(r.legalStatus,'Proposed / Pending');assert.equal(r.urgent,false);assert.equal(r.urgentImportant,false);});
test('suspended and repealed items cannot trigger operative P0 alerts',()=>{const r=demoRecords(now)[0];for(const legalStatus of ['Suspended','Repealed'] as const){const x=scoreRecord({...r,legalStatus},DEFAULT_CONFIG,now);assert.notEqual(x.priority,'P0');assert.equal(x.urgent,false);}});
test('express non-applicability is archived and source confidence is separate',()=>{const r=demoRecords(now)[0];const x=scoreRecord({...r,applicability:'Not applicable'},DEFAULT_CONFIG,now);assert.equal(x.score,20);assert.equal(x.priority,'Archived');assert.equal(x.confidence,98);});
test('scoring configuration rejects invalid weights and urgency windows',()=>{assert.throws(()=>validateConfig({...DEFAULT_CONFIG,weights:[20,20,20,20,10]}));assert.throws(()=>validateConfig({...DEFAULT_CONFIG,urgentDays:0}));assert.throws(()=>validateConfig({...DEFAULT_CONFIG,monitor:90}));});
test('deduplication removes trackers but preserves document parameters',()=>{assert.equal(canonicalUrl('https://www.example.org/article/?utm_source=x&fbclid=x&id=12#top'),'https://example.org/article/?id=12');});
test('robots respects explicit bot groups and longest allow/disallow matches',()=>{
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/public','/private/a'),false);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/public','/private/public/a'),true);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /\nUser-agent: MDPPAIntelligenceBot\nAllow: /','/article'),true);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /*?secret=','/article?secret=1'),false);
});
test('RSS extraction retains publication evidence and does not invent missing dates',()=>{const source=SOURCES.find(s=>s.id==='boi')!;const rows=extractEntries('<rss><channel><item><title>Motorcycle production investment</title><link>https://boi.gov.ph/test</link><pubDate>Fri, 16 Oct 2026 00:00:00 GMT</pubDate><description>New production investment</description></item><item><title>Motorcycle component standards</title><link>https://boi.gov.ph/test-2</link></item></channel></rss>',source);assert.equal(rows.length,2);assert.equal(rows[0].publishedAt,'2026-10-16T00:00:00.000Z');assert.equal(rows[1].publishedAt,null);});
test('generic vehicle references do not establish motorcycle applicability',async()=>{const r=await assess({source:SOURCES[0],headline:'Motor vehicle restamping memorandum circular',url:'https://lto.gov.ph/test-only',text:'General motor vehicle restamping instructions. Motorcycle engine and chassis eligibility is not established.',publishedAt:null},now);assert.equal(r.applicability,'Uncertain');assert.equal(r.coverageVerified,false);assert.notEqual(r.priority,'P0');assert.equal(r.effectiveAt,null);});
test('historical EVIDA is high priority without a fabricated publication or deadline',async()=>{const r=await assess({source:SOURCES.find(s=>s.id==='evida')!,headline:'Republic Act No. 11697',url:'https://lawphil.net/statutes/repacts/ra2022/ra_11697_2022.html',text:'Republic Act No. 11697. Scope and Application. Electric vehicle manufacture assembly importation.',publishedAt:null},now);assert.equal(r.priority,'P1');assert.equal(r.issuedAt,'2022-04-15');assert.equal(r.publishedAt,null);assert.equal(r.historical,true);assert.equal(r.urgent,false);});

function makeDb():Db{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_oval_otto_octavius.sql',import.meta.url),'utf8'));
 const prepare=(sql:string)=>{const stmt=sqlite.prepare(sql);let args:any[]=[];return {bind(...v:any[]){args=v;return this;},async all(){return {results:stmt.all(...args)};},async first(){return stmt.get(...args)||null;},async run(){const result=stmt.run(...args);return {meta:{changes:Number(result.changes)}};}};};
 return {prepare,async batch(statements:any[]){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
const user={userId:'test-analyst',email:'reviewer@example.invalid'};
const req=(path:string,body?:unknown,origin='https://mdppa.example')=>new Request('https://mdppa.example/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}:{});
test('API rejects unauthenticated access and cross-origin writes',async()=>{const DB=makeDb();assert.equal((await handleApi(req('snapshot'),{DB},null)).status,401);assert.equal((await handleApi(req('queue',{recordId:'demo-critical'},'https://attacker.example'),{DB},user)).status,403);});
test('persistent review, masked recipients, preview approval, sandbox history and idempotency',async()=>{
 const DB=makeDb(),env={DB,EMAIL_MODE:'sandbox'};
 for(let i=0;i<2;i++)assert.equal((await handleApi(req('queue',{recordId:'demo-critical'}),env,user)).status,200);
 let snapshot=await getSnapshot(DB,{email:'Sandbox',schedule:'Test',github:'Test'});assert.equal(snapshot.queue.length,1);
 await handleApi(req('recipients',{name:'Authorized reviewer',email:'secret-person@example.invalid'}),env,user);
 snapshot=await getSnapshot(DB,{email:'Sandbox',schedule:'Test',github:'Test'});assert.ok(!snapshot.recipients[0].email!.includes('secret-person'));
 const payload={recordIds:['demo-critical'],recipientIds:[],subject:'Test internal briefing'};
 const preview=await (await handleApi(req('preview',payload),env,user)).json() as any;assert.match(preview.text,/DEMONSTRATION ONLY/);
 assert.equal((await handleApi(req('send',{...payload,approved:false}),env,user)).status,400);
 assert.equal((await handleApi(req('send',{...payload,approved:true,approvalHash:'stale'}),env,user)).status,409);
 const send={...payload,approved:true,approvalHash:preview.approvalHash,idempotencyKey:crypto.randomUUID()};
 const response=await handleApi(req('send',send),env,user);assert.equal(response.status,200);const result=await response.json() as any;assert.equal(result.history.status,'Sandbox saved — not delivered');
 assert.equal((await handleApi(req('send',send),env,user)).status,409);
 snapshot=await getSnapshot(DB,{email:'Sandbox',schedule:'Test',github:'Test'});assert.equal(snapshot.history.length,1);assert.match(snapshot.history[0].draftText!,/DEMONSTRATION ONLY/);assert.ok(snapshot.queue[0].approvedAt);assert.ok(snapshot.audit.some(a=>a.action.includes('Sandbox')));
});
test('fictional scenarios are blocked from a live provider before any delivery',async()=>{const DB=makeDb(),env={DB,EMAIL_MODE:'live',RESEND_API_KEY:'test-no-network',EMAIL_FROM:'test@example.invalid'};await handleApi(req('queue',{recordId:'demo-critical'}),env,user);const payload={recordIds:['demo-critical'],recipientIds:[],subject:'Test'};const p=await (await handleApi(req('preview',payload),env,user)).json() as any;const response=await handleApi(req('send',{...payload,approved:true,approvalHash:p.approvalHash,idempotencyKey:crypto.randomUUID()}),env,user);assert.equal(response.status,400);assert.match((await response.json() as any).error,/Fictional/);});
test('email HTML escapes source content and does not render injected markup',()=>{const item={...demoRecords(now)[0],headline:'<script>alert(1)</script>',summary:'<img src=x onerror=alert(1)>'};const draft=emailDraft([item],'Internal <test>');assert.ok(!draft.html.includes('<script>'));assert.ok(draft.html.includes('&lt;script&gt;'));assert.ok(!draft.html.includes('<img src=x'));});
test('same-source re-ingestion is idempotent and preserves discovery date',async()=>{const DB=makeDb();const r={...demoRecords(now)[0],demo:false,id:'ingestion-test',url:'https://example.org/regulation',contentHash:'content-v1'};assert.equal(await upsertRecords(DB,[r],'test'),1);assert.equal(await upsertRecords(DB,[r],'test'),0);const snapshot=await getSnapshot(DB,{email:'Sandbox',schedule:'Test',github:'Test'});assert.equal(snapshot.records.filter(x=>x.id==='ingestion-test').length,1);});
test('analyst evidence review can establish a P0 only with an evidenced operative obligation',async()=>{
 const DB=makeDb(),env={DB};const r={...demoRecords(now)[0],demo:false,id:'review-test',url:'https://example.org/test-regulation',contentHash:'review-test-content'};await upsertRecords(DB,[r],'test');await handleApi(req('queue',{recordId:r.id}),env,user);
 const payload={recordId:r.id,note:'TEST FIXTURE: Section 3 expressly covers motorcycles; Section 8 establishes the stated future compliance deadline.',evidenceUrl:r.url,legalStatus:'Effective / Enforceable',applicability:'Direct',coverageVerified:true,riskEvidence:true,severeDisruption:false,confidence:95,deadline:new Date(Date.now()+5*86400000).toISOString().slice(0,10),effectiveAt:'',ratings:[5,5,5,5,5]};
 assert.equal((await handleApi(req('verify',{...payload,note:'short'}),env,user)).status,400);
 const response=await handleApi(req('verify',payload),env,user);assert.equal(response.status,200);const result=await response.json() as any;assert.equal(result.record.priority,'P0');assert.equal(result.record.deadlineVerified,true);
 const snapshot=await getSnapshot(DB,{email:'Sandbox',schedule:'Test',github:'Test'});assert.equal(snapshot.queue[0].approvedAt,null);assert.ok(snapshot.audit.some(a=>a.action==='Evidence verified and re-scored'));
});
test('a stale preview cannot approve changed source findings',async()=>{
 const DB=makeDb(),env={DB};await handleApi(req('queue',{recordId:'demo-critical'}),env,user);const payload={recordIds:['demo-critical'],recipientIds:[],subject:'Initial subject'};const p=await (await handleApi(req('preview',payload),env,user)).json() as any;
 const response=await handleApi(req('send',{...payload,subject:'Changed subject',approved:true,approvalHash:p.approvalHash,idempotencyKey:crypto.randomUUID()}),env,user);assert.equal(response.status,409);
});
test('public evaluation starts without login and isolates queues, recipients and scoring per browser',async()=>{
 const DB=makeDb(),env={DB,PUBLIC_DEMO:'1'};const a=await anonymousSession(req('snapshot')),b=await anonymousSession(req('snapshot'));
 assert.notEqual(a.user.userId,b.user.userId);assert.ok(('review:'+a.user.userId+':%').length<=50,'D1 LIKE patterns must fit its 50-byte limit');assert.match(a.cookie!,/HttpOnly; Secure; SameSite=None; Partitioned/);
 await handleApi(req('queue',{recordId:'demo-critical'}),env,a.user);
 const add=await (await handleApi(req('recipients',{name:'Private browser recipient',email:'browser-a@example.invalid'}),env,a.user)).json() as any;
 await handleApi(req('scoring',{config:{...DEFAULT_CONFIG,high:75}}),env,a.user);
 const sa=await (await handleApi(req('snapshot'),env,a.user)).json() as any,sb=await (await handleApi(req('snapshot'),env,b.user)).json() as any;
 assert.equal(sa.queue.length,1);assert.equal(sb.queue.length,0);assert.equal(sa.recipients.length,1);assert.equal(sb.recipients.length,0);assert.equal(sa.config.high,75);assert.equal(sb.config.high,70);
 await handleApi(req('recipients/remove',{id:add.id}),env,b.user);const still=await (await handleApi(req('snapshot'),env,a.user)).json() as any;assert.equal(still.recipients[0].active,true);
});
test('public mode forces sandbox even when live email credentials exist and protects service endpoints',async()=>{
 const DB=makeDb(),env={DB,PUBLIC_DEMO:'1',EMAIL_MODE:'live',RESEND_API_KEY:'must-never-be-used',EMAIL_FROM:'test@example.invalid',PRIVATE_OWNER_SITE:'1'},a=(await anonymousSession(req('snapshot'))).user;
 const status=await (await handleApi(req('snapshot'),env,a)).json() as any;assert.match(status.mode.email,/Sandbox/);
 assert.equal((await handleApi(req('service-status'),env,a)).status,403);
 await handleApi(req('queue',{recordId:'demo-critical'}),env,a);const body={recordIds:['demo-critical'],recipientIds:[],subject:'Public test'};const p=await (await handleApi(req('preview',body),env,a)).json() as any;
 const result=await handleApi(req('send',{...body,approved:true,approvalHash:p.approvalHash,idempotencyKey:crypto.randomUUID()}),env,a);assert.equal(result.status,200);assert.equal((await result.json() as any).history.status,'Sandbox saved — not delivered');
});
