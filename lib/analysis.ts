import { criteria, scoreRecord, digest } from './scoring';
import type { Intelligence, Source } from './types';

export interface Extracted { headline: string; url: string; text: string; publishedAt: string | null; source: Source }
export const RELEVANT = /motorcycl|two[- ]wheel|\b2w\b|category\s*l\b|\bevida\b|electric vehicle|restamp|homologat|motor vehicle|vehicle.*(?:tariff|registration|emission)|(?:tariff|registration|emission).*vehicle|counterfeit.*parts/i;

export async function assess(input: Extracted, now = new Date()): Promise<Intelligence> {
 const {source,headline,url,publishedAt} = input;
 const text = input.text.replace(/\s+/g,' ').trim();
 const corpus = `${headline} ${text}`;
 const motorcycle = /motorcycl|two[- ]wheel|\b2w\b|category\s*l\b/i.test(corpus);
 const onlyFourWheels = /exclusively.{0,30}(?:passenger cars|four[- ]wheeled)|only.{0,20}(?:cars|trucks|buses)/i.test(corpus);
 const restamp = /re[- ]?stamp/i.test(corpus);
 const isEvida = source.id === 'evida' && /11697/.test(corpus) && /scope and application/i.test(text);
 const isTariff = source.id === 'tariff-baseline' && /rates of import duty/i.test(text);
 const proposal = /\b(?:senate bill|house bill|proposed|draft|consultation|pending bill)\b/i.test(headline);
 const legal = /\b(?:Republic Act|Executive Order|Memorandum Circular|Department Order|Administrative Order)\b/i.test(headline);
 const knownCoverage = isEvida || (motorcycle && !restamp && !onlyFourWheels && text.length > 350 && !legal);
 const direct = motorcycle && !restamp && !onlyFourWheels;
 const applicability = onlyFourWheels ? 'Not applicable' : isEvida ? 'Direct' : knownCoverage && direct ? 'Direct' : isTariff ? 'Uncertain' : restamp || legal ? 'Uncertain' : motorcycle ? 'Direct' : 'Indirect';
 const regulatory = legal || /regulat|compliance|standard|registration|legislat|tax|tariff|customs/i.test(corpus);
 const financial = /cost|dut[yies]|tax|tariff|import|sales|production|investment|incentive/i.test(corpus);
 const safety = /safety|counterfeit|emission|sustainable|electric/i.test(corpus);
 const risk = /ban|penalt|suspend|mandatory|prohibit|recall/i.test(headline) && knownCoverage;
 const confidence = isEvida ? 93 : isTariff ? 76 : text.length < 150 ? 35 : source.official ? 85 : source.category === 'Legal archive' ? 80 : 65;
 const summary = isEvida
  ? 'RA 11697 establishes a framework covering electric vehicle manufacturing, assembly, imports, trade, components and charging infrastructure. This is a historical legal baseline; current implementing rules and model classifications still need review.'
  : isTariff
  ? 'EO 62 establishes a multi-year MFN tariff schedule and refers to expanded electric vehicle coverage. The linked body text does not establish which motorcycle or component tariff lines qualify; Annex A and current amendments must be checked.'
  : `Source reports: ${headline.replace(/\s*[-|]\s*(?:MDPPA|LTO|PNA)$/i,'')}. ${legal ? 'Coverage, amendments and enforceability require review of the complete legal text.' : 'This is an extracted development for analyst screening; no new legal obligation is inferred.'}`;
 const directImpact = isEvida ? 'EV manufacturers, assemblers and importers fall within the express scope in Section 3. Apply to a specific electric motorcycle only after checking its classification and the relevant implementing rules.'
  : applicability === 'Direct' ? 'The source expressly discusses motorcycles or the two-wheel sector. Review the original report to establish the specific product or activity affected.'
  : restamp ? 'Motorcycle engine and chassis identification coverage has not been established. A general motor vehicle title does not prove technical feasibility or legal applicability.'
  : 'No verified direct motorcycle obligation has been established from this source.';
 const indirectImpact = isEvida ? 'Potential effects on electric model strategy, parts supply, after-sales capability and charging partnerships; these are business inferences.' : isTariff ? 'Potential landed-cost and sourcing implications, subject to the exact AHTN code, origin rules, applicable rate and amendments.' : financial ? 'Potential implications for demand, landed costs or business planning; magnitude has not been quantified.' : 'Possible industry-policy or rider education relevance; business consequences require analyst confirmation.';
 const reasons = [
  isEvida ? 'Section 3 expressly covers EV manufacture, assembly and importation; model-specific rules remain to be checked.' : knownCoverage ? 'Motorcycle scope is explicit in the retrieved source.' : onlyFourWheels ? 'Source scope is restricted to four-wheel products.' : restamp ? 'Restamping scope and two-wheel technical suitability are unverified.' : 'Generic vehicle terms do not establish motorcycle applicability.',
  isEvida ? 'The enacted statute assigns standards, registration and industry-development responsibilities.' : regulatory ? 'Regulatory language detected; a legal reviewer must establish actual obligations.' : 'No enforceable obligation was established.',
  financial || isEvida ? 'Supply, investment, sales, taxation or production relevance is present; impact is unquantified.' : 'No material cost consequence established.',
  isEvida ? 'The EV value chain includes manufacturers, importers, dealers and parts providers.' : motorcycle ? 'Relevant to the motorcycle sector; exact stakeholder breadth requires review.' : 'Breadth of affected MDPPA members is uncertain.',
  safety ? 'Safety, sustainability, technology or counterfeit-parts issues align with MDPPA priorities.' : 'Routine monitoring value; strategic consequence not yet demonstrated.'
 ];
 const ratings = isEvida ? [5,5,4,5,5] : isTariff ? [2,5,5,4,4] : [onlyFourWheels?0:knownCoverage?5:motorcycle?3:1,regulatory?2:1,financial?2:1,motorcycle?3:1,safety?3:2];
 const contentHash = await digest(text || headline);
 const documentId = isEvida ? 'RA 11697' : isTariff ? 'EO 62, s. 2024' : headline.match(/(?:Republic Act|Executive Order|Memorandum Circular|MC|RA|EO)\s*(?:No\.?\s*)?[A-Z]*[- ]?\d{2,}(?:[- ]\d+)*/i)?.[0] || null;
 const item: Intelligence = {
  id:(await digest(url)).slice(0,24),headline:isEvida?'EVIDA: electric vehicle industry framework':isTariff?'EO 62: tariff schedule — motorcycle coverage needs verification':headline,
  sourceId:source.id,source:source.agency,url,relatedUrls:[],documentId,publishedAt:publishedAt || null,
  issuedAt:isEvida?'2022-04-15':isTariff?'2024-06-20':null,discoveredAt:now.toISOString(),
  effectiveAt:null,deadline:null,dateEvidence:null,type:isEvida?'Republic Act':isTariff?'Executive Order':proposal?'Proposed legislation':legal?'Regulatory issuance':'News / announcement',
  legalStatus:isEvida||isTariff?'Approved / Enacted':proposal?'Proposed / Pending':legal?'Status Unverified':'Not a legal issuance',summary,applicability,
  directImpact,indirectImpact,
  manufacturers:isEvida?'Map electric-model plans, component standards and possible incentives against the law and current implementing rules. Do not assume a universal tax exemption.':financial?'Assess implications for procurement, production and landed costs after verifying the product scope.':'Review whether product, production or compliance teams need to act; no new obligation confirmed.',
  dealerships:isEvida?'Review electric-model documentation, customer disclosures, parts/service capability and any applicable registration requirements.':'Confirm whether sales, registration, inventory or after-sales workflows are affected. No automatic change is recommended.',
  functions:[...(regulatory?['Legal & compliance']:[]),...(financial?['Finance & imports']:[]),...(motorcycle||isEvida?['Manufacturing','Dealership operations']:[]),...(safety?['Road safety & advocacy']:[])],
  classes:isEvida?['Electric motorcycles — classification to verify']:motorcycle?['Two-wheel motorcycles — source scope']:['Category L scope unverified'],
  action:isEvida?'Assign the policy and technical committees to map current implementing rules and model coverage; prepare a coordinated member briefing.':restamp?'Obtain the complete memorandum and confirm engine/chassis eligibility with the LTO before classifying this as a motorcycle compliance obligation.':isTariff?'Obtain Annex A; map exact motorcycle and component AHTN tariff codes and current amendments before estimating costs.':'Review the original source, confirm motorcycle applicability and assign an appropriate committee owner before distribution.',
  verification:isEvida?'Historical legal text retrieved; specific current implementing requirements are not independently verified.':isTariff?'Body text retrieved; tariff annex and current amendments require legal review.':knownCoverage?'Source text retrieved; analyst review of business implications required.':'Applicability or legal status requires verification.',
  confidence,coverageVerified:knownCoverage,severeDisruption:false,riskEvidence:risk,deadlineVerified:false,opportunity:/investment|incentive|growth|electric|sustainable/i.test(corpus),demo:false,
  historical:isEvida||isTariff||!!(publishedAt && now.getTime()-new Date(publishedAt).getTime()>90*86400000),
  evidence:[{label:isEvida?'Scope: Section 3':isTariff?'Rates: Sections 1–2 and Annex A reference':'Retrieved source',detail:isEvida?'The statute covers the EV value chain; exact motorcycle subclasses and implementing obligations require further review.':isTariff?'The tariff schedule depends on Annex A product lines; body text alone is insufficient.':'Headline and content were extracted from the linked page. Classification and business impact are screening inferences.',url}],
  criteria:criteria(ratings,reasons),score:0,priority:'P2',threat:'Uncertain',important:false,urgent:false,urgentImportant:false,scoringVersion:'',scoredAt:'',contentHash,
 };
 return scoreRecord(item,undefined,now);
}
