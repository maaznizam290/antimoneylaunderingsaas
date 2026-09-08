// Integration tests that touch the database must never point at the dev
// database (prisma/dev.db) — this redirects Prisma to a dedicated SQLite
// file before any test module imports `@/lib/db`. Create/refresh it with:
//   DATABASE_URL="file:./test.db" npx prisma migrate deploy
// (relative sqlite paths resolve relative to prisma/schema.prisma's
// directory, i.e. this is prisma/test.db).
process.env.DATABASE_URL = 'file:./test.db';
process.env.GEMINI_API_KEY = ''; // force the deterministic fallback analyzer in tests
