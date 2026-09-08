import { describe, expect, it } from 'vitest';
import { buildKycEvidenceSet, classifyKycDocument } from './kycEvidence';

describe('classifyKycDocument', () => {
  it('classifies common KYC document names', () => {
    expect(classifyKycDocument('Passport.pdf')).toBe('passport');
    expect(classifyKycDocument('utility_bill_march.pdf')).toBe('proof_of_address');
    expect(classifyKycDocument('drivers_license.jpg')).toBe('drivers_license');
    expect(classifyKycDocument('random_scan.png')).toBe('other');
  });
});

describe('buildKycEvidenceSet', () => {
  it('does not drop any uploaded document', () => {
    const files = [
      { id: '1', name: 'Passport.pdf', mimeType: 'application/pdf', size: 100 },
      { id: '2', name: 'AddressProof.pdf', mimeType: 'application/pdf', size: 100 },
      { id: '3', name: 'BankStatement.pdf', mimeType: 'application/pdf', size: 100 },
    ];
    const evidence = buildKycEvidenceSet(files);
    expect(evidence.documents).toHaveLength(3);
  });

  it('flags likely missing identity and address proof when absent', () => {
    const evidence = buildKycEvidenceSet([
      { id: '1', name: 'random.pdf', mimeType: 'application/pdf', size: 100 },
    ]);
    expect(evidence.likelyMissingTypes).toContain('passport');
    expect(evidence.likelyMissingTypes).toContain('proof_of_address');
  });

  it('recognizes a complete set as not missing common types', () => {
    const evidence = buildKycEvidenceSet([
      { id: '1', name: 'Passport.pdf', mimeType: 'application/pdf', size: 100 },
      { id: '2', name: 'AddressProof.pdf', mimeType: 'application/pdf', size: 100 },
    ]);
    expect(evidence.likelyMissingTypes).toEqual([]);
  });
});
