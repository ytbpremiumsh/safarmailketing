alter table public.campaigns
  add column if not exists audience_summary jsonb;
