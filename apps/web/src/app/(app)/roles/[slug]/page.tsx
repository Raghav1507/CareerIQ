import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, ListChecks, ShieldQuestion } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { ModuleNotice } from "@/components/feature/module-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoleDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const detail = await getRoleDetail(slug).catch(() => null);
  return { title: detail ? detail.role.name : "Role" };
}

export default async function RoleDetailPage({ params }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) notFound();

  const detail = await getRoleDetail(slug);
  if (!detail) notFound();

  const { role, skills } = detail;
  const required = skills.filter((s) => s.is_required);
  const optional = skills.filter((s) => !s.is_required);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/roles">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All roles
          </Link>
        </Button>
        <PageHeader
          title={role.name}
          description={role.description}
          actions={
            <div className="flex gap-2">
              <Badge variant="info">{required.length} required</Badge>
              <Badge variant="secondary">{optional.length} optional</Badge>
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-primary" aria-hidden />
                Key responsibilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {role.responsibilities.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Required skills</CardTitle>
              <Badge variant="info">Weight 2.0</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {required.map((s) => (
                  <span
                    key={s.slug}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm font-medium text-primary"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {s.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Optional skills</CardTitle>
              <Badge variant="muted">Weight 1.0</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {optional.map((s) => (
                  <span
                    key={s.slug}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground"
                  >
                    <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                    {s.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Occupational mappings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">O*NET-SOC</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {role.onet_codes.length ? (
                    role.onet_codes.map((code) => (
                      <Badge key={code} variant="outline">
                        {code}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Not mapped</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">ESCO</p>
                <div className="mt-1">
                  {role.esco_codes.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {role.esco_codes.map((code) => (
                        <Badge key={code} variant="outline">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Imported with the official ESCO dataset (data-pipeline phase)
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <ModuleNotice
            module="Target-role selection"
            phase="Next increment"
            detail="Choosing this role as your target unlocks skill-gap analysis and learning-roadmap generation, implemented in the next build increment of this project."
          />

          <Button variant="outline" className="w-full" disabled>
            <ShieldQuestion className="h-4 w-4" aria-hidden />
            Set as target role (next increment)
          </Button>
        </div>
      </div>
    </div>
  );
}
