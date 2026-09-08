# Verifin

Verifin is a KYC/AML compliance investigation platform: reverse-engineered
from [KYCComplianceAgent](https://github.com/chetankerhalkar/KYCComplianceAgent)
(a Next.js/Genkit prototype that stored everything in an in-memory array),
rebuilt with persistent storage, secure file handling, complete multi-file
evidence handling, a Hermes-orchestrated pipeline, and human-in-the-loop
compliance review.

## What changed vs. the source app

| Source (ComplyAI) | Verifin |
|---|---|
| `let applicationsStore: CustomerApplication[] = []` (in-memory, lost on restart) | PostgreSQL/SQLite via Prisma — the sole source of truth |
| Documents stored as Base64 `dataUri` inline with app state | Metadata in the DB; bytes in a `FileStorageService` (local disk in dev, swappable for S3/GCS/Supabase Storage) |
| AML analysis used "the first KYC document and first transaction log ... This is a simplification" | AML runs over a deterministically aggregated evidence set built from **every** uploaded document and **every** transaction CSV |
| One `handleNewApplication()` ran KYC → AML → summary with no persistence of partial progress | A 10-stage persistent `analysisStage` state machine; a failed stage is retried without re-running completed ones |
| No orchestration layer | Hermes Compliance Orchestrator: a controlled-tool pipeline, auditable via `AgentRun` records |
| No audit persistence | Every material action writes an `AuditEntry` row |

## Architecture

```
 Browser (React/Next.js UI)
        │  fetch()
        ▼
 Next.js Route Handlers  (src/app/api/**)      ← the "Compliance API"
        │
        ▼
 Hermes Orchestrator  (src/lib/hermes/orchestrator.ts)
        │  calls only the controlled tools below
        ▼
 Hermes Tools  (src/lib/hermes/tools.ts)
   get_application · get_documents · get_transaction_data
   analyze_kyc · analyze_transactions · analyze_aml
   generate_compliance_summary · retrieve_similar_cases
   record_audit_event · get_application_status · request_human_review
        │                              │
        ▼                              ▼
 Evidence layer                  Gemini/Genkit AI flows
 (src/lib/evidence/**)           (src/lib/ai/**) — falls back to a
   KYC doc classification          deterministic analyzer when
   CSV parsing/normalization       GEMINI_API_KEY is unset or a
   statistics + pattern flags      Gemini call fails
        │                              │
        ▼                              ▼
 FileStorageService              PostgreSQL / SQLite (Prisma)
 (src/lib/storage/**)            — Application, UploadedFile, KycResult,
   document bytes only             AmlResult, ComplianceSummary,
                                    AuditEntry, AgentRun, CuratedKnowledge
                                          │
                                          ▼
                                  Human Reviewer
                             Approve / Escalate / Reject
                            (src/app/api/applications/[id]/status)
```

**Hermes never writes application data directly and never makes the final
call.** It only calls the tools above (no raw SQL, no filesystem, no
unrestricted network access), and its ceiling of authority is
`request_human_review` — moving a case to `PendingReview`. The
Approve/Escalate/Reject decision is a separate, human-only API route that
Hermes cannot invoke.

## Database schema (`prisma/schema.prisma`)

`Application` (aggregate root: `status` is the business-facing workflow
state — New/Processing/PendingReview/Approved/Escalated/Rejected/Error;
`analysisStage` is the internal pipeline state machine) has one-to-many
`UploadedFile`, `AuditEntry`, `Comment`, `AgentRun`, and one-to-one
`KycResult`, `AmlResult`, `ComplianceSummary`. `CuratedKnowledge` is Hermes'
curated (human-seeded) procedure/heuristic store — see **Agent memory
strategy** below.

The schema targets SQLite for zero-config local dev; switching to
production Postgres is a one-line datasource change (see the comment at the
top of `schema.prisma`). Array fields (`missingInformation`, `flags`,
`evidenceReferences`, `recommendations`, `toolCalls`) are stored as JSON
text rather than Prisma's native `Json` type because SQLite's connector
doesn't support it — see `src/lib/json.ts`.

## File storage

`src/lib/storage/FileStorageService.ts` defines the interface
(`upload`/`retrieve`/`delete`); `LocalDiskStorage` is the dev
implementation (files under `./storage/<applicationId>/<uuid>.<ext>`,
outside any public directory). Swap in an S3/GCS/Supabase-Storage
implementation for production by implementing the same interface —
nothing else in the app depends on the backend. Documents are only ever
served through the authenticated `GET /api/files/[id]` route, never as a
static path.

## AI pipeline

Three stages, each ported from the source app's Genkit flows and extended
to use the full evidence set (not a single representative file):

1. **KYC completeness** (`src/lib/ai/flows/determineKycCompleteness.ts`) —
   every uploaded KYC document is passed to Gemini as media, with its file
   name, so findings can cite which document(s) they're based on.
2. **AML risk** (`flagAmlRisks.ts`) — Gemini receives the KYC documents
   plus a deterministic `TransactionEvidenceSet` built from *all*
   transaction CSVs: aggregate statistics, already-flagged suspicious
   patterns (large-outlier, structuring, high-velocity, round-number), and
   a bounded representative sample — never a blind dump of every row, and
   never just the first file (`src/lib/evidence/transactionEvidence.ts`).
3. **Compliance summary** (`summarizeComplianceResults.ts`) — synthesizes
   the two results above into an overall risk level and reviewer
   recommendations.

**Fallback mode:** if `GEMINI_API_KEY` is unset, or a Gemini call throws,
each stage falls back to a deterministic, explainable analyzer
(`src/lib/ai/fallback.ts`) built on the same evidence sets. Every result
carries a `source: "gemini" | "fallback-deterministic"` tag that the UI
always displays — a fallback run is never presented as if it were model
output.

## Hermes: agentic orchestration, not the database

`src/lib/hermes/orchestrator.ts` drives an application through
`NEW → DOCUMENTS_VALIDATED → KYC_ANALYSIS_RUNNING → KYC_ANALYSIS_COMPLETE →
AML_ANALYSIS_RUNNING → AML_ANALYSIS_COMPLETE →
SUMMARY_GENERATION_RUNNING → SUMMARY_COMPLETE → PENDING_REVIEW` (or
`ANALYSIS_ERROR`). The database — never in-process state — is the
source of truth for what's already done: before running a stage, the
orchestrator checks whether its result row already exists and skips it if
so. That's what makes retries safe (see the "AI failure test" below) and
what makes a page refresh non-destructive (no duplicate AI runs, no
duplicate audit entries — an already-decided application returns `409` if
`/analyze` is called again).

Every tool call the orchestrator makes is appended to the current
`AgentRun.toolCalls` log, visible in the UI's "Hermes Agent Activity"
panel, for observability.

**Agent memory strategy (controlled learning):** `CuratedKnowledge` holds
only human-approved procedures/heuristics/lessons, seeded via
`prisma/seed.ts` — never raw customer case data, and Hermes cannot write
to it at runtime. `retrieve_similar_cases()` reads from this table. This
is deliberately *not* a general-purpose vector memory over customer
applications: uncontrolled learning from individual cases is explicitly
out of scope (see CLAUDE.md section 10 for the constraint this
implements).

## Security model

- Hermes' only interface to data is the tool set in `src/lib/hermes/tools.ts` —
  no raw SQL, filesystem, or network access; every tool validates its
  inputs and writes through Prisma.
- Documents are private by construction: bytes are never in a public
  directory or a Base64 field in an API response; they're served one at a
  time through an authenticated-by-route-design endpoint.
- All API input is validated with Zod (`src/lib/validation.ts`) — file
  type/size limits, required fields, enum checks.
- Final Approve/Escalate/Reject is a human-only route; Hermes cannot call
  it, and it's rejected (`409`) unless the application is
  `PendingReview`/`Escalated`.
- `.env` is git-ignored; `.env.example` documents every variable with no
  real secrets committed.
- **Known gap:** this MVP does not implement full user authentication/RBAC
  — the reviewer "actor" is a free-text name field, not an authenticated
  identity. Production deployment needs an auth layer (e.g. NextAuth or
  your IdP of choice) in front of the API routes and the status/comment
  actions in particular.

## Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string. Dev default: local SQLite (`file:./prisma/dev.db`). Production: a PostgreSQL URL. |
| `GEMINI_API_KEY` | Enables Gemini-backed analysis via Genkit. Unset → deterministic fallback analyzer. |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR` | Local-disk file storage config. Replace `LocalDiskStorage` for S3/GCS/Supabase in production. |
| `NEXT_PUBLIC_APP_NAME` | Display name. |

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init   # creates prisma/dev.db and applies the schema
npm run db:seed                      # seeds Hermes' curated-knowledge table
npm run dev                          # http://localhost:3000
```

Production:

```bash
npm run build
npm run db:migrate:deploy   # against your production DATABASE_URL
npm run start
```

Set `GEMINI_API_KEY` in your environment (Google AI Studio →
"Get API key") to enable Gemini-backed analysis; without it the app runs
correctly on the deterministic fallback analyzer, clearly labeled as such
throughout the UI.

## Testing performed

```bash
npm run typecheck   # tsc --noEmit — passes
npm run lint        # eslint — passes, no warnings
npm run build       # next build — passes, all routes compile
npm test            # vitest — 17/17 passing
```

Automated tests (`src/lib/**/*.test.ts`) cover: CSV parsing edge cases,
multi-file transaction aggregation (statistics not reset per file),
suspicious-pattern detection (large-outlier, structuring), KYC document
classification not dropping any uploaded file, fallback-analyzer
correctness, and — as an integration test against a dedicated SQLite test
database (`prisma/test.db`, see `src/test/setup.ts`) — the orchestrator's
retry behavior: a simulated AML-stage failure leaves the KYC result
intact and does not re-run it on retry, and a decided (`Approved`)
application rejects a further analyze call rather than reprocessing it.

Manually exercised end-to-end against the running dev server (the
acceptance path in CLAUDE.md section 40): created an application, uploaded
3 KYC documents and 3 transaction-log CSVs in one session, ran analysis,
confirmed the AML stage correctly aggregated across all 3 CSVs (8 rows, 3
files) and flagged a structuring pattern spanning multiple files (not just
the first), added a reviewer comment, approved the case, **killed and
restarted the dev server, and confirmed the application, its results,
comment, and full audit trail were unchanged** (persistence test, section
43), and confirmed a repeat `/analyze` call on the now-`Approved`
application is rejected with `409` rather than silently reprocessing
(idempotency test, section 21).

## Accuracy evaluation methodology

**Accuracy has not yet been empirically validated.** No claim of a fixed
accuracy percentage is made anywhere in this app, and none should be
inferred from the architecture alone.

What exists: `CuratedKnowledge`/`AgentRun` give Hermes-orchestrated runs a
persistent, inspectable trace (which tools ran, in what order, with what
inputs/outputs) that a baseline (call the three AI flows directly, without
Hermes) does not produce — which is the precondition for measuring whether
orchestration helps.

What's out of scope for this MVP (flagged, not silently skipped, per the
explicit scoping decision for this build): an evaluation harness that runs
both the direct Genkit pipeline and the Hermes-orchestrated pipeline over
an expert-labeled benchmark dataset and reports KYC precision/recall, AML
precision/recall/F1/false-positive/false-negative rate, and reviewer
agreement (CLAUDE.md sections 11-12, 44). Building this requires a real
labeled dataset, which doesn't exist yet; fabricating one — or fabricating
results — would violate the explicit instruction not to invent benchmark
numbers. The schema and tool boundaries here are designed so that harness
can be added later without restructuring the pipeline: `AgentRun` already
records every tool call with timing, and both the fallback and Gemini
paths return the same typed result shape, so a comparison runner can call
either path against the same evidence sets and diff the results against
ground truth.

## UI/UX

Premium enterprise-fintech palette (navy/indigo/teal/slate/emerald/amber/red),
information-dense tables over decorative cards, no glassmorphism/heavy
gradients/oversized rounded corners. Dashboard shows real metrics computed
from the database (never fabricated) with search + status/risk filters.
The application-details workspace surfaces KYC/AML/summary results side by
side with their evidence citations and AI-vs-fallback source tag, full
document/transaction evidence with inline preview, the Hermes tool-call
trace, the complete audit trail, comments, and reviewer actions — the AI
recommendation is never presented as an opaque score without its
underlying evidence and reasoning (CLAUDE.md section 34).

## Known limitations

- No authentication/RBAC yet (see **Security model**) — acceptable for an
  investor-demo MVP, not for production.
- The fallback KYC analyzer classifies documents by filename pattern, not
  by reading document content (no OCR/vision without a real Gemini key) —
  this is disclosed in its own `reasoning` text, not hidden.
- The evaluation harness for empirically comparing baseline vs.
  Hermes-orchestrated accuracy (sections 11-12, 44) is intentionally out of
  scope for this pass — see **Accuracy evaluation methodology**.
- Hermes' orchestration logic is currently a deterministic, auditable
  tool-calling sequence rather than an LLM making its own tool-selection
  decisions at each step. This satisfies the "controlled tools, no
  unrestricted access, human-in-the-loop" requirements exactly, and keeps
  the pipeline's behavior reproducible for the eventual accuracy
  evaluation; giving Hermes LLM-driven tool selection within the same
  tool boundary is a natural next step, not a rewrite.
