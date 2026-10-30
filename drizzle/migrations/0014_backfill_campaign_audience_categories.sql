-- Rebuild per-category audience summaries for every campaign.
with recipient_categories as (
  select
    r.campaign_id,
    coalesce(c.category, 'Umum') as category_label,
    r.email
  from public.campaign_recipients r
  left join public.contacts c on c.id = r.contact_id
),
totals as (
  select
    rc.campaign_id,
    count(*)::int as total,
    count(distinct lower(rc.email))::int as unique_total
  from recipient_categories rc
  group by rc.campaign_id
),
grouped_counts as (
  select
    rc.campaign_id,
    rc.category_label,
    count(*)::int as category_total
  from recipient_categories rc
  group by rc.campaign_id, rc.category_label
),
per_campaign as (
  select
    t.campaign_id,
    t.total,
    t.unique_total,
    jsonb_agg(
      jsonb_build_object('category', g.category_label, 'count', g.category_total)
      order by g.category_total desc, g.category_label asc
    ) as summary
  from totals t
  join grouped_counts g on g.campaign_id = t.campaign_id
  group by t.campaign_id, t.total, t.unique_total
)
update public.campaigns c
set audience_summary = jsonb_build_object(
  'total', p.total,
  'unique', p.unique_total,
  'categories', p.summary
),
updated_at = now()
from per_campaign p
where c.id = p.campaign_id;
