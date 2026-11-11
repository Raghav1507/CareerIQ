"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Mode = "login" | "register";

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Invalid email or password.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with this email already exists.";
  }
  if (m.includes("password")) {
    return message;
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return message;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(friendlyError(error.message));
        if (!data.session) throw new Error("Sign-in did not return a session.");
        router.push(nextPath);
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() || null } },
      });
      if (error) throw new Error(friendlyError(error.message));

      if (data.session) {
        toast.success("Account created. Welcome to CareerIQ!");
        router.push("/onboarding");
        router.refresh();
        return;
      }
      // Email confirmation required by the project's auth configuration.
      setAwaitingConfirmation(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="surface p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <MailCheck className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold">Confirm your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your
          account, then sign in.
        </p>
        <Button className="mt-5" variant="outline" asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to continue your career analysis."
            : "Start with a profile, then upload your resume."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {mode === "register" ? (
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="Aditya Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "register" ? (
              <span className="text-xs text-muted-foreground">Min. 8 characters</span>
            ) : null}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New to CareerIQ?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
