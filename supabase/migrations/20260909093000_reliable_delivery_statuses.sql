-- Reliable Mailketing delivery states.
-- Delivery is now processed by the authenticated dashboard worker; the legacy
-- pg_net worker is disabled because request IDs are not delivery confirmations.
alter type public.recipient_status add value if not exists 'delivered';
alter type public.recipient_status add value if not exists 'bounced';
alter type public.recipient_status add value if not exists 'rejected';

alter table public.campaign_recipients
  add column if not exists provider_response jsonb,
  add column if not exists provider_status_code integer,
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists rejected_at timestamptz;

do $$
declare worker_job_id bigint;
begin
  select jobid into worker_job_id
  from cron.job
  where jobname = 'safar-mail-worker';

  if worker_job_id is not null then
    perform cron.alter_job(job_id := worker_job_id, active := false);
  end if;
end
$$;
