import type { Genkit } from 'genkit';

/// Whether a Gemini-backed run is possible at all. Checked before every AI
/// stage so the pipeline can fail over to the deterministic analyzer
/// (CLAUDE.md section 33 — fail gracefully, never make the whole app
/// unusable because the specialized model is unavailable).
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

let aiInstance: Genkit | null = null;
let initAttempted = false;

/// Lazily constructs the Genkit instance wired to the Google AI (Gemini)
/// plugin. Returns null (never throws) when no key is configured or
/// initialization fails — callers must treat null as "use the fallback
/// analyzer", not as an error.
export async function getAi(): Promise<Genkit | null> {
  if (!isGeminiConfigured()) return null;
  if (aiInstance) return aiInstance;
  if (initAttempted) return null;
  initAttempted = true;

  try {
    const { genkit } = await import('genkit');
    const { googleAI } = await import('@genkit-ai/googleai');
    aiInstance = genkit({
      plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
    });
    return aiInstance;
  } catch (err) {
    console.error('[verifin] Gemini/Genkit initialization failed; using fallback analyzer.', err);
    return null;
  }
}

export const GEMINI_MODEL = 'googleai/gemini-2.0-flash';
