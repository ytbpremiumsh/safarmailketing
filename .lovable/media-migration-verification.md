# Bukti pemulihan media — 31 Oktober 2026

- 13 file sumber diunduh melalui public GET resmi; total 42.574.457 byte.
- Upload memakai tool Storage terkelola ke bucket `media` yang tetap privat.
- Setiap file tujuan dibaca ulang melalui Storage API dengan kredensial admin terkelola. Semua ukuran dan SHA-256 cocok dengan sumber; tidak dikompresi atau diubah.
- 13 media_assets mempertahankan ID, nama, created_at, mime_type dan size_bytes dari sumber. created_by dipetakan ke owner Cloud sesuai instruksi; peran tidak diubah.
- Seluruh 13 tautan `/api/public/media/<token>` diperiksa di localhost dan situs aktif: 26 GET HTTP 200 dengan ukuran/hash cocok dan cache immutable satu tahun.
- Pembaruan tautan: 10 templates, 9 template_versions, 46 campaigns; pemeriksaan ulang tidak menemukan URL Storage lama pada HTML/lampiran ketiga tabel tersebut.
- Database: storage.objects=13, media_assets=13, 13 pasangan ukuran cocok, total byte=42.574.457; bucket_private=true, worker_off=true.
- Jumlah tabel utama tidak berubah: contacts=19.600, templates=14, campaigns=56, campaign_recipients=47.869, email_events=26.303, suppressions=393, template_versions=9.
- Akses langsung melalui URL public bucket ditolak HTTP 400; akses per-file yang sudah ada tetap berfungsi. Tidak membuat endpoint migrasi, mengubah RLS, menyalakan worker, mengimpor password/secret, mengulang impor tabel, atau publish.
- Commit teramati saat pemeriksaan: b8eb7c665c0fd6506ca2cc17be8571b16f88c4ee. Ini commit kode teramati, bukan bukti bahwa perubahan data Storage dicatat di Git.
- Blocker pemulihan 13 file: tidak ada. Tugas keamanan/login di roadmap terpisah belum dinyatakan selesai.