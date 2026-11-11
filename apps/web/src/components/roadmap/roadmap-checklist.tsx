"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Circle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiFetch, ApiException } from "@/lib/api";
import { cn } from "@/lib/utils";

type PlanResource = {
  id: string;
  title: string;
  url: string;
  type: string;
  provider: string | null;
  difficulty: string;
};

type PlanItem = {
  key: string;
  skill: string;
  skill_slug: string;
  category: string;
  est_hours: number;
  is_required: boolean;
  resource_ids?: string[];
  resources?: PlanResource[];
};

type PlanWeek = {
  week: number;
  title: string;
  objectives: string[];
  items: PlanItem[];
};

export function RoadmapChecklist({
  roadmapId,
  plan,
  initialProgress,
}: {
  roadmapId: string;
  plan: PlanWeek[];
  initialProgress: Record<string, string>;
}) {
  const router = useRouter();
  const [progress, setProgress] = React.useState<Record<string, string>>(initialProgress);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const allKeys = plan.flatMap((w) => w.items.map((i) => i.key));
  const done = allKeys.filter((k) => progress[k] === "completed").length;
  const pct = allKeys.length ? Math.round((done / allKeys.length) * 100) : 0;

  const weekResources = (week: PlanWeek): PlanResource[] => {
    const seen = new Set<string>();
    const out: PlanResource[] = [];
    for (const item of week.items) {
      for (const r of item.resources ?? []) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          out.push(r);
        }
      }
    }
    return out;
  };

  async function toggle(item: PlanItem) {
    const next = progress[item.key] === "completed" ? "not_started" : "completed";
    setBusyKey(item.key);
    setProgress((prev) => ({ ...prev, [item.key]: next }));
    try {
      await apiFetch("/api/roadmaps/progress", {
        method: "POST",
        body: JSON.stringify({
          roadmap_id: roadmapId,
          item_key: item.key,
          status: next,
          skill_slug: item.skill_slug,
        }),
      });
      router.refresh();
    } catch (err) {
      setProgress((prev) => ({ ...prev, [item.key]: progress[item.key] ?? "not_started" }));
      toast.error(err instanceof ApiException ? err.message : "Could not save progress.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={pct} className="max-w-xs" />
        <span className="text-sm font-medium">
          {done}/{allKeys.length} items done ({pct}%)
        </span>
      </div>

      <ol className="relative space-y-4 border-l pl-6">
        {plan.map((week) => (
          <li key={week.week} className="relative">
            <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {week.week}
            </span>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{week.title}</h3>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {week.items.reduce((n, i) => n + i.est_hours, 0)}h planned
                </span>
              </div>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                {week.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              {weekResources(week).length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <BookOpen className="h-3 w-3" aria-hidden /> Learning resources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {weekResources(week).map((r) => (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${r.title} (opens in a new tab)`}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="truncate">{r.title}</span>
                        <Badge variant="muted" className="px-1 py-0 text-[9px]">
                          {r.type}
                        </Badge>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {week.items.map((item) => {
                  const complete = progress[item.key] === "completed";
                  const busy = busyKey === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(item)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                        complete
                          ? "border-success/40 bg-success/10 text-success"
                          : "hover:bg-accent"
                      )}
                    >
                      {complete ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Circle className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {item.skill}
                      <Badge variant={item.is_required ? "default" : "muted"} className="ml-1 px-1.5 py-0 text-[10px]">
                        {item.is_required ? "required" : "optional"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
