"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2, Quote, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { apiFetch, ApiException } from "@/lib/api";

type ParsedSkill = { slug: string; name: string; category: string; confidence?: number; evidence?: string };

type ResumeRecord = {
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
  parsed: { skills?: ParsedSkill[]; summary?: string; education?: unknown[]; experience?: unknown[] } | null;
  reviewed: boolean | null;
  error: string | null;
};

type UploadState = {
  fileName: string;
  fileSize: number;
  phase: "upload" | "analyse";
  pct: number;
};

const MAX_BYTES = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF resumes are supported — export your resume as PDF first.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_BYTES) return `File is ${formatBytes(file.size)} — the limit is 10 MB. Compress or re-export it.`;
  return null;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function prettyStatus(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]/g, " ");
}

/** POST with real upload progress (fetch cannot report request-body progress). */
function postResume(
  file: File,
  onPct: (pct: number) => void,
  onUploaded: () => void
): Promise<{ duplicate: boolean; resume: { id: string }; analysis: { parsed: { skills?: ParsedSkill[] } } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/resumes");
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPct(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.upload.onload = () => onUploaded();
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText) as unknown;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as { duplicate: boolean; resume: { id: string }; analysis: { parsed: { skills?: ParsedSkill[] } } });
        return;
      }
      const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
      reject(
        new ApiException(
          xhr.status,
          err?.code ?? "UNKNOWN_ERROR",
          err?.message ?? `Upload failed with status ${xhr.status}`,
          err?.details
        )
      );
    };
    xhr.onerror = () => reject(new ApiException(0, "NETWORK_ERROR", "Network error — is the dev server still running?"));
    xhr.ontimeout = () => reject(new ApiException(0, "TIMEOUT", "The upload timed out."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export function ResumeManager({ resumes }: { resumes: ResumeRecord[] }) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState<UploadState | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [importSummary, setImportSummary] = React.useState(true);
  const [showEvidence, setShowEvidence] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragDepth = React.useRef(0);

  async function upload(file: File) {
    const problem = validateFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading({ fileName: file.name, fileSize: file.size, phase: "upload", pct: 0 });
    try {
      const res = await postResume(
        file,
        (pct) =>
          setUploading((u) => (u ? { ...u, pct, phase: pct >= 100 ? "analyse" : "upload" } : u)),
        () => setUploading((u) => (u ? { ...u, phase: "analyse", pct: 100 } : u))
      );
      if (res.duplicate) {
        toast.info("This exact PDF is already on file — showing the existing analysis.");
      } else {
        const n = res.analysis?.parsed?.skills?.length ?? 0;
        toast.success("Resume analysed", {
          description: n
            ? `${n} catalogue skill(s) detected — review them below.`
            : "No catalogue skills detected; you can still review the summary.",
        });
      }
      setReviewId(res.resume.id);
      setImportSummary(true);
      setShowEvidence(false);
      router.refresh();
      window.setTimeout(() => {
        document.getElementById(`resume-${res.resume.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function openReview(r: ResumeRecord) {
    setReviewId(r.id === reviewId ? null : r.id);
    const skills = r.parsed?.skills ?? [];
    setSelected(new Set(skills.map((s) => s.slug)));
    setImportSummary(Boolean(r.parsed?.summary));
    setShowEvidence(false);
  }

  async function confirm(r: ResumeRecord) {
    setConfirming(true);
    try {
      const res = await apiFetch<{ added: number; skipped: number; totalSkills: number }>(
        `/api/resumes/${r.id}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ skillSlugs: [...selected], importSummary }),
        }
      );
      toast.success(`Imported ${res.added} skill(s)`, {
        description: `${res.skipped} skipped (already in your profile). Profile total: ${res.totalSkills}.`,
      });
      setReviewId(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Import failed.");
    } finally {
      setConfirming(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/resumes/${id}`, { method: "DELETE" });
      toast.success("Resume deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiException ? err.message : "Delete failed.");
    }
  }

  function pickFiles(list: FileList | null | undefined) {
    const f = list?.[0];
    if (f && !uploading) void upload(f);
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => pickFiles(e.target.files)}
      />

      {/* ---- upload zone (click + real drag & drop) ---- */}
      <div
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          dragDepth.current += 1;
          setDragOver(true);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          pickFiles(e.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(uploading)}
          aria-label="Upload a PDF resume: click to choose a file, or drop a PDF here"
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 text-center transition-all disabled:opacity-60 ${
            dragOver
              ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/30"
              : "border-muted-foreground/30 bg-card hover:border-primary/50 hover:bg-accent"
          } ${uploading ? "py-8" : "py-10"}`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-5 w-5" aria-hidden />
            )}
          </span>
          {uploading ? (
            <>
              <span className="text-sm font-semibold">{uploading.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {formatBytes(uploading.fileSize)} ·{" "}
                {uploading.phase === "upload"
                  ? `uploading… ${uploading.pct}%`
                  : "PyMuPDF extracting text and matching skills…"}
              </span>
              <span className="mt-1 w-full max-w-sm">
                {uploading.phase === "upload" ? (
                  <Progress value={uploading.pct} aria-label="Upload progress" />
                ) : (
                  <span className="block h-2 w-full overflow-hidden rounded-full bg-muted">
                    <span className="block h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
                  </span>
                )}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">
                {dragOver ? "Drop it here" : "Drop a PDF resume or click to upload"}
              </span>
              <span className="text-xs text-muted-foreground">
                PDF only · max 10 MB · max 40 pages · SHA-256 de-duplication
              </span>
            </>
          )}
        </button>
      </div>

      {resumes.length === 0 ? null : (
        <div className="space-y-3">
          {resumes.map((r) => {
            const skills = r.parsed?.skills ?? [];
            const evidenceSkills = skills.filter((s) => s.evidence);
            const open = reviewId === r.id;
            const errorText = r.error ?? r.error_message;
            const summaryOn = importSummary && Boolean(r.parsed?.summary);
            const nothingToImport = selected.size === 0 && !summaryOn;
            const groups = new Map<string, ParsedSkill[]>();
            for (const s of skills) {
              const key = s.category || "Other";
              const list = groups.get(key);
              if (list) list.push(s);
              else groups.set(key, [s]);
            }
            const eduCount = Array.isArray(r.parsed?.education) ? r.parsed.education.length : 0;
            const expCount = Array.isArray(r.parsed?.experience) ? r.parsed.experience.length : 0;

            return (
              <Card key={r.id} id={`resume-${r.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()} ·{" "}
                        {r.page_count ? `${r.page_count} pages · ` : ""}
                        {formatBytes(Number(r.size_bytes))}
                      </p>
                    </div>
                    <Badge variant={r.status === "processed" ? "success" : r.status === "failed" ? "destructive" : "muted"}>
                      {prettyStatus(r.status)}
                    </Badge>
                    {r.is_active ? <Badge variant="info">Active</Badge> : null}
                    {r.reviewed ? (
                      <Badge variant="success">
                        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                        Reviewed
                      </Badge>
                    ) : null}
                    {skills.length && !r.reviewed ? (
                      <Button size="sm" onClick={() => openReview(r)} aria-expanded={open}>
                        {open ? "Close review" : `Review ${skills.length} skill(s)`}
                      </Button>
                    ) : r.parsed?.summary && !r.reviewed ? (
                      <Button size="sm" onClick={() => openReview(r)} aria-expanded={open}>
                        {open ? "Close review" : "Review summary"}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" aria-label={`Delete ${r.file_name}`} onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>

                  {errorText ? (
                    <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{errorText}</p>
                  ) : null}

                  {open ? (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {skills.length ? (
                        <div>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold">
                              Detected skills — untick anything wrong
                              <span className="ml-2 font-normal text-muted-foreground">
                                {selected.size}/{skills.length} selected
                              </span>
                            </h4>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setSelected(new Set(skills.map((s) => s.slug)))}
                                disabled={selected.size === skills.length}
                              >
                                Select all
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setSelected(new Set())}
                                disabled={selected.size === 0}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {[...groups.entries()].map(([category, list]) => (
                              <div key={category}>
                                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                  {category}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {list.map((s) => {
                                    const on = selected.has(s.slug);
                                    return (
                                      <button
                                        key={s.slug}
                                        type="button"
                                        aria-pressed={on}
                                        title={s.evidence ? `Seen in resume: ${s.evidence}` : s.name}
                                        className={badgeVariants({
                                          variant: on ? "default" : "outline",
                                        })}
                                        onClick={() =>
                                          setSelected((prev) => {
                                            const next = new Set(prev);
                                            if (on) next.delete(s.slug);
                                            else next.add(s.slug);
                                            return next;
                                          })
                                        }
                                      >
                                        {s.name}
                                        {typeof s.confidence === "number" ? (
                                          <span className="ml-1 opacity-60">{Math.round(s.confidence * 100)}%</span>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          {evidenceSkills.length ? (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => setShowEvidence((v) => !v)}
                                aria-expanded={showEvidence}
                              >
                                <Quote className="h-3 w-3" aria-hidden />
                                {showEvidence ? "Hide" : "Show"} evidence lines ({evidenceSkills.length})
                              </Button>
                              {showEvidence ? (
                                <ul className="mt-1.5 max-h-44 space-y-1.5 overflow-y-auto rounded-md border bg-muted/40 p-2.5">
                                  {evidenceSkills.map((s) => (
                                    <li key={s.slug} className="text-xs leading-relaxed">
                                      <span className="font-medium">{s.name}</span>
                                      <span className="text-muted-foreground"> — {s.evidence}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No catalogue skills were detected in this file — you can still import the summary, or add
                          skills manually in the profile editor.
                        </p>
                      )}

                      {r.parsed?.summary ? (
                        <div>
                          <h4 className="mb-1 text-sm font-semibold">Summary detected</h4>
                          <p className="text-xs leading-relaxed text-muted-foreground">{r.parsed.summary}</p>
                          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={importSummary}
                              onChange={(e) => setImportSummary(e.target.checked)}
                            />
                            Import this into my profile summary
                          </label>
                        </div>
                      ) : null}

                      {eduCount || expCount ? (
                        <p className="text-xs text-muted-foreground">
                          Also parsed: {eduCount} education {eduCount === 1 ? "entry" : "entries"} · {expCount} experience{" "}
                          {expCount === 1 ? "entry" : "entries"}
                          <span className="opacity-70"> (kept with the resume; skills and summary are what you import)</span>
                        </p>
                      ) : null}

                      <Separator />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" disabled={confirming || nothingToImport} onClick={() => confirm(r)}>
                          {confirming ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                              Importing…
                            </>
                          ) : selected.size === 0 && summaryOn ? (
                            "Import summary into my profile"
                          ) : (
                            `Import ${selected.size} skill(s) into my profile`
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReviewId(null)}>
                          Cancel
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Nothing enters your profile until you confirm.
                        </span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
