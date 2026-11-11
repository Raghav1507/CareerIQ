import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Service-role Supabase client for trusted server operations only
 * (resume storage uploads). Never expose this key to the browser.
 */
export function createAdminClient() {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
