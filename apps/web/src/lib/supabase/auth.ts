import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the authenticated user for a Route Handler.
 * Returns `user` on success or a reason when unauthenticated.
 */
export async function requireUser(): Promise<
  { user: User; error: null } | { user: null; error: "unauthenticated" | "not_configured" }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { user: null, error: "not_configured" };

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (set) => {
          try {
            set.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* server component context */
          }
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? { user, error: null } : { user: null, error: "unauthenticated" };
  } catch {
    return { user: null, error: "unauthenticated" };
  }
}
