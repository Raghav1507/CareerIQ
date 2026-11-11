import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { setProgress } from "@/lib/server/roadmaps";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  roadmap_id: z.string().uuid(),
  item_key: z.string().min(1).max(120),
  status: z.enum(["not_started", "in_progress", "completed"]),
  skill_slug: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "roadmap:progress", 60);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "INVALID_BODY", "roadmap_id, item_key and status required.");

  try {
    await setProgress({
      userId: user.id,
      roadmapId: parsed.data.roadmap_id,
      itemKey: parsed.data.item_key,
      status: parsed.data.status,
      skillSlug: parsed.data.skill_slug,
    });
    await audit({
      userId: user.id,
      action: "roadmap.progress",
      resource: "roadmap_progress",
      resourceId: parsed.data.roadmap_id,
      metadata: { item_key: parsed.data.item_key, status: parsed.data.status },
      ip: clientIp(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    return jsonError(e.status ?? 500, e.code ?? "PROGRESS_FAILED", e.message);
  }
}
