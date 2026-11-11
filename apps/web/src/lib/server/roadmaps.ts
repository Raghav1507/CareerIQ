/** Learning roadmap generation from a role's skill gap (deterministic plan). */

import { query, queryOne, withTransaction } from "@/lib/db";
import { computeRoleGap, type RoleGap } from "@/lib/server/gap";
import { explainRoadmap } from "@/lib/server/explain";

export type PlanResource = {
  id: string;
  title: string;
  url: string;
  type: string;
  provider: string | null;
  difficulty: string;
};

export type PlanItem = {
  key: string;
  skill: string;
  skill_slug: string;
  category: string;
  est_hours: number;
  is_required: boolean;
  resource_ids: string[];
  resources: PlanResource[];
};

export type PlanWeek = {
  week: number;
  title: string;
  objectives: string[];
  items: PlanItem[];
};

const HOURS_BY_CATEGORY: Record<string, number> = {
  language: 14,
  frontend: 10,
  backend: 12,
  database: 8,
  data: 10,
  ml_ai: 16,
  devops: 10,
  security: 8,
  tooling: 6,
  soft_skill: 4,
};

export type RoadmapRow = {
  id: string;
  role_id: string;
  slug: string;
  name: string;
  title: string;
  horizon_weeks: number;
  status: string;
  plan: PlanWeek[];
  created_at: string;
};

function buildPlan(gap: RoleGap, horizonWeeks: number): PlanWeek[] {
  const missing = [
    ...gap.evidence.missingRequired.map((s) => ({ ...s, category: "required" as string })),
    ...gap.evidence.missingOptional.map((s) => ({ ...s, category: "optional" as string })),
  ];
  if (missing.length === 0) return [];

  const weeks = Math.max(1, Math.min(horizonWeeks, missing.length));
  const perWeek = Math.ceil(missing.length / weeks);
  const plan: PlanWeek[] = [];

  for (let w = 0; w < weeks; w++) {
    const slice = missing.slice(w * perWeek, (w + 1) * perWeek);
    if (slice.length === 0) continue;
    const items: PlanItem[] = slice.map((s) => ({
      key: `w${w + 1}-${s.slug}`,
      skill: s.name,
      skill_slug: s.slug,
      category: HOURS_BY_CATEGORY[s.category] !== undefined ? s.category : "tooling",
      est_hours: HOURS_BY_CATEGORY[s.category] ?? 6,
      is_required: s.is_required,
      resource_ids: [],
      resources: [],
    }));
    const totalHours = items.reduce((sum, i) => sum + i.est_hours, 0);
    plan.push({
      week: w + 1,
      title:
        items.length === 1
          ? `Week ${w + 1} — ${items[0].skill}`
          : `Week ${w + 1} — ${items.map((i) => i.skill).join(" + ")}`,
      objectives: [
        ...items.map((i) => `Study ${i.skill} fundamentals (${i.est_hours}h)`),
        ...(items.length > 1 ? [`Complete one integrated exercise (~${Math.round(totalHours / 3)}h)`] : []),
        `Build or extend a small project applying ${items.map((i) => i.skill).join(", ")}`,
      ],
      items,
    });
  }
  return plan;
}

export type GeneratedRoadmap = { roadmap: RoadmapRow; skillCount: number };

/** Attach curated learning_resources (max 3 per skill) to every plan item. */
async function attachResources(plan: PlanWeek[]): Promise<void> {
  const slugs = [...new Set(plan.flatMap((w) => w.items.map((i) => i.skill_slug)))];
  if (slugs.length === 0) return;
  const rows = await query<{
    slug: string;
    id: string;
    title: string;
    url: string;
    resource_type: string;
    provider: string | null;
    difficulty: string;
  }>(
    `select s.slug, lr.id, lr.title, lr.url, lr.resource_type, lr.provider, lr.difficulty
       from public.learning_resources lr
       join public.skills s on s.id = lr.skill_id
      where s.slug = any($1::text[]) and lr.is_active
      order by case lr.difficulty when 'beginner' then 0 when 'intermediate' then 1 else 2 end,
               lr.resource_type, lr.title`,
    [slugs]
  );
  const bySlug = new Map<string, PlanResource[]>();
  for (const r of rows) {
    const list = bySlug.get(r.slug) ?? [];
    if (list.length < 3) {
      list.push({
        id: r.id,
        title: r.title,
        url: r.url,
        type: r.resource_type,
        provider: r.provider,
        difficulty: r.difficulty,
      });
      bySlug.set(r.slug, list);
    }
  }
  for (const week of plan) {
    for (const item of week.items) {
      const resources = bySlug.get(item.skill_slug) ?? [];
      item.resources = resources;
      item.resource_ids = resources.map((r) => r.id);
    }
  }
}

export async function generateRoadmap(
  userId: string,
  roleSlug: string,
  horizonWeeks = 12
): Promise<GeneratedRoadmap> {
  const weeks = Math.max(1, Math.min(104, Math.round(horizonWeeks)));
  const gap = await computeRoleGap(userId, roleSlug);
  if (!gap) {
    throw Object.assign(new Error("Unknown role."), { code: "ROLE_NOT_FOUND", status: 404 });
  }
  const plan = buildPlan(gap, weeks);
  if (plan.length === 0) {
    throw Object.assign(
      new Error(`You already cover every skill for ${gap.role.name} — no roadmap needed.`),
      { code: "NO_GAPS", status: 409 }
    );
  }
  await attachResources(plan);

  // Gemini rewrites the weekly objectives (advisory only — structure/hours stay
  // deterministic). Any failure keeps the template objectives.
  const { objectives, modelUsed } = await explainRoadmap(
    plan.map((w) => ({
      week: w.week,
      title: w.title,
      objectives: w.objectives,
      items: w.items.map((i) => ({
        skill: i.skill,
        est_hours: i.est_hours,
        is_required: i.is_required,
      })),
    }))
  );
  if (objectives) {
    plan.forEach((w, i) => {
      w.objectives = objectives[i];
    });
  }

  const skillCount = plan.reduce((n, w) => n + w.items.length, 0);
  const inserted = await queryOne<{ id: string }>(
    `insert into public.learning_roadmaps (user_id, role_id, title, horizon_weeks, plan, model_used)
     values ($1,
             (select id from public.career_roles where slug = $2),
             $3,
             $4,
             $5::jsonb,
             $6)
     returning id`,
    [
      userId,
      roleSlug,
      `${weeks}-week plan → ${gap.role.name}`,
      weeks,
      JSON.stringify(plan),
      modelUsed,
    ]
  );

  const roadmap = await getRoadmap(userId, inserted!.id);
  return { roadmap, skillCount };
}

export async function getRoadmap(userId: string, roadmapId: string): Promise<RoadmapRow> {
  const row = await queryOne<RoadmapRow>(
    `select lr.id, lr.role_id, r.slug, r.name, lr.title, lr.horizon_weeks, lr.status, lr.plan, lr.created_at
       from public.learning_roadmaps lr
       join public.career_roles r on r.id = lr.role_id
      where lr.id = $1 and lr.user_id = $2`,
    [roadmapId, userId]
  );
  if (!row) throw Object.assign(new Error("Roadmap not found."), { code: "NOT_FOUND", status: 404 });
  return row;
}

export async function listRoadmaps(userId: string): Promise<RoadmapRow[]> {
  return query<RoadmapRow>(
    `select lr.id, lr.role_id, r.slug, r.name, lr.title, lr.horizon_weeks, lr.status, lr.plan, lr.created_at
       from public.learning_roadmaps lr
       join public.career_roles r on r.id = lr.role_id
      where lr.user_id = $1
      order by lr.created_at desc
      limit 10`,
    [userId]
  );
}

export async function getRoadmapProgress(
  userId: string,
  roadmapId: string
): Promise<Record<string, string>> {
  const rows = await query<{ item_key: string; status: string }>(
    `select item_key, status from public.roadmap_progress where user_id = $1 and roadmap_id = $2`,
    [userId, roadmapId]
  );
  return Object.fromEntries(rows.map((r) => [r.item_key, r.status]));
}

export async function setProgress(input: {
  userId: string;
  roadmapId: string;
  itemKey: string;
  status: "not_started" | "in_progress" | "completed";
  skillSlug?: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const owned = await client.query<{ id: string }>(
      `select id from public.learning_roadmaps where id = $1 and user_id = $2`,
      [input.roadmapId, input.userId]
    );
    if (!owned.rows[0]) {
      throw Object.assign(new Error("Roadmap not found."), { code: "NOT_FOUND", status: 404 });
    }
    await client.query(
      `insert into public.roadmap_progress (roadmap_id, user_id, item_key, skill_id, status, completed_at)
       values ($1,$2,$3,
               (select id from public.skills where slug = $4),
               $5,
               case when $5 = 'completed' then now() else null end)
       on conflict (roadmap_id, item_key)
       do update set status = excluded.status,
                     skill_id = coalesce(excluded.skill_id, roadmap_progress.skill_id),
                     completed_at = case when excluded.status = 'completed' then now() else null end`,
      [input.roadmapId, input.userId, input.itemKey, input.skillSlug ?? null, input.status]
    );
  });
}
