/** Best-effort audit trail writer.
 *
 * Failures are logged and swallowed — auditing must never break a user
 * request. Writes go through the owner connection (bypasses RLS); clients can
 * only SELECT their own rows (see migration 0006).
 */

import { query } from "@/lib/db";

export type AuditEntry = {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

function safeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  if (!first) return null;
  // basic IPv4/IPv6 sanity — invalid values must not break the insert
  if (/^[0-9a-fA-F.:]+$/.test(first) && first.length <= 45) return first;
  return null;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `insert into public.audit_logs (user_id, action, resource, resource_id, metadata, ip)
       values ($1, $2, $3, $4, $5::jsonb, $6::inet)`,
      [
        entry.userId ?? null,
        entry.action,
        entry.resource,
        entry.resourceId ?? null,
        JSON.stringify(entry.metadata ?? {}),
        safeIp(entry.ip),
      ]
    );
  } catch (err) {
    console.error("[audit] write failed:", entry.action, err instanceof Error ? err.message : err);
  }
}

/** Convenience: pull the client IP off a Request (best-effort). */
export function clientIp(req: Request): string | null {
  return safeIp(req.headers.get("x-forwarded-for")) ?? safeIp(req.headers.get("x-real-ip"));
}
