alter table public.campaigns
  add column if not exists audience_summary text;

comment on column public.campaigns.audience_summary is
  'Ringkasan penerima yang ditampilkan sebagai pengingat pada daftar kampanye.';
