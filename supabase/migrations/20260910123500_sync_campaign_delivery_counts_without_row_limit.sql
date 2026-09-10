-- Keep campaign delivery counters synchronized for campaigns of any size.
-- COUNT runs inside Postgres and is not affected by the REST 1,000-row response limit.
create or replace function private.refresh_campaign_delivery_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.campaigns c
  set
    sent_count = (
      select count(*)::integer
      from public.campaign_recipients cr
      where cr.campaign_id = new.campaign_id
        and cr.status in ('queued', 'sent', 'delivered')
    ),
    opened_count = (
      select count(*)::integer
      from public.campaign_recipients cr
      where cr.campaign_id = new.campaign_id
        and (cr.internal_opened_at is not null or cr.provider_opened_at is not null)
    ),
    clicked_count = (
      select count(*)::integer
      from public.campaign_recipients cr
      where cr.campaign_id = new.campaign_id
        and (cr.internal_first_clicked_at is not null or cr.provider_first_clicked_at is not null)
    ),
    failed_count = (
      select count(*)::integer
      from public.campaign_recipients cr
      where cr.campaign_id = new.campaign_id
        and cr.status in ('failed', 'bounced', 'rejected')
    ),
    updated_at = now()
  where c.id = new.campaign_id;
  return new;
end
$function$;

update public.campaigns c
set
  sent_count = m.sent_count,
  failed_count = m.failed_count,
  opened_count = m.opened_count,
  clicked_count = m.clicked_count,
  updated_at = now()
from (
  select
    cr.campaign_id,
    count(*) filter (where cr.status in ('queued', 'sent', 'delivered'))::integer as sent_count,
    count(*) filter (where cr.status in ('failed', 'bounced', 'rejected'))::integer as failed_count,
    count(*) filter (where cr.internal_opened_at is not null or cr.provider_opened_at is not null)::integer as opened_count,
    count(*) filter (where cr.internal_first_clicked_at is not null or cr.provider_first_clicked_at is not null)::integer as clicked_count
  from public.campaign_recipients cr
  group by cr.campaign_id
) m
where c.id = m.campaign_id;