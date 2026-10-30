# Roadmap

## Pindah aplikasi ke Lovable Cloud (backend baru)
- [ ] Rekayasa skema database dasar dari kode (profiles, contacts, templates, campaigns, campaign_recipients, media_assets, audit_logs, pengaturan Mailketing, helper private.is_active_staff, dsb) — hasil ekstraksi dua subagent
- [ ] Terapkan skema dasar + seluruh migrasi di supabase/migrations ke backend baru (lov_database--migration)
- [ ] Arahkan aplikasi (src/routes/index.tsx) ke backend baru lewat env, bukan hardcode
- [ ] Aktifkan email/password auth (selesai)
- [ ] Verifikasi: signup/login admin, sinkronisasi profil, halaman utama
- [ ] Catat untuk user: token Mailketing & data lama tidak ikut pindah otomatis (proyek lama terkunci kuota)
