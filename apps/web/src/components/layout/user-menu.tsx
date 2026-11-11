"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function UserMenu({ email, fullName }: { email: string; fullName: string | null }) {
  const router = useRouter();

  async function signOut() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  }

  const initials = (fullName || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none ring-ring focus-visible:ring-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials || "?"}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[160px] truncate text-sm font-medium sm:inline-block">
          {fullName || email}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
          Career profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
