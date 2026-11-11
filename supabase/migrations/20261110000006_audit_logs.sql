-- Phase 9: audit logging — every sensitive mutation is recorded (service-role writes only).
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete set null,
  action      text not null,
  resource    text not null,
  resource_id text,
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_user_idx
  on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

-- Users may read their own audit trail. No insert/update/delete policy exists,
-- so only the service role / connection owner (web server) can write.
create policy audit_logs_select_own
  on public.audit_logs for select
  using (auth.uid() = user_id);
