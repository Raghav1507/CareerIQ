/** Shared data loaders for the matching engines (server-only). */

import { query } from "@/lib/db";

export type OwnedSkill = { slug: string; name: string; proficiency: string };

export type RoleSkillLine = {
  role_id: string;
  slug: string;
  name: string;
  weight: number;
  is_required: boolean;
};

export type RoleIndexRow = {
  id: string;
  slug: string;
  name: string;
  display_order: number;
};

/** Alias-normalised slugs the user already owns (manual + resume sources). */
export async function getOwnedSkillSlugs(userId: string): Promise<Set<string>> {
  const rows = await query<{ slug: string }>(
    `select distinct s.slug
       from public.user_skills us
       join public.skills s on s.id = us.skill_id
      where us.user_id = $1`,
    [userId]
  );
  return new Set(rows.map((r) => r.slug));
}

export async function getOwnedSkills(userId: string): Promise<OwnedSkill[]> {
  return query<OwnedSkill>(
    `select s.slug, s.name, us.proficiency
       from public.user_skills us
       join public.skills s on s.id = us.skill_id
      where us.user_id = $1
      order by s.name`,
    [userId]
  );
}

/** All active roles (ordered). */
export async function getRoleIndex(): Promise<RoleIndexRow[]> {
  return query<RoleIndexRow>(
    `select id, slug, name, display_order
       from public.career_roles
      where is_active
      order by display_order`
  );
}

/** Weighted skill lines for one role (or every role when roleSlug is null). */
export async function getRoleSkillLines(roleSlug?: string | null): Promise<
  Array<RoleSkillLine & { role_slug: string }>
> {
  return query<RoleSkillLine & { role_slug: string }>(
    `select r.id as role_id, r.slug as role_slug,
            s.slug, s.name, rs.weight, rs.is_required
       from public.career_roles r
       join public.role_skills rs on rs.role_id = r.id
       join public.skills s on s.id = rs.skill_id
      where r.is_active
        and ($1::text is null or r.slug = $1)
      order by r.display_order, rs.is_required desc, rs.weight desc, s.name`,
    [roleSlug ?? null]
  );
}
