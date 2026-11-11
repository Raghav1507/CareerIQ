import { query, queryOne } from "@/lib/db";
import type { CareerRoleRow, DashboardSummary, SkillCategory } from "@/types/db";

export type RoleSkillCountRow = {
  slug: string;
  name: string;
  required: number;
  optional: number;
};

export type RoleWithCounts = CareerRoleRow & {
  required_count: number;
  optional_count: number;
};

export type RoleSkillItem = {
  slug: string;
  name: string;
  category: SkillCategory;
  is_required: boolean;
  weight: number;
};

/** Real counts for the dashboard — every number comes from the database. */
export async function getDashboardSummary(userId: string) {
  const catalog = await queryOne<{
    roles: string;
    skills: string;
    required_skill_links: string;
    aliases: string;
  }>(`
    select
      (select count(*) from public.career_roles where is_active) as roles,
      (select count(*) from public.skills)                        as skills,
      (select count(*) from public.role_skills where is_required) as required_skill_links,
      (select count(*) from public.skill_aliases)                 as aliases
  `);

  const userStats = await queryOne<{
    skills: string;
    resumes: string;
    recommendations: string;
    roadmaps: string;
    job_descriptions: string;
    onboarding_complete: boolean;
  }>(`
    select
      (select count(*) from public.user_skills where user_id = $1)            as skills,
      (select count(*) from public.resumes where user_id = $1)                as resumes,
      (select count(*) from public.career_recommendations where user_id = $1) as recommendations,
      (select count(*) from public.learning_roadmaps where user_id = $1)      as roadmaps,
      (select count(*) from public.job_descriptions where user_id = $1)       as job_descriptions,
      coalesce((select onboarding_complete from public.profiles where user_id = $1), false)
        as onboarding_complete
  `, [userId]);

  const roleSkillCounts = await query<RoleSkillCountRow>(`
    select r.slug, r.name,
           count(*) filter (where rs.is_required)     as required,
           count(*) filter (where not rs.is_required) as optional
      from public.career_roles r
      join public.role_skills rs on rs.role_id = r.id
     where r.is_active
     group by r.slug, r.name, r.display_order
     order by r.display_order
  `);

  const summary: DashboardSummary & { roleSkillCounts: RoleSkillCountRow[] } = {
    catalog: {
      roles: Number(catalog?.roles ?? 0),
      skills: Number(catalog?.skills ?? 0),
      requiredSkillLinks: Number(catalog?.required_skill_links ?? 0),
      aliases: Number(catalog?.aliases ?? 0),
    },
    user: {
      skills: Number(userStats?.skills ?? 0),
      resumes: Number(userStats?.resumes ?? 0),
      recommendations: Number(userStats?.recommendations ?? 0),
      roadmaps: Number(userStats?.roadmaps ?? 0),
      jobDescriptions: Number(userStats?.job_descriptions ?? 0),
      profileComplete: Boolean(userStats?.onboarding_complete),
      onboardingComplete: Boolean(userStats?.onboarding_complete),
    },
    roleSkillCounts,
  };

  return summary;
}

/** The ten official M1 career roles with skill coverage counts. */
export async function listRoles(): Promise<RoleWithCounts[]> {
  return query<RoleWithCounts>(`
    select r.*,
           count(*) filter (where rs.is_required)     as required_count,
           count(*) filter (where not rs.is_required) as optional_count
      from public.career_roles r
      left join public.role_skills rs on rs.role_id = r.id
     where r.is_active
     group by r.id
     order by r.display_order
  `);
}

export async function getRoleDetail(slug: string) {
  const role = await queryOne<CareerRoleRow>(
    `select * from public.career_roles where slug = $1 and is_active`,
    [slug]
  );
  if (!role) return null;

  const skills = await query<RoleSkillItem>(
    `
      select s.slug, s.name, s.category, rs.is_required, rs.weight
        from public.role_skills rs
        join public.skills s on s.id = rs.skill_id
       where rs.role_id = $1
       order by rs.is_required desc, rs.weight desc, s.name
    `,
    [role.id]
  );

  return { role, skills };
}

export async function listSkillsWithAliases() {
  return query<{
    id: string;
    slug: string;
    name: string;
    category: SkillCategory;
    description: string | null;
    aliases: string[];
  }>(`
    select s.id, s.slug, s.name, s.category, s.description,
           coalesce(array_remove(array_agg(a.alias order by a.alias), null), '{}') as aliases
      from public.skills s
      left join public.skill_aliases a on a.skill_id = s.id
     group by s.id
     order by s.category, s.name
  `);
}
