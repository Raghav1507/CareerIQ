import Link from "next/link";
import { ArrowRight, ExternalLink, Map, Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { EmptyState } from "@/components/feature/empty-state";
import { ScoreRing } from "@/components/charts/score-ring";
import { GenerateRecommendationsButton } from "@/components/recommendations/generate-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/supabase/auth";
import { queryOne } from "@/lib/db";
import { getStoredRecommendations } from "@/lib/server/recommendations";
import type { ScoredSkill } from "@/lib/matching";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recommendations" };

function SkillChips({ label, skills, tone }: { label: string; skills: ScoredSkill[]; tone: "success" | "destructive" | "muted" }) {
  if (!skills.length) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
        {label} ({skills.length})
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <Badge key={`${label}-${s.slug}`} variant={tone}>
            {s.name}
            <span className="ml-1 opacity-70">×{s.weight}</span>
            {s.via ? (
              <span
                className="ml-1 opacity-70"
                title={`Semantic bridge: your “${s.via.name}” skill (cosine ${s.via.similarity})`}
              >
                ≈
              </span>
            ) : null}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default async function RecommendationsPage() {
  const { user } = await requireUser();
  if (!user) return null;

  const [rows, skillCount] = await Promise.all([
    getStoredRecommendations(user.id),
    queryOne<{ n: string }>(
      `select count(*)::text as n from public.user_skills where user_id = $1`,
      [user.id]
    ),
  ]);
  const hasSkills = Number(skillCount?.n ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career recommendations"
        description="Ranked matches across the ten technical roles using the official M1 formula. Gemini may phrase the explanation — it never changes the score."
        actions={<GenerateRecommendationsButton hasSkills={hasSkills} />}
      />

      {!rows.length ? (
        <EmptyState
          icon={Trophy}
          title={hasSkills ? "No recommendations yet" : "Add skills to unlock recommendations"}
          description={
            hasSkills
              ? "Press Generate to score all ten official roles against your confirmed skills — required skills weigh 2.0, optional 1.0."
              : "Recommendations compare your skills against each role's weighted requirements. Add at least one skill in your profile first."
          }
          action={
            hasSkills ? (
              <GenerateRecommendationsButton hasSkills={hasSkills} />
            ) : (
              <Button asChild>
                <Link href="/onboarding">
                  Open profile editor <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="info">{rows.length} roles ranked</Badge>
            <span>
              Computed {new Date(rows[0].computed_at).toLocaleString()} ·{" "}
              {rows[0].model_used ? (
                <>
                  explanations by <strong className="text-foreground">{rows[0].model_used}</strong>
                </>
              ) : (
                "deterministic explanations (LLM unavailable)"
              )}
            </span>
          </div>

          {rows.map((row) => {
            const ev = {
              matchedRequired: (row.matched_required ?? []) as ScoredSkill[],
              missingRequired: (row.missing_required ?? []) as ScoredSkill[],
              matchedOptional: (row.matched_optional ?? []) as ScoredSkill[],
              missingOptional: (row.missing_optional ?? []) as ScoredSkill[],
            };
            const semantic = (row.semantic_matches ?? []) as Array<{ role_skill_name: string; via_skill_name: string }>;
            const rank = row.ranked_position;
            return (
              <Card key={row.id} className={rank === 1 ? "border-primary/50" : undefined}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-4 sm:flex-col sm:items-center">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                          rank === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {rank}
                      </span>
                      <ScoreRing value={Number(row.match_score)} size={104} strokeWidth={9} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">{row.name}</h2>
                        {row.is_target_role ? (
                          <Badge variant="info">
                            <Target className="mr-1 h-3 w-3" aria-hidden />
                            Target role
                          </Badge>
                        ) : null}
                        <Badge variant="muted">
                          {row.weighted_matched} / {row.weighted_required} weighted
                        </Badge>
                        {semantic.length ? (
                          <Badge
                            variant="info"
                            title="Custom skills bridged to role skills with pgvector cosine ≥ 0.60"
                          >
                            {semantic.length} semantic match{semantic.length > 1 ? "es" : ""}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <SkillChips label="Matched required" skills={ev.matchedRequired} tone="success" />
                        <SkillChips label="Missing required" skills={ev.missingRequired} tone="destructive" />
                        <SkillChips label="Matched optional" skills={ev.matchedOptional} tone="success" />
                        <SkillChips label="Missing optional" skills={ev.missingOptional} tone="muted" />
                      </div>

                      <p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
                        {row.explanation}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/skill-gap?role=${row.slug}`}>
                            <Target className="h-3.5 w-3.5" aria-hidden />
                            Skill gap
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/roadmap?role=${row.slug}`}>
                            <Map className="h-3.5 w-3.5" aria-hidden />
                            Build roadmap
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/roles/${row.slug}`}>
                            Role details <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
