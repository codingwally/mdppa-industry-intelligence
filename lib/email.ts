import type { Intelligence } from './types';
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function emailDraft(records:Intelligence[],subject:string){
 const text=[subject,'MDPPA Industry Intelligence | Internal Proof of Concept','',...records.flatMap(r=>[
  `${r.priority} | ${r.score}/100 | ${r.headline}`,
  r.demo?'DEMONSTRATION ONLY — no real legal obligation.':`${r.source} | ${r.legalStatus}`,
  `Summary: ${r.summary}`,`Motorcycle applicability: ${r.applicability}`,`Manufacturer impact: ${r.manufacturers}`,`Dealership impact: ${r.dealerships}`,
  `Important: ${r.important?'Yes':'No'} | Urgent: ${r.urgent?'Yes':'No'} | Threat: ${r.threat}`,`MDPPA action: ${r.action}`,`Verification: ${r.verification}`,`Source: ${r.url}`,''
 ])].join('\n');
 const html=`<div style="font-family:Arial,sans-serif;max-width:720px;color:#243671"><h1>${escapeHtml(subject)}</h1><p>MDPPA Industry Intelligence · Internal Proof of Concept</p>${records.map(r=>`<article style="border-top:3px solid #ffc000;padding:18px 0"><p><strong>${r.priority} · ${r.score}/100</strong> · ${escapeHtml(r.legalStatus)}</p><h2>${escapeHtml(r.headline)}</h2>${r.demo?'<p><strong>DEMONSTRATION ONLY</strong></p>':''}<p>${escapeHtml(r.summary)}</p><p><b>Manufacturers:</b> ${escapeHtml(r.manufacturers)}</p><p><b>Dealerships:</b> ${escapeHtml(r.dealerships)}</p><p><b>Recommended action:</b> ${escapeHtml(r.action)}</p><p><b>Verification:</b> ${escapeHtml(r.verification)}</p>${r.demo?'':`<a href="${escapeHtml(r.url)}">Read original source</a>`}</article>`).join('')}</div>`;
 return {subject,text,html};
}
