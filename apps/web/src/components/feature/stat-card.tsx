import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function StatCard({ label, value, hint, icon: Icon, className }: Props) {
  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
