"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiException } from "@/lib/api";

export function GenerateRecommendationsButton({ hasSkills }: { hasSkills: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await apiFetch<{ count: number; top: Array<{ role: string; score: number }> }>(
        "/api/recommendations",
        { method: "POST" }
      );
      toast.success(`${res.count} roles ranked`, {
        description: res.top.length
          ? `Top match: ${res.top[0].role} (${res.top[0].score}%)`
          : undefined,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={generate} disabled={busy || !hasSkills}>
      <Sparkles className="h-4 w-4" aria-hidden />
      {busy ? "Ranking all ten roles…" : hasSkills ? "Generate recommendations" : "Add skills first"}
    </Button>
  );
}
