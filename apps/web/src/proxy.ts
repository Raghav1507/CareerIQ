import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/resume",
  "/recommendations",
  "/roles",
  "/skill-gap",
  "/roadmap",
  "/job-analyzer",
  "/settings",
  "/onboarding",
];

const AUTH_PAGES = ["/login", "/register"];

/**
 * Next.js 16 `proxy` (formerly middleware): refreshes the Supabase session
 * cookie and enforces route-level authentication before rendering.
 * Every Route Handler still re-validates the session independently.
 */
export async function proxy(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Not configured: pages render their own configuration notice.
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          supabaseResponse.cookies.set(name, value)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && AUTH_PAGES.includes(path)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon\\.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)",
  ],
};
