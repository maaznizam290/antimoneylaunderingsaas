// The *only* interface Hermes is allowed to use to touch application data.
// No tool here grants raw SQL, filesystem, or network access — each tool is
// a narrow, validated, audited operation (CLAUDE.md sections 8/30). The
// orchestrator (src/lib/hermes/orchestrator.ts) calls these; it never
// queries Prisma directly for business writes.
import { db } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/LocalDiskStorage';
import { buildKycEvidenceSet, type KycEvidenceSet } from '@/lib/evidence/kycEvidence';
import { buildTransactionEvidenceSet, type TransactionEvidenceSet } from '@/lib/evidence/transactionEvidence';
import { analyzeKycCompleteness } from '@/lib/ai/flows/determineKycCompleteness';
import { analyzeAmlRisk } from '@/lib/ai/flows/flagAmlRisks';
import { generateComplianceSummary as generateComplianceSummaryFlow } from '@/lib/ai/flows/summarizeComplianceResults';
import { recordAuditEvent } from '@/lib/audit';
import { toJsonText, fromJsonText } from '@/lib/json';
import type {
  AiSource,
  AmlRiskResult,
  ComplianceSummaryResult,
  FileCategory,
  KycCompletenessResult,
  RiskLevel,
} from '@/lib/types';

export class ToolError extends Error {}

export async function get_application(applicationId: string) {
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new ToolError(`Application ${applicationId} not found`);
  return app;
}

export async function get_application_status(applicationId: string) {
  const app = await get_application(applicationId);
  return { status: app.status, analysisStage: app.analysisStage, analysisError: app.analysisError };
}

export async function get_documents(applicationId: string, category?: FileCategory) {
  return db.uploadedFile.findMany({
    where: category ? { applicationId, category } : { applicationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function get_transaction_data(applicationId: string): Promise<TransactionEvidenceSet> {
  const files = await get_documents(applicationId, 'transaction_log');
  const storage = getFileStorage();
  const texts = await Promise.all(
    files.map(async (f) => ({
      name: f.name,
      text: (await storage.retrieve(f.storageKey)).toString('utf-8'),
    }))
  );
  return buildTransactionEvidenceSet(texts);
}

async function loadKycEvidence(
  applicationId: string
): Promise<{ evidence: KycEvidenceSet; documents: { name: string; dataUri: string }[] }> {
  const files = await get_documents(applicationId, 'kyc_document');
  const evidence = buildKycEvidenceSet(files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size })));
  const storage = getFileStorage();
  const documents = await Promise.all(
    files.map(async (f) => {
      const buf = await storage.retrieve(f.storageKey);
      return { name: f.name, dataUri: `data:${f.mimeType};base64,${buf.toString('base64')}` };
    })
  );
  return { evidence, documents };
}

export async function analyze_kyc(applicationId: string): Promise<KycCompletenessResult> {
  const { evidence, documents } = await loadKycEvidence(applicationId);
  const result = await analyzeKycCompleteness(evidence, documents);
  const data = {
    isComplete: result.isComplete,
    missingInformation: toJsonText(result.missingInformation),
    reasoning: result.reasoning,
    evidenceReferences: toJsonText(result.evidenceReferences),
    source: result.source,
  };
  await db.kycResult.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
  return result;
}

export async function analyze_transactions(applicationId: string): Promise<TransactionEvidenceSet> {
  return get_transaction_data(applicationId);
}

export async function analyze_aml(applicationId: string): Promise<AmlRiskResult> {
  const { evidence: kycEvidence, documents } = await loadKycEvidence(applicationId);
  const txEvidence = await get_transaction_data(applicationId);
  const result = await analyzeAmlRisk(kycEvidence, txEvidence, documents);
  const data = {
    riskLevel: result.riskLevel,
    riskScore: result.riskScore,
    flags: toJsonText(result.flags),
    reasoning: result.reasoning,
    evidenceReferences: toJsonText(result.evidenceReferences),
    source: result.source,
  };
  await db.amlResult.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
  return result;
}

export async function generate_compliance_summary(applicationId: string): Promise<ComplianceSummaryResult> {
  const kyc = await db.kycResult.findUnique({ where: { applicationId } });
  const aml = await db.amlResult.findUnique({ where: { applicationId } });
  if (!kyc || !aml) {
    throw new ToolError('Both a KYC result and an AML result must exist before generating a compliance summary.');
  }

  const kycResult: KycCompletenessResult = {
    isComplete: kyc.isComplete,
    missingInformation: fromJsonText<string[]>(kyc.missingInformation, []),
    reasoning: kyc.reasoning,
    evidenceReferences: fromJsonText<string[]>(kyc.evidenceReferences, []),
    source: kyc.source as AiSource,
  };
  const amlResult: AmlRiskResult = {
    riskLevel: aml.riskLevel as RiskLevel,
    riskScore: aml.riskScore,
    flags: fromJsonText<string[]>(aml.flags, []),
    reasoning: aml.reasoning,
    evidenceReferences: fromJsonText<string[]>(aml.evidenceReferences, []),
    source: aml.source as AiSource,
  };

  const result = await generateComplianceSummaryFlow(kycResult, amlResult);
  const data = {
    overallRisk: result.overallRisk,
    summary: result.summary,
    reasoning: result.reasoning,
    recommendations: toJsonText(result.recommendations),
    source: result.source,
  };
  await db.complianceSummary.upsert({
    where: { applicationId },
    create: { applicationId, ...data },
    update: data,
  });
  return result;
}

/// Retrieves curated, human-approved knowledge — never raw customer case
/// data — that Hermes may use as context. See CLAUDE.md section 10 and
/// prisma/seed.ts for how CuratedKnowledge is populated (explicitly, by a
/// human-run seed step, not by Hermes learning on its own).
export async function retrieve_similar_cases(kind: string = 'case_pattern', limit = 5) {
  return db.curatedKnowledge.findMany({ where: { kind }, take: limit, orderBy: { createdAt: 'desc' } });
}

export async function record_audit_event(
  applicationId: string,
  actor: string,
  action: string,
  details?: string
) {
  return recordAuditEvent(applicationId, actor, action, details);
}

/// Marks the application ready for a human decision. This is the ceiling of
/// Hermes' authority: it may request review, it may never itself approve,
/// escalate, reject, or otherwise finalize a case (CLAUDE.md sections 9/37).
export async function request_human_review(applicationId: string) {
  const app = await db.application.update({
    where: { id: applicationId },
    data: { status: 'PendingReview', analysisStage: 'PENDING_REVIEW' },
  });
  await recordAuditEvent(applicationId, 'Hermes', 'Application Ready for Review');
  return app;
}
