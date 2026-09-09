import ExcelJS from 'exceljs';

const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // some browsers mislabel .xlsx uploads with this legacy MIME type
]);

/// Whether an uploaded transaction-log file should be parsed as a
/// spreadsheet (via xlsxBufferToCsvText) rather than read directly as CSV
/// text. Checks both MIME type and extension since browsers/OSes are
/// inconsistent about what `type` they report for spreadsheet exports.
export function isXlsxFile(file: { mimeType: string; name: string }): boolean {
  return XLSX_MIME_TYPES.has(file.mimeType) || /\.xlsx?$/i.test(file.name);
}

/// Converts an uploaded .xlsx workbook's first worksheet into CSV text, so
/// it flows through the exact same parseCsv()-based evidence pipeline as a
/// native .csv transaction log (see transactionEvidence.ts) — nothing
/// downstream (header matching, statistics, pattern detection, provenance)
/// needs to know the source file was a spreadsheet rather than a CSV.
///
/// Only the first worksheet is read, matching the common case of a
/// single-sheet transaction export. Uses `exceljs` rather than the
/// popular `xlsx` (SheetJS) package: the npm-published `xlsx` build has
/// known, unpatched-on-npm prototype-pollution and ReDoS advisories, and
/// this function's whole job is parsing untrusted user-uploaded files.
export async function xlsxBufferToCsvText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (err) {
    throw new Error(
      `Could not read this file as an Excel (.xlsx) workbook — it may be corrupted, password-protected, or in an unsupported legacy .xls format. (${err instanceof Error ? err.message : String(err)})`
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return '';

  const lines: string[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    // ExcelJS's row.values is 1-indexed; index 0 is always undefined.
    const cells = (row.values as unknown[]).slice(1).map(cellToCsvField);
    lines.push(cells.join(','));
  });
  return lines.join('\n');
}

function cellToCsvField(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) {
    text = '';
  } else if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'object') {
    const obj = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(obj.richText)) {
      text = obj.richText.map((r) => r.text).join('');
    } else if (obj.result !== undefined) {
      text = String(obj.result); // formula cell — use its computed value
    } else if (obj.text !== undefined) {
      text = String(obj.text); // hyperlink cell
    } else {
      text = String(value);
    }
  } else {
    text = String(value);
  }

  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
