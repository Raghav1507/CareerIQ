import { PageHeader } from "@/components/feature/page-header";
import {
  ApiStatusRow,
  AppearanceCard,
  SignOutButton,
} from "@/components/settings/settings-controls";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/supabase/auth";
import { queryOne } from "@/lib/db";
import { getSystemHealth } from "@/lib/health";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireUser();
  if (!user) return null;

  const [health, dataCounts] = await Promise.all([
    getSystemHealth(),
    queryOne<{
      skills: number;
      resumes: number;
      recommendations: number;
      roadmaps: number;
      jobs: number;
    }>(`
      select
        (select count(*)::int from public.user_skills where user_id = $1)          as skills,
        (select count(*)::int from public.resumes where user_id = $1)              as resumes,
        (select count(*)::int from public.career_recommendations where user_id = $1) as recommendations,
        (select count(*)::int from public.learning_roadmaps where user_id = $1)    as roadmaps,
        (select count(*)::int from public.job_descriptions where user_id = $1)     as jobs
    `, [user.id]),
  ]);

  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "–";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Account, appearance and an honest view of what CareerIQ stores for you."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Managed by Supabase Auth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="truncate font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">
                {(user.user_metadata?.full_name as string | undefined) || "Not set"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">{joined}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">User ID</span>
              <span className="max-w-[220px] truncate font-mono text-xs">
                {user.id}
              </span>
            </div>
            <Separator />
            <div className="flex justify-end">
              <SignOutButton />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Stored locally in your browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceCard />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform status</CardTitle>
            <CardDescription>Live probes from this request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ApiStatusRow
              status={{
                db: health.db.ok,
                ai: health.ai.ok,
                aiError: health.ai.error,
              }}
            />
            <p className="text-xs text-muted-foreground">
              Database latency {health.db.latencyMs} ms
              {health.ai.ok ? ` · AI service ${health.ai.latencyMs} ms (v${health.ai.version})` : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your data</CardTitle>
            <CardDescription>
              Everything is scoped to your account and protected by Row Level Security.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                { label: "Skills", value: dataCounts?.skills ?? 0 },
                { label: "Resumes", value: dataCounts?.resumes ?? 0 },
                { label: "Recommendations", value: dataCounts?.recommendations ?? 0 },
                { label: "Roadmaps", value: dataCounts?.roadmaps ?? 0 },
                { label: "Job analyses", value: dataCounts?.jobs ?? 0 },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="mt-0.5 text-lg font-semibold">{row.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="muted">RLS enabled on all tables</Badge>
              <Badge variant="muted">Private resume storage</Badge>
              <Badge variant="muted">Server-side secrets only</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
