import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { updateStatusSchema } from '@/lib/validation';
import { APPLICATION_INCLUDE, serializeApplication } from '@/lib/serialize';

/// The single place a case's final decision is written. This is a human
/// reviewer action only — Hermes and the AI pipeline never call this route
/// or set one of these three statuses themselves (CLAUDE.md section 9). A
/// decision is only accepted from PendingReview or Escalated, mirroring the
/// source application's workflow.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await db.application.findUnique({ where: { id } });
  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  if (!['PendingReview', 'Escalated'].includes(app.status)) {
    return NextResponse.json(
      { error: `Cannot record a review decision on an application with status "${app.status}".` },
      { status: 409 }
    );
  }

  const { decision, actor } = parsed.data;
  await db.application.update({ where: { id }, data: { status: decision } });
  await recordAuditEvent(id, actor, `Status Updated to ${decision}`);

  const full = await db.application.findUniqueOrThrow({ where: { id }, include: APPLICATION_INCLUDE });
  return NextResponse.json({ application: serializeApplication(full) });
}
