/**
 * Job-description analysis: extract required skills with the AI service,
 * score compatibility with the same M1 logic (every JD skill = required, 2.0),
 * link the closest of the ten official roles, persist both rows.
 */

import { getServerEnv } from "@/lib/env";
import { query, queryOne, withTransaction } from "@/lib/db";
import { computeMatchScore } from "@/lib/matching";
import { getOwnedSkillSlugs, getRoleIndex, getRoleSkillLines } from "@/lib/server/match-data";
import { explainJobMatch } from "@/lib/server/explain";
import { templateJobExplanation } from "@/lib/server/explanations";

export type ExtractedSkill = {
  slug: string;
  name: string;
  category: string;
  confidence: number;
  evidence: string;
};

export type JobMatchResult = {
  jobId: string;
  resultId: string | null;
  title: string | null;
  company: string | null;
  score: number;
  matched: ExtractedSkill[];
  missing: ExtractedSkill[];
  closestRole: { slug: string; name: string; overlap: number } | null;
  explanation: string;
  modelUsed: string | null;
  skillsFound: number;
  warning: string | null;
};

async function extractSkills(text: string, title: string | null, company: string | null): Promise<ExtractedSkill[]> {
  const env = getServerEnv();
  const res = await fetch(`${env.AI_SERVICE_URL}/api/v1/jobs/skills`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": env.INTERNAL_API_KEY,
    },
    body: JSON.stringify({ text, title, company }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw Object.assign(new Error(body?.error?.message ?? "Skill extraction failed."), {
      code: "AI_UNAVAILABLE",
      status: 502,
    });
  }
  const data = (await res.json()) as { skills: ExtractedSkill[] };
  return data.skills ?? [];
}

function closestRole(
  jdSlugs: Set<string>,
  roleLines: Array<{ role_slug: string; slug: string; is_required: boolean }>
): { slug: string; name: string; overlap: number } | null {
  const byRole = new Map<string, Set<string>>();
  for (const line of roleLines) {
    if (!line.is_required) continue;
    const set = byRole.get(line.role_slug) ?? new Set<string>();
    set.add(line.slug);
    byRole.set(line.role_slug, set);
  }
  let best: { slug: string; overlap: number } | null = null;
  for (const [slug, required] of byRole) {
    let hit = 0;
    for (const s of jdSlugs) if (required.has(s)) hit += 1;
    const overlap = jdSlugs.size ? hit / jdSlugs.size : 0;
    if (!best || overlap > best.overlap) best = { slug, overlap };
  }
  if (!best || best.overlap === 0) return null;
  return { slug: best.slug, name: best.slug, overlap: Math.round(best.overlap * 100) / 100 };
}

export async function analyzeJob(
  userId: string,
  input: { text: string; title?: string | null; company?: string | null }
): Promise<JobMatchResult> {
  const text = input.text.trim();
  const title = input.title?.trim() || null;
  const company = input.company?.trim() || null;

  const extracted = await extractSkills(text, title, company);
  const jdSlugs = new Set(extracted.map((s) => s.slug));

  const [owned, roleIndex, roleLines] = await Promise.all([
    getOwnedSkillSlugs(userId),
    getRoleIndex(),
    getRoleSkillLines(),
  ]);

  // M1 for jobs: every extracted skill is required with weight 2.0.
  const matched = extracted.filter((s) => owned.has(s.slug));
  const missing = extracted.filter((s) => !owned.has(s.slug));
  const weightedRequired = jdSlugs.size * 2;
  const weightedMatched = matched.length * 2;
  const score = computeMatchScore(weightedMatched, weightedRequired);

  const roleNames = new Map(roleIndex.map((r) => [r.slug, r.name]));
  const closest = closestRole(jdSlugs, roleLines);
  const closestWithName = closest ? { ...closest, name: roleNames.get(closest.slug) ?? closest.slug } : null;

  const llm = await explainJobMatch({
    title,
    company,
    score,
    weighted_matched: weightedMatched,
    weighted_required: weightedRequired,
    matched_skills: matched.map((s) => s.name),
    missing_skills: missing.map((s) => s.name),
    closest_role: closestWithName?.name ?? null,
  });

  const explanation =
    llm.explanation?.trim() ||
    templateJobExplanation({
      title,
      score,
      matched: matched.map((s) => s.name),
      missing: missing.map((s) => s.name),
      total: extracted.length,
    });

  const warning =
    extracted.length === 0
      ? "No catalogue skills were recognised in this text — the score reflects an empty required set."
      : null;

  let jobId = "";
  let resultId: string | null = null;

  await withTransaction(async (client) => {
    const job = await client.query<{ id: string }>(
      `insert into public.job_descriptions (user_id, title, company, source, raw_text, extracted_skills)
       values ($1,$2,$3,'paste',$4,$5::jsonb) returning id`,
      [userId, title, company, text, JSON.stringify(extracted)]
    );
    jobId = job.rows[0].id;

    if (extracted.length > 0) {
      const closestRoleRow = closestWithName
        ? await client.query<{ id: string }>(`select id from public.career_roles where slug = $1`, [
            closestWithName.slug,
          ])
        : { rows: [] as Array<{ id: string }> };

      const res = await client.query<{ id: string }>(
        `insert into public.job_match_results
           (job_description_id, user_id, role_id, compatibility_score, formula,
            matched_skills, missing_skills, explanation, model_used)
         values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9) returning id`,
        [
          jobId,
          userId,
          closestRoleRow.rows[0]?.id ?? null,
          score,
          JSON.stringify({
            weighted_matched: weightedMatched,
            weighted_required: weightedRequired,
            weights: { required: 2.0, optional: 1.0 },
            formula: "matched/job_skills × 100",
          }),
          JSON.stringify(matched),
          JSON.stringify(missing),
          explanation,
          llm.modelUsed,
        ]
      );
      resultId = res.rows[0].id;
    }
  });

  return {
    jobId,
    resultId,
    title,
    company,
    score,
    matched,
    missing,
    closestRole: closestWithName,
    explanation,
    modelUsed: llm.modelUsed,
    skillsFound: extracted.length,
    warning,
  };
}

export type JobHistoryRow = {
  id: string;
  title: string | null;
  company: string | null;
  created_at: string;
  score: number | null;
  skills_found: number;
};

export async function listJobs(userId: string): Promise<JobHistoryRow[]> {
  return query<JobHistoryRow>(
    `select jd.id, jd.title, jd.company, jd.created_at,
            (select compatibility_score from public.job_match_results r
              where r.job_description_id = jd.id order by r.created_at desc limit 1) as score,
            jsonb_array_length(jd.extracted_skills) as skills_found
       from public.job_descriptions jd
      where jd.user_id = $1
      order by jd.created_at desc
      limit 10`,
    [userId]
  );
}

export async function getLatestJobResult(userId: string): Promise<JobHistoryRow | null> {
  const rows = await listJobs(userId);
  return rows[0] ?? null;
}

export async function profileHasSkills(userId: string): Promise<boolean> {
  const row = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.user_skills where user_id = $1`,
    [userId]
  );
  return Number(row?.n ?? 0) > 0;
}
