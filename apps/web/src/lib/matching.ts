/**
 * Official Milestone-1 career matching formula.
 *
 *   Career Match Score = (Weighted Matched Skills / Weighted Required Skills) × 100
 *
 * Weights are defined by the DB seed (role_skills):
 *   required skills = 2.0, optional skills = 1.0.
 *
 * The LLM NEVER computes this value — it only explains the structured result
 * produced here (see docs/architecture.md §5).
 */

export const REQUIRED_SKILL_WEIGHT = 2.0;
export const OPTIONAL_SKILL_WEIGHT = 1.0;

export type ScoredSkill = {
  slug: string;
  name: string;
  weight: number;
  is_required: boolean;
  /** Present when the skill was matched through the semantic safety net. */
  via?: { slug: string; name: string; similarity: number };
};

export type MatchEvidence = {
  weightedMatched: number;
  weightedRequired: number;
  matchScore: number;
  matchedRequired: ScoredSkill[];
  missingRequired: ScoredSkill[];
  matchedOptional: ScoredSkill[];
  missingOptional: ScoredSkill[];
};

/** Clamps to [0, 100] and guards division by zero. */
export function computeMatchScore(weightedMatched: number, weightedRequired: number): number {
  if (!Number.isFinite(weightedMatched) || !Number.isFinite(weightedRequired)) return 0;
  if (weightedRequired <= 0) return 0;
  const raw = (weightedMatched / weightedRequired) * 100;
  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}

/**
 * Builds the full structured match evidence for a role.
 * `ownedSkillSlugs` are normalised skill slugs the user already has
 * (alias-normalised by the caller).
 */
export function evaluateRoleMatch(
  roleSkills: Array<{ slug: string; name: string; weight: number; is_required: boolean }>,
  ownedSkillSlugs: Set<string>
): MatchEvidence {
  const matchedRequired: ScoredSkill[] = [];
  const missingRequired: ScoredSkill[] = [];
  const matchedOptional: ScoredSkill[] = [];
  const missingOptional: ScoredSkill[] = [];

  let weightedRequired = 0;
  let weightedMatched = 0;

  for (const skill of roleSkills) {
    const owned = ownedSkillSlugs.has(skill.slug);
    const entry: ScoredSkill = {
      slug: skill.slug,
      name: skill.name,
      weight: skill.weight,
      is_required: skill.is_required,
    };
    if (skill.is_required) {
      weightedRequired += skill.weight;
    }
    if (owned) {
      weightedMatched += skill.weight; // required (2.0) or optional (1.0)
      if (skill.is_required) matchedRequired.push(entry);
      else matchedOptional.push(entry);
    } else if (skill.is_required) {
      missingRequired.push(entry);
    } else {
      missingOptional.push(entry);
    }
  }

  return {
    weightedMatched: round2(weightedMatched),
    weightedRequired: round2(weightedRequired),
    matchScore: computeMatchScore(weightedMatched, weightedRequired),
    matchedRequired,
    missingRequired,
    matchedOptional,
    missingOptional,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A pgvector cosine bridge produced by the semantic safety net (Phase 8):
 * a user-added skill that is similar enough to one of the role's missing
 * skills to count as coverage. Exact/alias matches always win — a bridge is
 * only ever considered for skills the alias matcher left unmatched.
 */
export type SemanticBridge = {
  roleSkillSlug: string;
  roleSkillName: string;
  weight: number;
  isRequired: boolean;
  viaSkillSlug: string;
  viaSkillName: string;
  similarity: number;
};

/** Provenance row persisted in career_recommendations.semantic_matches. */
export type SemanticMatch = {
  role_skill_slug: string;
  role_skill_name: string;
  via_skill_slug: string;
  via_skill_name: string;
  weight: number;
  is_required: boolean;
  similarity: number;
};

/**
 * Folds semantic bridges into exact-match evidence:
 *   - each bridge moves its role skill from missing → matched (with `via`),
 *   - weightedMatched gains the skill's normal weight (2.0/1.0),
 *   - the M1 formula is re-applied so score and weights stay consistent.
 * Bridges for skills that are already matched are ignored.
 */
export function applySemanticBridges(
  evidence: MatchEvidence,
  bridges: SemanticBridge[]
): { evidence: MatchEvidence; semanticMatches: SemanticMatch[] } {
  const semanticMatches: SemanticMatch[] = [];
  if (bridges.length === 0) return { evidence, semanticMatches };

  const missingRequired = [...evidence.missingRequired];
  const missingOptional = [...evidence.missingOptional];
  const matchedRequired = [...evidence.matchedRequired];
  const matchedOptional = [...evidence.matchedOptional];
  let weightedMatched = evidence.weightedMatched;

  for (const bridge of bridges) {
    const reqIdx = missingRequired.findIndex((s) => s.slug === bridge.roleSkillSlug);
    const optIdx = reqIdx === -1 ? missingOptional.findIndex((s) => s.slug === bridge.roleSkillSlug) : -1;
    if (reqIdx === -1 && optIdx === -1) continue; // already matched exactly

    const inRequired = reqIdx !== -1;
    const source = inRequired ? missingRequired : missingOptional;
    const idx = inRequired ? reqIdx : optIdx;
    const skill = source[idx];
    const bridged: ScoredSkill = {
      ...skill,
      via: { slug: bridge.viaSkillSlug, name: bridge.viaSkillName, similarity: bridge.similarity },
    };
    source.splice(idx, 1);
    if (inRequired) matchedRequired.push(bridged);
    else matchedOptional.push(bridged);

    weightedMatched += skill.weight;
    semanticMatches.push({
      role_skill_slug: skill.slug,
      role_skill_name: skill.name,
      via_skill_slug: bridge.viaSkillSlug,
      via_skill_name: bridge.viaSkillName,
      weight: skill.weight,
      is_required: skill.is_required,
      similarity: bridge.similarity,
    });
  }

  if (semanticMatches.length === 0) return { evidence, semanticMatches };

  return {
    evidence: {
      ...evidence,
      weightedMatched: round2(weightedMatched),
      matchScore: computeMatchScore(weightedMatched, evidence.weightedRequired),
      matchedRequired,
      missingRequired,
      matchedOptional,
      missingOptional,
    },
    semanticMatches,
  };
}
