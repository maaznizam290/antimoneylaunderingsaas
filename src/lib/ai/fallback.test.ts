import { describe, expect, it } from 'vitest';
import { fallbackAmlRisk, fallbackComplianceSummary, fallbackKycCompleteness } from './fallback';
import { buildKycEvidenceSet } from '@/lib/evidence/kycEvidence';
import { buildTransactionEvidenceSet } from '@/lib/evidence/transactionEvidence';

describe('fallback analyzers', () => {
  it('marks all fallback results with source fallback-deterministic', () => {
    const kycEvidence = buildKycEvidenceSet([{ id: '1', name: 'Passport.pdf', mimeType: 'application/pdf', size: 10 }]);
    const txEvidence = buildTransactionEvidenceSet([]);

    const kyc = fallbackKycCompleteness(kycEvidence);
    const aml = fallbackAmlRisk(txEvidence, kycEvidence);
    const summary = fallbackComplianceSummary(kyc, aml);

    expect(kyc.source).toBe('fallback-deterministic');
    expect(aml.source).toBe('fallback-deterministic');
    expect(summary.source).toBe('fallback-deterministic');
  });

  it('flags incomplete KYC when only a passport is uploaded (no address proof)', () => {
    const kycEvidence = buildKycEvidenceSet([{ id: '1', name: 'Passport.pdf', mimeType: 'application/pdf', size: 10 }]);
    const kyc = fallbackKycCompleteness(kycEvidence);
    expect(kyc.isComplete).toBe(false);
    expect(kyc.missingInformation.length).toBeGreaterThan(0);
  });

  it('raises AML risk when no transaction data was provided at all', () => {
    const kycEvidence = buildKycEvidenceSet([
      { id: '1', name: 'Passport.pdf', mimeType: 'application/pdf', size: 10 },
      { id: '2', name: 'AddressProof.pdf', mimeType: 'application/pdf', size: 10 },
    ]);
    const txEvidence = buildTransactionEvidenceSet([]);
    const aml = fallbackAmlRisk(txEvidence, kycEvidence);
    expect(aml.riskScore).toBeGreaterThan(0);
  });
});
