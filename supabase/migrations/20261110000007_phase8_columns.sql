-- ============================================================================
-- CareerIQ — 0007 Phase 8 columns
--   skills.esco_code            ← official ESCO skill concept code (imported,
--                                 never fabricated; null until the pipeline runs)
--   skill_gap_analyses.model_used ← provenance of the gap advice text
--                                  (Gemini model, or null for deterministic)
-- ============================================================================

alter table public.skills
  add column if not exists esco_code text;

create index if not exists skills_esco_code_idx
  on public.skills (esco_code)
  where esco_code is not null;

alter table public.skill_gap_analyses
  add column if not exists model_used text;
