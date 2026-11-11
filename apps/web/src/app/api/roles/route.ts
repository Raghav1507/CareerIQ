import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { listRoles } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** The ten official M1 career roles with skill coverage counts. */
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
    const roles = await listRoles();
    return NextResponse.json({ roles });
  } catch (err) {
    console.error("[roles]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load career roles." } },
      { status: 500 }
    );
  }
}
