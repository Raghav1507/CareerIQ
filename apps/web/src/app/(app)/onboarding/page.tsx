import { GraduationCap, Heart, Sparkles, Target } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { Badge } from "@/components/ui/badge";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { requireUser } from "@/lib/supabase/auth";
import { query, queryOne } from "@/lib/db";
import { listRoles, listSkillsWithAliases } from "@/lib/queries";
import type { ProfileRow, SkillCategory } from "@/types/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career Profile" };

export default async function OnboardingPage() {
  const { user } = await requireUser();
  if (!user) return null;

  const [profile, catalog, roles, owned] = await Promise.all([
    queryOne<ProfileRow>(`select * from public.profiles where user_id = $1`, [user.id]),
    listSkillsWithAliases(),
    listRoles(),
    query<{
      skill_id: string;
      slug: string;
      name: string;
      category: SkillCategory;
      proficiency: string;
    }>(
      `select us.skill_id, s.slug, s.name, s.category, us.proficiency
         from public.user_skills us
         join public.skills s on s.id = us.skill_id
        where us.user_id = $1
        order by s.name`,
      [user.id]
    ),
  ]);

  const sections = [
    {
      icon: GraduationCap,
      title: "Education",
      text: "Degree, field, institution, dates and optional GPA.",
      done: Boolean(profile?.education?.length),
    },
    {
      icon: Target,
      title: "Skills",
      text: `Free-text or picked from the ${catalog.length}-skill catalogue with proficiency.`,
      done: owned.length > 0,
    },
    {
      icon: Heart,
      title: "Interests & goals",
      text: "What you enjoy and the direction you want your career to take.",
      done: Boolean(profile?.interests?.length || profile?.career_goals?.length),
    },
    {
      icon: Sparkles,
      title: "Experience level",
      text: "Entry to lead — used to frame recommendations, never to exclude you.",
      done: Boolean(profile?.headline),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career profile"
        description="The foundation of every recommendation: your education, skills, projects, experience, interests and career goals."
        actions={
          <Badge variant={profile?.onboarding_complete ? "success" : "muted"}>
            {profile?.onboarding_complete ? "Profile complete" : "Profile incomplete"}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <div key={s.title} className="surface p-4">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                s.done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <h3 className="mt-3 flex items-center gap-2 text-sm font-semibold">
              {s.title}
              {s.done ? <Badge variant="success">Added</Badge> : null}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>

      <ProfileEditor
        profile={profile}
        catalog={catalog.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          category: c.category,
          aliases: c.aliases,
        }))}
        owned={owned}
        roles={roles.map((r) => ({ slug: r.slug, name: r.name }))}
      />
    </div>
  );
}
