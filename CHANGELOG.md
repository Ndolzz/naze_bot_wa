# Changelog

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
