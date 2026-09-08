import { NextResponse } from 'next/server';
import { runHermesPipeline, AlreadyProcessedError, ValidationError } from '@/lib/hermes/orchestrator';
import { db } from '@/lib/db';
import { APPLICATION_INCLUDE, serializeApplication } from '@/lib/serialize';

/// Starts (or retries) the Hermes-orchestrated analysis pipeline. Safe to
/// call repeatedly: already-completed stages are skipped (see
/// runHermesPipeline), and an already-reviewable/decided application is
/// rejected with 409 rather than silently re-run (CLAUDE.md section 21).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await runHermesPipeline(id);
  } catch (err) {
    if (err instanceof AlreadyProcessedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Any other error was already persisted onto the application
    // (status=Error, analysisStage=ANALYSIS_ERROR) by the orchestrator —
    // fall through and return the current state rather than a bare 500 so
    // the client can show what happened and offer a retry.
  }

  const app = await db.application.findUnique({ where: { id }, include: APPLICATION_INCLUDE });
  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }
  return NextResponse.json({ application: serializeApplication(app) });
}
