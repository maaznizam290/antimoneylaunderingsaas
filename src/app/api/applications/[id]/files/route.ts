import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/LocalDiskStorage';
import { recordAuditEvent } from '@/lib/audit';
import { uploadCategorySchema, validateUploadedFile } from '@/lib/validation';
import { APPLICATION_INCLUDE, serializeApplication } from '@/lib/serialize';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await db.application.findUnique({ where: { id } });
  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }
  if (['PendingReview', 'Approved', 'Escalated', 'Rejected'].includes(app.status)) {
    return NextResponse.json(
      { error: `Cannot upload files to an application with status "${app.status}".` },
      { status: 409 }
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const categoryParsed = uploadCategorySchema.safeParse(formData.get('category'));
  if (!categoryParsed.success) {
    return NextResponse.json({ error: 'category must be "kyc_document" or "transaction_log"' }, { status: 400 });
  }
  const category = categoryParsed.data;

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const errors: string[] = [];
  for (const file of files) {
    const err = validateUploadedFile(category, { type: file.type, size: file.size, name: file.name });
    if (err) errors.push(err);
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
  }

  const storage = getFileStorage();
  const stored = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await storage.upload({ applicationId: id, fileName: file.name, data: buffer });
    const record = await db.uploadedFile.create({
      data: {
        applicationId: id,
        name: file.name,
        mimeType: file.type || (category === 'transaction_log' ? 'text/csv' : 'application/octet-stream'),
        size: file.size,
        category,
        storageKey,
      },
    });
    stored.push(record);
  }

  await recordAuditEvent(
    id,
    'User',
    category === 'kyc_document' ? 'KYC Documents Uploaded' : 'Transaction Logs Uploaded',
    stored.map((f) => f.name).join(', ')
  );

  const full = await db.application.findUniqueOrThrow({ where: { id }, include: APPLICATION_INCLUDE });
  return NextResponse.json({ application: serializeApplication(full) }, { status: 201 });
}
