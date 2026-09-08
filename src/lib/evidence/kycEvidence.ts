/// Heuristic document-type classification used to (a) give the fallback
/// analyzer something concrete to reason about without OCR/vision, and (b)
/// give the Gemini-backed prompt structured metadata alongside the raw
/// document media. Every document is classified — none are dropped.
export type InferredKycDocType =
  | 'passport'
  | 'national_id'
  | 'drivers_license'
  | 'proof_of_address'
  | 'bank_statement'
  | 'other';

const KEYWORD_MAP: [RegExp, InferredKycDocType][] = [
  [/passport/i, 'passport'],
  [/(national[_-]?id|nid|id[_-]?card)/i, 'national_id'],
  [/(driver|licence|license)/i, 'drivers_license'],
  [/(address|utility|proof[_-]?of[_-]?address|poa)/i, 'proof_of_address'],
  [/(bank[_-]?statement|statement)/i, 'bank_statement'],
];

export function classifyKycDocument(fileName: string): InferredKycDocType {
  for (const [pattern, type] of KEYWORD_MAP) {
    if (pattern.test(fileName)) return type;
  }
  return 'other';
}

export interface KycDocumentEvidence {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  inferredType: InferredKycDocType;
}

export interface KycEvidenceSet {
  documents: KycDocumentEvidence[];
  recognizedTypes: InferredKycDocType[];
  /// Common KYC document categories not represented by any uploaded file —
  /// a starting point for the completeness assessment, refined by the AI
  /// (or, in fallback mode, used directly).
  likelyMissingTypes: InferredKycDocType[];
}

const EXPECTED_TYPES: InferredKycDocType[] = ['passport', 'proof_of_address'];
// national_id/drivers_license are alternates to passport, handled below.

export function buildKycEvidenceSet(
  files: { id: string; name: string; mimeType: string; size: number }[]
): KycEvidenceSet {
  const documents: KycDocumentEvidence[] = files.map((f) => ({
    ...f,
    inferredType: classifyKycDocument(f.name),
  }));
  const recognizedTypes = Array.from(new Set(documents.map((d) => d.inferredType)));

  const hasIdentity = recognizedTypes.some((t) =>
    ['passport', 'national_id', 'drivers_license'].includes(t)
  );
  const hasAddressProof = recognizedTypes.includes('proof_of_address');

  const likelyMissingTypes: InferredKycDocType[] = [];
  if (!hasIdentity) likelyMissingTypes.push('passport');
  if (!hasAddressProof) likelyMissingTypes.push('proof_of_address');

  return { documents, recognizedTypes, likelyMissingTypes };
}
