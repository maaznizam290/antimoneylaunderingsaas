// Ported from the source flow (src/ai/flows/summarize-kyc-results.ts).
import { z } from 'genkit';
import { getAi, GEMINI_MODEL } from '../genkit';
import { fallbackComplianceSummary } from '../fallback';
import type { AmlRiskResult, ComplianceSummaryResult, KycCompletenessResult } from '@/lib/types';

const OutputSchema = z.object({
  summary: z.string().describe('A concise summary (<=200 words) of the key findings and reasoning.'),
  overallRisk: z.enum(['Low', 'Medium', 'High']).describe('The overall risk level for this application.'),
  reasoning: z.string().describe('How the KYC and AML findings combine into the overall assessment.'),
  recommendations: z.array(z.string()).describe('Concrete next actions for the human reviewer.'),
});

export async function generateComplianceSummary(
  kyc: KycCompletenessResult,
  aml: AmlRiskResult
): Promise<ComplianceSummaryResult> {
  const ai = await getAi();
  if (!ai) {
    return fallbackComplianceSummary(kyc, aml);
  }

  try {
    const { output } = await ai.generate({
      model: GEMINI_MODEL,
      prompt: [
        {
          text:
            'You are a compliance officer writing the final summary of a KYC/AML case for a human reviewer who will ' +
            'approve, escalate, or reject the application. Base your summary ONLY on the structured results below — ' +
            'do not invent findings.\n\n' +
            `KYC completeness result: ${JSON.stringify(kyc)}\n\n` +
            `AML risk result: ${JSON.stringify(aml)}\n\n` +
            'Provide a concise summary (<=200 words), an overall risk level, reasoning for how the two results ' +
            'combine, and concrete recommendations for the reviewer.',
        },
      ],
      output: { schema: OutputSchema },
    });

    if (!output) throw new Error('Empty Gemini response');
    return { ...output, source: 'gemini' };
  } catch (err) {
    console.error('[verifin] Compliance summary generation via Gemini failed; using fallback.', err);
    return fallbackComplianceSummary(kyc, aml);
  }
}
