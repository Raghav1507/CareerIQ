"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  children: React.ReactNode;
  user: { email: string; fullName: string | null };
};

/**
 * Application shell: fixed sidebar on desktop, dialog-based navigation on
 * mobile, top bar with account menu.
 */
export function AppShell({ children, user }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card md:flex md:flex-col md:p-4">
        <SidebarNav />
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="left-0 top-0 h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none p-4 sm:left-0 sm:top-0 sm:translate-x-0 sm:translate-y-0">
              <DialogTitle className="sr-only">Navigation</DialogTitle>
              <div className="absolute right-3 top-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="h-full pt-8">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              C
            </span>
            CareerIQ
          </Link>
        </div>
        <UserMenu email={user.email} fullName={user.fullName} />
      </header>

      {/* Desktop top bar */}
      <div className="sticky top-0 z-30 hidden h-14 items-center justify-end border-b bg-background/95 px-8 backdrop-blur md:flex">
        <UserMenu email={user.email} fullName={user.fullName} />
      </div>

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
