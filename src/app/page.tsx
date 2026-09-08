'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Header } from '@/components/Header';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, statusTone, riskTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api, type ApiApplication } from '@/lib/apiClient';
import { BUSINESS_STATUSES } from '@/lib/types';

export default function DashboardPage() {
  const [applications, setApplications] = useState<ApiApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [riskFilter, setRiskFilter] = useState<string>('All');

  useEffect(() => {
    let cancelled = false;
    api
      .listApplications()
      .then((apps) => !cancelled && setApplications(apps))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const apps = applications ?? [];
    return {
      total: apps.length,
      pendingReview: apps.filter((a) => a.status === 'PendingReview').length,
      highRisk: apps.filter((a) => a.amlResult?.riskLevel === 'High' || a.summary?.overallRisk === 'High').length,
      approved: apps.filter((a) => a.status === 'Approved').length,
      escalated: apps.filter((a) => a.status === 'Escalated').length,
    };
  }, [applications]);

  const filtered = useMemo(() => {
    return (applications ?? []).filter((a) => {
      if (search && !a.customerName.toLowerCase().includes(search.toLowerCase()) && !a.id.includes(search)) {
        return false;
      }
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (riskFilter !== 'All') {
        const risk = a.summary?.overallRisk ?? a.amlResult?.riskLevel;
        if (risk !== riskFilter) return false;
      }
      return true;
    });
  }, [applications, search, statusFilter, riskFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Case Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-500">KYC/AML applications under review</p>
          </div>
          <Link href="/applications/new">
            <Button>New Application</Button>
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricTile label="Total Applications" value={metrics.total} tone="slate" />
          <MetricTile label="Pending Review" value={metrics.pendingReview} tone="amber" />
          <MetricTile label="High Risk" value={metrics.highRisk} tone="red" />
          <MetricTile label="Approved" value={metrics.approved} tone="emerald" />
          <MetricTile label="Escalated" value={metrics.escalated} tone="amber" />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name or application ID…"
              className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option>All</option>
                {BUSINESS_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option>All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {error && <p className="p-5 text-sm text-red-600">{error}</p>}
            {!applications && !error && <p className="p-5 text-sm text-slate-500">Loading applications…</p>}
            {applications && filtered.length === 0 && (
              <p className="p-5 text-sm text-slate-500">
                {applications.length === 0
                  ? 'No applications yet. Create one to get started.'
                  : 'No applications match your search/filters.'}
              </p>
            )}
            {filtered.length > 0 && (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">Customer</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5">Risk</th>
                    <th className="px-5 py-2.5">Created</th>
                    <th className="px-5 py-2.5">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => {
                    const risk = app.summary?.overallRisk ?? app.amlResult?.riskLevel;
                    return (
                      <tr key={app.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link href={`/applications/${app.id}`} className="font-medium text-indigo-700 hover:underline">
                            {app.customerName}
                          </Link>
                          <div className="text-xs text-slate-400">{app.id}</div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={statusTone(app.status)}>{app.status}</Badge>
                        </td>
                        <td className="px-5 py-3">{risk ? <Badge tone={riskTone(risk)}>{risk}</Badge> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-5 py-3 text-slate-500">{format(new Date(app.createdAt), 'PP p')}</td>
                        <td className="px-5 py-3 text-slate-500">{format(new Date(app.updatedAt), 'PP p')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'amber' | 'red' | 'emerald' }) {
  const toneClasses: Record<string, string> = {
    slate: 'text-slate-900',
    amber: 'text-amber-600',
    red: 'text-red-600',
    emerald: 'text-emerald-600',
  };
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      </CardBody>
    </Card>
  );
}
