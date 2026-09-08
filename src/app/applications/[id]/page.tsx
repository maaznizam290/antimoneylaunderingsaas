'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Header } from '@/components/Header';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, statusTone, riskTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { api, type ApiApplication, type ApiFile } from '@/lib/apiClient';
import type { ReviewDecision } from '@/lib/types';

export default function ApplicationDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [app, setApp] = useState<ApiApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ApiFile | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const load = useCallback(() => {
    api
      .getApplication(id)
      .then(setApp)
      .catch((err) => setError((err as Error).message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
        </main>
      </div>
    );
  }
  if (!app) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-4xl px-6 py-8 text-sm text-slate-500">Loading application…</main>
      </div>
    );
  }

  const overallRisk = app.summary?.overallRisk ?? app.amlResult?.riskLevel;
  const kycFiles = app.files.filter((f) => f.category === 'kyc_document');
  const txFiles = app.files.filter((f) => f.category === 'transaction_log');

  const retry = async () => {
    setIsRetrying(true);
    try {
      const updated = await api.startAnalysis(id);
      setApp(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRetrying(false);
    }
  };

  const decide = async (decision: ReviewDecision) => {
    if (!reviewerName.trim()) return;
    setIsDeciding(true);
    try {
      const updated = await api.updateStatus(id, decision, reviewerName.trim());
      setApp(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsDeciding(false);
    }
  };

  const submitComment = async () => {
    if (!commentBody.trim() || !commentAuthor.trim()) return;
    setIsCommenting(true);
    try {
      const updated = await api.addComment(id, commentAuthor.trim(), commentBody.trim());
      setApp(updated);
      setCommentBody('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCommenting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
          &larr; Back to Dashboard
        </Link>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        <Card>
          <CardBody className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{app.customerName}</h1>
              <p className="mt-1 text-xs text-slate-500">
                Application ID: {app.id} · Created {format(new Date(app.createdAt), 'PPP p')} · Updated{' '}
                {format(new Date(app.updatedAt), 'PPP p')}
              </p>
              <p className="mt-1 text-xs text-slate-400">Analysis stage: {app.analysisStage}</p>
            </div>
            <div className="flex gap-2">
              <Badge tone={statusTone(app.status)}>{app.status}</Badge>
              {overallRisk && <Badge tone={riskTone(overallRisk)}>{overallRisk} Risk</Badge>}
            </div>
          </CardBody>

          {app.status === 'Error' && (
            <CardBody className="border-t border-red-100 bg-red-50">
              <p className="text-sm font-medium text-red-700">Analysis error: {app.analysisError}</p>
              <p className="mt-1 text-xs text-red-600">
                Any already-completed stages (KYC/AML/summary) are preserved. Retrying resumes from the failed stage.
              </p>
              <Button variant="danger" className="mt-2" onClick={retry} disabled={isRetrying}>
                {isRetrying ? 'Retrying…' : 'Retry Analysis'}
              </Button>
            </CardBody>
          )}

          {(app.status === 'PendingReview' || app.status === 'Escalated') && (
            <CardBody className="border-t border-slate-100">
              <p className="mb-2 text-sm font-semibold text-slate-800">Reviewer Decision</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Your name"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <Button variant="success" disabled={!reviewerName.trim() || isDeciding} onClick={() => decide('Approved')}>
                  Approve
                </Button>
                <Button variant="outline" disabled={!reviewerName.trim() || isDeciding} onClick={() => decide('Escalated')}>
                  Escalate
                </Button>
                <Button variant="danger" disabled={!reviewerName.trim() || isDeciding} onClick={() => decide('Rejected')}>
                  Reject
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Final decisions are always made by a human reviewer — Hermes and the AI pipeline only recommend.
              </p>
            </CardBody>
          )}
          {(app.status === 'Approved' || app.status === 'Rejected') && (
            <CardBody className="border-t border-slate-100">
              <p className={`text-sm font-semibold ${app.status === 'Approved' ? 'text-emerald-700' : 'text-red-700'}`}>
                This application has been {app.status.toLowerCase()}.
              </p>
            </CardBody>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <ResultCard title="KYC Completeness" source={app.kycResult?.source}>
            {app.kycResult ? (
              <>
                <Badge tone={app.kycResult.isComplete ? 'emerald' : 'amber'}>
                  {app.kycResult.isComplete ? 'Complete' : 'Incomplete'}
                </Badge>
                {app.kycResult.missingInformation.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                    {app.kycResult.missingInformation.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-slate-500">{app.kycResult.reasoning}</p>
                <EvidenceList label="Evidence" items={app.kycResult.evidenceReferences} />
              </>
            ) : (
              <Placeholder stage={app.analysisStage} />
            )}
          </ResultCard>

          <ResultCard title="AML Risk" source={app.amlResult?.source}>
            {app.amlResult ? (
              <>
                <Badge tone={riskTone(app.amlResult.riskLevel)}>
                  {app.amlResult.riskLevel} · score {app.amlResult.riskScore.toFixed(0)}/100
                </Badge>
                {app.amlResult.flags.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                    {app.amlResult.flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-slate-500">{app.amlResult.reasoning}</p>
                <EvidenceList label="Evidence" items={app.amlResult.evidenceReferences} />
              </>
            ) : (
              <Placeholder stage={app.analysisStage} />
            )}
          </ResultCard>

          <ResultCard title="Compliance Summary" source={app.summary?.source}>
            {app.summary ? (
              <>
                <Badge tone={riskTone(app.summary.overallRisk)}>{app.summary.overallRisk} Overall Risk</Badge>
                <p className="mt-2 text-xs text-slate-600">{app.summary.summary}</p>
                {app.summary.recommendations.length > 0 && (
                  <>
                    <p className="mt-2 text-xs font-semibold text-slate-700">Recommendations</p>
                    <ul className="list-inside list-disc text-xs text-slate-600">
                      {app.summary.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <Placeholder stage={app.analysisStage} />
            )}
          </ResultCard>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Evidence</h2>
          </CardHeader>
          <CardBody className="grid gap-6 sm:grid-cols-2">
            <FileList title="KYC Documents" files={kycFiles} onPreview={setPreviewFile} />
            <FileList title="Transaction Logs" files={txFiles} onPreview={setPreviewFile} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Hermes Agent Activity</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {app.agentRuns.length === 0 && <p className="text-sm text-slate-500">No agent runs yet.</p>}
            {app.agentRuns.map((run) => (
              <details key={run.id} className="rounded-md border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  <Badge tone={run.status === 'completed' ? 'emerald' : run.status === 'failed' ? 'red' : 'indigo'}>
                    {run.status}
                  </Badge>{' '}
                  {run.objective} <span className="text-xs text-slate-400">({format(new Date(run.startedAt), 'PP p')})</span>
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {run.toolCalls.map((call, i) => (
                    <li key={i} className="border-l-2 border-indigo-200 pl-2">
                      <span className="font-mono text-indigo-700">{call.tool}</span>{' '}
                      <span className="text-slate-400">{JSON.stringify(call.output)}</span>
                    </li>
                  ))}
                </ul>
                {run.error && <p className="mt-1 text-xs text-red-600">Error: {run.error}</p>}
              </details>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Audit Trail</h2>
          </CardHeader>
          <CardBody>
            <ol className="space-y-2">
              {app.auditTrail.map((entry) => (
                <li key={entry.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                  <span className="font-medium text-slate-700">{entry.action}</span>{' '}
                  <span className="text-xs text-slate-400">
                    — {entry.actor} · {format(new Date(entry.timestamp), 'PP p')}
                  </span>
                  {entry.details && <p className="mt-0.5 text-xs text-slate-500">{entry.details}</p>}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Comments</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {app.comments.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
            {app.comments.map((c) => (
              <div key={c.id} className="rounded-md bg-slate-50 p-2.5 text-sm">
                <p className="text-xs font-semibold text-slate-700">
                  {c.author} <span className="font-normal text-slate-400">· {format(new Date(c.createdAt), 'PP p')}</span>
                </p>
                <p className="mt-0.5 text-slate-600">{c.body}</p>
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <input
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="Your name"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-40"
              />
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
              />
              <Button onClick={submitComment} disabled={isCommenting || !commentBody.trim() || !commentAuthor.trim()}>
                Add
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>

      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

function ResultCard({ title, source, children }: { title: string; source?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {source && (
          <Badge tone={source === 'gemini' ? 'teal' : 'slate'}>{source === 'gemini' ? 'Gemini' : 'Fallback (heuristic)'}</Badge>
        )}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function Placeholder({ stage }: { stage: string }) {
  if (stage === 'ANALYSIS_ERROR') return <p className="text-xs text-slate-400">Not yet run — see error above.</p>;
  return <p className="text-xs text-slate-400">Pending…</p>;
}

function EvidenceList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="mt-2 text-xs text-slate-400">
      {label}: {items.slice(0, 6).join(', ')}
      {items.length > 6 ? `, +${items.length - 6} more` : ''}
    </p>
  );
}

function FileList({
  title,
  files,
  onPreview,
}: {
  title: string;
  files: ApiFile[];
  onPreview: (f: ApiFile) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      {files.length === 0 ? (
        <p className="text-xs text-slate-400">None uploaded.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="truncate">
                {f.name} <span className="text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
              </span>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onPreview(f)}>
                Preview
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
