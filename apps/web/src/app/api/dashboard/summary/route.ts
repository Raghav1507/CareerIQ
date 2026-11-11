import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getDashboardSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Real counts for the interactive dashboard — no hardcoded metrics. */
export async function GET() {
  const { user, error } = await requireUser();
  if (error === "not_configured") {
    return errorResponse(503, "SUPABASE_NOT_CONFIGURED", "Authentication is not configured.");
  }
  if (error || !user) {
    return errorResponse(401, "UNAUTHENTICATED", "You must be signed in.");
  }

  try {
    const summary = await getDashboardSummary(user.id);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[dashboard/summary]", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load dashboard summary.");
  }
}
