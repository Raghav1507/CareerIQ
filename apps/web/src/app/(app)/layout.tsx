import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let email: string | null = null;
  let fullName: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    email = user.email ?? null;
    fullName =
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null) ?? null;
  } catch (err) {
    // Configuration problems send the user to the sign-in page, which renders
    // an actionable configuration notice.
    if (err instanceof Error && err.message.includes("not configured")) {
      redirect("/login");
    }
    redirect("/login");
  }

  if (!email) redirect("/login");

  return (
    <AppShell user={{ email, fullName }}>
      {children}
    </AppShell>
  );
}
