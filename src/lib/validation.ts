import { z } from 'zod';
import { FILE_CATEGORIES, REVIEW_DECISIONS } from '@/lib/types';

export const createApplicationSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(200),
});

export const addCommentSchema = z.object({
  author: z.string().trim().min(1, 'Author is required').max(200),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});

export const updateStatusSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  actor: z.string().trim().min(1, 'Reviewer name is required').max(200),
});

export const uploadCategorySchema = z.enum(FILE_CATEGORIES);

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export const ALLOWED_MIME_TYPES: Record<(typeof FILE_CATEGORIES)[number], string[]> = {
  kyc_document: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  transaction_log: [
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel', // legacy .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  ],
};

// Browsers/OSes are inconsistent about the `type` they report for
// spreadsheet exports (some send an empty string, some send a generic
// octet-stream), so transaction-log uploads are also accepted by
// extension — matching how the evidence layer actually parses them (see
// src/lib/evidence/xlsx.ts and src/lib/hermes/tools.ts).
const TRANSACTION_LOG_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export function validateUploadedFile(
  category: (typeof FILE_CATEGORIES)[number],
  file: { type: string; size: number; name: string }
): string | null {
  if (file.size === 0) return `${file.name}: file is empty`;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${file.name}: exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`;
  }
  const allowed = ALLOWED_MIME_TYPES[category];
  const lowerName = file.name.toLowerCase();
  const isAllowedByExtension =
    category === 'transaction_log' && TRANSACTION_LOG_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!allowed.includes(file.type) && !isAllowedByExtension) {
    return `${file.name}: unsupported file type "${file.type || 'unknown'}" for ${category === 'kyc_document' ? 'KYC documents' : 'transaction logs'}`;
  }
  return null;
}
