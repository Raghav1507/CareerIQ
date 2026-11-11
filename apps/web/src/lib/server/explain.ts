/**
 * Client for the FastAI explain endpoint (Gemini-backed).
 * Every call has a short timeout and degrades to `null` — callers then use
 * their deterministic template, so an unavailable LLM never blocks the product.
 */

import { getServerEnv } from "@/lib/env";

type ExplainResponse = {
  explanation: string | null;
  explanations: string[] | null;
  objectives?: string[][] | null;
  model_used: string | null;
  provider?: string;
  reason?: string;
};

type ExplainKind = "recommendations" | "job_match" | "skill_gap" | "roadmap";

async function callExplain(kind: ExplainKind, evidence: unknown): Promise<ExplainResponse | null> {
  try {
    const env = getServerEnv();
    const res = await fetch(`${env.AI_SERVICE_URL}/api/v1/explain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({ kind, evidence }),
      signal: AbortSignal.timeout(35_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ExplainResponse;
  } catch {
    return null;
  }
}

/** One Gemini call for the whole ranked recommendation list (or null → templates). */
export async function explainRecommendations(
  entries: Array<Record<string, unknown>>
): Promise<{ explanations: string[] | null; modelUsed: string | null }> {
  const data = await callExplain("recommendations", { entries });
  if (!data?.explanations || data.explanations.length !== entries.length) {
    return { explanations: null, modelUsed: null };
  }
  return { explanations: data.explanations, modelUsed: data.model_used };
}

/** Gemini explanation for a single job-match result (or null → template). */
export async function explainJobMatch(
  evidence: Record<string, unknown>
): Promise<{ explanation: string | null; modelUsed: string | null }> {
  const data = await callExplain("job_match", evidence);
  return { explanation: data?.explanation ?? null, modelUsed: data?.model_used ?? null };
}

/** Gemini prioritised gap advice (or null → deterministic template). */
export async function explainGap(
  evidence: Record<string, unknown>
): Promise<{ explanation: string | null; modelUsed: string | null }> {
  const data = await callExplain("skill_gap", evidence);
  return { explanation: data?.explanation ?? null, modelUsed: data?.model_used ?? null };
}

/** Gemini weekly objectives for a roadmap (or null → deterministic templates). */
export async function explainRoadmap(
  weeks: Array<Record<string, unknown>>
): Promise<{ objectives: string[][] | null; modelUsed: string | null }> {
  const data = await callExplain("roadmap", { weeks });
  const objectives = data?.objectives;
  if (!Array.isArray(objectives) || objectives.length !== weeks.length) {
    return { objectives: null, modelUsed: null };
  }
  const valid = objectives.every(
    (w) => Array.isArray(w) && w.length > 0 && w.every((o) => typeof o === "string")
  );
  return valid ? { objectives: objectives as string[][], modelUsed: data?.model_used ?? null } : { objectives: null, modelUsed: null };
}
