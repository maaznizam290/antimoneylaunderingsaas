import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { APPLICATION_INCLUDE, serializeApplication } from '@/lib/serialize';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await db.application.findUnique({ where: { id }, include: APPLICATION_INCLUDE });
  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }
  return NextResponse.json({ application: serializeApplication(app) });
}
