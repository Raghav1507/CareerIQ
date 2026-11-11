import { z } from "zod";

/**
 * Server-side environment schema. Read lazily so that `next build` never
 * crashes on a machine that has not configured secrets yet — route handlers
 * call `getServerEnv()` and surface a typed 500 instead.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AI_SERVICE_URL: z.string().default("http://127.0.0.1:8000"),
  INTERNAL_API_KEY: z.string().min(16, "INTERNAL_API_KEY must be at least 16 characters"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isServerEnvConfigured(): boolean {
  return serverEnvSchema.safeParse(process.env).success;
}
