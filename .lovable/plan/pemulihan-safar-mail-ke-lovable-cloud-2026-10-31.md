# Pemulihan Safar Mail ke Lovable Cloud

## Kondisi terbaru yang sudah diperiksa
- Perubahan terakhir: `f6f22bd294c36ff92b97a15f73e6bf30ea1beb56`. Tidak ada perubahan lokal yang tertunda saat pemeriksaan.
- Kode halaman utama **sudah memakai URL dan public key dari env Cloud**, bukan alamat lama hardcoded.
- Cloud sehat; 15 tabel aplikasi sudah tersedia. Kontak, kampanye dan objek media masih kosong.
- Ada satu akun admin aktif hasil pengujian sebelumnya, tetapi kepemilikannya belum diverifikasi. Pendaftaran pertama masih otomatis menjadi admin: ini harus dihapus.
- Jadwal worker sudah aktif setiap menit; media masih memakai bucket privat sementara kode membuat tautan publik.
- Saldo yang dilaporkan saat mulai: **1,30 kredit**. Angka ini bukan biaya pekerjaan ini; penggunaan aktual dilaporkan dari catatan kredit yang tersedia.

## Pekerjaan yang akan dilakukan
1. **Amankan akses terlebih dahulu.** Hilangkan admin otomatis, pisahkan peran dari profil, audit akun uji, dan siapkan pemulihan admin hanya untuk owner terverifikasi melalui persetujuan aman. Tidak memberikan hak admin berdasarkan email yang diketik pengguna atau urutan pendaftaran.
2. **Amankan pengujian pengiriman.** Pastikan worker tidak mengirim selama migrasi; validasi HTML, pencegahan body kosong, retry dan idempotensi diuji dengan mocks tanpa menyentuh pengiriman nyata.
3. **Lengkapi yang benar-benar kurang.** Audit tabel, grants/RLS, RPC, indeks dan kontrak UI yang sudah terpasang; tambahkan perbaikan tanpa mengulang atau menimpa migrasi terbaru.
4. **Pulihkan media.** Kompres JPEG/PNG/WebP di browser: sisi maksimal 1600px, hasil hanya digunakan jika lebih kecil, transparansi PNG tetap terjaga, GIF tidak diproses. Terapkan cache panjang pada path immutable dan gambar preview lazy/async. Bedakan preview privat dari gambar yang boleh diakses penerima email; tidak membuat semua media publik.
5. **Siapkan pemulihan data.** Periksa akses baca layanan lama secara normal, tanpa bypass kuota. Siapkan import tervalidasi dengan deteksi duplikat dan pemeriksaan sebelum penulisan. Tidak mengklaim data pindah bila ekspor terblokir.
6. **Verifikasi dan laporan.** Uji login/admin setelah owner tersedia, penolakan akses tanpa izin, CRUD kontak/template/media, dan fungsi email dengan mocks. Laporkan hasil pemeriksaan aplikasi, status fungsi/jadwal, commit sumber dan kredit tercatat.

## Keputusan owner yang diperlukan
- Tentukan akun owner yang akan diverifikasi dan diberi akses admin melalui persetujuan aman; akun uji yang ada tidak otomatis dianggap owner.
- Jika ekspor lama tetap terblokir: pilih menunggu pemulihan/menyediakan ekspor, atau menyetujui mulai dengan data kosong. **Tidak mengubah koneksi produksi atau mempublikasikan sebelum keputusan ini dan akses admin siap.** Kode preview sudah menunjuk Cloud dari pekerjaan sebelumnya; perubahan itu tidak akan diam-diam dipromosikan ke produksi.
- Token Mailketing/kunci webhook yang belum siap diminta melalui pengaturan secret aman, tanpa dicetak di chat. Tidak mengganti secret yang sudah tersimpan.

## Detail teknis
- Tambahkan migrasi korektif untuk `user_roles`, helper otorisasi dan trigger signup; pertahankan kolom lama sebagai kompatibilitas sampai semua pembaca otorisasi dipindahkan. Jangan menyalin role admin uji sebagai hak terverifikasi.
- Pertahankan tiga fungsi lama yang sudah ada selama audit; tidak membuat Edge Function baru. Perubahan server aplikasi modern memakai fungsi server/jalur server TanStack. Bila kode fungsi lama memerlukan perubahan yang tidak dapat diterbitkan sesuai batas platform, laporkan keterbatasannya, bukan mengklaim deploy.
- Jadwal terkelola tetap memakai autentikasi cron dan secret worker; gunakan mekanisme jeda/resume resmi saat pengujian. Import tidak menjalankan kampanye, worker, atau trigger pengiriman.
- Pengujian hasil kompresi mencakup batas 1600px, pemilihan file lebih kecil, transparansi dan bypass GIF; pengujian keamanan mencakup signup tanpa admin dan penolakan perubahan role mandiri.
- Pemeriksaan build/types memakai hasil otomatis platform; pengujian perilaku dijalankan terpisah. Tidak menjalankan build manual atau mengubah metadata Git.

## Batas pekerjaan
Tidak menghapus/reset backend lama, mengirim email nyata, menerbitkan aplikasi tanpa kesiapan owner, atau menimpa perubahan terbaru. Bagian aman dilanjutkan; langkah yang memerlukan owner/secret tetap ditandai terblokir dengan alasan jelas.