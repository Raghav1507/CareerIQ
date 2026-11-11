/**
 * Database row types (public schema). These mirror supabase/migrations.
 */

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  user_id: string;
  headline: string | null;
  summary: string | null;
  education: EducationEntry[];
  interests: string[];
  career_goals: string[];
  experience_level: ExperienceLevel;
  years_experience: number;
  location: string | null;
  preferred_roles: string[];
  target_role_slug: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type ExperienceLevel = "entry" | "junior" | "mid" | "senior" | "lead";

export type EducationEntry = {
  degree?: string;
  field?: string;
  institution?: string;
  start?: string;
  end?: string;
  gpa?: number | string;
};

export type SkillRow = {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  description: string | null;
  is_technical: boolean;
};

export type SkillCategory =
  | "language"
  | "frontend"
  | "backend"
  | "database"
  | "data"
  | "ml_ai"
  | "devops"
  | "security"
  | "tooling"
  | "soft_skill";

export type CareerRoleRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  responsibilities: string[];
  onet_codes: string[];
  esco_codes: string[];
  is_active: boolean;
  display_order: number;
};

export type RoleSkillRow = {
  role_id: string;
  skill_id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  is_required: boolean;
  weight: number;
};

export type DashboardSummary = {
  catalog: {
    roles: number;
    skills: number;
    requiredSkillLinks: number;
    aliases: number;
  };
  user: {
    skills: number;
    resumes: number;
    recommendations: number;
    roadmaps: number;
    jobDescriptions: number;
    profileComplete: boolean;
    onboardingComplete: boolean;
  };
};
