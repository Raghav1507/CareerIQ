import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { generateRoadmap } from "@/lib/server/roadmaps";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  role_slug: z.string().min(1).max(60),
  horizon_weeks: z.number().int().min(1).max(104).default(12),
});

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "roadmaps", 10);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "INVALID_BODY", "role_slug and horizon_weeks required.");

  try {
    const { roadmap, skillCount } = await generateRoadmap(
      user.id,
      parsed.data.role_slug,
      parsed.data.horizon_weeks
    );
    await audit({
      userId: user.id,
      action: "roadmap.create",
      resource: "learning_roadmaps",
      resourceId: roadmap?.id ?? null,
      metadata: { role_slug: parsed.data.role_slug, horizon_weeks: parsed.data.horizon_weeks, skill_count: skillCount },
      ip: clientIp(req),
    });
    return jsonOk({ roadmap, skillCount }, 201);
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    return jsonError(e.status ?? 500, e.code ?? "ROADMAP_FAILED", e.message);
  }
}
