import type { AnalysisStage, BusinessStatus, FileCategory, ReviewDecision, RiskLevel } from '@/lib/types';

export interface ApiFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  createdAt: string;
}

export interface ApiKycResult {
  isComplete: boolean;
  missingInformation: string[];
  reasoning: string;
  evidenceReferences: string[];
  source: string;
  createdAt: string;
}

export interface ApiAmlResult {
  riskLevel: RiskLevel;
  riskScore: number;
  flags: string[];
  reasoning: string;
  evidenceReferences: string[];
  source: string;
  createdAt: string;
}

export interface ApiSummary {
  overallRisk: RiskLevel;
  summary: string;
  reasoning: string;
  recommendations: string[];
  source: string;
  createdAt: string;
}

export interface ApiAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string | null;
}

export interface ApiComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ApiAgentRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  objective: string;
  toolCalls: { tool: string; input: unknown; output: unknown; at: string }[];
  result: string | null;
  error: string | null;
}

export interface ApiApplication {
  id: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  status: BusinessStatus;
  analysisStage: AnalysisStage;
  analysisError: string | null;
  files: ApiFile[];
  kycResult: ApiKycResult | null;
  amlResult: ApiAmlResult | null;
  summary: ApiSummary | null;
  auditTrail: ApiAuditEntry[];
  comments: ApiComment[];
  agentRuns: ApiAgentRun[];
}

async function unwrap<T>(res: Response, key: string): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? `Request failed with status ${res.status}`);
  }
  return json[key] as T;
}

export const api = {
  listApplications: async (): Promise<ApiApplication[]> => {
    const res = await fetch('/api/applications', { cache: 'no-store' });
    return unwrap<ApiApplication[]>(res, 'applications');
  },
  getApplication: async (id: string): Promise<ApiApplication> => {
    const res = await fetch(`/api/applications/${id}`, { cache: 'no-store' });
    return unwrap<ApiApplication>(res, 'application');
  },
  createApplication: async (customerName: string): Promise<ApiApplication> => {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName }),
    });
    return unwrap<ApiApplication>(res, 'application');
  },
  uploadFiles: async (id: string, category: FileCategory, files: File[]): Promise<ApiApplication> => {
    const form = new FormData();
    form.set('category', category);
    files.forEach((f) => form.append('files', f));
    const res = await fetch(`/api/applications/${id}/files`, { method: 'POST', body: form });
    return unwrap<ApiApplication>(res, 'application');
  },
  startAnalysis: async (id: string): Promise<ApiApplication> => {
    const res = await fetch(`/api/applications/${id}/analyze`, { method: 'POST' });
    return unwrap<ApiApplication>(res, 'application');
  },
  addComment: async (id: string, author: string, body: string): Promise<ApiApplication> => {
    const res = await fetch(`/api/applications/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, body }),
    });
    return unwrap<ApiApplication>(res, 'application');
  },
  updateStatus: async (id: string, decision: ReviewDecision, actor: string): Promise<ApiApplication> => {
    const res = await fetch(`/api/applications/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, actor }),
    });
    return unwrap<ApiApplication>(res, 'application');
  },
  fileUrl: (fileId: string): string => `/api/files/${fileId}`,
};
