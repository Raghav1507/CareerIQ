-- ============================================================================
-- CareerIQ — 0003 Row Level Security
-- Defence-in-depth: every user-owned table is restricted to its owner via
-- auth.uid(). Server-side code additionally scopes queries by user_id.
-- Reference data (skills, roles, resources) is publicly readable, writable
-- only by the service role (which bypasses RLS).
-- ============================================================================

-- Sync Supabase Auth sign-ups into public.users -------------------------------
do $do$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'on_auth_user_created'
       and tgrelid = 'auth.users'::regclass
  ) then
    execute $fn$
      create function public.handle_new_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        insert into public.users (id, email, full_name)
        values (
          new.id,
          new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
        )
        on conflict (id) do nothing;
        return new;
      end;
      $body$
    $fn$;

    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $do$;

-- Helper: is the current JWT subject the row owner? ---------------------------
create or replace function public.is_owner(row_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_user_id is not null and row_user_id = auth.uid();
$$;

-- Enable RLS -------------------------------------------------------------------
alter table public.users                 enable row level security;
alter table public.profiles              enable row level security;
alter table public.skills                enable row level security;
alter table public.skill_aliases         enable row level security;
alter table public.user_skills           enable row level security;
alter table public.projects              enable row level security;
alter table public.experience            enable row level security;
alter table public.certifications        enable row level security;
alter table public.resumes               enable row level security;
alter table public.resume_analyses       enable row level security;
alter table public.career_roles          enable row level security;
alter table public.role_skills           enable row level security;
alter table public.career_recommendations enable row level security;
alter table public.skill_gap_analyses    enable row level security;
alter table public.job_descriptions      enable row level security;
alter table public.job_match_results     enable row level security;
alter table public.learning_resources    enable row level security;
alter table public.learning_roadmaps     enable row level security;
alter table public.roadmap_progress      enable row level security;

-- User-owned tables ------------------------------------------------------------
create policy users_select_own on public.users
  for select using (public.is_owner(id));
create policy users_insert_own on public.users
  for insert with check (public.is_owner(id));
create policy users_update_own on public.users
  for update using (public.is_owner(id)) with check (public.is_owner(id));

create policy profiles_all_own on public.profiles
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy user_skills_all_own on public.user_skills
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy projects_all_own on public.projects
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy experience_all_own on public.experience
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy certifications_all_own on public.certifications
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy resumes_all_own on public.resumes
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy resume_analyses_all_own on public.resume_analyses
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy recommendations_all_own on public.career_recommendations
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy skill_gaps_all_own on public.skill_gap_analyses
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy job_descriptions_all_own on public.job_descriptions
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy job_match_results_all_own on public.job_match_results
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy learning_roadmaps_all_own on public.learning_roadmaps
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

create policy roadmap_progress_all_own on public.roadmap_progress
  for all using (public.is_owner(user_id)) with check (public.is_owner(user_id));

-- Reference data: read-only for clients, written by service role ---------------
create policy skills_read_all on public.skills
  for select using (true);
create policy skill_aliases_read_all on public.skill_aliases
  for select using (true);
create policy career_roles_read_all on public.career_roles
  for select using (true);
create policy role_skills_read_all on public.role_skills
  for select using (true);
create policy learning_resources_read_all on public.learning_resources
  for select using (true);
