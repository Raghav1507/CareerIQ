"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScoreRing } from "@/components/charts/score-ring";
import { apiFetch, ApiException } from "@/lib/api";

type SkillHit = { slug: string; name: string; category: string; evidence?: string };

type Result = {
  jobId: string;
  title: string | null;
  company: string | null;
  score: number;
  matched: SkillHit[];
  missing: SkillHit[];
  closestRole: { slug: string; name: string; overlap: number } | null;
  explanation: string;
  modelUsed: string | null;
  skillsFound: number;
  warning: string | null;
};

export function AnalyzerForm({ hasSkills }: { hasSkills: boolean }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);

  async function analyse() {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch<{ result: Result }>("/api/job-analyzer", {
        method: "POST",
        body: JSON.stringify({ text, title: title || undefined, company: company || undefined }),
      });
      setResult(res.result);
      toast.success(`Compatibility ${res.result.score}%`, {
        description: res.result.closestRole
          ? `Closest official role: ${res.result.closestRole.name}`
          : undefined,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!hasSkills ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          Your profile has no skills yet — the compatibility score will be 0% until you add some in the profile
          editor. You can still analyse postings to see which skills they require.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="job-title">Job title (optional)</Label>
          <Input
            id="job-title"
            placeholder="Backend Developer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="job-company">Company (optional)</Label>
          <Input
            id="job-company"
            placeholder="Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={200}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job-text">Job description</Label>
        <Textarea
          id="job-text"
          placeholder="Paste the full job description — requirements, responsibilities, tech stack… (min 80 characters)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          maxLength={100_000}
        />
        <p className="text-xs text-muted-foreground">{text.length} characters</p>
      </div>

      <Button onClick={analyse} disabled={busy || text.trim().length < 80}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ScanSearch className="h-4 w-4" aria-hidden />}
        {busy ? "Extracting skills and scoring…" : "Analyse this job"}
      </Button>

      {result ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ScoreRing value={result.score} label="compatibility" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {result.title ?? "Untitled posting"}
                    {result.company ? ` · ${result.company}` : ""}
                  </h3>
                  <Badge variant="info">{result.skillsFound} required skill(s) found</Badge>
                  {result.closestRole ? (
                    <Badge variant="secondary">
                      Closest role: {result.closestRole.name} ({Math.round(result.closestRole.overlap * 100)}% overlap)
                    </Badge>
                  ) : null}
                  <Badge variant={result.modelUsed ? "default" : "muted"}>
                    {result.modelUsed ? `Gemini: ${result.modelUsed}` : "Deterministic explanation"}
                  </Badge>
                </div>

                {result.warning ? (
                  <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">{result.warning}</p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      Matched ({result.matched.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {result.matched.length ? (
                        result.matched.map((s) => (
                          <Badge key={s.slug} variant="success">
                            {s.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None yet</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      Gaps ({result.missing.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {result.missing.length ? (
                        result.missing.map((s) => (
                          <Badge key={s.slug} variant="destructive">
                            {s.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No gaps</span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">{result.explanation}</p>
                <p className="text-xs text-muted-foreground">
                  Formula: matched job skills ÷ {result.skillsFound} × 100 — every listed skill weighs 2.0 (M1 rule).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
