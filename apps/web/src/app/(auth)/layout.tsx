import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/40 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl"
        />
        <Link href="/" className="relative flex items-center gap-2.5 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            C
          </span>
          CareerIQ
        </Link>
        <div className="relative space-y-4">
          <h2 className="text-3xl font-semibold leading-snug tracking-tight">
            Your career decisions, backed by evidence — not guesswork.
          </h2>
          <ul className="space-y-2.5 text-sm text-background/75">
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Explainable role recommendations from your real skills
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Skill-gap analysis against the ten technical roles
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Personalised learning roadmaps and job matching
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-background/60">
          CSET400C Capstone Project · Bennett University
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              C
            </span>
            CareerIQ
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
