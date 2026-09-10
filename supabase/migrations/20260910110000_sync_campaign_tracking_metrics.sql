alter table public.email_events
  drop constraint if exists email_events_event_type_check;

alter table public.email_events
  add constraint email_events_event_type_check
  check (event_type in ('open', 'click', 'bounce', 'unsubscribe'));

create or replace function private.refresh_campaign_delivery_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.campaigns c
  set
    opened_count = (
      select count(*)::integer
      from public.campaign_recipients cr
      where cr.campaign_id = new.campaign_id
        and (
          cr.internal_opened_at is not null
          or cr.provider_opened_at is not null
        )
    ),
    clicked_count = (
      select count(*)::integer
      from public.campaign_recipients cr
      where cr.campaign_id = new.campaign_id
        and (
          cr.internal_first_clicked_at is not null
          or cr.provider_first_clicked_at is not null
        )
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
$$;

revoke all on function private.refresh_campaign_delivery_metrics() from public;
revoke all on function private.refresh_campaign_delivery_metrics() from anon;
revoke all on function private.refresh_campaign_delivery_metrics() from authenticated;

drop trigger if exists refresh_campaign_delivery_metrics
  on public.campaign_recipients;

create trigger refresh_campaign_delivery_metrics
after update of
  internal_opened_at,
  provider_opened_at,
  internal_first_clicked_at,
  provider_first_clicked_at,
  status
on public.campaign_recipients
for each row
when (
  old.internal_opened_at is distinct from new.internal_opened_at
  or old.provider_opened_at is distinct from new.provider_opened_at
  or old.internal_first_clicked_at is distinct from new.internal_first_clicked_at
  or old.provider_first_clicked_at is distinct from new.provider_first_clicked_at
  or old.status is distinct from new.status
)
execute function private.refresh_campaign_delivery_metrics();

update public.campaigns c
set
  opened_count = (
    select count(*)::integer
    from public.campaign_recipients cr
    where cr.campaign_id = c.id
      and (
        cr.internal_opened_at is not null
        or cr.provider_opened_at is not null
      )
  ),
  clicked_count = (
    select count(*)::integer
    from public.campaign_recipients cr
    where cr.campaign_id = c.id
      and (
        cr.internal_first_clicked_at is not null
        or cr.provider_first_clicked_at is not null
      )
  ),
  failed_count = (
    select count(*)::integer
    from public.campaign_recipients cr
    where cr.campaign_id = c.id
      and cr.status in ('failed', 'bounced', 'rejected')
  ),
  updated_at = now();