import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  ClipboardCheck,
  Database,
  FileText,
  Map,
  Server,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { StatCard } from "@/components/feature/stat-card";
import { EmptyState } from "@/components/feature/empty-state";
import { RoleSkillChart } from "@/components/charts/role-skill-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDashboardSummary } from "@/lib/queries";
import { getSystemHealth } from "@/lib/health";
import { requireUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function HealthDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-destructive"}`}
      aria-hidden
    />
  );
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  if (!user) {
    // proxy already redirects; this keeps the RSC safe if bypassed.
    return null;
  }

  const [summary, health] = await Promise.all([
    getDashboardSummary(user.id),
    getSystemHealth(),
  ]);

  const checklist = [
    {
      label: "Complete your career profile",
      done: summary.user.onboardingComplete,
      href: "/onboarding",
      icon: UserRound,
    },
    {
      label: "Upload and review your resume",
      done: summary.user.resumes > 0,
      href: "/resume",
      icon: FileText,
    },
    {
      label: "Review career recommendations",
      done: summary.user.recommendations > 0,
      href: "/recommendations",
      icon: Sparkles,
    },
    {
      label: "Analyse a job description",
      done: summary.user.jobDescriptions > 0,
      href: "/job-analyzer",
      icon: ClipboardCheck,
    },
    {
      label: "Generate a learning roadmap",
      done: summary.user.roadmaps > 0,
      href: "/roadmap",
      icon: Map,
    },
  ];
  const completed = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career intelligence dashboard"
        description="Live overview of your profile, analyses and the CareerIQ platform health."
        actions={
          <Button asChild>
            <Link href="/onboarding">
              {summary.user.onboardingComplete ? "Edit profile" : "Start profile"}{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* Personal stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My skills"
          value={summary.user.skills}
          hint={summary.user.skills ? "Confirmed in your profile" : "Add skills to improve matching"}
          icon={Target}
        />
        <StatCard
          label="Resumes analysed"
          value={summary.user.resumes}
          hint="Awaiting your review before use"
          icon={FileText}
        />
        <StatCard
          label="Recommendations"
          value={summary.user.recommendations}
          hint="Explainable role matches"
          icon={Sparkles}
        />
        <StatCard
          label="Learning roadmaps"
          value={summary.user.roadmaps}
          hint="Personalised plans"
          icon={Map}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Platform health — real probes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Platform health</CardTitle>
              <Badge variant={health.status === "ok" ? "success" : "warning"}>
                {health.status === "ok" ? "All systems go" : "Degraded"}
              </Badge>
            </div>
            <CardDescription>Live checks — not cached metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Database className="h-4 w-4" aria-hidden /> PostgreSQL
              </span>
              <span className="flex items-center gap-2 font-medium">
                <HealthDot ok={health.db.ok} />
                {health.db.ok ? `${health.db.latencyMs} ms` : "unreachable"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Server className="h-4 w-4" aria-hidden /> AI service
              </span>
              <span className="flex items-center gap-2 font-medium">
                <HealthDot ok={health.ai.ok} />
                {health.ai.ok
                  ? `v${health.ai.version ?? "?"} · ${health.ai.latencyMs} ms`
                  : "offline"}
              </span>
            </div>
            {!health.ai.ok && health.ai.error ? (
              <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
                {health.ai.error}
              </p>
            ) : null}
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" aria-hidden /> Career catalogue
              </span>
              <span className="font-medium">
                {summary.catalog.roles} roles · {summary.catalog.skills} skills
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.catalog.aliases.toLocaleString("en-IN")} skill aliases enable normalisation
              (React.js = React JS = ReactJS).
            </p>
          </CardContent>
        </Card>

        {/* Onboarding checklist */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Getting started</CardTitle>
              <Badge variant="muted">
                {completed}/{checklist.length}
              </Badge>
            </div>
            <CardDescription>Complete the official M1 workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {checklist.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-md ${
                        item.done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>
                      {item.label}
                    </span>
                    {item.done ? (
                      <Badge variant="success" className="ml-auto">
                        Done
                      </Badge>
                    ) : (
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Your activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your activity</CardTitle>
            <CardDescription>Everything below is read live from your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Profile complete</span>
              <Badge variant={summary.user.profileComplete ? "success" : "secondary"}>
                {summary.user.profileComplete ? "Yes" : "Not yet"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Skills in profile</span>
              <span className="font-medium">{summary.user.skills}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Job descriptions analysed</span>
              <span className="font-medium">{summary.user.jobDescriptions}</span>
            </div>
            <Separator />
            {summary.user.resumes === 0 && summary.user.recommendations === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No analyses yet"
                description="Upload a resume to extract your skills and unlock role recommendations."
                action={
                  <Button size="sm" asChild>
                    <Link href="/resume">Go to resume analysis</Link>
                  </Button>
                }
                className="border-0 py-6"
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Real reference-data chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skill requirements across the ten roles</CardTitle>
          <CardDescription>
            Required (weight 2.0) vs optional (weight 1.0) skills per official M1 career role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleSkillChart data={summary.roleSkillCounts} />
        </CardContent>
      </Card>
    </div>
  );
}
