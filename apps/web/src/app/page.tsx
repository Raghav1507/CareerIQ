import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  Map,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const OFFICIAL_ROLES = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Data Analyst",
  "Data Scientist",
  "Machine Learning Engineer",
  "AI Engineer",
  "DevOps/Cloud Engineer",
  "Cybersecurity Analyst",
  "Software Engineer",
];

const WORKFLOW = [
  { step: "01", title: "Create your profile", text: "Education, skills, projects, experience, interests and career goals." },
  { step: "02", title: "Upload your resume", text: "PyMuPDF extracts text; spaCy and aliases normalise every skill." },
  { step: "03", title: "Review AI extraction", text: "You confirm exactly what the AI found before anything is used." },
  { step: "04", title: "Get role recommendations", text: "Weighted skill matching plus semantic similarity, fully explained." },
  { step: "05", title: "Analyse your skill gap", text: "Pick a target role and see required vs optional gaps." },
  { step: "06", title: "Follow your roadmap", text: "A personalised week-by-week plan to close the gap." },
  { step: "07", title: "Match a job description", text: "Paste a JD and get a deterministic compatibility score." },
  { step: "08", title: "Act on the evidence", text: "Missing skills, explanations and learning resources in one view." },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Resume intelligence",
    text: "PDF extraction with validation, structured parsing and a human-review step before any analysis.",
  },
  {
    icon: Radar,
    title: "Semantic skill matching",
    text: "Aliases (React.js = React JS = ReactJS) and pgvector cosine similarity catch equivalent capabilities.",
  },
  {
    icon: Sparkles,
    title: "Explainable recommendations",
    text: "Every score is computed deterministically; the LLM only writes the explanation from that evidence.",
  },
  {
    icon: Target,
    title: "Skill-gap analysis",
    text: "Mandatory skills weighted over optional skills, mapped against your confirmed profile.",
  },
  {
    icon: Map,
    title: "Learning roadmaps",
    text: "Personalised plans built from your actual gaps, with progress tracking per item.",
  },
  {
    icon: ClipboardCheck,
    title: "Job compatibility",
    text: "Paste a job description and see matched skills, missing skills and a transparent score.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="app-container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              C
            </span>
            CareerIQ
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Landing">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#roles" className="transition-colors hover:text-foreground">Career roles</a>
            <a href="#methodology" className="transition-colors hover:text-foreground">Methodology</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">
                Get started <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="app-container grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <Badge variant="info" className="mb-5">
                Open source · Explainable AI
              </Badge>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Know exactly which career fits{" "}
                <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                  your skills
                </span>
                .
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                CareerIQ analyses your education, skills, projects, experience and resume to
                deliver explainable career-role recommendations, skill-gap analysis, job
                matching and personalised learning roadmaps.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Start free analysis <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">I already have an account</Link>
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["Deterministic scoring", "Review before analysis", "Advisory, never prescriptive"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Product preview card */}
            <Card className="relative overflow-hidden shadow-xl">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Career match
                    </p>
                    <p className="mt-1 text-lg font-semibold">Full Stack Developer</p>
                  </div>
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20 text-xl font-semibold text-primary">
                    82
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    { label: "Required skills matched", value: 8, total: 10 },
                    { label: "Optional skills matched", value: 6, total: 10 },
                    { label: "Skill gap remaining", value: 4, total: 10 },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{row.label}</span>
                        <span>
                          {row.value}/{row.total}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(row.value / row.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Why this match:</strong> You cover all core
                  stack requirements (React, Node, SQL, Docker). Strengthen system design and
                  CI/CD to move from 82 to 90+.
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["React.js", "Node.js", "PostgreSQL", "Docker", "TypeScript"].map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                  <Badge variant="warning">+2 to learn</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="border-b py-16 lg:py-20">
          <div className="app-container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="muted">Official workflow</Badge>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                From raw resume to a plan you can execute
              </h2>
              <p className="mt-3 text-muted-foreground">
                The end-to-end Milestone-1 workflow, implemented exactly as proposed.
              </p>
            </div>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map((item) => (
                <li key={item.step} className="surface p-5 transition-shadow hover:shadow-md">
                  <span className="text-xs font-semibold text-primary">{item.step}</span>
                  <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b py-16 lg:py-20">
          <div className="app-container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="muted">Platform</Badge>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Everything the career analysis needs — nothing it doesn&apos;t
              </h2>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="border-b py-16 lg:py-20">
          <div className="app-container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="muted">Scope</Badge>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Ten official technical career roles
              </h2>
              <p className="mt-3 text-muted-foreground">
                Structured required and optional skills for each role, curated from the
                Milestone-1 proposal with O*NET mappings.
              </p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {OFFICIAL_ROLES.map((role, i) => (
                <div
                  key={role}
                  className="surface flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium leading-snug">{role}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section id="methodology" className="py-16 lg:py-20">
          <div className="app-container grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge variant="muted">Methodology</Badge>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                A transparent formula — not a black box
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Every compatibility score in CareerIQ is computed from the submitted
                Milestone-1 formula. Mandatory skills carry double weight, optional skills
                single weight, and semantic similarity accounts for wording differences.
                Large language models write explanations from that structured evidence —
                they never invent numbers.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { icon: GitBranch, text: "Skill aliases normalise React.js / React JS / ReactJS" },
                  { icon: BarChart3, text: "pgvector cosine similarity for related capabilities" },
                  { icon: ShieldCheck, text: "LLM failures degrade gracefully — never fake results" },
                  { icon: Briefcase, text: "Advisory recommendations based only on declared skills" },
                ].map((row) => (
                  <p key={row.text} className="flex items-start gap-2.5 text-sm">
                    <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-muted-foreground">{row.text}</span>
                  </p>
                ))}
              </div>
            </div>
            <Card className="bg-card">
              <CardContent className="p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Official M1 formula
                </p>
                <p className="mt-4 rounded-lg border bg-muted/40 p-4 text-center font-mono text-sm leading-relaxed">
                  Career Match Score =
                  <br />
                  <span className="text-primary">
                    (Weighted Matched Skills / Weighted Required Skills)
                  </span>{" "}
                  × 100
                </p>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg border p-3">
                    <dt className="text-muted-foreground">Required skill weight</dt>
                    <dd className="mt-1 text-lg font-semibold">2.0</dd>
                  </div>
                  <div className="rounded-lg border p-3">
                    <dt className="text-muted-foreground">Optional skill weight</dt>
                    <dd className="mt-1 text-lg font-semibold">1.0</dd>
                  </div>
                </dl>
                <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                  Scores are advisory and derived only from the skills and experience you
                  provide. CareerIQ does not consider protected characteristics.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/40 py-14">
          <div className="app-container flex flex-col items-center gap-5 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to see your career fit?
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Create your profile, upload a resume and get your first explainable
              recommendation in minutes.
            </p>
            <Button size="lg" asChild>
              <Link href="/register">
                Create free account <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="app-container flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              C
            </span>
            CareerIQ — AI Career Intelligence Platform
          </p>
          <p>Made for students & career switchers</p>
        </div>
      </footer>
    </div>
  );
}
