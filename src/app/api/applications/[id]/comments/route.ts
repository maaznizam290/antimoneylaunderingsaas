import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { addCommentSchema } from '@/lib/validation';
import { APPLICATION_INCLUDE, serializeApplication } from '@/lib/serialize';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await db.application.findUnique({ where: { id } });
  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  await db.comment.create({ data: { applicationId: id, author: parsed.data.author, body: parsed.data.body } });
  await recordAuditEvent(id, parsed.data.author, 'Comment Added', parsed.data.body);

  const full = await db.application.findUniqueOrThrow({ where: { id }, include: APPLICATION_INCLUDE });
  return NextResponse.json({ application: serializeApplication(full) }, { status: 201 });
}
