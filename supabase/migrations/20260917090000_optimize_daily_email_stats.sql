-- Keep daily dashboard statistics comfortably below the PostgREST statement timeout.
-- Each event branch can now use a narrow partial index instead of repeatedly
-- scanning the full campaign_recipients table.
create index if not exists campaign_recipients_sent_at_idx
  on public.campaign_recipients (sent_at)
  where sent_at is not null;

create index if not exists campaign_recipients_delivered_at_idx
  on public.campaign_recipients (delivered_at)
  where delivered_at is not null;

create index if not exists campaign_recipients_first_open_at_idx
  on public.campaign_recipients ((coalesce(
    least(internal_opened_at, provider_opened_at),
    internal_opened_at,
    provider_opened_at
  )))
  where internal_opened_at is not null or provider_opened_at is not null;

create index if not exists campaign_recipients_first_click_at_idx
  on public.campaign_recipients ((coalesce(
    least(internal_first_clicked_at, provider_first_clicked_at),
    internal_first_clicked_at,
    provider_first_clicked_at
  )))
  where internal_first_clicked_at is not null or provider_first_clicked_at is not null;

create index if not exists campaign_recipients_bounced_at_idx
  on public.campaign_recipients (bounced_at)
  where bounced_at is not null;

create index if not exists campaign_recipients_rejected_at_idx
  on public.campaign_recipients (rejected_at)
  where rejected_at is not null;

create index if not exists campaign_recipients_failed_updated_idx
  on public.campaign_recipients (updated_at)
  where status = 'failed';

create or replace function public.get_daily_email_stats(p_days integer default 14)
returns table (
  day date,
  sent bigint,
  delivered bigint,
  opened bigint,
  clicked bigint,
  bounced bigint,
  rejected bigint,
  failed bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with params as (
    select
      greatest(1, least(coalesce(p_days, 14), 90))::integer as days,
      (now() at time zone 'Asia/Jakarta')::date as today
  ),
  bounds as (
    select
      p.days,
      p.today,
      ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta') as cutoff
    from params p
  ),
  date_range as (
    select generate_series(
      b.today - (b.days - 1),
      b.today,
      interval '1 day'
    )::date as day
    from bounds b
  ),
  events as (
    select (cr.sent_at at time zone 'Asia/Jakarta')::date as day, 'sent'::text as metric
    from public.campaign_recipients cr cross join bounds b
    where cr.sent_at >= b.cutoff
    union all
    select (cr.delivered_at at time zone 'Asia/Jakarta')::date, 'delivered'
    from public.campaign_recipients cr cross join bounds b
    where cr.delivered_at >= b.cutoff
    union all
    select (coalesce(
      least(cr.internal_opened_at, cr.provider_opened_at),
      cr.internal_opened_at,
      cr.provider_opened_at
    ) at time zone 'Asia/Jakarta')::date, 'opened'
    from public.campaign_recipients cr cross join bounds b
    where coalesce(
      least(cr.internal_opened_at, cr.provider_opened_at),
      cr.internal_opened_at,
      cr.provider_opened_at
    ) >= b.cutoff
    union all
    select (coalesce(
      least(cr.internal_first_clicked_at, cr.provider_first_clicked_at),
      cr.internal_first_clicked_at,
      cr.provider_first_clicked_at
    ) at time zone 'Asia/Jakarta')::date, 'clicked'
    from public.campaign_recipients cr cross join bounds b
    where coalesce(
      least(cr.internal_first_clicked_at, cr.provider_first_clicked_at),
      cr.internal_first_clicked_at,
      cr.provider_first_clicked_at
    ) >= b.cutoff
    union all
    select (cr.bounced_at at time zone 'Asia/Jakarta')::date, 'bounced'
    from public.campaign_recipients cr cross join bounds b
    where cr.bounced_at >= b.cutoff
    union all
    select (cr.rejected_at at time zone 'Asia/Jakarta')::date, 'rejected'
    from public.campaign_recipients cr cross join bounds b
    where cr.rejected_at >= b.cutoff
    union all
    select (cr.updated_at at time zone 'Asia/Jakarta')::date, 'failed'
    from public.campaign_recipients cr cross join bounds b
    where cr.status = 'failed' and cr.updated_at >= b.cutoff
  ),
  totals as (
    select
      e.day,
      count(*) filter (where e.metric = 'sent')::bigint as sent,
      count(*) filter (where e.metric = 'delivered')::bigint as delivered,
      count(*) filter (where e.metric = 'opened')::bigint as opened,
      count(*) filter (where e.metric = 'clicked')::bigint as clicked,
      count(*) filter (where e.metric = 'bounced')::bigint as bounced,
      count(*) filter (where e.metric = 'rejected')::bigint as rejected,
      count(*) filter (where e.metric = 'failed')::bigint as failed
    from events e
    group by e.day
  )
  select
    d.day,
    coalesce(t.sent, 0)::bigint,
    coalesce(t.delivered, 0)::bigint,
    coalesce(t.opened, 0)::bigint,
    coalesce(t.clicked, 0)::bigint,
    coalesce(t.bounced, 0)::bigint,
    coalesce(t.rejected, 0)::bigint,
    coalesce(t.failed, 0)::bigint
  from date_range d
  left join totals t using (day)
  order by d.day;
$function$;

revoke all on function public.get_daily_email_stats(integer) from public, anon;
grant execute on function public.get_daily_email_stats(integer) to authenticated, service_role;
