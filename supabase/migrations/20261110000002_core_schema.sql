-- ============================================================================
-- CareerIQ — 0002 core schema
-- Tables cover the full M1 data model (profiles, skills, resumes, roles,
-- recommendations, skill gaps, jobs, roadmaps, resources).
-- ============================================================================

-- 1. Users ------------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       citext not null unique,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- 2. Profiles (career profile / onboarding) --------------------------------------
create table public.profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.users (id) on delete cascade,
  headline           text,
  summary            text,
  education          jsonb not null default '[]'::jsonb,   -- [{degree, field, institution, start, end, gpa}]
  interests          text[] not null default '{}',
  career_goals       text[] not null default '{}',
  experience_level   text not null default 'entry'
                     check (experience_level in ('entry','junior','mid','senior','lead')),
  years_experience   numeric(4,1) not null default 0 check (years_experience >= 0),
  location           text,
  preferred_roles    text[] not null default '{}',          -- slugs of the ten M1 roles
  target_role_slug   text,                                  -- selected target role
  onboarding_complete boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_user_id_idx on public.profiles (user_id);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. Skills + aliases ------------------------------------------------------------
create table public.skills (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  category     text not null
               check (category in ('language','frontend','backend','database','data',
                                   'ml_ai','devops','security','tooling','soft_skill')),
  description  text,
  is_technical boolean not null default true,
  embedding    vector(384),
  created_at   timestamptz not null default now()
);
create index skills_embedding_idx on public.skills
  using hnsw (embedding vector_cosine_ops);
create index skills_category_idx on public.skills (category);

create table public.skill_aliases (
  id         uuid primary key default gen_random_uuid(),
  skill_id   uuid not null references public.skills (id) on delete cascade,
  alias      text not null,
  alias_norm text not null,                    -- lower-cased, punctuation-stripped
  unique (alias_norm)
);
create index skill_aliases_skill_id_idx on public.skill_aliases (skill_id);
create index skill_aliases_norm_idx on public.skill_aliases (alias_norm);

-- 4. User skills ------------------------------------------------------------------
create table public.user_skills (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  skill_id          uuid not null references public.skills (id) on delete cascade,
  proficiency       text not null default 'intermediate'
                    check (proficiency in ('beginner','intermediate','advanced','expert')),
  years_experience  numeric(4,1) not null default 0 check (years_experience >= 0),
  source            text not null default 'manual'
                    check (source in ('manual','resume','import')),
  confidence        numeric(4,3) not null default 1.0
                    check (confidence between 0 and 1),
  created_at        timestamptz not null default now(),
  unique (user_id, skill_id)
);
create index user_skills_user_id_idx on public.user_skills (user_id);
create index user_skills_skill_id_idx on public.user_skills (skill_id);

-- 5. Projects & experience --------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  name         text not null,
  description  text,
  technologies text[] not null default '{}',
  url          text,
  start_date   date,
  end_date     date,
  order_index  int not null default 0,
  source       text not null default 'manual' check (source in ('manual','resume')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index projects_user_id_idx on public.projects (user_id);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.experience (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  company      text not null,
  title        text not null,
  description  text,
  skills       text[] not null default '{}',
  start_date   date not null,
  end_date     date,
  is_current   boolean not null default false,
  order_index  int not null default 0,
  source       text not null default 'manual' check (source in ('manual','resume')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index experience_user_id_idx on public.experience (user_id);
create trigger experience_set_updated_at before update on public.experience
  for each row execute function public.set_updated_at();

create table public.certifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  name          text not null,
  issuer        text,
  issue_date    date,
  expiry_date   date,
  credential_id text,
  url           text,
  source        text not null default 'manual' check (source in ('manual','resume')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index certifications_user_id_idx on public.certifications (user_id);
create trigger certifications_set_updated_at before update on public.certifications
  for each row execute function public.set_updated_at();

-- 6. Resumes & analyses -----------------------------------------------------------
create table public.resumes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  file_name      text not null,
  storage_path   text not null,               -- private bucket path: {user_id}/{uuid}.pdf
  mime_type      text not null default 'application/pdf',
  size_bytes     bigint not null check (size_bytes > 0),
  page_count     int,
  sha256         text,                        -- de-duplication / integrity
  status         text not null default 'uploaded'
                 check (status in ('uploaded','processing','processed','failed')),
  is_active      boolean not null default false,
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index resumes_user_id_idx on public.resumes (user_id);
create trigger resumes_set_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();

create table public.resume_analyses (
  id               uuid primary key default gen_random_uuid(),
  resume_id        uuid not null references public.resumes (id) on delete cascade,
  user_id          uuid not null references public.users (id) on delete cascade,
  status           text not null default 'pending'
                   check (status in ('pending','running','completed','failed')),
  -- structured extraction awaiting user review:
  -- {skills:[{name, normalized, category, confidence, evidence}],
  --  education:[...], experience:[...], projects:[...], certifications:[...],
  --  interests:[...], summary:string}
  parsed           jsonb not null default '{}'::jsonb,
  raw_text_excerpt text,
  model_used       text,
  warning          text,
  error            text,
  reviewed         boolean not null default false,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index resume_analyses_resume_id_idx on public.resume_analyses (resume_id);
create index resume_analyses_user_id_idx on public.resume_analyses (user_id);

-- 7. Career roles (the ten M1 roles) ----------------------------------------------
create table public.career_roles (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  category       text not null
                 check (category in ('software','frontend','backend','data','ml_ai','devops','security')),
  description    text not null,
  responsibilities text[] not null default '{}',
  onet_codes     text[] not null default '{}',   -- O*NET-SOC codes
  esco_codes     text[] not null default '{}',   -- ESCO codes (imported dataset)
  embedding      vector(384),
  is_active      boolean not null default true,
  display_order  int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index career_roles_embedding_idx on public.career_roles
  using hnsw (embedding vector_cosine_ops);
create trigger career_roles_set_updated_at before update on public.career_roles
  for each row execute function public.set_updated_at();

create table public.role_skills (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid not null references public.career_roles (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete cascade,
  is_required boolean not null default false,
  weight      numeric(4,2) not null default 1.0 check (weight > 0),
  source      text not null default 'm1_curated'
              check (source in ('m1_curated','esco','onet','derived')),
  created_at  timestamptz not null default now(),
  unique (role_id, skill_id)
);
create index role_skills_role_id_idx on public.role_skills (role_id);
create index role_skills_skill_id_idx on public.role_skills (skill_id);
create index role_skills_role_required_idx on public.role_skills (role_id, is_required);

-- 8. Career recommendations --------------------------------------------------------
create table public.career_recommendations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  role_id            uuid not null references public.career_roles (id) on delete cascade,
  match_score        numeric(5,2) not null check (match_score between 0 and 100),
  ranked_position    int not null,
  weighted_matched   numeric(8,2) not null default 0,   -- numerator of M1 formula
  weighted_required  numeric(8,2) not null default 0,   -- denominator of M1 formula
  matched_required   jsonb not null default '[]'::jsonb,
  missing_required   jsonb not null default '[]'::jsonb,
  matched_optional   jsonb not null default '[]'::jsonb,
  missing_optional   jsonb not null default '[]'::jsonb,
  semantic_matches   jsonb not null default '[]'::jsonb,
  explanation        text,                             -- LLM-generated, advisory
  evidence           jsonb not null default '{}'::jsonb,
  model_used         text,
  is_target_role     boolean not null default false,
  computed_at        timestamptz not null default now(),
  unique (user_id, role_id, computed_at)
);
create index career_recommendations_user_idx
  on public.career_recommendations (user_id, computed_at desc);
create index career_recommendations_role_idx on public.career_recommendations (role_id);

-- 9. Skill-gap analyses ------------------------------------------------------------
create table public.skill_gap_analyses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  role_id            uuid not null references public.career_roles (id) on delete cascade,
  recommendation_id  uuid references public.career_recommendations (id) on delete set null,
  gap_score          numeric(5,2) not null check (gap_score between 0 and 100),
  matched_required   jsonb not null default '[]'::jsonb,
  missing_required   jsonb not null default '[]'::jsonb,
  matched_optional   jsonb not null default '[]'::jsonb,
  missing_optional   jsonb not null default '[]'::jsonb,
  advice             text,                            -- LLM-generated, advisory
  created_at         timestamptz not null default now()
);
create index skill_gap_analyses_user_idx
  on public.skill_gap_analyses (user_id, created_at desc);

-- 10. Job descriptions & match results ---------------------------------------------
create table public.job_descriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  title             text,
  company           text,
  source            text not null default 'paste'
                    check (source in ('paste','upload')),
  raw_text          text not null,
  extracted_skills  jsonb not null default '[]'::jsonb,
  embedding         vector(384),
  created_at        timestamptz not null default now()
);
create index job_descriptions_user_idx on public.job_descriptions (user_id, created_at desc);
create index job_descriptions_embedding_idx on public.job_descriptions
  using hnsw (embedding vector_cosine_ops);

create table public.job_match_results (
  id                 uuid primary key default gen_random_uuid(),
  job_description_id uuid not null references public.job_descriptions (id) on delete cascade,
  user_id            uuid not null references public.users (id) on delete cascade,
  role_id            uuid references public.career_roles (id) on delete set null,
  compatibility_score numeric(5,2) not null check (compatibility_score between 0 and 100),
  formula            jsonb not null default '{}'::jsonb,
                     -- {weighted_matched, weighted_required, weights:{required, optional}}
  matched_skills     jsonb not null default '[]'::jsonb,
  missing_skills     jsonb not null default '[]'::jsonb,
  explanation        text,
  model_used         text,
  created_at         timestamptz not null default now()
);
create index job_match_results_user_idx on public.job_match_results (user_id, created_at desc);

-- 11. Learning resources & roadmaps ------------------------------------------------
create table public.learning_resources (
  id             uuid primary key default gen_random_uuid(),
  skill_id       uuid references public.skills (id) on delete set null,
  title          text not null,
  description    text,
  resource_type  text not null
                 check (resource_type in ('course','documentation','article','video',
                                          'project','certification','book')),
  url            text not null,
  provider       text,
  difficulty     text not null default 'beginner'
                 check (difficulty in ('beginner','intermediate','advanced')),
  duration_hours numeric(6,1) check (duration_hours >= 0),
  tags           text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index learning_resources_skill_idx on public.learning_resources (skill_id);

create table public.learning_roadmaps (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  role_id       uuid not null references public.career_roles (id) on delete cascade,
  title         text not null,
  horizon_weeks int not null default 12 check (horizon_weeks between 1 and 104),
  status        text not null default 'active'
                check (status in ('active','completed','archived')),
  -- plan: [{week, title, objectives[], items:[{key, skill, resource_ids[], est_hours}]}]
  plan          jsonb not null default '[]'::jsonb,
  model_used    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index learning_roadmaps_user_idx on public.learning_roadmaps (user_id, created_at desc);
create trigger learning_roadmaps_set_updated_at before update on public.learning_roadmaps
  for each row execute function public.set_updated_at();

create table public.roadmap_progress (
  id           uuid primary key default gen_random_uuid(),
  roadmap_id   uuid not null references public.learning_roadmaps (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  item_key     text not null,
  skill_id     uuid references public.skills (id) on delete set null,
  status       text not null default 'not_started'
               check (status in ('not_started','in_progress','completed')),
  notes        text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (roadmap_id, item_key)
);
create index roadmap_progress_user_idx on public.roadmap_progress (user_id);
create trigger roadmap_progress_set_updated_at before update on public.roadmap_progress
  for each row execute function public.set_updated_at();
