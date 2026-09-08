import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Simulates a one-time AML-stage outage so the retry test can prove that a
// failed AML stage is retried WITHOUT re-running an already-successful KYC
// stage — CLAUDE.md's "AI failure test" (section 41) and the general
// retryability/idempotency requirements (sections 19-21).
let failAmlOnce = false;

vi.mock('./tools', async () => {
  const actual = await vi.importActual<typeof import('./tools')>('./tools');
  return {
    ...actual,
    analyze_aml: async (applicationId: string) => {
      if (failAmlOnce) {
        failAmlOnce = false;
        throw new Error('Simulated AML analyzer outage');
      }
      return actual.analyze_aml(applicationId);
    },
  };
});

const { db } = await import('@/lib/db');
const { getFileStorage } = await import('@/lib/storage/LocalDiskStorage');
const { runHermesPipeline } = await import('./orchestrator');

describe('runHermesPipeline retry behavior', () => {
  let applicationId: string;

  beforeEach(async () => {
    const app = await db.application.create({
      data: { customerName: 'Retry Test Customer', status: 'New', analysisStage: 'NEW' },
    });
    applicationId = app.id;

    const storage = getFileStorage();
    const kycKey = await storage.upload({ applicationId, fileName: 'Passport.pdf', data: Buffer.from('%PDF fake passport') });
    await db.uploadedFile.create({
      data: { applicationId, name: 'Passport.pdf', mimeType: 'application/pdf', size: 20, category: 'kyc_document', storageKey: kycKey },
    });
    const addrKey = await storage.upload({ applicationId, fileName: 'AddressProof.pdf', data: Buffer.from('%PDF fake address') });
    await db.uploadedFile.create({
      data: { applicationId, name: 'AddressProof.pdf', mimeType: 'application/pdf', size: 20, category: 'kyc_document', storageKey: addrKey },
    });
    const csvKey = await storage.upload({
      applicationId,
      fileName: 'Jan.csv',
      data: Buffer.from('id,date,amount\n1,2024-01-01,10\n'),
    });
    await db.uploadedFile.create({
      data: { applicationId, name: 'Jan.csv', mimeType: 'text/csv', size: 30, category: 'transaction_log', storageKey: csvKey },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('preserves the KYC result and does not re-run it when AML fails then is retried', async () => {
    failAmlOnce = true;
    await expect(runHermesPipeline(applicationId)).rejects.toThrow('Simulated AML analyzer outage');

    let app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(app.status).toBe('Error');
    expect(app.analysisStage).toBe('ANALYSIS_ERROR');

    const kycAfterFailure = await db.kycResult.findUnique({ where: { applicationId } });
    expect(kycAfterFailure).not.toBeNull();

    const kycStartedCountBefore = await db.auditEntry.count({
      where: { applicationId, action: 'KYC Completeness Analysis Started' },
    });
    expect(kycStartedCountBefore).toBe(1);

    // Retry — AML succeeds this time (failAmlOnce is now false).
    await runHermesPipeline(applicationId);

    app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(app.status).toBe('PendingReview');
    expect(app.analysisStage).toBe('PENDING_REVIEW');

    const kycStartedCountAfter = await db.auditEntry.count({
      where: { applicationId, action: 'KYC Completeness Analysis Started' },
    });
    expect(kycStartedCountAfter).toBe(1); // unchanged: KYC was not re-run

    expect(await db.amlResult.findUnique({ where: { applicationId } })).not.toBeNull();
    expect(await db.complianceSummary.findUnique({ where: { applicationId } })).not.toBeNull();
  });

  it('rejects starting analysis again once a final decision has been recorded', async () => {
    await runHermesPipeline(applicationId);
    await db.application.update({ where: { id: applicationId }, data: { status: 'Approved' } });

    await expect(runHermesPipeline(applicationId)).rejects.toThrow(/already completed analysis/);
  });
});
