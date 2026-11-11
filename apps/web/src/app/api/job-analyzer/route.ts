import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { analyzeJob } from "@/lib/server/jobs";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().trim().min(80, "Paste at least 80 characters of the job description.").max(100_000),
  title: z.string().max(300).optional(),
  company: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "job-analyzer", 10);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(422, "INVALID_JOB", parsed.error.issues[0]?.message ?? "Invalid job description.");
  }

  try {
    const result = await analyzeJob(user.id, parsed.data);
    await audit({
      userId: user.id,
      action: "job.analyze",
      resource: "job_match_results",
      metadata: { title: parsed.data.title ?? null, company: parsed.data.company ?? null, score: result?.score },
      ip: clientIp(req),
    });
    return jsonOk({ result }, 201);
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    return jsonError(e.status ?? 500, e.code ?? "ANALYZE_FAILED", e.message);
  }
}
