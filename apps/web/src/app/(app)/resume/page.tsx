import { FileText } from "lucide-react";
import { PageHeader } from "@/components/feature/page-header";
import { Badge } from "@/components/ui/badge";
import { ResumeManager } from "@/components/resume/resume-manager";
import { requireUser } from "@/lib/supabase/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resume Analysis" };

type ResumeRow = {
  id: string;
  file_name: string;
  size_bytes: string | number;
  page_count: number | null;
  status: string;
  is_active: boolean;
  error_message: string | null;
  created_at: string;
  analysis_id: string | null;
  analysis_status: string | null;
  parsed: { skills?: Array<{ slug: string; name: string; category: string }>; summary?: string } | null;
  reviewed: boolean | null;
  error: string | null;
};

export default async function ResumePage() {
  const { user } = await requireUser();
  if (!user) return null;

  const resumes = await query<ResumeRow>(
    `select r.id, r.file_name, r.size_bytes, r.page_count, r.status, r.is_active,
            r.error_message, r.created_at,
            ra.id as analysis_id, ra.status as analysis_status, ra.parsed, ra.reviewed, ra.error
       from public.resumes r
       left join lateral (
         select * from public.resume_analyses a
          where a.resume_id = r.id
          order by a.created_at desc limit 1
       ) ra on true
      where r.user_id = $1
      order by r.created_at desc`,
    [user.id]
  );

  const processed = resumes.filter((r) => r.status === "processed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume analysis"
        description="Upload a PDF resume. PyMuPDF extracts the text, the alias matcher finds catalogue skills, and you review everything before anything enters your profile."
        actions={
          <Badge variant={resumes.length ? "success" : "muted"}>
            {resumes.length} uploaded · {processed} processed
          </Badge>
        }
      />

      <ResumeManager resumes={resumes} />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Validated uploads",
            text: "PDF magic bytes, ≤ 10 MB, ≤ 40 pages, SHA-256 de-duplication.",
          },
          {
            title: "Structured extraction",
            text: "Skills with evidence lines, plus summary, education and experience sections as reviewable JSON.",
          },
          {
            title: "You stay in control",
            text: "Nothing enters your profile until you confirm the extracted data.",
          },
        ].map((item) => (
          <div key={item.title} className="surface p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" aria-hidden />
              {item.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
