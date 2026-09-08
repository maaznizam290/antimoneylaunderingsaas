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
  transaction_log: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
};

export function validateUploadedFile(
  category: (typeof FILE_CATEGORIES)[number],
  file: { type: string; size: number; name: string }
): string | null {
  if (file.size === 0) return `${file.name}: file is empty`;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${file.name}: exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`;
  }
  const allowed = ALLOWED_MIME_TYPES[category];
  const isCsvByExtension = category === 'transaction_log' && file.name.toLowerCase().endsWith('.csv');
  if (!allowed.includes(file.type) && !isCsvByExtension) {
    return `${file.name}: unsupported file type "${file.type || 'unknown'}" for ${category === 'kyc_document' ? 'KYC documents' : 'transaction logs'}`;
  }
  return null;
}
