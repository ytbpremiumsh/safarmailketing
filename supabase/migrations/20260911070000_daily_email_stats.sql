-- Daily email delivery statistics for the authenticated staff dashboard.
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
  date_range as (
    select generate_series(
      p.today - (p.days - 1),
      p.today,
      interval '1 day'
    )::date as day
    from params p
  ),
  events as (
    select (cr.sent_at at time zone 'Asia/Jakarta')::date as day, 'sent'::text as metric
    from public.campaign_recipients cr, params p
    where cr.sent_at >= ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta')
    union all
    select (cr.delivered_at at time zone 'Asia/Jakarta')::date, 'delivered'
    from public.campaign_recipients cr, params p
    where cr.delivered_at >= ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta')
    union all
    select (
      coalesce(
        least(cr.internal_opened_at, cr.provider_opened_at),
        cr.internal_opened_at,
        cr.provider_opened_at
      ) at time zone 'Asia/Jakarta'
    )::date, 'opened'
    from public.campaign_recipients cr, params p
    where coalesce(
      least(cr.internal_opened_at, cr.provider_opened_at),
      cr.internal_opened_at,
      cr.provider_opened_at
    ) >= ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta')
    union all
    select (
      coalesce(
        least(cr.internal_first_clicked_at, cr.provider_first_clicked_at),
        cr.internal_first_clicked_at,
        cr.provider_first_clicked_at
      ) at time zone 'Asia/Jakarta'
    )::date, 'clicked'
    from public.campaign_recipients cr, params p
    where coalesce(
      least(cr.internal_first_clicked_at, cr.provider_first_clicked_at),
      cr.internal_first_clicked_at,
      cr.provider_first_clicked_at
    ) >= ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta')
    union all
    select (cr.bounced_at at time zone 'Asia/Jakarta')::date, 'bounced'
    from public.campaign_recipients cr, params p
    where cr.bounced_at >= ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta')
    union all
    select (cr.rejected_at at time zone 'Asia/Jakarta')::date, 'rejected'
    from public.campaign_recipients cr, params p
    where cr.rejected_at >= ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta')
    union all
    select (cr.updated_at at time zone 'Asia/Jakarta')::date, 'failed'
    from public.campaign_recipients cr, params p
    where cr.status = 'failed'
      and cr.updated_at >= ((p.today - (p.days - 1))::timestamp at time zone 'Asia/Jakarta')
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