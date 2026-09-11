-- Automatic email deliverability suppression and category management
alter table public.contacts
  add column if not exists previous_category text,
  add column if not exists suppression_kind text,
  add column if not exists suppression_reason text,
  add column if not exists suppressed_until timestamptz;

alter table public.suppressions
  add column if not exists kind text not null default 'manual',
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists contacts_suppressed_until_idx
  on public.contacts (suppressed_until)
  where suppressed_until is not null;

create index if not exists suppressions_expires_at_idx
  on public.suppressions (expires_at)
  where expires_at is not null;

create or replace function private.release_expired_soft_bounces()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_count integer := 0;
begin
  with released as (
    update public.contacts c
       set category = coalesce(nullif(c.previous_category, ''), 'Umum'),
           status = 'active',
           bounce_count = 0,
           previous_category = null,
           suppression_kind = null,
           suppression_reason = null,
           suppressed_until = null,
           updated_at = now()
     where c.suppression_kind = 'soft_bounce'
       and c.suppressed_until is not null
       and c.suppressed_until <= now()
       and c.unsubscribed_at is null
    returning c.id
  )
  select count(*)::integer into released_count from released;

  delete from public.suppressions s
   where s.kind = 'soft_bounce'
     and s.expires_at is not null
     and s.expires_at <= now();

  return released_count;
end;
$$;

revoke all on function private.release_expired_soft_bounces() from public;
revoke all on function private.release_expired_soft_bounces() from anon;
revoke all on function private.release_expired_soft_bounces() from authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job
    from cron.job
   where jobname = 'release-expired-soft-bounces'
   limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'release-expired-soft-bounces',
    '17 * * * *',
    'select private.release_expired_soft_bounces()'
  );
end
$$;

with latest_bounce as (
  select distinct on (lower(cr.email))
    cr.contact_id,
    lower(cr.email) as email,
    coalesce(nullif(cr.last_error, ''), nullif(cr.provider_message, ''), 'Bounce dilaporkan Mailketing') as reason,
    coalesce(cr.bounced_at, cr.updated_at, now()) as bounced_at
  from public.campaign_recipients cr
  where cr.status = 'bounced'
  order by lower(cr.email), coalesce(cr.bounced_at, cr.updated_at) desc nulls last
),
classified as (
  select *,
    case
      when reason ~* 'blacklist|blocked by recipient|spam complaint' then 'blacklist'
      when reason ~* '(smtp[^0-9]*4[0-9]{2}|(^|[^0-9])4\.2\.2([^0-9]|$)|(^|[^0-9])452([^0-9]|$)|mailbox full|inbox full|over.?quota|out of storage|temporar)' then 'soft_bounce'
      when reason ~* '(smtp[^0-9]*5[0-9]{2}|(^|[^0-9])5\.1\.1([^0-9]|$)|(^|[^0-9])550([^0-9]|$)|no.?such.?user|user unknown|does not exist|bad address|invalid (recipient|email)|mailbox (not found|unavailable)|domain not found)' then 'hard_bounce'
      else 'hard_bounce'
    end as kind
  from latest_bounce
)
update public.contacts c
set previous_category = case
      when coalesce(c.category, 'Umum') not in ('Email Tidak Valid','Inbox Penuh','Blacklist','Unsubscribe')
      then coalesce(c.category, 'Umum')
      else c.previous_category
    end,
    category = case classified.kind
      when 'soft_bounce' then 'Inbox Penuh'
      when 'blacklist' then 'Blacklist'
      else 'Email Tidak Valid'
    end,
    status = 'bounced',
    bounce_count = greatest(coalesce(c.bounce_count, 0), 1),
    suppression_kind = classified.kind,
    suppression_reason = classified.reason,
    suppressed_until = case when classified.kind = 'soft_bounce'
      then classified.bounced_at + interval '14 days' else null end,
    updated_at = now()
from classified
where c.id = classified.contact_id;

with latest_bounce as (
  select distinct on (lower(cr.email))
    cr.contact_id,
    lower(cr.email) as email,
    coalesce(nullif(cr.last_error, ''), nullif(cr.provider_message, ''), 'Bounce dilaporkan Mailketing') as reason,
    coalesce(cr.bounced_at, cr.updated_at, now()) as bounced_at
  from public.campaign_recipients cr
  where cr.status = 'bounced'
  order by lower(cr.email), coalesce(cr.bounced_at, cr.updated_at) desc nulls last
),
classified as (
  select *,
    case
      when reason ~* 'blacklist|blocked by recipient|spam complaint' then 'blacklist'
      when reason ~* '(smtp[^0-9]*4[0-9]{2}|(^|[^0-9])4\.2\.2([^0-9]|$)|(^|[^0-9])452([^0-9]|$)|mailbox full|inbox full|over.?quota|out of storage|temporar)' then 'soft_bounce'
      else 'hard_bounce'
    end as kind
  from latest_bounce
)
insert into public.suppressions
  (email, contact_id, reason, source, created_by, created_at, kind, expires_at, updated_at)
select email, contact_id, reason, 'mailketing_backfill', null, bounced_at, kind,
       case when kind = 'soft_bounce' then bounced_at + interval '14 days' else null end,
       now()
from classified
on conflict (email) do update
set contact_id = excluded.contact_id,
    reason = excluded.reason,
    source = excluded.source,
    kind = excluded.kind,
    expires_at = excluded.expires_at,
    updated_at = now()
where public.suppressions.kind <> 'unsubscribe'
  and lower(public.suppressions.reason) <> 'unsubscribe';

select private.release_expired_soft_bounces();
