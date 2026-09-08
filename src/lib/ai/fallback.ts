// Deterministic, explainable stand-ins for the three Gemini-backed stages,
// used whenever GEMINI_API_KEY is unset or a Gemini call fails. Every
// result is tagged source: 'fallback-deterministic' and the UI always
// surfaces that tag — this is a degraded-but-functional mode, never
// presented as if it were model output (CLAUDE.md sections 33/36).
import type { KycEvidenceSet, InferredKycDocType } from '@/lib/evidence/kycEvidence';
import type { TransactionEvidenceSet } from '@/lib/evidence/transactionEvidence';
import type { AmlRiskResult, ComplianceSummaryResult, KycCompletenessResult, RiskLevel } from '@/lib/types';

function humanizeDocType(t: InferredKycDocType): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fallbackKycCompleteness(evidence: KycEvidenceSet): KycCompletenessResult {
  const missing = evidence.likelyMissingTypes;
  const isComplete = missing.length === 0 && evidence.documents.length > 0;
  return {
    isComplete,
    missingInformation: missing.map((t) => `${humanizeDocType(t)} not found among uploaded documents.`),
    reasoning:
      `Deterministic fallback analysis (no GEMINI_API_KEY configured): classified ${evidence.documents.length} ` +
      `document(s) by filename pattern. Recognized categories: ${evidence.recognizedTypes.map(humanizeDocType).join(', ') || 'none'}. ` +
      `This heuristic checks for at least one identity document (passport, national ID, or driver's licence) and one proof of address; ` +
      `it does not read document contents.`,
    evidenceReferences: evidence.documents.map((d) => d.name),
    source: 'fallback-deterministic',
  };
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

export function fallbackAmlRisk(
  txEvidence: TransactionEvidenceSet,
  kycEvidence: KycEvidenceSet
): AmlRiskResult {
  const patternScore = Math.min(70, txEvidence.suspiciousPatterns.length * 20);
  const velocityScore = txEvidence.statistics.averageDailyVelocity > 10 ? 15 : 0;
  const missingDocsScore = kycEvidence.likelyMissingTypes.length * 10;
  const noDataPenalty = txEvidence.totalRowsProcessed === 0 ? 25 : 0;
  const riskScore = Math.min(100, patternScore + velocityScore + missingDocsScore + noDataPenalty);

  const evidenceReferences = [
    ...txEvidence.suspiciousPatterns.flatMap((p) => p.evidenceReferences),
    ...txEvidence.sourceFiles,
  ];

  return {
    riskLevel: riskLevelFromScore(riskScore),
    riskScore,
    flags: txEvidence.suspiciousPatterns.map((p) => p.description),
    reasoning:
      `Deterministic fallback analysis (no GEMINI_API_KEY configured): evaluated ${txEvidence.totalRowsProcessed} ` +
      `transaction row(s) across ${txEvidence.sourceFiles.length} file(s) using statistical outlier, structuring, ` +
      `velocity, and round-number heuristics. ${txEvidence.suspiciousPatterns.length} pattern(s) flagged. ` +
      `${kycEvidence.likelyMissingTypes.length > 0 ? 'Incomplete KYC documentation increases uncertainty in this assessment.' : ''}`,
    evidenceReferences: Array.from(new Set(evidenceReferences)),
    source: 'fallback-deterministic',
  };
}

export function fallbackComplianceSummary(
  kyc: KycCompletenessResult,
  aml: AmlRiskResult
): ComplianceSummaryResult {
  const overallRisk: RiskLevel = !kyc.isComplete && aml.riskLevel !== 'High' ? 'Medium' : aml.riskLevel;

  const recommendations: string[] = [];
  if (!kyc.isComplete) recommendations.push('Request the missing KYC documentation before final decision.');
  if (aml.riskLevel === 'High') recommendations.push('Escalate to a senior compliance officer for manual review.');
  if (aml.flags.length > 0) recommendations.push('Review each flagged transaction pattern individually with supporting evidence.');
  if (recommendations.length === 0) recommendations.push('No additional action indicated by automated analysis; proceed with standard review.');

  return {
    overallRisk,
    summary:
      `Deterministic fallback summary (no GEMINI_API_KEY configured). KYC documentation is ` +
      `${kyc.isComplete ? 'complete' : 'incomplete'}. AML analysis assigned a ${aml.riskLevel.toLowerCase()} risk level ` +
      `(score ${aml.riskScore.toFixed(0)}/100) based on ${aml.flags.length} flagged pattern(s).`,
    reasoning: `Combined KYC reasoning: ${kyc.reasoning} | Combined AML reasoning: ${aml.reasoning}`,
    recommendations,
    source: 'fallback-deterministic',
  };
}
