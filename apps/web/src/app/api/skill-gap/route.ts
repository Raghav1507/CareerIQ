import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { saveSkillGap } from "@/lib/server/gap";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ role_slug: z.string().min(1).max(60) });

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "skill-gap", 20);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "INVALID_ROLE", "role_slug is required.");

  try {
    const gap = await saveSkillGap(user.id, parsed.data.role_slug);
    await audit({
      userId: user.id,
      action: "skill_gap.save",
      resource: "skill_gap_analyses",
      metadata: { role_slug: parsed.data.role_slug, gap_score: gap.gapScore },
      ip: clientIp(req),
    });
    return jsonOk({
      role: gap.role,
      gap_score: gap.gapScore,
      advice: gap.advice,
      missing_required: gap.evidence.missingRequired,
      matched_required: gap.evidence.matchedRequired,
    });
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    return jsonError(e.status ?? 500, e.code ?? "GAP_FAILED", e.message);
  }
}
