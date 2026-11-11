import { requireUser } from "@/lib/supabase/auth";
import { generateRecommendations, getStoredRecommendations } from "@/lib/server/recommendations";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "recommendations", 10);
  if (limited) return limited;

  try {
    const ranked = await generateRecommendations(user.id);
    await audit({
      userId: user.id,
      action: "recommendations.generate",
      resource: "career_recommendations",
      metadata: { count: ranked.length, top_score: ranked[0]?.score },
      ip: clientIp(req),
    });
    return jsonOk({
      count: ranked.length,
      top: ranked.slice(0, 3).map((r) => ({ rank: r.rank, role: r.roleName, score: r.score })),
    });
  } catch (err) {
    const e = err as Error & { code?: string; status?: number };
    return jsonError(e.status ?? 500, e.code ?? "GENERATE_FAILED", e.message);
  }
}

export async function GET() {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");
  const rows = await getStoredRecommendations(user.id);
  return jsonOk({ recommendations: rows });
}
