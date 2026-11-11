/**
 * Career recommendation engine (official M1 formula).
 *
 * score = (weighted matched [required 2.0 + optional 1.0] / weighted required) × 100
 *
 * Gemini may add a natural-language explanation on top — it never changes a number.
 */

import { query, withTransaction } from "@/lib/db";
import {
  applySemanticBridges,
  evaluateRoleMatch,
  type MatchEvidence,
  type SemanticBridge,
  type SemanticMatch,
} from "@/lib/matching";
import { getOwnedSkillSlugs, getRoleIndex, getRoleSkillLines } from "@/lib/server/match-data";
import { computeSemanticBridges, ensureCustomSkillEmbeddings } from "@/lib/server/semantic";
import { explainRecommendations } from "@/lib/server/explain";
import { templateRecommendationExplanation } from "@/lib/server/explanations";

export type RecommendationResult = {
  rank: number;
  roleId: string;
  roleSlug: string;
  roleName: string;
  score: number;
  evidence: MatchEvidence;
  semanticMatches: SemanticMatch[];
  explanation: string;
  modelUsed: string | null;
  isTargetRole: boolean;
};

export type RecommendationRow = {
  id: string;
  role_id: string;
  slug: string;
  name: string;
  match_score: number;
  ranked_position: number;
  weighted_matched: number;
  weighted_required: number;
  matched_required: unknown;
  missing_required: unknown;
  matched_optional: unknown;
  missing_optional: unknown;
  semantic_matches: unknown;
  explanation: string | null;
  evidence: Record<string, unknown>;
  model_used: string | null;
  is_target_role: boolean;
  computed_at: string;
};

async function getTargetRoleSlug(userId: string): Promise<string | null> {
  const row = await query<{ target_role_slug: string | null }>(
    `select target_role_slug from public.profiles where user_id = $1`,
    [userId]
  );
  return row[0]?.target_role_slug ?? null;
}

/** Computes, ranks and persists a fresh recommendation set for the user. */
export async function generateRecommendations(userId: string): Promise<RecommendationResult[]> {
  const [owned, roles, lines] = await Promise.all([
    getOwnedSkillSlugs(userId),
    getRoleIndex(),
    getRoleSkillLines(),
  ]);

  if (owned.size === 0) {
    throw Object.assign(new Error("Add at least one skill to your profile before generating recommendations."), {
      code: "NO_SKILLS",
      status: 422,
    });
  }

  const targetSlug = await getTargetRoleSlug(userId);
  const byRole = new Map<string, Array<{ slug: string; name: string; weight: number; is_required: boolean }>>();
  for (const line of lines) {
    const list = byRole.get(line.role_id) ?? [];
    list.push({ slug: line.slug, name: line.name, weight: Number(line.weight), is_required: line.is_required });
    byRole.set(line.role_id, list);
  }

  // Stage 1 — exact / alias matching (the M1 evidence).
  const exact = roles.map((role) => {
    const evidence = evaluateRoleMatch(byRole.get(role.id) ?? [], owned);
    return {
      rank: 0,
      roleSlug: role.slug,
      roleId: role.id,
      roleName: role.name,
      score: evidence.matchScore,
      evidence,
      semanticMatches: [] as SemanticMatch[],
      explanation: "",
      modelUsed: null as string | null,
      isTargetRole: role.slug === targetSlug,
    };
  });

  // Stage 2 — Phase 8 semantic safety net: user-added skills that the alias
  // matcher could not map are cosine-bridged to missing role skills. Best
  // effort: without the AI service or embeddings the exact result stands.
  await ensureCustomSkillEmbeddings(userId);
  const bridgeRows = await computeSemanticBridges(userId);
  const bridgesByRole = new Map<string, SemanticBridge[]>();
  for (const b of bridgeRows) {
    const list = bridgesByRole.get(b.role_slug) ?? [];
    list.push({
      roleSkillSlug: b.role_skill_slug,
      roleSkillName: b.role_skill_name,
      weight: Number(b.weight),
      isRequired: b.is_required,
      viaSkillSlug: b.via_skill_slug,
      viaSkillName: b.via_skill_name,
      similarity: Number(b.similarity),
    });
    bridgesByRole.set(b.role_slug, list);
  }

  const ranked: RecommendationResult[] = exact
    .map((r) => {
      const { evidence, semanticMatches } = applySemanticBridges(
        r.evidence,
        bridgesByRole.get(r.roleSlug) ?? []
      );
      return { ...r, evidence, semanticMatches, score: evidence.matchScore };
    })
    .sort((a, b) => b.score - a.score || a.roleSlug.localeCompare(b.roleSlug))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  // Optional Gemini enrichment — one call, whole list; falls back to templates.
  const llmEntries = ranked.map((r) => ({
    rank: r.rank,
    role: r.roleName,
    score: r.score,
    weighted_matched: r.evidence.weightedMatched,
    weighted_required: r.evidence.weightedRequired,
    matched_required: r.evidence.matchedRequired.map((s) => s.name),
    missing_required: r.evidence.missingRequired.map((s) => s.name),
    matched_optional: r.evidence.matchedOptional.map((s) => s.name),
    missing_optional: r.evidence.missingOptional.map((s) => s.name),
    semantic_matched: r.semanticMatches.map((m) => `${m.via_skill_name} ≈ ${m.role_skill_name}`),
  }));
  const { explanations, modelUsed } = await explainRecommendations(llmEntries);

  ranked.forEach((r, i) => {
    r.explanation =
      explanations?.[i]?.trim() || templateRecommendationExplanation(r.roleName, r.evidence);
    r.modelUsed = explanations?.[i]?.trim() ? modelUsed : null;
  });

  // Persist atomically: replace the previous set.
  await withTransaction(async (client) => {
    await client.query(`delete from public.career_recommendations where user_id = $1`, [userId]);
    for (const r of ranked) {
      await client.query(
        `insert into public.career_recommendations
           (user_id, role_id, match_score, ranked_position, weighted_matched, weighted_required,
            matched_required, missing_required, matched_optional, missing_optional,
            semantic_matches, explanation, evidence, model_used, is_target_role)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          userId,
          r.roleId,
          r.score,
          r.rank,
          r.evidence.weightedMatched,
          r.evidence.weightedRequired,
          JSON.stringify(r.evidence.matchedRequired),
          JSON.stringify(r.evidence.missingRequired),
          JSON.stringify(r.evidence.matchedOptional),
          JSON.stringify(r.evidence.missingOptional),
          JSON.stringify(r.semanticMatches),
          r.explanation,
          JSON.stringify({
            formula: "m1",
            weights: { required: 2.0, optional: 1.0 },
            ownedSkillCount: owned.size,
            semanticMatches: r.semanticMatches.length,
            llm: r.modelUsed,
          }),
          r.modelUsed,
          r.isTargetRole,
        ]
      );
    }
  });

  return ranked;
}

/** Latest persisted recommendation set (newest computed_at), joined with role data. */
export async function getStoredRecommendations(userId: string): Promise<RecommendationRow[]> {
  return query<RecommendationRow>(
    `select cr.id, cr.role_id, r.slug, r.name,
            cr.match_score, cr.ranked_position,
            cr.weighted_matched, cr.weighted_required,
            cr.matched_required, cr.missing_required,
            cr.matched_optional, cr.missing_optional, cr.semantic_matches,
            cr.explanation, cr.evidence, cr.model_used,
            cr.is_target_role, cr.computed_at
       from public.career_recommendations cr
       join public.career_roles r on r.id = cr.role_id
      where cr.user_id = $1
        and cr.computed_at = (
          select max(computed_at) from public.career_recommendations where user_id = $1
        )
      order by cr.ranked_position`,
    [userId]
  );
}
