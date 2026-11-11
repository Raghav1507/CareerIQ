import { createHash, randomUUID } from "node:crypto";
import { requireUser } from "@/lib/supabase/auth";
import { query, queryOne } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

async function callExtract(fileBytes: Buffer, fileName: string) {
  const env = getServerEnv();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(fileBytes)], { type: "application/pdf" }), fileName);
  const res = await fetch(`${env.AI_SERVICE_URL}/api/v1/resume/extract`, {
    method: "POST",
    headers: { "X-Internal-API-Key": env.INTERNAL_API_KEY },
    body: form,
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = body?.error as { code?: string; message?: string } | undefined;
    throw Object.assign(new Error(err?.message ?? "Extraction failed."), {
      code: err?.code ?? "EXTRACT_FAILED",
      status: res.status,
    });
  }
  return body as {
    page_count: number;
    model_used: string;
    raw_text_excerpt: string;
    parsed: Record<string, unknown>;
  };
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "resumes:upload", 10);
  if (limited) return limited;

  const admin = createAdminClient();
  if (!admin) return jsonError(503, "STORAGE_NOT_CONFIGURED", "SUPABASE_SERVICE_ROLE_KEY is missing on the server.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(422, "NO_FILE", "Attach a PDF file as `file`.");

  if (file.size > MAX_BYTES) return jsonError(413, "TOO_LARGE", "PDF must be 10 MB or smaller.");
  const looksPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  if (!looksPdf) return jsonError(422, "NOT_PDF", "Only PDF resumes are supported.");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return jsonError(422, "NOT_A_PDF", "File is not a valid PDF (magic bytes missing).");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await queryOne<{ id: string }>(
    `select id from public.resumes where user_id = $1 and sha256 = $2`,
    [user.id, sha256]
  );
  if (existing) {
    const resume = await queryOne(`select * from public.resumes where id = $1`, [existing.id]);
    const analysis = await queryOne(
      `select * from public.resume_analyses where resume_id = $1 order by created_at desc limit 1`,
      [existing.id]
    );
    await audit({
      userId: user.id,
      action: "resume.upload_duplicate",
      resource: "resumes",
      resourceId: existing.id,
      ip: clientIp(req),
    });
    return jsonOk({ duplicate: true, resume, analysis });
  }

  const storagePath = `${user.id}/${randomUUID()}.pdf`;
  const upload = await admin.storage.from("resumes").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) {
    return jsonError(502, "STORAGE_UPLOAD_FAILED", upload.error.message);
  }

  const resumeId = randomUUID();
  let status: "processed" | "failed" = "processed";
  let extracted: Awaited<ReturnType<typeof callExtract>> | null = null;
  let extractError: string | null = null;

  try {
    extracted = await callExtract(bytes, file.name);
  } catch (err) {
    status = "failed";
    extractError = err instanceof Error ? err.message : "Extraction failed.";
  }

  const resume = await queryOne(
    `insert into public.resumes
       (id, user_id, file_name, storage_path, mime_type, size_bytes, page_count, sha256, status, error_message)
     values ($1,$2,$3,$4,'application/pdf',$5,$6,$7,$8,$9)
     returning *`,
    [
      resumeId,
      user.id,
      file.name.slice(0, 200),
      storagePath,
      file.size,
      extracted?.page_count ?? null,
      sha256,
      status,
      extractError,
    ]
  );

  const analysis = await queryOne(
    `insert into public.resume_analyses
       (resume_id, user_id, status, parsed, raw_text_excerpt, model_used, error, completed_at)
     values ($1,$2,$3,$4::jsonb,$5,$6,$7, now())
     returning *`,
    [
      resumeId,
      user.id,
      status === "processed" ? "completed" : "failed",
      JSON.stringify(extracted?.parsed ?? {}),
      extracted?.raw_text_excerpt ?? null,
      extracted?.model_used ?? null,
      extractError,
    ]
  );

  await audit({
    userId: user.id,
    action: "resume.upload",
    resource: "resumes",
    resourceId: resumeId,
    metadata: { status, pages: extracted?.page_count ?? null, size_bytes: file.size },
    ip: clientIp(req),
  });

  if (status === "failed") {
    return jsonOk({ duplicate: false, resume, analysis }, 201);
  }
  return jsonOk({ duplicate: false, resume, analysis }, 201);
}

export async function GET() {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const resumes = await query(
    `select r.*, ra.id as analysis_id, ra.status as analysis_status, ra.parsed, ra.reviewed, ra.error
       from public.resumes r
       left join lateral (
         select * from public.resume_analyses a
          where a.resume_id = r.id
          order by a.created_at desc limit 1
       ) ra on true
      where r.user_id = $1
      order by r.created_at desc`,
    [user.id]
  );
  return jsonOk({ resumes });
}
