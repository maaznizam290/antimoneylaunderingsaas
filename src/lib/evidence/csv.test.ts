import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple CSV with header', () => {
    const rows = parseCsv('id,amount\n1,100\n2,200\n');
    expect(rows).toEqual([
      ['id', 'amount'],
      ['1', '100'],
      ['2', '200'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('id,counterparty\n1,"Acme, Inc."\n');
    expect(rows).toEqual([
      ['id', 'counterparty'],
      ['1', 'Acme, Inc.'],
    ]);
  });

  it('handles escaped quotes inside quoted fields', () => {
    const rows = parseCsv('id,note\n1,"He said ""hi"""\n');
    expect(rows[1]).toEqual(['1', 'He said "hi"']);
  });

  it('parses a file with no trailing newline', () => {
    const rows = parseCsv('id,amount\n1,100');
    expect(rows).toEqual([
      ['id', 'amount'],
      ['1', '100'],
    ]);
  });
});
