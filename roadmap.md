# Roadmap

## Kelanjutan migrasi aman — 30 Oktober 2026
- [x] Periksa state terbaru tanpa menimpa perubahan: commit f6f22bd, skema Cloud terpasang, koneksi memakai env, data bisnis kosong.
- [ ] Hapus perilaku first-signup auto-admin; pisahkan peran dari profiles dan verifikasi owner sebelum bootstrap admin.
- [ ] Audit akun admin uji yang sudah ada; jangan menganggapnya sebagai owner terverifikasi.
- [ ] Pastikan worker tidak mengirim email selama pengujian; uji normalisasi HTML/idempotensi memakai mocks.
- [ ] Verifikasi migrasi, grants/RLS, RPC, indeks, dan fungsi yang telah terpasang; terapkan hanya kekurangan.
- [ ] Periksa ekspor backend lama tanpa bypass; keputusan owner diperlukan sebelum memakai data kosong untuk produksi.
- [ ] Tambahkan kompresi gambar browser maksimal sisi 1600px, menjaga PNG transparan dan GIF animasi; immutable caching dan preview lazy/async.
- [ ] Pulihkan CRUD media privat dan jalur gambar email tanpa membuka seluruh bucket.
- [ ] Siapkan pemulihan/import tervalidasi, dengan persetujuan sebelum menulis data.
- [ ] Uji login owner/admin, RLS, CRUD dan fungsi tanpa kirim nyata; laporkan bukti deploy, commit dan kredit tercatat.
- [ ] Produksi: jangan publish atau mengganti koneksi lagi sebelum akses owner dan keputusan data siap.

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
