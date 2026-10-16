import initial from '../data/honda-watch.json';
import type {Db} from './store';
import type {HondaSnapshot,HondaCheck} from './honda-types';
export function initialHondaSnapshot():HondaSnapshot{return structuredClone(initial) as HondaSnapshot;}
export async function getHondaSnapshot(db:Db):Promise<HondaSnapshot>{
 const baseline=initialHondaSnapshot(),row=await db.prepare('SELECT payload FROM settings WHERE id=?').bind('honda-watch').first();
 if(!row)return baseline;
 const saved=JSON.parse(row.payload) as HondaSnapshot;
 if(saved.datasetVersion!==baseline.datasetVersion)return baseline;
 // New, source-reviewed releases can add cases; crawler failures never erase them.
 const cases=baseline.cases.map(c=>{const old=saved.cases.find(x=>x.id===c.id);return old&&old.observedAt>c.observedAt?old:c;});
 return {...baseline,cases,checks:[...saved.checks,...baseline.checks.filter(c=>!saved.checks.some(x=>x.id===c.id))].slice(0,90),runs:saved.runs||[]};
}
export function applyHondaCheck(snapshot:HondaSnapshot,check:HondaCheck){
 const previous=snapshot.checks.find(c=>c.leadId===check.leadId&&c.observationVerified&&c.contentHash);
 check.changed=!!(check.observationVerified&&previous?.contentHash&&previous.status==='Observed'&&previous.contentHash!==check.contentHash);
 // A crawler check is separate from the source-reviewed evidence capture. It never
 // rewrites the captured price, quote, stock claim, observation date or legal finding.
 return {...snapshot,checks:[check,...snapshot.checks].slice(0,90)};
}
export async function saveHondaSnapshot(db:Db,snapshot:HondaSnapshot){await db.prepare('INSERT INTO settings (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind('honda-watch',JSON.stringify(snapshot)).run();}
