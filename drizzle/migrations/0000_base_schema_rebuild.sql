-- Base schema for Safar Mail (reconstructed for the new Lovable Cloud project).
-- The original base migration was applied directly to the previous database and
-- never committed; this file rebuilds it from the application and edge-function
-- contracts. Later migrations in supabase/migrations extend these tables.

-- ============ Enum types ============
create type public.campaign_status as enum
  ('draft', 'scheduled', 'processing', 'paused', 'completed', 'partial', 'failed', 'cancelled');

create type public.recipient_status as enum
  ('pending', 'processing', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'rejected', 'cancelled');

-- ============ Private schema ============
create schema if not exists private;
revoke all on schema private from anon, authenticated, public;

-- ============ Profiles (created before helper functions) ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile on signup. The very first profile bootstraps as an
-- active admin so a fresh database has someone who can manage the app; every
-- later signup starts inactive and must be activated by an admin.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    lower(trim(new.email)),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when is_first then 'admin' else 'operator' end,
    is_first
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ============ Helper functions (after profiles exists) ============
create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active
  )
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role = 'admin'
  )
$$;

grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ============ Contacts ============
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  registration_code text,
  full_name text,
  first_name text,
  last_name text,
  mobile text,
  category text not null default 'Umum',
  created_by uuid,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "contacts_staff_all"
on public.contacts for all
to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;

-- ============ Templates ============
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  html_content text not null,
  category text not null default 'Umum',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.templates enable row level security;

create policy "templates_staff_all"
on public.templates for all
to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

grant select, insert, update, delete on public.templates to authenticated;
grant all on public.templates to service_role;

-- ============ Campaigns ============
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  html_content text not null,
  from_name text,
  from_email text,
  attachments jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz,
  status public.campaign_status not null default 'draft',
  total_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "campaigns_staff_select"
on public.campaigns for select
to authenticated
using ((select private.is_active_staff()));

create policy "campaigns_staff_insert"
on public.campaigns for insert
to authenticated
with check ((select private.is_active_staff()));

create policy "campaigns_staff_update"
on public.campaigns for update
to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

create policy "campaigns_admin_delete"
on public.campaigns for delete
to authenticated
using ((select private.is_admin()));

grant select, insert, update on public.campaigns to authenticated;
grant all on public.campaigns to service_role;

-- ============ Campaign recipients ============
create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  email text not null,
  variables jsonb not null default '{}'::jsonb,
  status public.recipient_status not null default 'pending',
  attempts integer not null default 0,
  message_id text,
  last_error text,
  provider_message text,
  sent_at timestamptz,
  queued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaign_recipients enable row level security;

create policy "campaign_recipients_staff_select"
on public.campaign_recipients for select
to authenticated
using ((select private.is_active_staff()));

create policy "campaign_recipients_staff_insert"
on public.campaign_recipients for insert
to authenticated
with check ((select private.is_active_staff()));

create policy "campaign_recipients_staff_update"
on public.campaign_recipients for update
to authenticated
using ((select private.is_active_staff()))
with check ((select private.is_active_staff()));

grant select, insert, update on public.campaign_recipients to authenticated;
grant all on public.campaign_recipients to service_role;

-- ============ Audit logs ============
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "audit_logs_admin_select"
on public.audit_logs for select
to authenticated
using ((select private.is_admin()));

create policy "audit_logs_staff_insert"
on public.audit_logs for insert
to authenticated
with check ((select private.is_active_staff()));

grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

-- ============ App settings (singleton) ============
create table public.app_settings (
  id boolean primary key default true check (id),
  default_from_name text,
  default_from_email text,
  available_senders jsonb not null default '[]'::jsonb,
  corporate_mode boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create policy "app_settings_staff_select"
on public.app_settings for select
to authenticated
using ((select private.is_active_staff()));

grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

-- ============ Mailketing token (secret storage + RPC) ============
-- The token must never be readable through the Data API, so it lives in the
-- private schema and is touched only through SECURITY DEFINER functions.
create table private.mailketing_token (
  id boolean primary key default true check (id),
  token text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into private.mailketing_token (id) values (true) on conflict (id) do nothing;

create or replace function public.read_mailketing_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select token from private.mailketing_token where id = true
$$;

create or replace function public.store_mailketing_token(p_token text, p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.mailketing_token (id, token, updated_by, updated_at)
  values (true, nullif(trim(p_token), ''), p_user_id, now())
  on conflict (id) do update
    set token = excluded.token,
        updated_by = excluded.updated_by,
        updated_at = now()
$$;

revoke all on function public.read_mailketing_token() from public, anon, authenticated;
revoke all on function public.store_mailketing_token(text, uuid) from public, anon, authenticated;
grant execute on function public.read_mailketing_token() to service_role;
grant execute on function public.store_mailketing_token(text, uuid) to service_role;

notify pgrst, 'reload schema';
