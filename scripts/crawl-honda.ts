import {readFile,writeFile} from 'node:fs/promises';
import {initialHondaSnapshot,applyHondaCheck} from '../lib/honda-store';
import {checkHondaLead} from '../lib/honda-crawler';
import type {HondaSnapshot} from '../lib/honda-types';
let snapshot=initialHondaSnapshot();try{snapshot=JSON.parse(await readFile('data/honda-watch.json','utf8')) as HondaSnapshot;}catch{}
const startedAt=new Date().toISOString();let observed=0,restricted=0;
for(const lead of snapshot.cases){const result=await checkHondaLead(lead);snapshot=applyHondaCheck(snapshot,result);if(result.observationVerified)observed++;else restricted++;console.log(`${lead.id} ${lead.platform}: ${result.status}. ${result.detail}`);}
snapshot.runs=[{id:crypto.randomUUID(),startedAt,finishedAt:new Date().toISOString(),observed,restricted,trigger:process.env.GITHUB_ACTIONS==='true'?'Daily GitHub workflow':'CLI source check'},...snapshot.runs].slice(0,30);
await writeFile('data/honda-watch.json',JSON.stringify(snapshot,null,2)+'\n');await writeFile('public/data/honda-watch.json',JSON.stringify(snapshot)+'\n');
console.log(JSON.stringify({sources:snapshot.cases.length,observed,restricted,confirmedCounterfeits:0}));
