import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listRoles } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career Roles" };

const CATEGORY_LABEL: Record<string, string> = {
  software: "Software",
  frontend: "Frontend",
  backend: "Backend",
  data: "Data",
  ml_ai: "ML / AI",
  devops: "DevOps",
  security: "Security",
};

export default async function RolesPage() {
  const roles = await listRoles();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career roles"
        description="The ten official technical career roles from the Milestone-1 proposal. Each role has structured required and optional skills with explicit weights."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role, index) => (
          <Link key={role.id} href={`/roles/${role.slug}`} className="group">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Badge variant="muted">{CATEGORY_LABEL[role.category] ?? role.category}</Badge>
                </div>
                <h2 className="mt-3 text-base font-semibold leading-snug">{role.name}</h2>
                <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">
                  {role.description}
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs">
                  <Badge variant="info">{role.required_count} required</Badge>
                  <Badge variant="secondary">{role.optional_count} optional</Badge>
                  <ArrowRight
                    className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No roles found — run the database migrations to seed the catalogue.
        </p>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" aria-hidden />
        O*NET mappings are M1-curated; ESCO codes are imported with the official dataset in the
        data-pipeline phase.
      </p>
    </div>
  );
}
