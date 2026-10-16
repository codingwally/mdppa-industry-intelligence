import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { SOURCES } from '../lib/sources';
import { crawlSource } from '../lib/crawler';
import { DEFAULT_CONFIG } from '../lib/scoring';
import type { Snapshot } from '../lib/types';
const startedAt=new Date().toISOString();
let previous:Partial<Snapshot>={};try{previous=JSON.parse(await readFile('data/initial.json','utf8'));}catch{}
const records=new Map((previous.records||[]).filter(x=>!x.demo).map(x=>[x.url,x]));
const health=[];let errors=0;let found=0;
for(const source of SOURCES){
 const result=await crawlSource(source);const old=previous.sources?.find(x=>x.id===source.id);
 if(!result.health.lastSuccessAt&&old?.lastSuccessAt)result.health.lastSuccessAt=old.lastSuccessAt;
 health.push(result.health);if(result.health.status==='Unavailable'||result.health.status==='Blocked by robots')errors++;
 for(const item of result.records){const existing=records.get(item.url);if(!existing)found++;records.set(item.url,{...item,discoveredAt:existing?.discoveredAt||item.discoveredAt});}
 console.log(`${source.agency}: ${result.health.status}; ${result.records.length} records${result.health.error?'; '+result.health.error:''}`);
}
const run={id:crypto.randomUUID(),startedAt,finishedAt:new Date().toISOString(),status:errors?'Completed with source errors':'Completed',sourcesChecked:SOURCES.filter(s=>s.enabled).length,recordsFound:found,errors,trigger:'CLI / GitHub Actions'};
const snapshot:Snapshot={records:[...records.values()],sources:health,runs:[run,...previous.runs||[]].slice(0,90),queue:[],recipients:[],history:[],audit:[],config:DEFAULT_CONFIG,mode:{email:'Sandbox — use the public application to prepare briefings',schedule:process.env.GITHUB_ACTIONS==='true'?'GitHub Actions checks public sources daily around 06:00 Asia/Manila. Open Activity log for the latest completed run.':'Local collection; no hosted schedule is implied.',github:process.env.GITHUB_REPOSITORY||'GitHub Pages Board evaluation'}};
await mkdir('data',{recursive:true});await writeFile('data/initial.json',JSON.stringify(snapshot,null,2)+'\n');
await mkdir('public/data',{recursive:true});await writeFile('public/data/snapshot.json',JSON.stringify(snapshot)+'\n');
console.log(JSON.stringify({records:snapshot.records.length,found,errors,finishedAt:run.finishedAt}));
