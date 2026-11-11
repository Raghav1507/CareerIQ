"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNav, secondaryNav } from "@/components/layout/nav-items";
import { Badge } from "@/components/ui/badge";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col gap-6">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2" onClick={onNavigate}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          C
        </span>
        <span className="text-base font-semibold tracking-tight">CareerIQ</span>
        <Badge variant="info" className="ml-auto">
          M2
        </Badge>
      </Link>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        {mainNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="flex flex-col gap-1 border-t pt-4" aria-label="Secondary">
        {secondaryNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <p className="px-3 text-[11px] leading-relaxed text-muted-foreground">
        AI recommendations are advisory and based only on the skills and experience you provide.
      </p>
    </div>
  );
}
