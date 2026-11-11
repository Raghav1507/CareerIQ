import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getRoleDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/** Full detail for one of the ten career roles, including weighted skills. */
export async function GET(_request: Request, { params }: Params) {
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

  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    return NextResponse.json(
      { error: { code: "INVALID_SLUG", message: "Invalid role slug." } },
      { status: 400 }
    );
  }

  try {
    const detail = await getRoleDetail(slug);
    if (!detail) {
      return NextResponse.json(
        { error: { code: "ROLE_NOT_FOUND", message: "Career role not found." } },
        { status: 404 }
      );
    }
    return NextResponse.json(detail);
  } catch (err) {
    console.error("[roles/[slug]]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load role detail." } },
      { status: 500 }
    );
  }
}
