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

do $$
declare
  worker_secret text;
  worker_hash text;
begin
  select decrypted_secret
    into worker_secret
  from vault.decrypted_secrets
  where name = 'safar_queue_worker_secret';

  if worker_secret is null then
    worker_secret := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      worker_secret,
      'safar_queue_worker_secret',
      'Kunci internal Cron untuk worker antrean Safar Mail'
    );
  end if;

  worker_hash := encode(
    extensions.digest(worker_secret, 'sha256'),
    'hex'
  );

  insert into public.queue_worker_config (
    id, secret_hash, active, batch_size, max_attempts
  )
  values (true, worker_hash, true, 20, 3)
  on conflict (id) do update
  set secret_hash = excluded.secret_hash,
      active = true,
      batch_size = 20,
      max_attempts = 3,
      updated_at = now();
end
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'safar-mail-queue-worker';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'safar-mail-queue-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://tbfndctalcrsebgocoto.supabase.co/functions/v1/mailketing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-queue-key', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'safar_queue_worker_secret'
        )
      ),
      body := '{"action":"process-queue","background":true}'::jsonb,
      timeout_milliseconds := 55000
    ) as request_id;
  $job$
);
