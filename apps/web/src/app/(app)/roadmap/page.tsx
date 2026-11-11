import Link from "next/link";
import { History, Map } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { EmptyState } from "@/components/feature/empty-state";
import { RoadmapGenerator } from "@/components/roadmap/roadmap-generator";
import { RoadmapChecklist } from "@/components/roadmap/roadmap-checklist";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/supabase/auth";
import { getRoleIndex } from "@/lib/server/match-data";
import { formatDate } from "@/lib/utils";
import {
  getRoadmapProgress,
  listRoadmaps,
  type PlanWeek,
  type RoadmapRow,
} from "@/lib/server/roadmaps";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning Roadmap" };

type SearchParams = Promise<{ role?: string; roadmap?: string }>;

export default async function RoadmapPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireUser();
  if (!user) return null;

  const params = await searchParams;
  const [roles, roadmaps] = await Promise.all([getRoleIndex(), listRoadmaps(user.id)]);

  const selected: RoadmapRow | null =
    roadmaps.find((r) => r.id === params.roadmap) ?? roadmaps[0] ?? null;

  const defaultRole = params.role || selected?.slug || roles[0]?.slug || "";
  const progress = selected ? await getRoadmapProgress(user.id, selected.id) : {};
  const plan = (selected?.plan ?? []) as PlanWeek[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning roadmap"
        description="A week-by-week plan built from your real skill gaps — required skills first, optional after. Progress is saved to your account."
        actions={
          selected ? (
            <Badge variant="success">{selected.title}</Badge>
          ) : (
            <Badge variant="muted">No roadmap yet</Badge>
          )
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Map className="h-4 w-4 text-primary" aria-hidden />
            Generate a new roadmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RoadmapGenerator roles={roles} defaultRole={defaultRole} />
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{selected.title}</CardTitle>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="muted">{selected.horizon_weeks}-week horizon</Badge>
                <Badge variant="info">{plan.length} active weeks</Badge>
                created {formatDate(selected.created_at)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <RoadmapChecklist roadmapId={selected.id} plan={plan} initialProgress={progress} />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Map}
          title="No roadmap yet"
          description="Roadmaps are generated from your skill gaps — pick a role above and press Generate. If you already cover every skill for a role we will tell you honestly instead of inventing work."
        />
      )}

      {roadmaps.length > 1 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden />
              Previous roadmaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roadmaps.slice(1).map((r) => (
              <Link
                key={r.id}
                href={`/roadmap?roadmap=${r.id}`}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span>{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.created_at)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
