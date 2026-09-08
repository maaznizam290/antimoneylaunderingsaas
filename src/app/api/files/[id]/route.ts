import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/LocalDiskStorage';

/// Serves a single uploaded file's bytes for preview/download. This is the
/// only path through which document content ever leaves the server — it is
/// never exposed as a static/public URL — see FileStorageService.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const storage = getFileStorage();
  let data: Buffer;
  try {
    data = await storage.retrieve(file.storageKey);
  } catch {
    return NextResponse.json({ error: 'Stored file content could not be retrieved' }, { status: 410 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
      'Cache-Control': 'private, max-age=0, no-store',
    },
  });
}
