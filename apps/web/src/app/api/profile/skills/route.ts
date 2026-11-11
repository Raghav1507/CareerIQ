import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { query, queryOne } from "@/lib/db";
import { normalizeSkillName } from "@/lib/utils";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  skill_id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).default("intermediate"),
});

type SkillRow = { id: string; slug: string; name: string; category: string };

async function resolveSkill(input: { skill_id?: string; name?: string }): Promise<SkillRow | null> {
  if (input.skill_id) {
    return queryOne<SkillRow>(`select id, slug, name, category from public.skills where id = $1`, [
      input.skill_id,
    ]);
  }
  if (!input.name) return null;
  const norm = normalizeSkillName(input.name);
  if (!norm) return null;

  // 1) exact alias match (covers React.js = React JS = ReactJS)
  const byAlias = await queryOne<SkillRow>(
    `select s.id, s.slug, s.name, s.category
       from public.skill_aliases a
       join public.skills s on s.id = a.skill_id
      where a.alias_norm = $1
      limit 1`,
    [norm]
  );
  if (byAlias) return byAlias;

  // 2) match an existing skill slug directly
  const bySlug = await queryOne<SkillRow>(
    `select id, slug, name, category from public.skills where slug = $1 limit 1`,
    [norm]
  );
  if (bySlug) return bySlug;

  // 3) user-added skill: create catalogue entry + alias (honest, visible in data)
  const created = await queryOne<SkillRow>(
    `insert into public.skills (slug, name, category, description, is_technical, source)
     values ($1, $2, 'tooling', 'Added by a user (not part of the seeded M1 catalogue)', true, 'user')
     on conflict (slug) do update set slug = excluded.slug
     returning id, slug, name, category`,
    [norm, input.name!.slice(0, 60)]
  );
  if (!created) return null;
  await query(
    `insert into public.skill_aliases (skill_id, alias, alias_norm)
     values ($1, $2, $3) on conflict (alias_norm) do nothing`,
    [created.id, input.name!.slice(0, 60), norm]
  );
  return created;
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "skills:add", 60);
  if (limited) return limited;

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "INVALID_SKILL", "Provide a skill id or name.");
  if (!parsed.data.skill_id && !parsed.data.name) {
    return jsonError(422, "INVALID_SKILL", "Provide a skill id or name.");
  }

  const skill = await resolveSkill(parsed.data);
  if (!skill) return jsonError(422, "INVALID_SKILL", "Could not resolve that skill.");

  const row = await queryOne(
    `insert into public.user_skills (user_id, skill_id, proficiency, source, confidence)
     values ($1, $2, $3, 'manual', 1.0)
     on conflict (user_id, skill_id) do update set proficiency = excluded.proficiency
     returning id, skill_id, proficiency, source`,
    [user.id, skill.id, parsed.data.proficiency]
  );

  await audit({
    userId: user.id,
    action: "skill.add",
    resource: "user_skills",
    resourceId: skill.id,
    metadata: { skill: skill.slug, proficiency: parsed.data.proficiency },
    ip: clientIp(req),
  });

  return jsonOk({ skill: { ...skill, proficiency: parsed.data.proficiency, user_skill_id: row?.id } });
}

export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "skills:delete", 60);
  if (limited) return limited;

  const skillId = new URL(req.url).searchParams.get("skill_id");
  if (!skillId) return jsonError(422, "MISSING_SKILL_ID", "skill_id query parameter required.");

  await query(`delete from public.user_skills where user_id = $1 and skill_id = $2`, [user.id, skillId]);
  await audit({
    userId: user.id,
    action: "skill.delete",
    resource: "user_skills",
    resourceId: skillId,
    ip: clientIp(req),
  });
  return jsonOk({ ok: true });
}
