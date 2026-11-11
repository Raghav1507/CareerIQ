import { requireUser } from "@/lib/supabase/auth";
import { queryOne } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "resumes:delete", 20);
  if (limited) return limited;

  const { id } = await params;
  const resume = await queryOne<{ storage_path: string }>(
    `delete from public.resumes where id = $1 and user_id = $2 returning storage_path`,
    [id, user.id]
  );
  if (!resume) return jsonError(404, "NOT_FOUND", "Resume not found.");

  const admin = createAdminClient();
  if (admin) {
    await admin.storage.from("resumes").remove([resume.storage_path]).catch(() => undefined);
  }
  await audit({
    userId: user.id,
    action: "resume.delete",
    resource: "resumes",
    resourceId: id,
    ip: clientIp(req),
  });
  return jsonOk({ ok: true });
}
