import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Sign in" };

function ConfigNotice() {
  return (
    <div className="surface p-6">
      <Badge variant="warning">Configuration required</Badge>
      <h1 className="mt-3 text-lg font-semibold">Authentication is not configured</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
        <code className="rounded bg-muted px-1">apps/web/.env.local</code> (values from{" "}
        <code className="rounded bg-muted px-1">npx supabase start</code>), then restart the
        dev server.
      </p>
    </div>
  );
}

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <>
      {configured ? (
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      ) : (
        <ConfigNotice />
      )}
    </>
  );
}
