"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RoleSwitcher({
  roles,
  value,
  basePath,
  placeholder = "Choose a role…",
}: {
  roles: Array<{ slug: string; name: string }>;
  value: string;
  basePath: string;
  placeholder?: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => {
        if (v !== "none") router.push(`${basePath}?role=${v}`);
      }}
    >
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {roles.map((r) => (
          <SelectItem key={r.slug} value={r.slug}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
