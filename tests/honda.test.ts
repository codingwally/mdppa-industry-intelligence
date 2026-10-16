import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {inspectHondaPage,checkHondaLead} from '../lib/honda-crawler';
import {initialHondaSnapshot,applyHondaCheck} from '../lib/honda-store';

const initial=initialHondaSnapshot(),lead=initial.cases[0],social=initial.cases[1];
test('Honda publication is Philippine motorcycle evidence with original source photographs',()=>{
 assert.equal(initial.cases.length,3);
 assert.deepEqual(initial.cases.map(c=>c.channel),['Ecommerce','Facebook','Website']);
 for(const c of initial.cases){
  assert.equal(c.marketCode,'PH');assert.match(c.scope,/motorcycle/i);
  assert.doesNotMatch(c.scope+' '+c.productType,/helmet|three.wheel|car parts|power equipment/i);
  assert.equal(c.authenticity,'Not determined');assert.ok(c.imageVerified);
  assert.ok(existsSync(new URL('../public/'+c.imageLocalPath,import.meta.url)));
  assert.ok(c.url.startsWith('https://'));assert.ok(c.imageUrl.startsWith('https://'));
  assert.match(c.evidenceHash,/^[a-f0-9]{64}$/);
 }
 assert.equal(initial.cases.filter(c=>c.classification==='Review lead').length,1);
 assert.equal(initial.cases[2].classification,'Reference offer');
 assert.match(social.limits,/Country of manufacture alone/);
});
test('a matching product page is observed without treating unrelated copy text as a verdict',()=>{
 const result=inspectHondaPage('<html><h1>Honda fully synthetic oil</h1><body><p>Honda synthetic oil for a scooter, 1L</p><nav>Class A copies in other categories</nav></body></html>',lead);
 assert.equal(result.state,'observed');assert.doesNotMatch(result.text,/Class A/);
 assert.equal(inspectHondaPage('<h1>Brake fluid</h1><nav>Honda synthetic oil</nav><p>Unrelated product</p>',lead).state,'mismatch');
});
test('Facebook metadata cannot turn an unrelated recommended post into a fresh observation',()=>{
 const html='<html><head><meta property="og:title" content="Fake Honda oil filters"></head><body><h1>Recommended posts</h1><p>Honda Civic car accessories</p></body></html>';
 assert.equal(inspectHondaPage(html,social).state,'metadata');
});
test('a canonical product title can identify a shop using non-heading product labels',()=>{
 const c=initial.cases[2];
 assert.equal(inspectHondaPage('<html><head><title>06381 Honda XRM 110 connecting rod</title><link rel="canonical" href="'+c.url+'"></head><body><main>06381 Honda XRM 110 Genuine parts ₱1,872</main></body></html>',c).state,'observed');
 assert.equal(inspectHondaPage('<html><head><title>06381 Honda XRM 110</title><link rel="canonical" href="https://newstarcommercial.com/unrelated"></head><body>06381 Honda XRM</body></html>',c).state,'mismatch');
});
test('robots denial prevents a product request and preserves the captured evidence',async()=>{
 const requested:string[]=[];
 const fetcher=(async(url:RequestInfo|URL)=>{requested.push(String(url));return new Response('User-agent: *\nDisallow: /',{status:200});}) as typeof fetch;
 const checked=await checkHondaLead(lead,{fetcher});
 assert.equal(checked.status,'Blocked by robots');assert.equal(checked.observationVerified,false);
 assert.equal(requested.length,1);assert.match(requested[0],/robots.txt$/);
 const next=applyHondaCheck(initial,checked);assert.deepEqual(next.cases,initial.cases);
});
test('access failure never resets a reviewed timestamp or invents a changed-page alert',async()=>{
 const fetcher=(async(url:RequestInfo|URL)=>new Response(String(url).endsWith('/robots.txt')?'':'Access denied',{status:String(url).endsWith('/robots.txt')?404:403})) as typeof fetch;
 const check=await checkHondaLead(lead,{fetcher});const next=applyHondaCheck(initial,check);
 assert.equal(check.status,'Access restricted');assert.equal(check.changed,false);
 assert.equal(next.cases[0].observedAt,lead.observedAt);assert.equal(next.cases[0].price,lead.price);
});
