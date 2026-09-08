// Ported from the source ComplyAI Genkit flow (src/ai/flows/determine-kyc-completeness.ts),
// extended to reason over *every* uploaded KYC document rather than an
// unbounded/implicit subset, and to always cite which document(s) informed
// each finding.
import { z } from 'genkit';
import { getAi, GEMINI_MODEL } from '../genkit';
import { fallbackKycCompleteness } from '../fallback';
import type { KycEvidenceSet } from '@/lib/evidence/kycEvidence';
import type { KycCompletenessResult } from '@/lib/types';

const OutputSchema = z.object({
  isComplete: z.boolean().describe('Whether the KYC documents are complete.'),
  missingInformation: z.array(z.string()).describe('List of missing information, if any.'),
  reasoning: z.string().describe('Reasoning for the completeness assessment.'),
  evidenceReferences: z
    .array(z.string())
    .describe('Document file names that support the assessment.'),
});

export async function analyzeKycCompleteness(
  evidence: KycEvidenceSet,
  documents: { name: string; dataUri: string }[]
): Promise<KycCompletenessResult> {
  const ai = await getAi();
  if (!ai || documents.length === 0) {
    return fallbackKycCompleteness(evidence);
  }

  try {
    const { output } = await ai.generate({
      model: GEMINI_MODEL,
      prompt: [
        {
          text:
            'You are a compliance officer assessing the completeness of a customer\'s KYC document set. ' +
            'You will be shown every document the customer uploaded, in order. For each, the file name is given ' +
            'immediately before the document itself so you can cite it.\n\n' +
            'Determine whether the set, taken together, is complete (typically requiring at least one government-issued ' +
            'identity document and one proof of address). If not, list the missing information. Cite the file names of ' +
            'the documents your assessment relies on in evidenceReferences.',
        },
        ...documents.flatMap((d) => [{ text: `Document: ${d.name}` }, { media: { url: d.dataUri } }]),
      ],
      output: { schema: OutputSchema },
    });

    if (!output) throw new Error('Empty Gemini response');
    return { ...output, source: 'gemini' };
  } catch (err) {
    console.error('[verifin] KYC completeness analysis via Gemini failed; using fallback.', err);
    return fallbackKycCompleteness(evidence);
  }
}
