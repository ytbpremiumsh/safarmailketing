# Roadmap

## Pindah aplikasi ke Lovable Cloud (backend baru)
- [x] Rekayasa skema database dasar dari kode (profiles, contacts, templates, campaigns, campaign_recipients, media_assets, audit_logs, pengaturan Mailketing, helper private.is_active_staff, dsb)
- [x] Terapkan skema dasar + seluruh migrasi di supabase/migrations ke backend baru (lov_database--migration)
- [x] Arahkan aplikasi (src/routes/index.tsx) ke backend baru lewat env, bukan hardcode
- [x] Aktifkan email/password auth (selesai)
- [x] Verifikasi: signup/login admin, sinkronisasi profil, halaman utama (diuji lewat browser: login sukses, dashboard tampil)
- [x] Deploy ulang edge functions (mailketing, mailketing-webhook, email-track) ke backend baru
- [x] Worker antrean otomatis: secret QUEUE_WORKER_KEY, route /api/public/jobs/process-queue, jadwal terkelola "safar-mail-queue-worker" (tiap menit), diuji end-to-end lokal
- [ ] Media: bucket "media" dibuat sebagai privat karena kebijakan workspace memblokir bucket publik — minta admin workspace mengizinkan bucket publik (Settings → Privacy & Security) atau alihkan kode ke signed URL
- [ ] Pengguna perlu: masukkan ulang token Mailketing di halaman Pengaturan, dan tempel kunci webhook MAILKETING_WEBHOOK_KEY (dari formulir secret) ke konfigurasi webhook di dasbor Mailketing
- [ ] Catatan: data lama tidak ikut pindah otomatis (layanan lama terkunci kuota)
