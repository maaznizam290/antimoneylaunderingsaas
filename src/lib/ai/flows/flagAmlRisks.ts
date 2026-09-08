// Ported from the source flow (src/ai/flows/flag-aml-risks.ts). The source
// implementation analyzed a single representative KYC document and a single
// representative transaction log. Verifin instead passes the AI a
// deterministically computed evidence set built over *all* uploaded KYC
// documents and *all* transaction CSVs (see src/lib/evidence), so no
// evidence is silently dropped (CLAUDE.md sections 13-16).
import { z } from 'genkit';
import { getAi, GEMINI_MODEL } from '../genkit';
import { fallbackAmlRisk } from '../fallback';
import type { KycEvidenceSet } from '@/lib/evidence/kycEvidence';
import type { TransactionEvidenceSet } from '@/lib/evidence/transactionEvidence';
import type { AmlRiskResult } from '@/lib/types';

const OutputSchema = z.object({
  riskLevel: z.enum(['Low', 'Medium', 'High']).describe('The overall AML risk level.'),
  riskScore: z.number().min(0).max(100).describe('Numeric risk score from 0 (no risk) to 100 (severe risk).'),
  flags: z.array(z.string()).describe('Specific AML risk flags identified during analysis.'),
  reasoning: z.string().describe('A summary of the reasoning behind the risk assessment.'),
  evidenceReferences: z
    .array(z.string())
    .describe('Citations such as "Transaction ID 38291 (March.csv)" or a document file name.'),
});

export async function analyzeAmlRisk(
  kycEvidence: KycEvidenceSet,
  txEvidence: TransactionEvidenceSet,
  kycDocuments: { name: string; dataUri: string }[]
): Promise<AmlRiskResult> {
  const ai = await getAi();
  if (!ai) {
    return fallbackAmlRisk(txEvidence, kycEvidence);
  }

  try {
    const { output } = await ai.generate({
      model: GEMINI_MODEL,
      prompt: [
        {
          text:
            'You are an AI compliance analyst specializing in Anti-Money Laundering (AML) risk assessment. ' +
            'You are given (a) the customer\'s KYC documents, and (b) a deterministically computed evidence set ' +
            'covering ALL of the customer\'s uploaded transaction data (statistics + already-flagged suspicious ' +
            'patterns + a representative sample of individual transactions, each with an ID and source file). ' +
            'Do not assume any transactions exist beyond what is listed below.\n\n' +
            `Transaction statistics: ${JSON.stringify(txEvidence.statistics)}\n\n` +
            `Deterministically flagged patterns: ${JSON.stringify(txEvidence.suspiciousPatterns)}\n\n` +
            `Representative transaction sample: ${JSON.stringify(txEvidence.representativeSample)}\n\n` +
            'Assess overall AML risk (riskLevel Low/Medium/High, riskScore 0-100), list specific flags, explain your ' +
            'reasoning, and cite the evidence (transaction IDs with source file, or document names) that supports each ' +
            'finding.',
        },
        ...kycDocuments.flatMap((d) => [{ text: `KYC document: ${d.name}` }, { media: { url: d.dataUri } }]),
      ],
      output: { schema: OutputSchema },
    });

    if (!output) throw new Error('Empty Gemini response');
    return { ...output, source: 'gemini' };
  } catch (err) {
    console.error('[verifin] AML risk analysis via Gemini failed; using fallback.', err);
    return fallbackAmlRisk(txEvidence, kycEvidence);
  }
}
