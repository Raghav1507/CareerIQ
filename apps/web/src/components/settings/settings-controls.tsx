"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Monitor, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "careeriq-theme";
const listeners = new Set<() => void>();

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    return "system";
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.classList.remove("dark");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  } else {
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }
  emit();
}

/**
 * Theme as an external store: hydration-safe (server snapshot = system) and
 * free of setState-in-effect patterns.
 */
function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readStoredTheme,
    () => "system" as Theme
  );
  return [theme, applyTheme];
}

export function AppearanceCard() {
  const [theme, setTheme] = useTheme();

  const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={theme === opt.value ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme(opt.value)}
        >
          <opt.icon className="h-4 w-4" aria-hidden />
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function signOut() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={signOut} disabled={loading}>
      <LogOut className="h-4 w-4" aria-hidden />
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function ApiStatusRow({
  status,
}: {
  status: { db: boolean; ai: boolean; aiError?: string };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={status.db ? "success" : "destructive"}>
        Database {status.db ? "connected" : "unreachable"}
      </Badge>
      <Badge variant={status.ai ? "success" : "warning"}>
        AI service {status.ai ? "connected" : "offline"}
      </Badge>
      {!status.ai && status.aiError ? (
        <span className="self-center text-xs text-muted-foreground">{status.aiError}</span>
      ) : null}
    </div>
  );
}
