import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { listSkillsWithAliases } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Skills catalogue with normalisation aliases (used by the profile editor). */
export async function GET() {
  const { user, error } = await requireUser();
  if (error === "not_configured") {
    return NextResponse.json(
      { error: { code: "SUPABASE_NOT_CONFIGURED", message: "Authentication is not configured." } },
      { status: 503 }
    );
  }
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "You must be signed in." } },
      { status: 401 }
    );
  }

  try {
    const skills = await listSkillsWithAliases();
    return NextResponse.json({ skills });
  } catch (err) {
    console.error("[skills]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load skills." } },
      { status: 500 }
    );
  }
}
