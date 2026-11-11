import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link / confirmation callback.
 * Exchanges the `code` query param for a session and redirects safely.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const safeNext = next.startsWith("/") ? next : "/dashboard";
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      console.error("[auth/callback]", error.message);
    } catch (err) {
      console.error(
        "[auth/callback]",
        err instanceof Error ? err.message : "unknown error"
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
