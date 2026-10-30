alter table public.campaign_recipients
  add column if not exists next_attempt_at timestamptz;

create index if not exists campaign_recipients_pending_worker_idx
  on public.campaign_recipients (campaign_id, next_attempt_at, updated_at)
  where status = 'pending';

create table if not exists public.queue_worker_config (
  id boolean primary key default true check (id),
  secret_hash text not null,
  active boolean not null default true,
  batch_size integer not null default 20 check (batch_size between 1 and 50),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_processed integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.queue_worker_config enable row level security;
revoke all on public.queue_worker_config from anon, authenticated;

create table if not exists public.queue_worker_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  processed_count integer not null default 0,
  sent_count integer not null default 0,
  retry_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'running'
    check (status in ('running','completed','failed')),
  error_message text
);

alter table public.queue_worker_runs enable row level security;
grant select on public.queue_worker_runs to authenticated;

drop policy if exists "queue_worker_runs_admin_select" on public.queue_worker_runs;
create policy "queue_worker_runs_admin_select"
on public.queue_worker_runs for select
to authenticated
using ((select private.is_admin()));

-- The queue worker secret and its cron schedule are provisioned separately:
-- the hash below matches the QUEUE_WORKER_KEY app secret, and the managed
-- HTTP schedule hits /api/public/jobs/process-queue every minute.
insert into public.queue_worker_config (id, secret_hash, active, batch_size, max_attempts)
values (true, encode(extensions.digest(decode('','hex'),'sha256'), 'hex'), true, 20, 3)
on conflict (id) do update
  set active = true,
      batch_size = 20,
      max_attempts = 3,
      updated_at = now();
