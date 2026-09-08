'use client';

import { useEffect, useState } from 'react';
import { api, type ApiFile } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';

export function FilePreviewModal({ file, onClose }: { file: ApiFile; onClose: () => void }) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const url = api.fileUrl(file.id);
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';
  const isCsv = file.mimeType === 'text/csv' || file.name.toLowerCase().endsWith('.csv') || file.mimeType === 'text/plain';

  useEffect(() => {
    if (!isCsv) return;
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => !cancelled && setCsvText(t.slice(0, 20_000)))
      .catch(() => !cancelled && setCsvText('(preview unavailable)'));
    return () => {
      cancelled = true;
    };
  }, [url, isCsv]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-400">
              {file.mimeType} · {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="outline">Open in new tab</Button>
            </a>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from an authenticated, non-static API route; next/image's optimizer requires a public/allowlisted remote source */}
          {isImage && <img src={url} alt={file.name} className="mx-auto max-w-full" />}
          {isPdf && <iframe src={url} title={file.name} className="h-[65vh] w-full rounded border border-slate-200 bg-white" />}
          {isCsv && (
            <pre className="whitespace-pre-wrap break-all rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">
              {csvText ?? 'Loading preview…'}
            </pre>
          )}
          {!isImage && !isPdf && !isCsv && (
            <p className="text-sm text-slate-500">No inline preview available for this file type. Use &quot;Open in new tab&quot;.</p>
          )}
        </div>
      </div>
    </div>
  );
}
