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
