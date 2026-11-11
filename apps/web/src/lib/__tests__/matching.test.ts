import { describe, expect, it } from "vitest";
import {
  OPTIONAL_SKILL_WEIGHT,
  REQUIRED_SKILL_WEIGHT,
  computeMatchScore,
  evaluateRoleMatch,
} from "@/lib/matching";

describe("computeMatchScore (official M1 formula)", () => {
  it("returns 0 when there is nothing required", () => {
    expect(computeMatchScore(0, 0)).toBe(0);
    expect(computeMatchScore(5, 0)).toBe(0);
  });

  it("returns 100 for a full weighted match", () => {
    expect(computeMatchScore(20, 20)).toBe(100);
  });

  it("returns partial scores", () => {
    expect(computeMatchScore(10, 20)).toBe(50);
    expect(computeMatchScore(15, 20)).toBe(75);
  });

  it("clamps above 100 when optional skills push the numerator past the denominator", () => {
    expect(computeMatchScore(25, 20)).toBe(100);
  });

  it("never returns a negative score", () => {
    expect(computeMatchScore(-4, 20)).toBe(0);
  });

  it("guards non-finite inputs", () => {
    expect(computeMatchScore(Number.NaN, 20)).toBe(0);
    expect(computeMatchScore(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("evaluateRoleMatch", () => {
  const roleSkills = [
    { slug: "reactjs", name: "React.js", weight: REQUIRED_SKILL_WEIGHT, is_required: true },
    { slug: "sql", name: "SQL", weight: REQUIRED_SKILL_WEIGHT, is_required: true },
    { slug: "docker", name: "Docker", weight: REQUIRED_SKILL_WEIGHT, is_required: true },
    { slug: "nextjs", name: "Next.js", weight: OPTIONAL_SKILL_WEIGHT, is_required: false },
    { slug: "graphql", name: "GraphQL", weight: OPTIONAL_SKILL_WEIGHT, is_required: false },
  ];

  it("splits skills into matched/missing buckets by requirement", () => {
    const owned = new Set(["reactjs", "sql", "nextjs"]);
    const result = evaluateRoleMatch(roleSkills, owned);

    expect(result.matchedRequired.map((s) => s.slug)).toEqual(["reactjs", "sql"]);
    expect(result.missingRequired.map((s) => s.slug)).toEqual(["docker"]);
    expect(result.matchedOptional.map((s) => s.slug)).toEqual(["nextjs"]);
    expect(result.missingOptional.map((s) => s.slug)).toEqual(["graphql"]);
    expect(result.weightedRequired).toBe(6); // 3 required × 2.0
    expect(result.weightedMatched).toBe(5); // 2 required (4.0) + 1 optional (1.0)
  });

  it("produces the M1 score: weighted matched / weighted required × 100", () => {
    const result = evaluateRoleMatch(roleSkills, new Set(["reactjs", "sql", "nextjs"]));
    // (4 + 1) / 6 × 100 = 83.33
    expect(result.matchScore).toBeCloseTo(83.33, 2);
  });

  it("scores 0 with an empty profile", () => {
    const result = evaluateRoleMatch(roleSkills, new Set());
    expect(result.matchScore).toBe(0);
    expect(result.missingRequired).toHaveLength(3);
    expect(result.matchedRequired).toHaveLength(0);
  });

  it("scores 100 when every required skill is owned", () => {
    const result = evaluateRoleMatch(roleSkills, new Set(["reactjs", "sql", "docker"]));
    expect(result.matchScore).toBe(100);
    expect(result.missingRequired).toHaveLength(0);
  });
});
