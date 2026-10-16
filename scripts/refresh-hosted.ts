import {SOURCES} from '../lib/sources';
const origin=process.env.MDPPA_SITE_ORIGIN,token=process.env.MDPPA_SITE_SERVICE_TOKEN;
if(!origin||!token){console.log('Hosted synchronization skipped: configure MDPPA_SITE_ORIGIN and the private Site service token. Local collection remains available.');process.exit(0);}
const base=new URL(origin);if(base.protocol!=='https:'||!base.hostname.endsWith('.chatgpt.site'))throw new Error('Expected the private deployed Site HTTPS origin.');
let errors=0;
for(const s of SOURCES.filter(s=>s.enabled)){
 const response=await fetch(new URL('/api/crawl-service',base),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'OAI-Sites-Authorization':`Bearer ${token}`},body:JSON.stringify({sourceIds:[s.id]}),signal:AbortSignal.timeout(150000)});
 if(!response.ok){errors++;console.error(`${s.agency}: hosted writer returned HTTP ${response.status}`);continue;}
 const result=await response.json() as any;console.log(`${s.agency}: ${result.run.status}; ${result.run.recordsFound} new records.`);
}
if(errors)process.exitCode=1;
