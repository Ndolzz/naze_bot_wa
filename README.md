# NAZE Bot

Bot WhatsApp multi-device dengan sistem plugin modular. Dipelihara oleh **Nendi**.

## Kebutuhan

- Node.js 20 atau lebih baru
- Akun WhatsApp untuk dipasangkan sebagai bot
- `ffmpeg` (opsional, untuk konversi audio/video; jika tidak ada, bot memakai `ffmpeg-static`)

## Instalasi

```bash
npm install
```

Jika muncul konflik versi `sharp` saat instalasi, file `.npmrc` di proyek ini
sudah mengaktifkan `legacy-peer-deps`.

## Konfigurasi

1. Buka `config.js`, isi nomor owner dan nomor bot (`session.pairingNumber`,
   format `628xxx`).
2. API key layanan pihak ketiga tidak disimpan di source. Salin `.env.example`
   menjadi `.env` lalu isi sesuai kebutuhan, atau isi lewat environment server
   atau panel. Fitur yang bergantung pada layanan tertentu hanya berjalan jika
   key miliknya diisi.

## Menjalankan

```bash
npm start
```

Saat pertama kali dijalankan, kode pairing tampil di console. Buka WhatsApp,
pilih Perangkat tertaut, lalu Tautkan dengan nomor telepon, dan masukkan kode
tersebut. Sesi tersimpan di folder `storage/session/` sehingga pairing tidak perlu
diulang.

### Panel (Pterodactyl dan sejenisnya)

Pilih egg Node.js 20 atau lebih baru, upload isi proyek ini ke root server, lalu
jalankan `npm start`. Jangan upload folder `storage/` atau file `.env` ke
tempat umum.

## Menu

| Perintah | Isi |
| --- | --- |
| `.menu` | Menu utama NAZE |
| `.filehelp` | Panduan penggunaan fitur pengelolaan file |
| `.totxt` | Mengubah teks menjadi file TXT |
| `.topdf` | Menggabungkan foto dan file TXT menjadi satu PDF |
| `.tozip` | Mengemas beberapa berkas menjadi satu ZIP |
| `.statusfile` | Status sesi pengumpulan berkas |
| `.batal` | Membatalkan sesi pengumpulan berkas |

## Pengelolaan file

- `.totxt`: balas pesan teks dengan `.totxt`, atau kirim `.totxt` diikuti teksnya;
  bot mengirim `hasil.txt` yang isinya sama dengan teks sumber.
- `.topdf`: mulai sesi, lalu kirim foto atau file TXT satu per satu, lalu kirim
  nama output diawali titik (contoh `.tugasbahasainggris`). Bot mengirim PDF dengan
  urutan halaman sesuai urutan kiriman.
- `.tozip`: alurnya sama dengan `.topdf`, tetapi menerima foto, video, audio,
  pesan suara, dan dokumen; isi asli setiap berkas dipertahankan.
- `.statusfile` dan `.batal` berlaku selama sesi berjalan.
- Batas bawaan: 20 berkas per sesi, 50 MB per berkas, 200 MB total, sesi berakhir
  setelah 15 menit tidak aktif. Batas dapat diatur di blok `files` pada `config.js`.

## Pengujian

```bash
npm test
```

Suite berada di `tests/file-management.test.js`. Bagian murni (utilitas sesi,
validasi nama, penyusun PDF) berjalan tanpa dependensi tambahan. Bagian
integrasi (orkestrator sesi, pembuatan ZIP) memerlukan `npm install` dan otomatis
dilewati dengan laporan jika dependensi belum tersedia.

## Struktur proyek

```
NAZE Bot
├── index.js        Titik masuk dan inisialisasi
├── config.js       Konfigurasi
├── case/           Perintah berbasis case
├── plugins/        Perintah berbasis plugin (per kategori)
├── src/
│   ├── connection.js   Koneksi dan pairing WhatsApp
│   ├── handler.js      Penanganan pesan dan perintah
│   ├── lib/            Library internal (plugin loader, serializer, PDF, dll.)
│   └── data/           Data game
├── database/       Data bot
├── storage/        Sesi WhatsApp dan berkas sementara (dibuat otomatis, jangan dibagikan)
├── tests/          Pengujian (npm test)
└── docs/           Dokumentasi tambahan
```

## Menambah plugin

Buat file `.js` di `plugins/<kategori>/` yang mengekspor `config` dan `handler`.
Plugin dimuat otomatis sesuai kategori foldernya.

## Atribusi

Basis kode, library pihak ketiga, dan game arcade memiliki atribusi masing-masing.
Lihat [NOTICE.md](NOTICE.md).
