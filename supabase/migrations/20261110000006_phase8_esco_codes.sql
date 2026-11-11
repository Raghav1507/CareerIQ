-- ============================================================================
-- CareerIQ — 0006 Phase 8: ESCO skill codes
-- career_roles.esco_codes already exists (0002) and is filled by
-- scripts/import-esco.mjs from the official ESCO web-service API.
-- Skills had no code column; add one so each catalogue skill can carry the
-- ESCO concept URI it was matched to. NULL means "no confident ESCO match" --
-- we never fabricate codes.
-- ============================================================================

alter table public.skills
  add column if not exists esco_code text;

comment on column public.skills.esco_code is
  'Official ESCO skill concept URI (http://data.europa.eu/esco/skill/<uuid>); NULL when no exact label match exists in the ESCO dataset.';

create index if not exists skills_esco_code_idx
  on public.skills (esco_code)
  where esco_code is not null;
