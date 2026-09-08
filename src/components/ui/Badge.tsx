import type { ReactNode } from 'react';

type Tone = 'slate' | 'indigo' | 'teal' | 'emerald' | 'amber' | 'red';

const TONE_CLASSES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-300',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-300',
  teal: 'bg-teal-50 text-teal-700 ring-teal-300',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
  amber: 'bg-amber-50 text-amber-700 ring-amber-300',
  red: 'bg-red-50 text-red-700 ring-red-300',
};

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case 'Approved':
      return 'emerald';
    case 'Rejected':
    case 'Error':
      return 'red';
    case 'PendingReview':
    case 'Escalated':
      return 'amber';
    case 'Processing':
      return 'indigo';
    default:
      return 'slate';
  }
}

export function riskTone(risk: string): Tone {
  switch (risk) {
    case 'High':
      return 'red';
    case 'Medium':
      return 'amber';
    case 'Low':
      return 'emerald';
    default:
      return 'slate';
  }
}
