import type {
  Application,
  UploadedFile,
  KycResult,
  AmlResult,
  ComplianceSummary,
  AuditEntry,
  Comment,
  AgentRun,
} from '@prisma/client';
import { fromJsonText } from '@/lib/json';

export type FullApplication = Application & {
  files: UploadedFile[];
  kycResult: KycResult | null;
  amlResult: AmlResult | null;
  summary: ComplianceSummary | null;
  auditEntries: AuditEntry[];
  comments: Comment[];
  agentRuns: AgentRun[];
};

/// Prisma returns Json columns as `JsonValue`; this gives API responses a
/// consistent, typed shape (arrays as arrays, not `unknown`).
export function serializeApplication(app: FullApplication) {
  return {
    id: app.id,
    customerName: app.customerName,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    status: app.status,
    analysisStage: app.analysisStage,
    analysisError: app.analysisError,
    files: app.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      category: f.category,
      createdAt: f.createdAt.toISOString(),
    })),
    kycResult: app.kycResult
      ? {
          isComplete: app.kycResult.isComplete,
          missingInformation: fromJsonText<string[]>(app.kycResult.missingInformation, []),
          reasoning: app.kycResult.reasoning,
          evidenceReferences: fromJsonText<string[]>(app.kycResult.evidenceReferences, []),
          source: app.kycResult.source,
          createdAt: app.kycResult.createdAt.toISOString(),
        }
      : null,
    amlResult: app.amlResult
      ? {
          riskLevel: app.amlResult.riskLevel,
          riskScore: app.amlResult.riskScore,
          flags: fromJsonText<string[]>(app.amlResult.flags, []),
          reasoning: app.amlResult.reasoning,
          evidenceReferences: fromJsonText<string[]>(app.amlResult.evidenceReferences, []),
          source: app.amlResult.source,
          createdAt: app.amlResult.createdAt.toISOString(),
        }
      : null,
    summary: app.summary
      ? {
          overallRisk: app.summary.overallRisk,
          summary: app.summary.summary,
          reasoning: app.summary.reasoning,
          recommendations: fromJsonText<string[]>(app.summary.recommendations, []),
          source: app.summary.source,
          createdAt: app.summary.createdAt.toISOString(),
        }
      : null,
    auditTrail: app.auditEntries
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((a) => ({
        id: a.id,
        timestamp: a.timestamp.toISOString(),
        actor: a.actor,
        action: a.action,
        details: a.details,
      })),
    comments: app.comments
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({ id: c.id, author: c.author, body: c.body, createdAt: c.createdAt.toISOString() })),
    agentRuns: app.agentRuns
      .slice()
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        status: r.status,
        objective: r.objective,
        toolCalls: fromJsonText<unknown[]>(r.toolCalls, []),
        result: r.result,
        error: r.error,
      })),
  };
}

export const APPLICATION_INCLUDE = {
  files: true,
  kycResult: true,
  amlResult: true,
  summary: true,
  auditEntries: true,
  comments: true,
  agentRuns: true,
} as const;
