import { ClipboardCheck, History } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { AnalyzerForm } from "@/components/jobs/analyzer-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/supabase/auth";
import { queryOne } from "@/lib/db";
import { listJobs } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Match Analyzer" };

export default async function JobAnalyzerPage() {
  const { user } = await requireUser();
  if (!user) return null;

  const [history, skillCount] = await Promise.all([
    listJobs(user.id),
    queryOne<{ n: string }>(
      `select count(*)::text as n from public.user_skills where user_id = $1`,
      [user.id]
    ),
  ]);
  const hasSkills = Number(skillCount?.n ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job match analyzer"
        description="Paste a job description. The AI service extracts the required skills with the same alias matcher used for resumes, then scores your compatibility with M1 maths."
        actions={
          <Badge variant={history.length ? "success" : "muted"}>{history.length} analysed</Badge>
        }
      />

      <AnalyzerForm hasSkills={hasSkills} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" aria-hidden />
            Analysis history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No postings analysed yet — your results will be listed here with their compatibility scores.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{job.title ?? "Untitled posting"}</span>
                    {job.company ? <span className="text-muted-foreground">· {job.company}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="muted">{job.skills_found} skills</Badge>
                    {job.score !== null ? (
                      <Badge variant={Number(job.score) >= 70 ? "success" : Number(job.score) >= 40 ? "warning" : "destructive"}>
                        {Math.round(Number(job.score))}%
                      </Badge>
                    ) : (
                      <Badge variant="outline">no skills found</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
