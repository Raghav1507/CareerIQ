"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Map, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, ApiException } from "@/lib/api";

export function RoadmapGenerator({
  roles,
  defaultRole,
}: {
  roles: Array<{ slug: string; name: string }>;
  defaultRole: string;
}) {
  const router = useRouter();
  const [role, setRole] = React.useState(defaultRole);
  const [weeks, setWeeks] = React.useState("12");
  const [busy, setBusy] = React.useState(false);

  async function generate() {
    if (!role) {
      toast.error("Pick a role first.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ roadmap: { id: string }; skillCount: number }>("/api/roadmaps", {
        method: "POST",
        body: JSON.stringify({ role_slug: role, horizon_weeks: Number(weeks) }),
      });
      toast.success(`Roadmap ready — ${res.skillCount} skill item(s)`);
      router.push(`/roadmap?roadmap=${res.roadmap.id}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiException ? err.message : "Generation failed.";
      if (err instanceof ApiException && err.code === "NO_GAPS") {
        toast.info(message);
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={role || "none"} onValueChange={(v) => setRole(v === "none" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Choose a role…</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.slug} value={r.slug}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Horizon</Label>
        <Select value={weeks} onValueChange={setWeeks}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="8">8 weeks</SelectItem>
            <SelectItem value="12">12 weeks</SelectItem>
            <SelectItem value="16">16 weeks</SelectItem>
            <SelectItem value="24">24 weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={generate} disabled={busy || !role}>
        {busy ? (
          <Sparkles className="h-4 w-4 animate-pulse" aria-hidden />
        ) : (
          <Map className="h-4 w-4" aria-hidden />
        )}
        {busy ? "Building plan…" : "Generate roadmap"}
      </Button>
    </div>
  );
}
