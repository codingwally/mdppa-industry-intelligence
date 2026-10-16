import type { Criterion, Intelligence, ScoringConfig } from './types';

export const DEFAULT_CONFIG: ScoringConfig = { weights: [30, 20, 20, 15, 15], high: 70, monitor: 35, critical: 85, minimumConfidence: 85, urgentDays: 14 };
export const SCORING_VERSION = '1.0.0';
export const CRITERIA = ['Motorcycle applicability', 'Regulatory consequences', 'Financial / operational impact', 'Stakeholder breadth', 'Strategic significance'];

export function criteria(ratings: number[], reasons: string[], config = DEFAULT_CONFIG): Criterion[] {
  return CRITERIA.map((label, i) => ({ key: String(i), label, weight: config.weights[i], rating: ratings[i], reason: reasons[i] }));
}
export function validateConfig(c: ScoringConfig): void {
  if (c.weights.length !== 5 || c.weights.some(w => !Number.isFinite(w) || w < 0 || w > 100) || c.weights.reduce((a,b) => a+b,0) !== 100) throw new Error('The five weights must total 100.');
  if (![c.monitor,c.high,c.critical,c.minimumConfidence,c.urgentDays].every(Number.isFinite) || c.monitor < 0 || c.monitor >= c.high || c.high >= c.critical || c.critical > 100 || c.minimumConfidence < 50 || c.minimumConfidence > 100 || c.urgentDays < 1 || c.urgentDays > 90) throw new Error('Invalid scoring thresholds.');
}
export function scoreRecord(item: Intelligence, config = DEFAULT_CONFIG, now = new Date()): Intelligence {
  validateConfig(config);
  const rated = item.criteria.map((c,i) => ({ ...c, weight: config.weights[i], rating: Math.max(0, Math.min(5, c.rating)) }));
  let score = Math.round(rated.reduce((sum,c) => sum + c.weight * c.rating / 5, 0));
  if (item.applicability === 'Not applicable') score = Math.min(score, 20);
  if (!item.coverageVerified || item.applicability === 'Uncertain') score = Math.min(score, 59);
  const dates = item.deadlineVerified ? [item.deadline,item.effectiveAt].filter((v): v is string => !!v) : [];
  const nearDate = dates.some(d => { const days = (new Date(d).getTime()-now.getTime())/86400000; return Number.isFinite(days) && days >= 0 && days <= config.urgentDays; });
  const operative = ['Effective / Enforceable','Published','Approved / Enacted'].includes(item.legalStatus);
  const verified = item.coverageVerified && ['Direct','Indirect'].includes(item.applicability) && item.confidence >= config.minimumConfidence;
  const important = score >= config.high && verified;
  const urgent = verified && ((nearDate && operative) || (item.severeDisruption && item.riskEvidence && operative));
  let priority: Intelligence['priority'] = score < config.monitor ? 'Archived' : 'P2';
  if (important) priority = 'P1';
  if (important && score >= config.critical && urgent && operative && item.riskEvidence) priority = 'P0';
  if (['Suspended','Repealed','Proposed / Pending','Status Unverified'].includes(item.legalStatus) && priority === 'P0') priority = 'P1';
  const threat = item.applicability === 'Not applicable' ? 'No' : !item.coverageVerified || item.applicability === 'Uncertain' ? 'Uncertain' : item.riskEvidence ? 'Yes' : 'No';
  return { ...item, criteria: rated, score, priority, threat, important, urgent, urgentImportant: urgent && important, scoringVersion: SCORING_VERSION, scoredAt: now.toISOString() };
}

export function canonicalUrl(input: string): string {
  const u = new URL(input); u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) u.searchParams.delete(key);
  u.hostname = u.hostname.replace(/^www\./,'');
  return u.toString().replace(/\/$/,'');
}
export function documentKey(title: string): string | null {
  const match = title.match(/\b(Republic Act|RA|Executive Order|EO|Memorandum Circular|MC)\s*(?:No\.?\s*)?([A-Z]*[- ]?\d{2,}(?:[- ]\d+)*)\b/i);
  return match ? match[0].toLowerCase().replace(/[^a-z0-9]/g,'') : null;
}
export async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
}
