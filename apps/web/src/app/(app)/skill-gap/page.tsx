import Link from "next/link";
import { CheckCircle2, Lightbulb, Map, XCircle } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { EmptyState } from "@/components/feature/empty-state";
import { ScoreRing } from "@/components/charts/score-ring";
import { RoleSwitcher } from "@/components/skill-gap/role-switcher";
import { SaveGapButton } from "@/components/skill-gap/save-gap-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/supabase/auth";
import { queryOne } from "@/lib/db";
import { computeRoleGap } from "@/lib/server/gap";
import { getRoleIndex } from "@/lib/server/match-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Skill Gap" };

type SearchParams = Promise<{ role?: string }>;

export default async function SkillGapPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireUser();
  if (!user) return null;

  const params = await searchParams;
  const roles = await getRoleIndex();

  const profile = await queryOne<{ target_role_slug: string | null }>(
    `select target_role_slug from public.profiles where user_id = $1`,
    [user.id]
  );
  const topRec = await queryOne<{ slug: string }>(
    `select r.slug from public.career_recommendations cr
       join public.career_roles r on r.id = cr.role_id
      where cr.user_id = $1
      order by cr.computed_at desc, cr.ranked_position asc limit 1`,
    [user.id]
  );

  const roleSlug = params.role || profile?.target_role_slug || topRec?.slug || "";

  if (!roleSlug || !roles.some((r) => r.slug === roleSlug)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Skill gap"
          description="Compare your confirmed skills against any of the ten official roles, weighted exactly like the M1 formula."
        />
        <EmptyState
          icon={Lightbulb}
          title="Choose a role to analyse"
          description="Pick one of the ten roles — or generate recommendations first and we will default to your best match."
          action={
            <div className="flex gap-2">
              <RoleSwitcher roles={roles} value="" basePath="/skill-gap" />
              <Button asChild variant="outline">
                <Link href="/recommendations">Go to recommendations</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const gap = await computeRoleGap(user.id, roleSlug);
  if (!gap) {
    return (
      <div className="space-y-6">
        <PageHeader title="Skill gap" />
        <EmptyState icon={Lightbulb} title="Role not found" description="That role is not part of the M1 catalogue." />
      </div>
    );
  }

  const { evidence, role } = gap;
  const ownedCount =
    evidence.matchedRequired.length + evidence.matchedOptional.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Skill gap — ${role.name}`}
        description="Required skills weigh 2.0, optional 1.0. The gap score is simply 100 minus your M1 match score."
        actions={
          <div className="flex flex-wrap gap-2">
            <RoleSwitcher roles={roles} value={roleSlug} basePath="/skill-gap" />
            <SaveGapButton roleSlug={roleSlug} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
            <ScoreRing value={evidence.matchScore} label="match score" />
            <Badge variant={evidence.matchScore >= 70 ? "success" : evidence.matchScore >= 40 ? "warning" : "destructive"}>
              Gap score {gap.gapScore}%
            </Badge>
            <p className="text-xs text-muted-foreground">
              {evidence.weightedMatched} / {evidence.weightedRequired} weighted · {ownedCount} of your skills used
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
              Prioritised advice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{gap.advice}</p>
            {gap.semanticMatches.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {gap.semanticMatches.length} skill
                {gap.semanticMatches.length > 1 ? "s" : ""} covered through the semantic safety net
                (pgvector cosine ≥ 0.60 from your custom skills):{" "}
                {gap.semanticMatches.map((m) => `${m.role_skill_name} ← ${m.via_skill_name}`).join(", ")}.
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button size="sm" asChild>
                <Link href={`/roadmap?role=${role.slug}`}>
                  <Map className="h-4 w-4" aria-hidden />
                  Generate learning roadmap
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Required skills{" "}
              <Badge variant="muted">
                {evidence.matchedRequired.length}/{evidence.matchedRequired.length + evidence.missingRequired.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...evidence.matchedRequired, ...evidence.missingRequired].map((s) => {
              const have = evidence.matchedRequired.some((m) => m.slug === s.slug);
              return (
                <div
                  key={s.slug}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {have ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                    )}
                    {s.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="muted">×{s.weight}</Badge>
                    <Badge variant={have ? "success" : "destructive"}>
                      {have ? (s.via ? "semantic" : "owned") : "gap"}
                    </Badge>
                  </span>
                </div>
              );
            })}
            {!evidence.missingRequired.length ? (
              <p className="text-sm text-success">Every required skill is already in your profile.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Optional skills{" "}
              <Badge variant="muted">
                {evidence.matchedOptional.length}/
                {evidence.matchedOptional.length + evidence.missingOptional.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...evidence.matchedOptional, ...evidence.missingOptional].map((s) => {
              const have = evidence.matchedOptional.some((m) => m.slug === s.slug);
              return (
                <div
                  key={s.slug}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {have ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                    {s.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="muted">×{s.weight}</Badge>
                    <Badge variant={have ? "success" : "outline"}>
                      {have ? (s.via ? "semantic" : "owned") : "gap"}
                    </Badge>
                  </span>
                </div>
              );
            })}
            {!evidence.missingOptional.length ? (
              <p className="text-sm text-success">You cover every optional skill too.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
