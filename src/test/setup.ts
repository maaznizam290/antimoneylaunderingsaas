// Integration tests that touch the database must never point at the dev
// database — this redirects Prisma to a dedicated Postgres database before
// any test module imports `@/lib/db`. Override via TEST_DATABASE_URL if
// your local Postgres isn't on the default port/credentials. Create/refresh
// the test database's schema with:
//   DATABASE_URL="<test db url>" npx prisma migrate deploy
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/verifin_test?schema=public';
process.env.GEMINI_API_KEY = ''; // force the deterministic fallback analyzer in tests
