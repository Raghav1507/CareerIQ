import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { queryOne } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/server/http";
import { rateLimitOr429 } from "@/lib/server/rate-limit";
import { audit, clientIp } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const educationEntry = z.object({
  degree: z.string().max(300).optional(),
  field: z.string().max(200).optional(),
  institution: z.string().max(300).optional(),
  start: z.string().max(40).optional(),
  end: z.string().max(40).optional(),
  gpa: z.union([z.string().max(20), z.number()]).optional(),
});

const profileSchema = z.object({
  headline: z.string().max(160).nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  education: z.array(educationEntry).max(10).default([]),
  interests: z.array(z.string().max(60).trim().min(1)).max(30).default([]),
  career_goals: z.array(z.string().max(120).trim().min(1)).max(30).default([]),
  experience_level: z.enum(["entry", "junior", "mid", "senior", "lead"]).default("entry"),
  years_experience: z.number().min(0).max(50).default(0),
  location: z.string().max(120).nullable().optional(),
  preferred_roles: z.array(z.string().max(60)).max(10).default([]),
  target_role_slug: z.string().max(60).nullable().optional(),
});

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (!user) return jsonError(401, error === "not_configured" ? "NOT_CONFIGURED" : "UNAUTHENTICATED", "Sign in required.");

  const limited = rateLimitOr429(user.id, "profile");
  if (limited) return limited;

  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(422, "INVALID_PROFILE", "Check the highlighted fields.", parsed.error.flatten());
  }
  const input = parsed.data;

  if (input.target_role_slug) {
    const role = await queryOne<{ id: string }>(
      `select id from public.career_roles where slug = $1 and is_active`,
      [input.target_role_slug]
    );
    if (!role) return jsonError(422, "UNKNOWN_ROLE", "Target role is not one of the ten M1 roles.");
  }

  const skillCount = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.user_skills where user_id = $1`,
    [user.id]
  );
  const hasSkills = Number(skillCount?.n ?? 0) > 0;
  const hasGoals = input.interests.length > 0 || input.career_goals.length > 0;
  const onboardingComplete = Boolean(input.headline && input.headline.trim() && hasSkills && hasGoals);

  const row = await queryOne<Record<string, unknown>>(
    `insert into public.profiles
       (user_id, headline, summary, education, interests, career_goals,
        experience_level, years_experience, location, preferred_roles,
        target_role_slug, onboarding_complete)
     values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (user_id) do update set
       headline = excluded.headline,
       summary = excluded.summary,
       education = excluded.education,
       interests = excluded.interests,
       career_goals = excluded.career_goals,
       experience_level = excluded.experience_level,
       years_experience = excluded.years_experience,
       location = excluded.location,
       preferred_roles = excluded.preferred_roles,
       target_role_slug = excluded.target_role_slug,
       onboarding_complete = excluded.onboarding_complete
     returning *`,
    [
      user.id,
      input.headline ?? null,
      input.summary ?? null,
      JSON.stringify(input.education),
      input.interests,
      input.career_goals,
      input.experience_level,
      input.years_experience,
      input.location ?? null,
      input.preferred_roles,
      input.target_role_slug ?? null,
      onboardingComplete,
    ]
  );

  await audit({
    userId: user.id,
    action: "profile.update",
    resource: "profiles",
    resourceId: user.id,
    metadata: { onboarding_complete: onboardingComplete, target_role_slug: input.target_role_slug },
    ip: clientIp(req),
  });

  return jsonOk({ profile: row, onboarding_complete: onboardingComplete });
}
