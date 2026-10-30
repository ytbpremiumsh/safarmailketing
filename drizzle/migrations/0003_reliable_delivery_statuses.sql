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

-- Note: the legacy 'safar-mail-worker' cron job does not exist on this fresh
-- database, so the original migration's cron.alter_job no-op block is omitted.
