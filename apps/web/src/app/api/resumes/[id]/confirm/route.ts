import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { queryOne, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const confirmSchema = z.object({
  skillSlugs: z.array(z.string().max(80)).max(200).default([]),
  importSummary: z.boolean().default(false),
});

type ParsedSkill = { slug: string; name: string; category: string; confidence?: number; evidence?: string };

export async function POST(req: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "resumes:confirm", 20);
  if (limited) return limited;

  const { id } = await params;
  const parsedBody = confirmSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) return jsonError(422, "INVALID_BODY", "Invalid confirmation payload.");
  const { skillSlugs, importSummary } = parsedBody.data;

  const analysis = await queryOne<{ id: string; parsed: { skills?: ParsedSkill[]; summary?: string } }>(
    `select ra.id, ra.parsed
       from public.resume_analyses ra
       join public.resumes r on r.id = ra.resume_id
      where ra.resume_id = $1 and ra.user_id = $2
      order by ra.created_at desc limit 1`,
    [id, user.id]
  );
  if (!analysis) return jsonError(404, "NOT_FOUND", "No analysis found for this resume.");

  const allSkills = analysis.parsed.skills ?? [];
  const wanted = new Set(skillSlugs);
  const selected = allSkills.filter((s) => wanted.has(s.slug));

  let added = 0;
  let skipped = 0;

  await withTransaction(async (client) => {
    for (const skill of selected) {
      const skillRow = await client.query<{ id: string }>(
        `select id from public.skills where slug = $1`,
        [skill.slug]
      );
      if (!skillRow.rows[0]) {
        skipped += 1;
        continue;
      }
      const res = await client.query(
        `insert into public.user_skills (user_id, skill_id, proficiency, source, confidence)
         values ($1, $2, 'intermediate', 'resume', $3)
         on conflict (user_id, skill_id) do nothing`,
        [user.id, skillRow.rows[0].id, Math.min(1, Math.max(0, skill.confidence ?? 0.9))]
      );
      if ((res.rowCount ?? 0) > 0) added += 1;
      else skipped += 1;
    }

    if (importSummary && analysis.parsed.summary) {
      await client.query(
        `update public.profiles
            set summary = coalesce(nullif(summary, ''), $2)
          where user_id = $1`,
        [user.id, analysis.parsed.summary.slice(0, 4000)]
      );
    }

    await client.query(
      `update public.resume_analyses set reviewed = true where id = $1`,
      [analysis.id]
    );
    await client.query(
      `update public.resumes set is_active = (id = $2) where user_id = $1`,
      [user.id, id]
    );
  });

  const skillCount = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.user_skills where user_id = $1`,
    [user.id]
  );

  await audit({
    userId: user.id,
    action: "resume.confirm",
    resource: "resume_analyses",
    resourceId: id,
    metadata: { added, skipped, imported_summary: importSummary },
    ip: clientIp(req),
  });

  return jsonOk({ added, skipped, totalSkills: Number(skillCount?.n ?? 0) });
}
