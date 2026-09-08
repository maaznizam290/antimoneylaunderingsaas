import { describe, expect, it } from 'vitest';
import { buildTransactionEvidenceSet } from './transactionEvidence';

describe('buildTransactionEvidenceSet', () => {
  it('aggregates transactions across multiple files rather than using only the first', () => {
    const jan = 'id,date,amount,currency,counterparty\nJ1,2024-01-05,100,USD,Alice\nJ2,2024-01-10,150,USD,Bob\n';
    const feb = 'id,date,amount,currency,counterparty\nF1,2024-02-01,200,USD,Carol\n';

    const evidence = buildTransactionEvidenceSet([
      { name: 'January.csv', text: jan },
      { name: 'February.csv', text: feb },
    ]);

    expect(evidence.totalRowsProcessed).toBe(3);
    expect(evidence.sourceFiles).toEqual(['January.csv', 'February.csv']);
    expect(evidence.statistics.totalTransactions).toBe(3);
    expect(evidence.statistics.totalAmount).toBe(450);
  });

  it('flags large outlier transactions with evidence citations', () => {
    const rows = ['id,date,amount,counterparty'];
    for (let i = 0; i < 20; i++) {
      rows.push(`T${i},2024-01-0${(i % 9) + 1},100,Regular`);
    }
    rows.push('T-outlier,2024-01-15,50000,Regular');
    const csv = rows.join('\n');

    const evidence = buildTransactionEvidenceSet([{ name: 'all.csv', text: csv }]);
    const outlierFlag = evidence.suspiciousPatterns.find((f) => f.type === 'large_outlier_transactions');

    expect(outlierFlag).toBeDefined();
    expect(outlierFlag?.evidenceReferences.some((ref) => ref.includes('T-outlier'))).toBe(true);
  });

  it('detects possible structuring just under a reporting threshold', () => {
    const rows = ['id,date,amount,counterparty'];
    for (let i = 0; i < 4; i++) {
      rows.push(`S${i},2024-03-0${i + 1},9500,SameParty`);
    }
    const csv = rows.join('\n');

    const evidence = buildTransactionEvidenceSet([{ name: 'march.csv', text: csv }]);
    const structuring = evidence.suspiciousPatterns.find((f) => f.type === 'possible_structuring');
    expect(structuring).toBeDefined();
  });

  it('records parse errors without discarding valid rows from other files', () => {
    const good = 'id,date,amount,counterparty\nG1,2024-01-01,10,X\n';
    const bad = 'not_amount_column\nabc\n';

    const evidence = buildTransactionEvidenceSet([
      { name: 'good.csv', text: good },
      { name: 'bad.csv', text: bad },
    ]);

    expect(evidence.parseErrors.length).toBeGreaterThan(0);
    expect(evidence.statistics.totalTransactions).toBeGreaterThanOrEqual(1);
  });
});
