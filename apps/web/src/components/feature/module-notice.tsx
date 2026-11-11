import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Transparent build-status notice used on modules that are part of a later
 * build phase. It tells the user exactly what exists today — nothing is faked.
 */
export function ModuleNotice({
  module,
  phase,
  detail,
}: {
  module: string;
  phase: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">{module} — build status</h3>
        <Badge variant="warning">{phase}</Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
