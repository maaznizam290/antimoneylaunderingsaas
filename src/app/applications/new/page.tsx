'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileDropZone } from '@/components/FileDropZone';
import { api, type ApiApplication } from '@/lib/apiClient';

export default function NewApplicationPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [app, setApp] = useState<ApiApplication | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kycFiles, setKycFiles] = useState<File[]>([]);
  const [txFiles, setTxFiles] = useState<File[]>([]);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const [uploadingTx, setUploadingTx] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const createApplication = async () => {
    if (!customerName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const created = await api.createApplication(customerName.trim());
      setApp(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const uploadKyc = async () => {
    if (!app || kycFiles.length === 0) return;
    setUploadingKyc(true);
    setError(null);
    try {
      const updated = await api.uploadFiles(app.id, 'kyc_document', kycFiles);
      setApp(updated);
      setKycFiles([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingKyc(false);
    }
  };

  const uploadTx = async () => {
    if (!app || txFiles.length === 0) return;
    setUploadingTx(true);
    setError(null);
    try {
      const updated = await api.uploadFiles(app.id, 'transaction_log', txFiles);
      setApp(updated);
      setTxFiles([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingTx(false);
    }
  };

  const startAnalysis = async () => {
    if (!app) return;
    setIsStarting(true);
    setError(null);
    try {
      await api.startAnalysis(app.id);
      router.push(`/applications/${app.id}`);
    } catch (err) {
      setError((err as Error).message);
      setIsStarting(false);
    }
  };

  const kycUploadedCount = app?.files.filter((f) => f.category === 'kyc_document').length ?? 0;
  const txUploadedCount = app?.files.filter((f) => f.category === 'transaction_log').length ?? 0;
  const canStart = kycUploadedCount > 0 && txUploadedCount > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
          &larr; Back to Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">New Application</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a case, attach evidence, then start the KYC/AML analysis pipeline.
        </p>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">1. Customer</h2>
          </CardHeader>
          <CardBody className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Customer name</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={!!app}
                placeholder="e.g. Jordan Ellis"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            {!app && (
              <Button onClick={createApplication} disabled={isCreating || !customerName.trim()}>
                {isCreating ? 'Creating…' : 'Create Application'}
              </Button>
            )}
          </CardBody>
        </Card>

        {app && (
          <>
            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-sm font-semibold text-slate-800">2. Evidence</h2>
              </CardHeader>
              <CardBody className="grid gap-6 sm:grid-cols-2">
                <FileDropZone
                  title="KYC Documents"
                  hint="Passport, ID card, proof of address, etc. (PDF, JPG, PNG)"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  pendingFiles={kycFiles}
                  onFilesSelected={(files) => setKycFiles((prev) => [...prev, ...files])}
                  onRemove={(i) => setKycFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  onUpload={uploadKyc}
                  isUploading={uploadingKyc}
                />
                <FileDropZone
                  title="Transaction Logs"
                  hint="One or more CSV exports of account activity"
                  accept="text/csv,.csv"
                  pendingFiles={txFiles}
                  onFilesSelected={(files) => setTxFiles((prev) => [...prev, ...files])}
                  onRemove={(i) => setTxFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  onUpload={uploadTx}
                  isUploading={uploadingTx}
                />
              </CardBody>
              {(kycUploadedCount > 0 || txUploadedCount > 0) && (
                <CardBody className="border-t border-slate-100 pt-4 text-xs text-slate-500">
                  Uploaded so far: {kycUploadedCount} KYC document(s), {txUploadedCount} transaction file(s).
                </CardBody>
              )}
            </Card>

            <div className="mt-6 flex justify-end">
              <Button onClick={startAnalysis} disabled={!canStart || isStarting}>
                {isStarting ? 'Starting analysis…' : 'Start Analysis'}
              </Button>
            </div>
            {!canStart && (
              <p className="mt-2 text-right text-xs text-slate-400">
                Upload at least one KYC document and one transaction log to start analysis.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
