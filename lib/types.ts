export type Priority = 'P0' | 'P1' | 'P2' | 'Archived';
export type LegalStatus = 'Proposed / Pending' | 'Approved / Enacted' | 'Published' | 'Effective / Enforceable' | 'Suspended' | 'Amended' | 'Repealed' | 'Status Unverified' | 'Not a legal issuance';
export type Applicability = 'Direct' | 'Indirect' | 'Uncertain' | 'Not applicable';
export interface Criterion { key: string; label: string; weight: number; rating: number; reason: string }
export interface Evidence { label: string; detail: string; url: string }
export interface Intelligence {
  id: string; headline: string; sourceId: string; source: string; url: string; relatedUrls: string[];
  documentId: string | null; publishedAt: string | null; issuedAt: string | null; discoveredAt: string;
  effectiveAt: string | null; deadline: string | null; dateEvidence: string | null;
  type: string; legalStatus: LegalStatus; summary: string; applicability: Applicability;
  directImpact: string; indirectImpact: string; manufacturers: string; dealerships: string;
  functions: string[]; classes: string[]; action: string; verification: string; confidence: number;
  coverageVerified: boolean; severeDisruption: boolean; riskEvidence: boolean;
  deadlineVerified: boolean; opportunity: boolean; demo: boolean; historical: boolean;
  evidence: Evidence[]; criteria: Criterion[]; score: number; priority: Priority;
  threat: 'Yes' | 'No' | 'Uncertain'; important: boolean; urgent: boolean; urgentImportant: boolean;
  scoringVersion: string; scoredAt: string; contentHash: string; reviewNote?: string;
}
export interface Source {
  id: string; name: string; agency: string; url: string; kind: 'rss' | 'html' | 'document' | 'manual';
  category: 'Government' | 'Legal archive' | 'Industry' | 'News' | 'Regional'; official: boolean;
  enabled: boolean; notes: string;
}
export interface SourceHealth extends Source {
  status: 'Healthy' | 'Unavailable' | 'Blocked by robots' | 'Manual review' | 'Not checked';
  checkedAt: string | null; lastSuccessAt: string | null; error: string | null;
  candidates: number; ingested: number; robots: string | null;
}
export interface CrawlRun { id: string; startedAt: string; finishedAt: string | null; status: string; sourcesChecked: number; recordsFound: number; errors: number; trigger: string }
export interface QueueEntry { id: string; recordId: string; status: string; createdAt: string; approvedAt: string | null; recipientIds: string[] }
export interface Recipient { id: string; name: string; email?: string; active: boolean }
export interface Audit { id: string; createdAt: string; action: string; recordId: string | null; actor: string; detail: string }
export interface ScoringConfig { weights: number[]; high: number; monitor: number; critical: number; minimumConfidence: number; urgentDays: number }
export interface Snapshot {
  records: Intelligence[]; sources: SourceHealth[]; runs: CrawlRun[]; queue: QueueEntry[];
  recipients: Recipient[]; history: { id: string; subject: string; status: string; createdAt: string; detail: string; draftText?: string }[];
  audit: Audit[]; config: ScoringConfig; mode: { email: string; schedule: string; github: string; access?: string; };
}
