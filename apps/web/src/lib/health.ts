import { pingDatabase } from "@/lib/db";
import { getServerEnv, isServerEnvConfigured } from "@/lib/env";

export type DbHealth = Awaited<ReturnType<typeof pingDatabase>>;

export type AiHealth = {
  ok: boolean;
  version?: string;
  latencyMs: number;
  error?: string;
};

/** Authenticated service-to-service ping to the FastAPI process. */
export async function pingAiService(): Promise<AiHealth> {
  if (!isServerEnvConfigured()) {
    return { ok: false, latencyMs: 0, error: "Server environment is not configured" };
  }
  const env = getServerEnv();
  const started = Date.now();
  try {
    const res = await fetch(`${env.AI_SERVICE_URL.replace(/\/$/, "")}/api/v1/internal/ping`, {
      method: "GET",
      headers: { "X-Internal-API-Key": env.INTERNAL_API_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `AI service responded ${res.status}` };
    }
    const body = (await res.json()) as { pong?: boolean; version?: string };
    if (!body.pong) {
      return { ok: false, latencyMs, error: "AI service returned unexpected payload" };
    }
    return { ok: true, latencyMs, version: body.version };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "AI service unreachable",
    };
  }
}

export async function getSystemHealth() {
  const [db, ai] = await Promise.all([pingDatabase(), pingAiService()]);
  const envOk = isServerEnvConfigured();
  return {
    status: db.ok && ai.ok && envOk ? ("ok" as const) : ("degraded" as const),
    time: new Date().toISOString(),
    environment: {
      configured: envOk,
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    db,
    ai,
  };
}
