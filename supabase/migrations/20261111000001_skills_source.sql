-- ============================================================================
-- CareerIQ — 0008 Phase 8: skill provenance for the semantic safety net
--
-- skills.source records WHERE a catalogue skill came from:
--   m1_curated — shipped by the seed migration (the official 78-skill set)
--   user       — created by a profile's custom-skill fallback
--
-- The pgvector cosine re-ranking behind the alias matcher only lets *user*
-- skills act as bridges to a role's missing skills, so curated skills can
-- never inflate a score through semantic similarity.
-- ============================================================================

alter table public.skills
  add column if not exists source text not null default 'm1_curated';

alter table public.skills
  drop constraint if exists skills_source_check;

alter table public.skills
  add constraint skills_source_check
  check (source in ('m1_curated', 'user'));

comment on column public.skills.source is
  'Provenance: m1_curated = seeded M1 catalogue, user = added from a profile (custom-skill fallback).';

-- Backfill: custom skills are recognisable by their creation description
-- (see app/api/profile/skills/route.ts step 3).
update public.skills
   set source = 'user'
 where source = 'm1_curated'
   and description = 'Added by a user (not part of the seeded M1 catalogue)';
