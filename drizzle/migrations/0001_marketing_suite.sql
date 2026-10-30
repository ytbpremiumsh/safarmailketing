alter type public.campaign_status add value if not exists 'paused';

alter table public.contacts
  add column if not exists status text not null default 'active',
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists bounce_count integer not null default 0,
  add column if not exists last_engaged_at timestamptz;

alter table public.templates
  add column if not exists category text not null default 'Umum';

alter table public.campaigns
  add column if not exists idempotency_key text,
  add column if not exists paused_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists opened_count integer not null default 0,
  add column if not exists clicked_count integer not null default 0;

alter table public.campaign_recipients
  add column if not exists opened_at timestamptz,
  add column if not exists first_clicked_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists click_count integer not null default 0;

create unique index if not exists campaigns_idempotency_key_idx
  on public.campaigns(idempotency_key) where idempotency_key is not null;
create index if not exists contacts_status_idx on public.contacts(status);
create index if not exists contacts_category_status_idx on public.contacts(category,status);
create index if not exists templates_category_idx on public.templates(category);

create table if not exists public.suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text not null default 'manual',
  source text not null default 'manual',
  contact_id uuid references public.contacts(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.suppressions enable row level security;
create policy suppressions_staff_select on public.suppressions for select to authenticated using (private.is_active_staff());
create policy suppressions_staff_insert on public.suppressions for insert to authenticated with check (private.is_active_staff() and created_by=(select auth.uid()));
create policy suppressions_staff_delete on public.suppressions for delete to authenticated using (private.is_active_staff());
grant select, insert, delete on public.suppressions to authenticated;
grant all on public.suppressions to service_role;

create table if not exists public.template_versions (
  id bigint generated always as identity primary key,
  template_id uuid not null references public.templates(id) on delete cascade,
  name text not null,
  subject text not null,
  html_content text not null,
  version_number integer not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(template_id, version_number)
);
alter table public.template_versions enable row level security;
create policy template_versions_staff_select on public.template_versions for select to authenticated using (private.is_active_staff());
create policy template_versions_staff_insert on public.template_versions for insert to authenticated with check (private.is_active_staff() and created_by=(select auth.uid()));
grant select, insert on public.template_versions to authenticated;
grant usage, select on sequence public.template_versions_id_seq to authenticated;
grant all on public.template_versions to service_role;

create table if not exists public.email_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  recipient_id uuid not null references public.campaign_recipients(id) on delete cascade,
  event_type text not null check (event_type in ('open','click')),
  target_url text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists email_events_campaign_type_idx on public.email_events(campaign_id,event_type);
create index if not exists email_events_recipient_idx on public.email_events(recipient_id);
alter table public.email_events enable row level security;
create policy email_events_staff_select on public.email_events for select to authenticated using (private.is_active_staff());
grant select on public.email_events to authenticated;
grant usage, select on sequence public.email_events_id_seq to authenticated;
grant all on public.email_events to service_role;

notify pgrst, 'reload schema';
