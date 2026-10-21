# Changelog

## 3.8.0

Banner NAZE, menu dinamis, dan fitur pencarian, downloader, serta vektorisasi Alight Motion.

- Banner NAZE kini menyertai setiap balasan teks bot (`m.reply`). Teks pendek dikirim sebagai gambar banner dengan caption; teks panjang dikirim sebagai banner tersendiri diikuti pesan teks. Banner diambil dari aset `naze-logo` (`assets/image/naze-logo.jpg`) bila tersedia; jika tidak ada, banner dibuat otomatis oleh `src/lib/naze-banner.js` (font piksel internal, dikodekan JPEG dengan sharp). Opsi `{ banner: false }` pada `m.reply` mematikan banner untuk satu pesan.
- Menu `.menu` ditulis ulang menjadi dinamis: seluruh plugin yang terpasang dikelompokkan per kategori (Pengelolaan File, Sticker Studio, Game, Pencarian, Downloader, Alat) dengan nama, alias, dan deskripsi masing-masing.
- Perintah baru: `.ytsearch` (alias `.yts`) untuk mencari video di YouTube (6 hasil: judul, durasi, jumlah tayangan, tautan).
- Perintah baru: `.ytmp3` dan `.ytmp4` untuk mengunduh audio/video YouTube, menerima tautan maupun kata kunci, dengan pilihan kualitas (audio 92/128/256/320 kbps, video 144p-1080p) dan batas 64 MB per berkas. Ditangani modul `src/lib/naze-youtube.js` (yt-search, @vreden/youtube_scraper, axios; tanpa dependensi baru).
- Perintah baru: `.tiktok` (alias `.tt`) dan `.ig` (alias `.instagram`) untuk mengunduh media TikTok dan Instagram. Resolver dipindahkan dari repositori naze-sosdown ke `src/lib/sosdown/` dan diorkestrasi oleh `src/lib/naze-sosdown.js`; berjalan mandiri dengan fetch bawaan Node.js 20, tanpa server tambahan dan tanpa dependensi baru. Batas 64 MB per berkas dan 10 media per postingan; opsi kualitas TikTok `hd`/`sd`/`wm`; Instagram terbatas pada konten publik.
- Perintah baru: `.amvector` mengubah gambar menjadi siluet vektor XML Alight Motion. Mode `isi`, `garis` (line art), `kontur`; warna global `#rrggbb` atau sampel warna asli (`asli`); siluet `gelap`/`terang` dengan ambang 1-99. Modul pipeline murni dipindahkan dari repositori nazevector ke `src/lib/vector/` tanpa perubahan, diorkestrasi `src/lib/naze-vector.js` (sharp untuk dekode gambar, maks 15 MB).
- Plugin `plugins/game/pixelfishing.js` dipindahkan ke format plugin v3.7.0 (ekspor `config` + `handler`) sehingga kini benar-benar dimuat oleh plugin loader; isi game (GAME_HTML) tetap identik byte demi byte dan tampil sebagai pesan interaktif (richResponseMessage) dengan reaksi 🎣.
- Banner otomatis dapat diganti kapan saja: letakkan berkas gambar asli pada `assets/image/naze-logo.jpg` lalu restart bot.
- Dokumentasi: README ditulis ulang dengan ringkasan fitur dan struktur per kategori fitur; ditambahkan `docs/SDD-SOSDOWN.md`, Software Design Document fitur sosdown yang menjelaskan arsitektur, kontrak data, strategi unduhan, penanganan kesalahan, dan titik perawatan.

## 3.7.0

Sticker Studio: pembuatan stiker, BRAT statis, BRATVID animasi, konversi media, dan pengelolaan stiker.

- Perintah baru: `.sticker` (alias `.s`, `.stiker`), `.brat`, `.bratvid`, `.toimg`, `.togif`, `.tovideo`, `.take`, `.steal`, `.getsticker`, `.liststicker`, `.delsticker`.
- `.brat` merender teks menjadi stiker WebP statis 512 x 512: background putih solid, teks hitam sans-serif, ukuran font dan pemenggalan baris dihitung otomatis agar teks memenuhi kanvas.
- `.bratvid` merender teks menjadi animated WebP dengan lima pola keyframe: Elastic Snap, Wave Cascade, Orbit Shift, Beat Pulse, dan Split Reassemble. Pola dipilih acak dengan peluang sama dan tidak berulang dua kali berturut-turut.
- `.toimg` memakai sharp; `.togif` dan `.tovideo` memakai ffmpeg. `.bratvid` selalu mengirim animated WebP, bukan MP4/GIF.
- `.take` dan `.steal` mengubah metadata EXIF stiker (node-webpmux). `.steal` dapat menyimpan stiker ke koleksi; koleksi dikelola lewat `.getsticker`, `.liststicker`, `.delsticker`.
- Batas durasi, ukuran berkas, dimensi, dan frame rate diatur di blok `stickerStudio` pada `config.js`; animated WebP divalidasi sebelum dikirim.
- Tidak ada dependensi baru; seluruh proses memakai `@napi-rs/canvas`, `sharp`, `fluent-ffmpeg`/`ffmpeg-static`, dan `node-webpmux` yang sudah tersedia.
- Menu `.menu` menampilkan bagian STICKER STUDIO sebelum FILE MANAGEMENT.
- Pengujian: `npm test` menjalankan `tests/sticker-studio.test.js` di samping suite lama.

## 3.6.0

Fitur QR Generator: mengubah teks menjadi gambar kode QR.

- Perintah baru: `.toqr`.
- Sumber teks mengikuti urutan pesan yang dibalas, teks setelah perintah, lalu teks terakhir pengguna (berlaku 10 menit).
- Kapasitas teks divalidasi sebelum pembuatan kode dan diatur lewat `config.files.qrMaxTextBytes` (bawaan 1000 karakter).
- Gambar kode dibuat dengan paket `qrcode` yang sudah tersedia pada dependensi; tidak ada dependensi baru.
- Foto, video, audio, dan dokumen ditolak dengan penjelasan karena kapasitas kode QR hanya cukup untuk teks.
- Menu `.menu`, panduan `.filehelp`, dan README diperbarui.
- Pengujian: `npm test` menjalankan `tests/file-management.test.js` dan `tests/qr-code.test.js`.

## 3.5.0

Sistem pengelolaan file: TXT Generator, PDF Creator, dan ZIP Archive.

- Perintah baru: `.totxt`, `.topdf`, `.tozip`, `.statusfile`, `.batal`, `.menu`, `.filehelp`.
- Sesi pengumpulan berkas terisolasi per pengirim dan per percakapan, dengan batas jumlah, ukuran per berkas, total ukuran, dan masa berlaku (atur di `config.files`).
- PDF disusun oleh modul internal `src/lib/naze-pdf-builder.js` tanpa dependensi baru; foto non-JPEG atau progresif disandikan ulang via sharp; arsip ZIP memakai adm-zip yang sudah tersedia.
- Penanganan pesan diaktifkan kembali di `src/handler.js` (dispatcher perintah berbasis plugin) karena sejak 3.4.0 cabang utama tidak lagi memproses perintah apa pun.
- Pesan dari akun bot sendiri diizinkan masuk dispatcher saat `mode: "self"`.
- Pengujian: `npm test` menjalankan `tests/file-management.test.js`.

## 3.4.0

Rilis pembersihan dan penataan ulang. Tidak ada fitur baru.

- Seluruh fitur AI dihapus (plugin, provider, hook di handler, konfigurasi).
- Identitas proyek lama dibersihkan; atribusi dipindahkan ke `NOTICE.md`.
- Konfigurasi rahasia dipindahkan ke environment (`.env`, lihat `.env.example`).
- File, aset, dan dependency yang tidak terpakai dihapus.
- Balasan bot selalu teks polos; tanpa emoji, font unicode, gif, atau audio.
- Struktur menu dirombak: Main, Tools, Games, Groups, System, dan panel Owner terpisah.
- Game arcade (HTML) tampil langsung di chat lewat `.arcade`.
