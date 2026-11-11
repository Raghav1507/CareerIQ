/**
 * Deterministic explanation templates.
 *
 * These are used whenever Gemini is unavailable or returns something unusable.
 * They only ever describe numbers that were already computed by the M1 formula —
 * they never invent evidence.
 */

import type { MatchEvidence, ScoredSkill } from "@/lib/matching";

function names(list: ScoredSkill[], limit = 6): string {
  const shown = list.slice(0, limit).map((s) => s.name);
  if (list.length <= limit) return shown.join(", ");
  return `${shown.join(", ")} and ${list.length - limit} more`;
}

export function templateRecommendationExplanation(roleName: string, ev: MatchEvidence): string {
  const matched = ev.matchedRequired.length;
  const total = ev.matchedRequired.length + ev.missingRequired.length;
  const parts: string[] = [];
  parts.push(
    `You cover ${matched} of ${total} required skills for ${roleName} (${names(ev.matchedRequired)}).`
  );
  if (ev.matchedOptional.length) {
    parts.push(`Optional strengths: ${names(ev.matchedOptional)}.`);
  }
  if (ev.missingRequired.length) {
    parts.push(`Main gaps: ${names(ev.missingRequired)}.`);
  }
  parts.push(
    `Weighted match ${ev.weightedMatched} / ${ev.weightedRequired} gives a Career Match Score of ${ev.matchScore} (official M1 formula).`
  );
  return parts.join(" ");
}

export function templateGapAdvice(roleName: string, ev: MatchEvidence): string {
  const pct = ev.matchScore;
  if (ev.missingRequired.length === 0) {
    return `You already cover every required skill for ${roleName} (${pct}%). Focus on the optional skills (${names(ev.missingOptional) || "none missing"}) to stand out.`;
  }
  return `${roleName} is ${pct}% covered. Start with the required gaps in this order: ${ev.missingRequired
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((s) => `${s.name} (weight ${s.weight})`)
    .join(", ")}. Then close optional gaps: ${names(ev.missingOptional, 4) || "none"}.`;
}

export function templateJobExplanation(input: {
  title: string | null;
  score: number;
  matched: string[];
  missing: string[];
  total: number;
}): string {
  const head = input.title ? `the “${input.title}” posting` : "this posting";
  const matchedPart = input.matched.length
    ? `You already match ${input.matched.length} of ${input.total} required skills (${input.matched.slice(0, 6).join(", ")}).`
    : `None of the ${input.total} required skills in ${head} are in your profile yet.`;
  const missingPart = input.missing.length
    ? `Priority gaps: ${input.missing.slice(0, 6).join(", ")}.`
    : "No gaps — you cover the full skill set.";
  return `${matchedPart} ${missingPart} Compatibility score ${input.score}% (matched/required × 100).`;
}
