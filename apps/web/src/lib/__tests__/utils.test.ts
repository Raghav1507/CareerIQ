import { describe, expect, it } from "vitest";
import { formatDate, formatScore, normalizeSkillName, scoreBand } from "@/lib/utils";

describe("normalizeSkillName (skill alias normalisation)", () => {
  it("makes React.js, React JS and ReactJS identical", () => {
    const a = normalizeSkillName("React.js");
    const b = normalizeSkillName("React JS");
    const c = normalizeSkillName("ReactJS");
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe("reactjs");
  });

  it("keeps C++ and C# distinct", () => {
    expect(normalizeSkillName("C++")).toBe("c++");
    expect(normalizeSkillName("C#")).toBe("c#");
    expect(normalizeSkillName("C++")).not.toBe(normalizeSkillName("C#"));
  });

  it("normalises Node.js / NodeJS / Node JS", () => {
    expect(normalizeSkillName("Node.js")).toBe("nodejs");
    expect(normalizeSkillName("Node JS")).toBe("nodejs");
    expect(normalizeSkillName("nodejs")).toBe("nodejs");
  });

  it("is case-insensitive and strips punctuation", () => {
    expect(normalizeSkillName("  PostgresQL ")).toBe("postgresql");
    expect(normalizeSkillName("Machine-Learning")).toBe("machinelearning");
  });
});

describe("formatScore", () => {
  it("rounds to a whole number", () => {
    expect(formatScore(83.33)).toBe("83");
    expect(formatScore(99.6)).toBe("100");
  });

  it("renders a dash for invalid input", () => {
    expect(formatScore(Number.NaN)).toBe("–");
  });
});

describe("scoreBand", () => {
  it("bands scores consistently", () => {
    expect(scoreBand(95).label).toBe("Strong");
    expect(scoreBand(70).label).toBe("Good");
    expect(scoreBand(50).label).toBe("Developing");
    expect(scoreBand(10).label).toBe("Early");
  });
});

describe("formatDate", () => {
  it("handles null and invalid values", () => {
    expect(formatDate(null)).toBe("–");
    expect(formatDate("not-a-date")).toBe("–");
  });

  it("formats valid dates", () => {
    expect(formatDate("2026-01-15")).toContain("2026");
  });
});
