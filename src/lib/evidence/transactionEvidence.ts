import { parseCsv } from './csv';

export interface NormalizedTransaction {
  /// The transaction's own id if the CSV provides one, else a synthesized
  /// one — always kept so every finding can cite "Transaction ID X".
  id: string;
  date: string | null;
  amount: number | null;
  currency: string | null;
  type: string | null;
  counterparty: string | null;
  raw: Record<string, string>;
  /// Provenance: which uploaded file and which row this came from.
  sourceFile: string;
  sourceRow: number;
}

export interface TransactionStatistics {
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  maxAmount: number;
  minAmount: number;
  distinctCounterparties: number;
  currencies: string[];
  dateRange: { earliest: string | null; latest: string | null };
  /// Average transactions/day across the observed date range — a coarse
  /// velocity signal for the AML analyzer.
  averageDailyVelocity: number;
}

export interface SuspiciousPatternFlag {
  type: string;
  description: string;
  /// Evidence citations, e.g. "Transaction ID 38291 (March.csv)".
  evidenceReferences: string[];
}

export interface TransactionEvidenceSet {
  sourceFiles: string[];
  totalRowsProcessed: number;
  parseErrors: string[];
  statistics: TransactionStatistics;
  suspiciousPatterns: SuspiciousPatternFlag[];
  /// A bounded, representative sample (largest + most recent + all flagged)
  /// so the AI prompt gets concrete evidence without every raw row —
  /// see CLAUDE.md section 15 (large-dataset handling).
  representativeSample: NormalizedTransaction[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  id: ['id', 'transaction_id', 'transactionid', 'txn_id', 'reference'],
  date: ['date', 'transaction_date', 'timestamp', 'datetime'],
  amount: ['amount', 'value', 'transaction_amount', 'amt'],
  currency: ['currency', 'ccy'],
  type: ['type', 'transaction_type', 'direction'],
  counterparty: ['counterparty', 'payee', 'beneficiary', 'from', 'to', 'party', 'merchant'],
};

function matchHeader(headers: string[], canonical: string): number {
  const aliases = HEADER_ALIASES[canonical] ?? [canonical];
  return headers.findIndex((h) => aliases.includes(h.trim().toLowerCase()));
}

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeOneFile(fileName: string, text: string): {
  transactions: NormalizedTransaction[];
  errors: string[];
} {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) {
    return { transactions: [], errors: [`${fileName}: no rows found`] };
  }

  const header = rows[0]!.map((h) => h.trim());
  const idIdx = matchHeader(header, 'id');
  const dateIdx = matchHeader(header, 'date');
  const amountIdx = matchHeader(header, 'amount');
  const currencyIdx = matchHeader(header, 'currency');
  const typeIdx = matchHeader(header, 'type');
  const counterpartyIdx = matchHeader(header, 'counterparty');

  if (amountIdx === -1) {
    errors.push(`${fileName}: could not identify an amount column (headers: ${header.join(', ')})`);
  }

  const transactions: NormalizedTransaction[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r]!;
    if (cols.every((c) => c.trim() === '')) continue;

    const raw: Record<string, string> = {};
    header.forEach((h, i) => {
      raw[h] = cols[i] ?? '';
    });

    const synthesizedId = `${fileName}:row-${r + 1}`;
    transactions.push({
      id: idIdx >= 0 && cols[idIdx] ? cols[idIdx]!.trim() : synthesizedId,
      date: dateIdx >= 0 ? cols[dateIdx] ?? null : null,
      amount: amountIdx >= 0 ? parseAmount(cols[amountIdx]) : null,
      currency: currencyIdx >= 0 ? cols[currencyIdx] ?? null : null,
      type: typeIdx >= 0 ? cols[typeIdx] ?? null : null,
      counterparty: counterpartyIdx >= 0 ? cols[counterpartyIdx] ?? null : null,
      raw,
      sourceFile: fileName,
      sourceRow: r + 1,
    });
  }

  return { transactions, errors };
}

function computeStatistics(transactions: NormalizedTransaction[]): TransactionStatistics {
  const amounts = transactions.map((t) => t.amount).filter((a): a is number => a !== null);
  const dates = transactions
    .map((t) => t.date)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const totalAmount = amounts.reduce((s, a) => s + a, 0);
  const earliest = dates[0] ?? null;
  const latest = dates[dates.length - 1] ?? null;
  const spanDays = earliest && latest ? Math.max(1, (latest.getTime() - earliest.getTime()) / 86_400_000) : 1;

  return {
    totalTransactions: transactions.length,
    totalAmount,
    averageAmount: amounts.length ? totalAmount / amounts.length : 0,
    maxAmount: amounts.length ? Math.max(...amounts) : 0,
    minAmount: amounts.length ? Math.min(...amounts) : 0,
    distinctCounterparties: new Set(
      transactions.map((t) => t.counterparty).filter((c): c is string => !!c)
    ).size,
    currencies: Array.from(new Set(transactions.map((t) => t.currency).filter((c): c is string => !!c))),
    dateRange: {
      earliest: earliest ? earliest.toISOString() : null,
      latest: latest ? latest.toISOString() : null,
    },
    averageDailyVelocity: transactions.length / spanDays,
  };
}

function cite(t: NormalizedTransaction): string {
  return `Transaction ID ${t.id} (${t.sourceFile})`;
}

/// Deterministic pattern detection over the *complete* evidence set — never
/// just the first file. See CLAUDE.md section 13/15.
function detectSuspiciousPatterns(
  transactions: NormalizedTransaction[],
  stats: TransactionStatistics
): SuspiciousPatternFlag[] {
  const flags: SuspiciousPatternFlag[] = [];
  const amounts = transactions.filter((t) => t.amount !== null);

  if (amounts.length > 0) {
    const mean = stats.averageAmount;
    const variance =
      amounts.reduce((s, t) => s + (t.amount! - mean) ** 2, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const largeThreshold = mean + 3 * stdDev;
    const large = amounts.filter((t) => stdDev > 0 && t.amount! > largeThreshold);
    if (large.length > 0) {
      flags.push({
        type: 'large_outlier_transactions',
        description: `${large.length} transaction(s) exceed 3 standard deviations above the mean amount (${mean.toFixed(2)}).`,
        evidenceReferences: large.slice(0, 10).map(cite),
      });
    }

    // Structuring heuristic: multiple transactions just under common
    // reporting thresholds (e.g. 10,000) from/to the same counterparty.
    const REPORTING_THRESHOLDS = [10_000, 3_000];
    for (const threshold of REPORTING_THRESHOLDS) {
      const nearThreshold = amounts.filter(
        (t) => t.amount! < threshold && t.amount! >= threshold * 0.9
      );
      const byCounterparty = new Map<string, NormalizedTransaction[]>();
      for (const t of nearThreshold) {
        const key = t.counterparty ?? 'unknown';
        byCounterparty.set(key, [...(byCounterparty.get(key) ?? []), t]);
      }
      for (const [counterparty, txs] of byCounterparty) {
        if (txs.length >= 3) {
          flags.push({
            type: 'possible_structuring',
            description: `${txs.length} transactions just under the ${threshold.toLocaleString()} reporting threshold involving "${counterparty}" — a pattern consistent with structuring.`,
            evidenceReferences: txs.slice(0, 10).map(cite),
          });
        }
      }
    }
  }

  if (stats.averageDailyVelocity > 10) {
    flags.push({
      type: 'high_velocity',
      description: `Average of ${stats.averageDailyVelocity.toFixed(1)} transactions/day, which is unusually high.`,
      evidenceReferences: [],
    });
  }

  if (stats.currencies.length > 3) {
    flags.push({
      type: 'multi_currency_exposure',
      description: `Transactions span ${stats.currencies.length} currencies (${stats.currencies.join(', ')}).`,
      evidenceReferences: [],
    });
  }

  const roundNumbers = amounts.filter((t) => t.amount! >= 1000 && t.amount! % 1000 === 0);
  if (roundNumbers.length >= 3) {
    flags.push({
      type: 'round_number_transactions',
      description: `${roundNumbers.length} transactions are round multiples of 1,000, which can indicate manual/artificial structuring.`,
      evidenceReferences: roundNumbers.slice(0, 10).map(cite),
    });
  }

  return flags;
}

/// Builds one evidence set from *all* uploaded transaction CSVs. Never
/// silently limited to "the first transaction log" (CLAUDE.md section 13).
export function buildTransactionEvidenceSet(
  files: { name: string; text: string }[]
): TransactionEvidenceSet {
  const allErrors: string[] = [];
  const allTransactions: NormalizedTransaction[] = [];

  for (const file of files) {
    const { transactions, errors } = normalizeOneFile(file.name, file.text);
    allTransactions.push(...transactions);
    allErrors.push(...errors);
  }

  const statistics = computeStatistics(allTransactions);
  const suspiciousPatterns = detectSuspiciousPatterns(allTransactions, statistics);

  const flaggedIds = new Set(suspiciousPatterns.flatMap((f) => f.evidenceReferences));
  const flagged = allTransactions.filter((t) => flaggedIds.has(cite(t)));
  const sortedByAmount = [...allTransactions].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const sortedByDate = [...allTransactions]
    .filter((t) => t.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

  const sampleMap = new Map<string, NormalizedTransaction>();
  for (const t of [...flagged, ...sortedByAmount.slice(0, 15), ...sortedByDate.slice(0, 15)]) {
    sampleMap.set(t.id + t.sourceFile, t);
    if (sampleMap.size >= 40) break;
  }

  return {
    sourceFiles: files.map((f) => f.name),
    totalRowsProcessed: allTransactions.length,
    parseErrors: allErrors,
    statistics,
    suspiciousPatterns,
    representativeSample: Array.from(sampleMap.values()),
  };
}
