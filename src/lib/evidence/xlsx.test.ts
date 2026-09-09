import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { isXlsxFile, xlsxBufferToCsvText } from './xlsx';
import { buildTransactionEvidenceSet } from './transactionEvidence';

async function buildTestWorkbook(rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transactions');
  rows.forEach((row) => sheet.addRow(row));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('isXlsxFile', () => {
  it('recognizes the standard .xlsx MIME type', () => {
    expect(
      isXlsxFile({
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: 'transactions.xlsx',
      })
    ).toBe(true);
  });

  it('recognizes by extension even when the browser reports a generic MIME type', () => {
    expect(isXlsxFile({ mimeType: 'application/octet-stream', name: 'March.xlsx' })).toBe(true);
  });

  it('does not misclassify a CSV file', () => {
    expect(isXlsxFile({ mimeType: 'text/csv', name: 'March.csv' })).toBe(false);
  });
});

describe('xlsxBufferToCsvText', () => {
  it('converts a workbook into CSV text usable by the standard evidence pipeline', async () => {
    const buffer = await buildTestWorkbook([
      ['id', 'date', 'amount', 'currency', 'counterparty'],
      ['X1', '2026-01-05', 120.5, 'USD', 'Example Store'],
      ['X2', '2026-01-10', 9500, 'USD', 'Offshore Corp'],
    ]);

    const csvText = await xlsxBufferToCsvText(buffer);
    expect(csvText).toContain('id,date,amount,currency,counterparty');
    expect(csvText).toContain('X1');
    expect(csvText).toContain('Example Store');
  });

  it('produces evidence identical in shape to a native CSV upload once fed through buildTransactionEvidenceSet', async () => {
    const rows = [
      ['id', 'date', 'amount', 'currency', 'counterparty'],
      ['X1', '2026-01-05', 120.5, 'USD', 'Example Store'],
      ['X2', '2026-01-10', 9500, 'USD', 'Offshore Corp'],
    ];
    const buffer = await buildTestWorkbook(rows);
    const csvText = await xlsxBufferToCsvText(buffer);

    const evidence = buildTransactionEvidenceSet([{ name: 'transactions.xlsx', text: csvText }]);
    expect(evidence.totalRowsProcessed).toBe(2);
    expect(evidence.statistics.totalAmount).toBeCloseTo(120.5 + 9500);
  });

  it('quotes fields containing commas so downstream CSV parsing stays correct', async () => {
    const buffer = await buildTestWorkbook([
      ['id', 'counterparty'],
      ['X1', 'Acme, Inc.'],
    ]);
    const csvText = await xlsxBufferToCsvText(buffer);
    const evidence = buildTransactionEvidenceSet([{ name: 't.xlsx', text: csvText }]);
    expect(evidence.representativeSample.some((t) => t.counterparty === 'Acme, Inc.')).toBe(true);
  });

  it('rejects a non-workbook buffer with a clear error rather than throwing an opaque one', async () => {
    const garbage = Buffer.from('this is not a real xlsx file');
    await expect(xlsxBufferToCsvText(garbage)).rejects.toThrow(/Could not read this file as an Excel/);
  });
});
