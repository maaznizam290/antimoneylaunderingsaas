// Hermes Compliance Orchestrator. Sequences the controlled tools in
// src/lib/hermes/tools.ts to drive an application through the persistent
// analysis-stage state machine (src/lib/types.ts ANALYSIS_STAGES).
//
// Design notes:
//  - The database (via the tools) is the only source of truth for whether a
//    stage already ran — not this function's control flow, not Hermes
//    "memory". That's what makes retries safe: this function can be called
//    again after a partial failure and it will skip whatever already
//    succeeded (CLAUDE.md sections 19-21).
//  - Every tool call is appended to the current AgentRun's toolCalls log for
//    observability (see the Hermes Agent Activity panel in the UI).
//  - Hermes never sets a final reviewer decision (Approved/Escalated/
//    Rejected) — its ceiling is request_human_review, which only marks the
//    case PendingReview.
import { db } from '@/lib/db';
import { toJsonText } from '@/lib/json';
import * as tools from './tools';

export class AlreadyProcessedError extends Error {}
export class ValidationError extends Error {}

interface ToolCallLog {
  tool: string;
  input: unknown;
  output: unknown;
  at: string;
}

const TERMINAL_STATUSES = ['PendingReview', 'Approved', 'Escalated', 'Rejected'];

export async function runHermesPipeline(applicationId: string): Promise<void> {
  const app = await tools.get_application(applicationId);
  if (TERMINAL_STATUSES.includes(app.status)) {
    throw new AlreadyProcessedError(
      `Application ${applicationId} has already completed analysis (status: ${app.status}).`
    );
  }

  const kycFiles = await tools.get_documents(applicationId, 'kyc_document');
  const txFiles = await tools.get_documents(applicationId, 'transaction_log');
  if (kycFiles.length === 0 || txFiles.length === 0) {
    throw new ValidationError('At least one KYC document and one transaction log are required to start analysis.');
  }

  const run = await db.agentRun.create({
    data: {
      applicationId,
      objective: 'Run the KYC → AML → compliance-summary pipeline and request human review.',
      status: 'running',
    },
  });

  const toolCalls: ToolCallLog[] = [];
  const log = (tool: string, input: unknown, output: unknown) => {
    toolCalls.push({ tool, input, output, at: new Date().toISOString() });
  };

  try {
    log('get_application', { applicationId }, { status: app.status, analysisStage: app.analysisStage });
    log('get_documents', { applicationId, category: 'kyc_document' }, { count: kycFiles.length });
    log('get_documents', { applicationId, category: 'transaction_log' }, { count: txFiles.length });

    await db.application.update({
      where: { id: applicationId },
      data: { status: 'Processing', analysisStage: 'DOCUMENTS_VALIDATED', analysisError: null },
    });

    let kycResult = await db.kycResult.findUnique({ where: { applicationId } });
    if (!kycResult) {
      await db.application.update({ where: { id: applicationId }, data: { analysisStage: 'KYC_ANALYSIS_RUNNING' } });
      await tools.record_audit_event(applicationId, 'Hermes', 'KYC Completeness Analysis Started');
      const result = await tools.analyze_kyc(applicationId);
      log('analyze_kyc', { applicationId }, { isComplete: result.isComplete, source: result.source });
      await tools.record_audit_event(
        applicationId,
        'Hermes',
        'KYC Completeness Analysis Finished',
        `Complete: ${result.isComplete}. Source: ${result.source}. ${result.reasoning.slice(0, 160)}`
      );
      await db.application.update({ where: { id: applicationId }, data: { analysisStage: 'KYC_ANALYSIS_COMPLETE' } });
    } else {
      log('analyze_kyc', { applicationId }, { skipped: true, reason: 'result already persisted' });
    }

    let amlResult = await db.amlResult.findUnique({ where: { applicationId } });
    if (!amlResult) {
      await db.application.update({ where: { id: applicationId }, data: { analysisStage: 'AML_ANALYSIS_RUNNING' } });
      await tools.record_audit_event(applicationId, 'Hermes', 'AML Risk Analysis Started');
      const txEvidence = await tools.analyze_transactions(applicationId);
      log('analyze_transactions', { applicationId }, {
        totalRowsProcessed: txEvidence.totalRowsProcessed,
        sourceFiles: txEvidence.sourceFiles,
        patternsFound: txEvidence.suspiciousPatterns.length,
      });
      const result = await tools.analyze_aml(applicationId);
      log('analyze_aml', { applicationId }, { riskLevel: result.riskLevel, riskScore: result.riskScore, source: result.source });
      await tools.record_audit_event(
        applicationId,
        'Hermes',
        'AML Risk Analysis Finished',
        `Risk: ${result.riskLevel} (${result.riskScore.toFixed(0)}/100). Flags: ${result.flags.join(', ') || 'none'}.`
      );
      await db.application.update({ where: { id: applicationId }, data: { analysisStage: 'AML_ANALYSIS_COMPLETE' } });
    } else {
      log('analyze_aml', { applicationId }, { skipped: true, reason: 'result already persisted' });
    }

    let summary = await db.complianceSummary.findUnique({ where: { applicationId } });
    if (!summary) {
      await db.application.update({ where: { id: applicationId }, data: { analysisStage: 'SUMMARY_GENERATION_RUNNING' } });
      await tools.record_audit_event(applicationId, 'Hermes', 'Compliance Summary Generation Started');
      const result = await tools.generate_compliance_summary(applicationId);
      log('generate_compliance_summary', { applicationId }, { overallRisk: result.overallRisk, source: result.source });
      await tools.record_audit_event(
        applicationId,
        'Hermes',
        'Compliance Summary Generation Finished',
        `Overall Risk: ${result.overallRisk}.`
      );
      await db.application.update({ where: { id: applicationId }, data: { analysisStage: 'SUMMARY_COMPLETE' } });
    } else {
      log('generate_compliance_summary', { applicationId }, { skipped: true, reason: 'result already persisted' });
    }

    const similarCases = await tools.retrieve_similar_cases();
    log('retrieve_similar_cases', { kind: 'case_pattern' }, { count: similarCases.length });

    await tools.request_human_review(applicationId);
    log('request_human_review', { applicationId }, { status: 'PendingReview' });

    await db.agentRun.update({
      where: { id: run.id },
      data: { status: 'completed', completedAt: new Date(), result: 'PENDING_REVIEW', toolCalls: toJsonText(toolCalls) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during Hermes orchestration';
    await db.application.update({
      where: { id: applicationId },
      data: { status: 'Error', analysisStage: 'ANALYSIS_ERROR', analysisError: message },
    });
    await tools.record_audit_event(applicationId, 'System', 'Analysis Error', message);
    await db.agentRun.update({
      where: { id: run.id },
      data: { status: 'failed', completedAt: new Date(), error: message, toolCalls: toJsonText(toolCalls) },
    });
    throw err;
  }
}
