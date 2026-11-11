"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiException } from "@/lib/api";

export function SaveGapButton({ roleSlug }: { roleSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await apiFetch<{ gap_score: number }>("/api/skill-gap", {
        method: "POST",
        body: JSON.stringify({ role_slug: roleSlug }),
      });
      toast.success("Gap analysis saved", { description: `Gap score ${res.gap_score}%.` });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={save} disabled={busy}>
      <Database className="h-4 w-4" aria-hidden />
      {busy ? "Saving…" : "Save to history"}
    </Button>
  );
}
