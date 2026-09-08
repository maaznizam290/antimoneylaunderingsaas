// Seeds Hermes' curated knowledge base — human-approved workflow
// procedures and heuristics, NOT customer case data (CLAUDE.md section 10).
// Run with `npm run db:seed`. Idempotent: re-running clears and re-inserts.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  await db.curatedKnowledge.deleteMany({});
  await db.curatedKnowledge.createMany({
    data: [
      {
        kind: 'procedure',
        title: 'Standard KYC/AML review order',
        content:
          'Always assess KYC document completeness before running AML risk analysis: an incomplete document set ' +
          'should raise, not lower, overall risk uncertainty, and missing-document findings should be surfaced to ' +
          'the reviewer alongside (not instead of) the AML result.',
      },
      {
        kind: 'heuristic',
        title: 'Structuring pattern definition',
        content:
          'Multiple transactions clustered just under a common reporting threshold (e.g. 90-100% of $10,000 or ' +
          '$3,000) involving the same counterparty is a classic structuring indicator and should be flagged even ' +
          'when no single transaction is individually large.',
      },
      {
        kind: 'lesson',
        title: 'Do not truncate transaction evidence',
        content:
          'When a customer uploads multiple transaction-log files, compute statistics and pattern flags over the ' +
          'full combined dataset, not just the first file or first N rows — evidence dropped this way is the most ' +
          'common cause of a missed AML finding.',
      },
    ],
  });
  console.log('Seeded curated knowledge.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
