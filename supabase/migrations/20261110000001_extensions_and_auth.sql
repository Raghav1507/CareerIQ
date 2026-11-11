-- ============================================================================
-- CareerIQ — 0001 extensions & auth compatibility layer
-- Works on BOTH hosted Supabase and plain PostgreSQL (docker-compose db).
-- ============================================================================

create extension if not exists vector;
create extension if not exists citext;

-- On hosted Supabase, `auth.users` and `auth.uid()` already exist and must not
-- be touched. On plain PostgreSQL they are created as a minimal compatibility
-- shim so that the schema, foreign keys and RLS policies are identical in both
-- environments.
do $do$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;

  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $fnbody$
        select nullif(
          coalesce(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
          ''
        )::uuid
      $fnbody$
    $fn$;
  end if;

  if to_regclass('auth.users') is null then
    create table auth.users (
      id         uuid primary key default gen_random_uuid(),
      email      citext unique,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz not null default now(),
      deleted_at timestamptz
    );
  end if;
end $do$;

-- updated_at maintenance -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
