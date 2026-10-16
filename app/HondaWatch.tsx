'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Bookmark,Check,ChevronRight,Clock,Download,ExternalLink,MessageCircle,FileSearch,Globe,Info,LoaderCircle,MapPin,Radio,RefreshCw,ScanLine,Search,ShieldAlert,ShieldCheck,ShoppingBag,X} from 'lucide-react';
import type {HondaLead,HondaSnapshot} from '../lib/honda-types';
import {downloadText} from './ui';

const LIVE='https://mdppa-industry-intelligence.wallyesteban1993.chatgpt.site/honda-watch';
const CHANNELS=['All records','Ecommerce','Facebook','Website'] as const;
const ICONS={Ecommerce:ShoppingBag,Facebook:MessageCircle,Website:Globe};
const stamp=(v:string)=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(v))+' PHT';

function SourcePhoto({lead,assetBase,full=false}:{lead:HondaLead;assetBase:string;full?:boolean}){
 const [failed,setFailed]=useState(false);
 return <figure className={full?'hw-full-photo':'hw-photo'}>
  <a href={lead.imageUrl} target="_blank" rel="noreferrer" aria-label={'View original photo for '+lead.id}>
   {failed?<div className="hw-photo-error">Photo unavailable. Open the original image below.</div>:<img src={assetBase+lead.imageLocalPath} alt={lead.imageAlt} loading="lazy" onError={()=>setFailed(true)}/>}
  </a>
  <figcaption>{lead.imageCaption}</figcaption>
  <div className="hw-photo-links"><a href={lead.url} target="_blank" rel="noreferrer">Source page <ExternalLink size={11}/></a><a href={lead.imageUrl} target="_blank" rel="noreferrer">Original photo <ExternalLink size={11}/></a></div>
 </figure>;
}

export default function HondaWatch({readOnly,assetBase,notify}:{readOnly:boolean;assetBase:string;notify:(v:string)=>void}){
 const [data,setData]=useState<HondaSnapshot|null>(null);
 const [error,setError]=useState(''),[channel,setChannel]=useState<(typeof CHANNELS)[number]>('All records'),[query,setQuery]=useState('');
 const [selected,setSelected]=useState<HondaLead|null>(null),[busy,setBusy]=useState(''),[saved,setSaved]=useState<string[]>([]),[savedOnly,setSavedOnly]=useState(false);
 const load=useCallback(async()=>{
  const response=await fetch(readOnly?assetBase+'data/honda-watch.json':'/api/honda-watch',{cache:'no-store'});
  if(!response.ok)throw new Error('The Honda evidence register could not be loaded.');
  const next=await response.json() as HondaSnapshot;setData(next);setError('');return next;
 },[readOnly,assetBase]);
 useEffect(()=>{
  let active=true;
  load().catch(e=>{if(active)setError(e.message);});
  try{const list=JSON.parse(localStorage.getItem('mdppa-honda-review')||'[]');if(Array.isArray(list))setSaved(list.filter(x=>typeof x==='string'));}catch{}
  return()=>{active=false;};
 },[load]);
 function toggleSave(id:string){
  const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];setSaved(next);
  try{localStorage.setItem('mdppa-honda-review',JSON.stringify(next));notify(next.includes(id)?'Saved for review in this browser.':'Removed from this browser’s review list.');}
  catch{notify('Saved for this visit. Browser storage is unavailable.');}
 }
 async function recheck(ids?:string[]){
  if(!data||busy)return;setBusy('Starting checks');
  try{
   const targets=ids||data.cases.map(c=>c.id);let reused=0;
   for(let i=0;i<targets.length;i++){
    setBusy(`Checking ${i+1} / ${targets.length}`);
    const response=await fetch('/api/honda-watch/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId:targets[i]})});
    const result=await response.json() as {error?:string;snapshot:HondaSnapshot;reused?:boolean};
    if(!response.ok)throw new Error(result.error||'Source check failed.');
    setData(result.snapshot);if(result.reused)reused++;
   }
   notify(reused===targets.length?'Recent checks retained. Rechecks are limited to once per source every five minutes.':'Checks complete. Crawler coverage shows the exact access results.');
  }catch(e){notify(e instanceof Error?e.message:'Source check failed.');}finally{setBusy('');}
 }
 function exportBrief(){
  if(!data)return;
  const brief=['# Honda motorcycle counterfeit early warning — Board evidence brief',`Evidence reviewed: ${stamp(data.asOf)}`,'Scope: Honda motorcycle genuine parts and motorcycle oil sold in the Philippines.','No product has been authenticated or confirmed counterfeit. Review leads, publisher allegations and reference offers are distinct.','',...data.cases.flatMap(c=>[
   `## ${c.id} · ${c.title}`,`Classification: ${c.classification}`,`Channel: ${c.platform}`,`Market: ${c.market}`,`Publisher / seller: ${c.seller}`,`Source: ${c.url}`,`Original photo: ${c.imageUrl}`,`Reviewed: ${stamp(c.observedAt)}`,`Freshness: ${c.sourceFreshness}`,`Price captured: ${c.price}`,`Commercial status: ${c.saleState}. ${c.saleEvidence}`,...c.quotes.map(q=>`${q.label}: “${q.text}”`),`Assessment: ${c.finding}`,`Limits: ${c.limits}`,`Evidence digest: ${c.evidenceHash}`,'']),`Review guidance: ${data.guidanceUrl}`].join('\n');
  downloadText(brief,'Honda_Motorcycle_Board_Evidence.md');
 }
 const cases=data?.cases.filter(c=>(channel==='All records'||c.channel===channel)&&(!savedOnly||saved.includes(c.id))&&`${c.title} ${c.seller} ${c.market} ${c.signal}`.toLowerCase().includes(query.toLowerCase()))||[];
 const reviewCount=data?.cases.filter(c=>c.classification==='Review lead').length||0;
 return <div className="honda-watch">
  <div className="hw-heading"><div><div className="hw-eyebrow"><span/>MDPPA · BRAND PROTECTION INTELLIGENCE</div><h1>Honda <span>early warning.</span></h1><p>Philippines only. Motorcycle genuine parts and oil. Evidence the board can inspect.</p></div><div className="hw-header-actions"><button className="hw-btn" disabled={!data} onClick={exportBrief}><Download size={15}/>Board brief</button>{readOnly?<a className="hw-btn red" href={LIVE} target="_blank" rel="noreferrer"><ScanLine size={16}/>Live source checks<ArrowUpRight size={14}/></a>:<button className="hw-btn red" disabled={!data||!!busy} onClick={()=>recheck()}>{busy?<LoaderCircle className="spin" size={16}/>:<ScanLine size={16}/>} {busy||'Run source checks'}</button>}</div></div>
  <section className="hw-hero"><div className="hw-hero-copy"><div className="hw-mission"><Radio size={14}/>COUNTERFEIT EARLY-WARNING DESK <span>HONDA MOTORCYCLES · PH</span></div><h2>Spot the signal.<br/><em>Protect the genuine.</em></h2><p>A product photo. A traceable source. A clear reason to review. See what public evidence supports—and where verification is still needed.</p><div className="hw-hero-bottom"><span><i/>PUBLIC EVIDENCE REGISTER</span><span>{data?'Reviewed '+stamp(data.asOf):'Loading capture time…'}</span></div></div><div className="hw-hero-visual"><div className="hw-target-ring"/><img src={assetBase+'honda-watch-ecommerce.jpg'} alt="Exact seller image of Honda motorcycle scooter oil under review"/><div className="hw-scan-frame"><span/><span/><span/><span/></div><div className="hw-visual-label"><ScanLine size={16}/><div><strong>HND-001 · ORIGINAL SELLER IMAGE</strong><small>Motorcycle bottle / car-use graphic mismatch</small></div></div></div></section>
  <div className="hw-caution"><ShieldAlert size={20}/><p><strong>Potential risk needs validation.</strong> One offer has a presentation inconsistency; one post alleges fake filters; one web offer is a reference. No current counterfeit sale has been independently established.</p><span>0 CONFIRMED</span></div>
  {error&&<div className="hw-error"><h2>Evidence register unavailable</h2><p>{error}</p><button className="hw-btn" onClick={()=>load().catch(e=>setError(e.message))}>Try again</button></div>}
  {!data&&!error&&<div className="hw-loading"><LoaderCircle className="spin"/>Loading the reviewed evidence register…</div>}
  {data&&<>
   <div className="hw-metrics"><div><span>EVIDENCE RECORDS</span><strong>{String(data.cases.length).padStart(2,'0')}<ShoppingBag size={19}/></strong><small>Commerce · Facebook · website</small></div><div><span>OFFER FLAGGED FOR REVIEW</span><strong>{String(reviewCount).padStart(2,'0')}<ShieldAlert size={19}/></strong><small>Presentation issue · unverified</small></div><div><span>PH MOTORCYCLE SCOPE</span><strong>{String(data.cases.filter(c=>c.marketCode==='PH').length).padStart(2,'0')}<MapPin size={19}/></strong><small>Genuine-parts claims and oil</small></div><button className={savedOnly?'selected':''} onClick={()=>setSavedOnly(!savedOnly)}><span>SAVED FOR REVIEW</span><strong>{saved.filter(id=>data.cases.some(c=>c.id===id)).length.toString().padStart(2,'0')}<Bookmark size={19}/></strong><small>{savedOnly?'Show all records':'Private to this browser'}</small></button></div>
   <section className="hw-register"><div className="hw-section-heading"><div><div className="hw-eyebrow">THE EVIDENCE REGISTER</div><h2>Three channels. Inspectable evidence.</h2></div><span><Clock size={13}/>Reviewed {stamp(data.asOf)}</span></div>
    <div className="hw-toolbar"><div className="hw-tabs" role="group" aria-label="Filter by sales channel">{CHANNELS.map(c=><button aria-pressed={channel===c} key={c} onClick={()=>setChannel(c)}>{c}<span>{c==='All records'?data.cases.length:data.cases.filter(v=>v.channel===c).length}</span></button>)}</div><label className="hw-search"><Search size={16}/><input aria-label="Search Honda evidence" placeholder="Search product, seller or market" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    {savedOnly&&<div className="hw-selection">Showing this browser’s saved review list.<button onClick={()=>setSavedOnly(false)}>Show all records</button></div>}
    <div className="hw-case-grid">{cases.map(c=>{
     const Icon=ICONS[c.channel],latest=data.checks.find(x=>x.leadId===c.id);
     return <article className="hw-case" key={c.id}>
      <div className="hw-case-photo"><div className="hw-image-top"><span><Icon size={12}/>{c.channel.toUpperCase()}</span><b>{c.id}</b></div><SourcePhoto lead={c} assetBase={assetBase}/></div>
      <div className="hw-case-body"><div className="hw-case-badges"><span className={'hw-risk '+(c.classification==='Reference offer'?'reference':c.classification==='Review lead'?'strong':'')}><FileSearch size={12}/>{c.classification}</span><span className="hw-geography">PH · MOTORCYCLE</span></div><h3>{c.title}</h3><p className="hw-seller">{c.seller}</p><div className="hw-price"><strong>{c.price}</strong><span>{c.saleState}</span></div><div className="hw-signal"><span>{c.classification==='Reference offer'?'REFERENCE STATUS':'WHY IT SURFACED'}</span><strong>{c.signal}</strong><p>{c.finding}</p></div><div className="hw-freshness"><Clock size={13}/><p>{c.sourceFreshness}</p></div>
       {latest&&<div className={'hw-check-note '+(latest.observationVerified?'ok':'')}><span/>{latest.status} · crawler</div>}
       <div className="hw-card-actions"><button className="hw-btn dark" onClick={()=>setSelected(c)}>Open evidence<ArrowUpRight size={14}/></button><button className={'hw-save '+(saved.includes(c.id)?'saved':'')} aria-label={(saved.includes(c.id)?'Unsave ':'Save ')+c.id} onClick={()=>toggleSave(c.id)}>{saved.includes(c.id)?<Check size={17}/>:<Bookmark size={17}/>}</button><a href={c.url} target="_blank" rel="noreferrer" aria-label={'Open source for '+c.id}><ExternalLink size={16}/></a></div>
      </div>
     </article>;
    })}</div>
    {!cases.length&&<div className="hw-empty"><FileSearch size={30}/><h3>No matching records</h3><p>Adjust the search, channel or saved-review filter.</p></div>}
   </section>
   <div className="hw-bottom-grid"><section className="hw-coverage"><div className="hw-section-heading"><div><div className="hw-eyebrow">COLLECTION TRANSPARENCY</div><h2>Crawler coverage</h2></div><ScanLine size={22}/></div><p>Three registered URLs are monitored for access and product identity. A recheck never certifies a product or updates a captured price without review. New-listing discovery is not enabled.</p><div className="hw-source-rows">{data.cases.map(c=>{const latest=data.checks.find(x=>x.leadId===c.id),Icon=ICONS[c.channel];return <div key={c.id}><span className="hw-source-icon"><Icon size={18}/></span><div><strong>{c.platform}</strong><small>{latest?stamp(latest.checkedAt):'No crawler check yet'}</small></div><span className={'hw-source-status '+(latest?.observationVerified?'observed':'restricted')}>{latest?.status||'Not checked'}</span></div>;})}</div><details className="hw-check-history"><summary>Inspect checks and access limits<ChevronRight size={14}/></summary>{data.checks.slice(0,12).map(c=><div key={c.id}><strong>{c.leadId} · {c.status}</strong><small>{stamp(c.checkedAt)}</small><p>{c.detail}</p>{c.changed&&<b>Page content changed; analyst review required.</b>}</div>)}</details><div className="hw-schedule"><Clock size={15}/><p>{data.schedule}</p></div>{readOnly?<a href={LIVE} target="_blank" rel="noreferrer" className="hw-text-link">Run a check in the public application<ArrowUpRight size={14}/></a>:<button className="hw-text-link" disabled={!!busy} onClick={()=>recheck()}><RefreshCw size={14}/>Recheck these sources</button>}</section>
    <section className="hw-review-path"><div className="hw-eyebrow">FROM SIGNAL TO ACTION</div><h2>Evidence before<br/><span>escalation.</span></h2><ol><li><b>01</b><div><strong>Preserve the offer</strong><p>Record the URL, time, exact variant, claims and original photos.</p></div></li><li><b>02</b><div><strong>Validate with Honda</strong><p>Review the supplier, batch markings, packaging and a sample if needed.</p></div></li><li><b>03</b><div><strong>Decide on a response</strong><p>A qualified reviewer decides whether a platform report is warranted.</p></div></li></ol><a className="hw-guidance" href={data.guidanceUrl} target="_blank" rel="noreferrer"><ShieldCheck size={18}/><span>Honda’s official evidence guidance<small>Platform link · screenshots · product photos · account name</small></span><ArrowUpRight size={18}/></a><p className="hw-independent">Independent MDPPA evaluation concept. No Honda affiliation or endorsement is claimed. No seller has been contacted or reported.</p></section>
   </div>
  </>}
  {selected&&data&&<HondaEvidence lead={selected} snapshot={data} assetBase={assetBase} close={()=>setSelected(null)} saved={saved.includes(selected.id)} save={()=>toggleSave(selected.id)} readOnly={readOnly} recheck={()=>recheck([selected.id])} busy={!!busy}/>}
 </div>;
}

function HondaEvidence({lead,snapshot,assetBase,close,saved,save,readOnly,recheck,busy}:{lead:HondaLead;snapshot:HondaSnapshot;assetBase:string;close:()=>void;saved:boolean;save:()=>void;readOnly:boolean;recheck:()=>void;busy:boolean}){
 const ref=useRef<HTMLDivElement>(null),closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{
  const prior=document.activeElement as HTMLElement;ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current();if(e.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,summary');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
  document.addEventListener('keydown',onKey);const before=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=before;prior?.focus();};
 },[]);
 const check=snapshot.checks.find(c=>c.leadId===lead.id);
 return <div className="hw-modal-backdrop" onClick={close}><div className="hw-evidence" ref={ref} role="dialog" aria-modal="true" aria-labelledby="hw-evidence-title" onClick={e=>e.stopPropagation()}>
  <header><div><ScanLine size={17}/><span>EVIDENCE DOSSIER · {lead.id}</span></div><button aria-label="Close Honda evidence" onClick={close}><X size={21}/></button></header>
  <div className="hw-evidence-body"><div className="hw-eyebrow">{lead.channel.toUpperCase()} · PH MOTORCYCLE</div><h2 id="hw-evidence-title">{lead.title}</h2><p className="hw-evidence-seller">{lead.seller} · {lead.platform}</p>
   <SourcePhoto lead={lead} assetBase={assetBase} full/>
   <div className="hw-verdict"><ShieldAlert size={20}/><div><strong>{lead.classification} · authenticity not determined</strong><p>No product has been independently confirmed counterfeit. This classification describes the evidence, not the seller’s conduct.</p></div></div>
   <div className="hw-facts"><div><span>Price at capture</span><strong>{lead.price}</strong></div><div><span>Evidence reviewed</span><strong>{stamp(lead.observedAt)}</strong></div><div><span>Market</span><strong>{lead.market}</strong></div><div><span>Source publication</span><strong>{lead.publishedAt||'Not established'}</strong></div></div>
   <section><h3>What the source says</h3>{lead.quotes.map(q=><blockquote key={q.label}><span>{q.label}</span><p>“{q.text}”</p></blockquote>)}<a className="hw-text-link" href={lead.url} target="_blank" rel="noreferrer">Inspect the source page<ExternalLink size={14}/></a></section>
   <section><h3>Assessment and limits</h3><p>{lead.finding}</p><div className="hw-limit"><Info size={18}/><p>{lead.limits}</p></div>{lead.references?.map(r=><div className="hw-reference" key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.label} <ExternalLink size={12}/></a><p>{r.note}</p></div>)}</section>
   {lead.additionalImages?.map(i=><section key={i.url}><h3>Companion source photograph</h3><figure className="hw-full-photo"><a href={i.url} target="_blank" rel="noreferrer"><img src={assetBase+i.localPath} alt={i.alt} loading="lazy"/></a><figcaption>{i.caption}</figcaption><a className="hw-text-link" href={i.url} target="_blank" rel="noreferrer">Original image <ExternalLink size={12}/></a></figure></section>)}
   <section><h3>Is it being offered now?</h3><strong>{lead.saleState}</strong><p>{lead.saleEvidence}</p><div className="hw-limit"><Clock size={18}/><p>{lead.sourceFreshness}</p></div><p className="hw-muted">Public content does not prove physical stock, a completed sale or authenticity. Captured prices are not live quotes.</p></section>
   <section><h3>Collection and provenance</h3><dl><dt>Method</dt><dd>{lead.observationMethod}</dd><dt>Latest crawler attempt</dt><dd>{check?stamp(check.checkedAt)+' · '+check.status:'No crawler check'}</dd></dl>{check&&<p>{check.detail}</p>}<label className="hw-digest">SHA-256 · evidence manifest<code>{lead.evidenceHash}</code></label><p className="hw-muted">The digest covers the source URL, review time, short quotes and original image URL. It does not authenticate the product or sign the source page.</p></section>
   <section><h3>Next steps for a qualified reviewer</h3><ol>{lead.nextSteps.map(s=><li key={s}>{s}</li>)}</ol></section>
  </div>
  <footer><button className="hw-btn" onClick={()=>downloadText(JSON.stringify({lead,checks:snapshot.checks.filter(c=>c.leadId===lead.id),statement:'Authenticity not determined. No report submitted.'},null,2),lead.id+'_Honda_Evidence.json')}><Download size={15}/>Evidence JSON</button><button className={'hw-btn '+(saved?'':'dark')} onClick={save}>{saved?<Check size={15}/>:<Bookmark size={15}/>} {saved?'Saved for review':'Save for review'}</button>{!readOnly&&<button className="hw-btn red" disabled={busy} onClick={recheck}><RefreshCw size={15}/>Recheck</button>}</footer>
 </div></div>;
}
