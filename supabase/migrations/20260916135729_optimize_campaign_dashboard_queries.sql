-- Mempercepat daftar kontak yang dipaginasi berdasarkan tanggal pembuatan.
create index if not exists contacts_created_at_id_idx
  on public.contacts (created_at desc, id asc);

-- Mempercepat detail kampanye dan pencarian event provider berdasarkan email.
create index if not exists campaign_recipients_campaign_updated_idx
  on public.campaign_recipients (campaign_id, updated_at desc);

create index if not exists campaign_recipients_email_sent_idx
  on public.campaign_recipients (email, sent_at desc)
  where status in ('sent', 'delivered', 'bounced');

-- Count open/click dipanggil oleh tracking. Partial index membuat PostgreSQL
-- menghitung hanya baris yang relevan, bukan memindai seluruh penerima.
create index if not exists campaign_recipients_opened_idx
  on public.campaign_recipients (campaign_id)
  where internal_opened_at is not null or provider_opened_at is not null;

create index if not exists campaign_recipients_clicked_idx
  on public.campaign_recipients (campaign_id)
  where internal_first_clicked_at is not null
     or provider_first_clicked_at is not null;

-- Digunakan saat melanjutkan kampanye untuk mengecualikan kontak yang tidak
-- boleh menerima email tanpa memindai seluruh tabel kontak.
create index if not exists contacts_blocked_email_idx
  on public.contacts (lower(email))
  where status <> 'active'
     or unsubscribed_at is not null
     or bounce_count > 0;
