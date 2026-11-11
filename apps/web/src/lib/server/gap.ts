/** Skill-gap computation for a role — live, deterministic, explainable. */

import { query, queryOne } from "@/lib/db";
import {
  applySemanticBridges,
  evaluateRoleMatch,
  type MatchEvidence,
  type SemanticBridge,
  type SemanticMatch,
} from "@/lib/matching";
import { getOwnedSkillSlugs } from "@/lib/server/match-data";
import { computeSemanticBridges, ensureCustomSkillEmbeddings } from "@/lib/server/semantic";
import { templateGapAdvice } from "@/lib/server/explanations";
import { explainGap } from "@/lib/server/explain";

export type RoleGap = {
  role: { id: string; slug: string; name: string; description: string };
  evidence: MatchEvidence;
  semanticMatches: SemanticMatch[];
  gapScore: number;
  advice: string;
  adviceModel: string | null;
  ownedCount: number;
};

export async function computeRoleGap(userId: string, roleSlug: string): Promise<RoleGap | null> {
  const role = await queryOne<{
    id: string;
    slug: string;
    name: string;
    description: string;
  }>(`select id, slug, name, description from public.career_roles where slug = $1 and is_active`, [
    roleSlug,
  ]);
  if (!role) return null;

  const [owned, lines] = await Promise.all([
    getOwnedSkillSlugs(userId),
    query<{ slug: string; name: string; weight: string; is_required: boolean }>(
      `select s.slug, s.name, rs.weight, rs.is_required
         from public.role_skills rs
         join public.skills s on s.id = rs.skill_id
        where rs.role_id = $1
        order by rs.is_required desc, rs.weight desc, s.name`,
      [role.id]
    ),
  ]);

  const exact = evaluateRoleMatch(
    lines.map((l) => ({
      slug: l.slug,
      name: l.name,
      weight: Number(l.weight),
      is_required: l.is_required,
    })),
    owned
  );

  // Phase 8 semantic safety net — same engine as recommendations, so the gap
  // always equals 100 − match_score of the stored recommendation.
  await ensureCustomSkillEmbeddings(userId);
  const bridgeRows = await computeSemanticBridges(userId, roleSlug);
  const bridges: SemanticBridge[] = bridgeRows.map((b) => ({
    roleSkillSlug: b.role_skill_slug,
    roleSkillName: b.role_skill_name,
    weight: Number(b.weight),
    isRequired: b.is_required,
    viaSkillSlug: b.via_skill_slug,
    viaSkillName: b.via_skill_name,
    similarity: Number(b.similarity),
  }));
  const { evidence, semanticMatches } = applySemanticBridges(exact, bridges);

  return {
    role,
    evidence,
    semanticMatches,
    gapScore: Math.round((100 - evidence.matchScore) * 100) / 100,
    advice: templateGapAdvice(role.name, evidence),
    adviceModel: null,
    ownedCount: owned.size,
  };
}

/**
 * Persists a skill-gap snapshot. Scores/evidence stay deterministic; the advice
 * text prefers Gemini and falls back to the template when it is unavailable.
 */
export async function saveSkillGap(userId: string, roleSlug: string): Promise<RoleGap> {
  const gap = await computeRoleGap(userId, roleSlug);
  if (!gap) {
    throw Object.assign(new Error("Unknown role."), { code: "ROLE_NOT_FOUND", status: 404 });
  }

  const skillRows = (list: Array<{ name: string; weight: number }>) =>
    list.map((s) => ({ name: s.name, weight: s.weight }));
  const { explanation, modelUsed } = await explainGap({
    role: gap.role.name,
    gap_score: gap.gapScore,
    matched_required: skillRows(gap.evidence.matchedRequired),
    missing_required: skillRows(gap.evidence.missingRequired),
    matched_optional: skillRows(gap.evidence.matchedOptional),
    missing_optional: skillRows(gap.evidence.missingOptional),
    semantic_matched: gap.semanticMatches.map((m) => `${m.via_skill_name} ≈ ${m.role_skill_name}`),
  });
  if (explanation) {
    gap.advice = explanation;
    gap.adviceModel = modelUsed;
  }
  const roleRow = await queryOne<{ role_id: string }>(
    `select id as role_id from public.career_roles where slug = $1`,
    [roleSlug]
  );
  const rec = await queryOne<{ id: string }>(
    `select id from public.career_recommendations
      where user_id = $1 and role_id = $2
      order by computed_at desc limit 1`,
    [userId, roleRow?.role_id]
  );

  await query(
    `insert into public.skill_gap_analyses
       (user_id, role_id, recommendation_id, gap_score,
        matched_required, missing_required, matched_optional, missing_optional, advice)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      userId,
      roleRow?.role_id,
      rec?.id ?? null,
      gap.gapScore,
      JSON.stringify(gap.evidence.matchedRequired),
      JSON.stringify(gap.evidence.missingRequired),
      JSON.stringify(gap.evidence.matchedOptional),
      JSON.stringify(gap.evidence.missingOptional),
      gap.advice,
    ]
  );
  return gap;
}
