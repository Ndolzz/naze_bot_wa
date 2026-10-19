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
| `.menu` | Daftar menu utama |
| `.menu tools`, `.menu games`, `.menu groups`, `.menu system` | Submenu dan daftar perintah |
| `.menu tools downloader` | Detail satu submenu beserta deskripsi |
| `.allmenu` | Seluruh perintah |
| `.groupmenu` | Menu administrasi grup |
| `.ownermenu` | Panel owner (khusus owner) |
| `.arcade` | Game HTML yang dimainkan langsung di chat |

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
│   ├── lib/            Library internal (database, menu, scheduler, dll.)
│   ├── scraper/        Scraper untuk downloader dan tools
│   └── data/           Data game
├── assets/         Gambar, font, dan game arcade
├── database/       Data bot
├── storage/        Sesi WhatsApp (dibuat otomatis, jangan dibagikan)
└── docs/           Dokumentasi tambahan
```

## Menambah plugin

Buat file `.js` di `plugins/<kategori>/` yang mengekspor `config` dan `handler`.
Plugin dimuat otomatis dan muncul di menu sesuai penempatan di
`src/lib/naze-menu-util.js`.

## Atribusi

Basis kode, library pihak ketiga, dan game arcade memiliki atribusi masing-masing.
Lihat [NOTICE.md](NOTICE.md).
