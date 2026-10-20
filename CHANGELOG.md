# Changelog

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
