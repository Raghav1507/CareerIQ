import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Canonical skill-name normalisation shared with the AI service.
 * Lower-cases and strips every character except letters, digits, '+' and '#'
 * so that "React.js" === "React JS" === "ReactJS" === "reactjs".
 */
export function normalizeSkillName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

/** Formats a 0-100 match score for display (e.g. 87.5 -> "88"). */
export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "–";
  return String(Math.round(score));
}

/** Human-readable score band used across charts and badges. */
export function scoreBand(score: number): {
  label: "Strong" | "Good" | "Developing" | "Early";
  tone: "success" | "primary" | "warning" | "muted";
} {
  if (score >= 80) return { label: "Strong", tone: "success" };
  if (score >= 60) return { label: "Good", tone: "primary" };
  if (score >= 40) return { label: "Developing", tone: "warning" };
  return { label: "Early", tone: "muted" };
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
