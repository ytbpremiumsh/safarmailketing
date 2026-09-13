with original_audiences as (
  select
    campaign_id,
    string_agg(
      distinct nullif(trim(coalesce(variables->>'kategori', variables->>'category')), ''),
      ', '
      order by nullif(trim(coalesce(variables->>'kategori', variables->>'category')), '')
    ) as categories
  from public.campaign_recipients
  group by campaign_id
)
update public.campaigns as campaign
set audience_summary = 'Kategori: ' || audience.categories
from original_audiences as audience
where audience.campaign_id = campaign.id
  and nullif(trim(campaign.audience_summary), '') is null
  and audience.categories is not null;
