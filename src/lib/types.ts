// Shared domain types and the two state machines that drive an application:
//
//   BUSINESS_STATUSES  — what a reviewer / the dashboard sees (preserved
//                        verbatim from the source ComplyAI application).
//   ANALYSIS_STAGES    — the internal AI-pipeline state machine (new in
//                        Verifin) that makes each stage independently
//                        retryable without disturbing the business status
//                        or re-running already-successful stages.

export const BUSINESS_STATUSES = [
  'New',
  'Processing',
  'PendingReview',
  'Approved',
  'Escalated',
  'Rejected',
  'Error',
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const ANALYSIS_STAGES = [
  'NEW',
  'DOCUMENTS_VALIDATED',
  'KYC_ANALYSIS_RUNNING',
  'KYC_ANALYSIS_COMPLETE',
  'AML_ANALYSIS_RUNNING',
  'AML_ANALYSIS_COMPLETE',
  'SUMMARY_GENERATION_RUNNING',
  'SUMMARY_COMPLETE',
  'PENDING_REVIEW',
  'ANALYSIS_ERROR',
] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

export const RISK_LEVELS = ['Low', 'Medium', 'High'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const FILE_CATEGORIES = ['kyc_document', 'transaction_log'] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const REVIEW_DECISIONS = ['Approved', 'Escalated', 'Rejected'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/// Which analyzer produced an AI result — always shown in the UI so a
/// degraded/no-API-key run is never presented as if it were a real model.
export const AI_SOURCES = ['gemini', 'fallback-deterministic'] as const;
export type AiSource = (typeof AI_SOURCES)[number];

export interface KycCompletenessResult {
  isComplete: boolean;
  missingInformation: string[];
  reasoning: string;
  evidenceReferences: string[];
  source: AiSource;
}

export interface AmlRiskResult {
  riskLevel: RiskLevel;
  riskScore: number;
  flags: string[];
  reasoning: string;
  evidenceReferences: string[];
  source: AiSource;
}

export interface ComplianceSummaryResult {
  overallRisk: RiskLevel;
  summary: string;
  reasoning: string;
  recommendations: string[];
  source: AiSource;
}
