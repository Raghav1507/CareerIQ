import { describe, expect, it } from "vitest";
import {
  OPTIONAL_SKILL_WEIGHT,
  REQUIRED_SKILL_WEIGHT,
  applySemanticBridges,
  computeMatchScore,
  evaluateRoleMatch,
  type SemanticBridge,
} from "@/lib/matching";

const roleSkills = [
  { slug: "reactjs", name: "React.js", weight: REQUIRED_SKILL_WEIGHT, is_required: true },
  { slug: "sql", name: "SQL", weight: REQUIRED_SKILL_WEIGHT, is_required: true },
  { slug: "docker", name: "Docker", weight: REQUIRED_SKILL_WEIGHT, is_required: true },
  { slug: "nextjs", name: "Next.js", weight: OPTIONAL_SKILL_WEIGHT, is_required: false },
];

function bridge(partial: Partial<SemanticBridge> & Pick<SemanticBridge, "roleSkillSlug">): SemanticBridge {
  const skill = roleSkills.find((s) => s.slug === partial.roleSkillSlug);
  return {
    roleSkillName: skill?.name ?? partial.roleSkillSlug,
    weight: skill?.weight ?? REQUIRED_SKILL_WEIGHT,
    isRequired: skill?.is_required ?? true,
    viaSkillSlug: "bunruntime",
    viaSkillName: "Bun Runtime",
    similarity: 0.87,
    ...partial,
  };
}

describe("applySemanticBridges (Phase 8 safety net)", () => {
  it("returns the evidence untouched when there are no bridges", () => {
    const evidence = evaluateRoleMatch(roleSkills, new Set(["reactjs"]));
    const { evidence: out, semanticMatches } = applySemanticBridges(evidence, []);
    expect(out).toBe(evidence);
    expect(semanticMatches).toHaveLength(0);
  });

  it("moves a missing required skill into matched and records provenance", () => {
    const evidence = evaluateRoleMatch(roleSkills, new Set(["reactjs"]));
    const { evidence: out, semanticMatches } = applySemanticBridges(evidence, [
      bridge({ roleSkillSlug: "sql", viaSkillSlug: "bunruntime", viaSkillName: "Bun Runtime", similarity: 0.91 }),
    ]);

    expect(out.missingRequired.map((s) => s.slug)).toEqual(["docker"]);
    const bridged = out.matchedRequired.find((s) => s.slug === "sql");
    expect(bridged?.via).toEqual({ slug: "bunruntime", name: "Bun Runtime", similarity: 0.91 });
    expect(semanticMatches).toEqual([
      {
        role_skill_slug: "sql",
        role_skill_name: "SQL",
        via_skill_slug: "bunruntime",
        via_skill_name: "Bun Runtime",
        weight: REQUIRED_SKILL_WEIGHT,
        is_required: true,
        similarity: 0.91,
      },
    ]);
  });

  it("keeps the M1 formula consistent after bridging", () => {
    const evidence = evaluateRoleMatch(roleSkills, new Set(["reactjs"])); // 2 / 6
    const { evidence: out } = applySemanticBridges(evidence, [bridge({ roleSkillSlug: "sql" })]);
    // (2 + 2) / 6 × 100 = 66.67
    expect(out.weightedMatched).toBe(4);
    expect(out.weightedRequired).toBe(6);
    expect(out.matchScore).toBe(computeMatchScore(out.weightedMatched, out.weightedRequired));
    expect(out.matchScore).toBeCloseTo(66.67, 2);
  });

  it("bridges optional skills with weight 1.0", () => {
    const evidence = evaluateRoleMatch(roleSkills, new Set(["reactjs"]));
    const { evidence: out, semanticMatches } = applySemanticBridges(evidence, [
      bridge({ roleSkillSlug: "nextjs" }),
    ]);
    expect(out.matchedOptional.map((s) => s.slug)).toEqual(["nextjs"]);
    expect(out.missingOptional).toHaveLength(0);
    expect(out.weightedMatched).toBe(3); // 2.0 + 1.0
    expect(semanticMatches[0].is_required).toBe(false);
    expect(semanticMatches[0].weight).toBe(OPTIONAL_SKILL_WEIGHT);
  });

  it("ignores bridges for skills already matched exactly", () => {
    const evidence = evaluateRoleMatch(roleSkills, new Set(["reactjs"]));
    const { evidence: out, semanticMatches } = applySemanticBridges(evidence, [
      bridge({ roleSkillSlug: "reactjs", viaSkillSlug: "svelte", viaSkillName: "Svelte" }),
    ]);
    expect(semanticMatches).toHaveLength(0);
    expect(out.weightedMatched).toBe(evidence.weightedMatched);
    expect(out.matchedRequired.find((s) => s.slug === "reactjs")?.via).toBeUndefined();
  });

  it("applies only the first bridge per skill", () => {
    const evidence = evaluateRoleMatch(roleSkills, new Set(["reactjs"]));
    const { evidence: out, semanticMatches } = applySemanticBridges(evidence, [
      bridge({ roleSkillSlug: "sql", viaSkillSlug: "first", viaSkillName: "First" }),
      bridge({ roleSkillSlug: "sql", viaSkillSlug: "second", viaSkillName: "Second" }),
    ]);
    expect(semanticMatches).toHaveLength(1);
    expect(out.weightedMatched).toBe(4);
    expect(out.matchedRequired.find((s) => s.slug === "sql")?.via?.slug).toBe("first");
  });

  it("ignores bridges for skills that are not part of the role", () => {
    const evidence = evaluateRoleMatch(roleSkills, new Set(["reactjs"]));
    const { evidence: out, semanticMatches } = applySemanticBridges(evidence, [
      bridge({ roleSkillSlug: "kubernetes", roleSkillName: "Kubernetes" }),
    ]);
    expect(semanticMatches).toHaveLength(0);
    expect(out.matchScore).toBe(evidence.matchScore);
  });
});
