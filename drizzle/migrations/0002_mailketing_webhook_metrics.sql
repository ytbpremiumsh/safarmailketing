-- Use official Mailketing webhook events as the displayed open/click source.
alter table public.campaign_recipients
  add column if not exists provider_opened_at timestamptz,
  add column if not exists provider_first_clicked_at timestamptz,
  add column if not exists provider_open_count integer not null default 0,
  add column if not exists provider_click_count integer not null default 0,
  add column if not exists internal_opened_at timestamptz,
  add column if not exists internal_first_clicked_at timestamptz,
  add column if not exists internal_open_count integer not null default 0,
  add column if not exists internal_click_count integer not null default 0;

alter table public.email_events
  add column if not exists source text not null default 'internal',
  add column if not exists event_key text,
  add column if not exists provider_payload jsonb;

create unique index if not exists email_events_event_key_unique
  on public.email_events(event_key) where event_key is not null;

create table if not exists public.mailketing_webhook_config (
  id boolean primary key default true check (id),
  secret_hash text not null,
  active boolean not null default true,
  last_event_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mailketing_webhook_config enable row level security;
revoke all on public.mailketing_webhook_config from anon, authenticated;

-- Configure secret_hash separately in each environment; never commit the secret.
