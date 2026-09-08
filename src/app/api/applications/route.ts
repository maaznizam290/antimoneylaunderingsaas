import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { createApplicationSchema } from '@/lib/validation';
import { APPLICATION_INCLUDE, serializeApplication } from '@/lib/serialize';

export async function GET() {
  const apps = await db.application.findMany({
    include: APPLICATION_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ applications: apps.map(serializeApplication) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  const app = await db.application.create({
    data: { customerName: parsed.data.customerName, status: 'New', analysisStage: 'NEW' },
  });
  await recordAuditEvent(app.id, 'User', 'Application Created', `Customer: ${app.customerName}`);

  const full = await db.application.findUniqueOrThrow({ where: { id: app.id }, include: APPLICATION_INCLUDE });
  return NextResponse.json({ application: serializeApplication(full) }, { status: 201 });
}
