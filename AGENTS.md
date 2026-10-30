<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisions
- Worker antrean email diautentikasi lewat secret `QUEUE_WORKER_KEY` (env) selain hash `queue_worker_config.secret_hash`; jadwal terkelola memanggil `/api/public/jobs/process-queue` tiap menit, yang meneruskan ke edge function `mailketing`. Why: penjadwal terkelola memakai bearer cron sendiri dan kunci worker tidak boleh disimpan plaintext di chat/DB.
- Webhook Mailketing diautentikasi lewat secret `MAILKETING_WEBHOOK_KEY` (env) selain hash `mailketing_webhook_config.secret_hash`; nilainya juga ditempel pengguna di dasbor Mailketing.
- Bucket storage `media` dibuat privat karena kebijakan workspace memblokir bucket publik; fungsi `private.is_active_user()` dan `private.is_admin()` dipakai untuk kebijakan media.
- Skema `cron` diaktifkan lewat ekstensi `pg_cron`; job SQL-only `release-expired-soft-bounces` berjalan tiap jam (menit ke-17).
- Migration `backfill_campaign_audience_categories` tidak memakai kolom `custom_category` (tidak ada di skema baru); kategori diambil dari `contacts.category`.
