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
| `.sticker`, `.s`, `.stiker` | Membuat stiker dari gambar atau video |
| `.brat` | Membuat stiker teks BRAT statis |
| `.bratvid` | Membuat stiker teks BRAT animasi |
| `.toimg` | Mengubah stiker menjadi gambar |
| `.togif` | Mengubah stiker animasi menjadi GIF |
| `.tovideo` | Mengubah stiker animasi menjadi video |
| `.take` | Mengubah metadata pembuat stiker |
| `.steal` | Mengambil stiker dengan metadata baru, opsional menyimpan |
| `.getsticker` | Mengambil stiker tersimpan berdasarkan nama |
| `.liststicker` | Menampilkan daftar stiker tersimpan |
| `.delsticker` | Menghapus stiker tersimpan berdasarkan nama |
| `.tiktok` | Mengunduh video atau foto TikTok |
| `.instagram`, `.ig` | Mengunduh video, foto, atau carousel Instagram |
| `.youtube`, `.yt` | Mengunduh video YouTube |
| `.mp3` | Mengunduh audio TikTok, Instagram, atau YouTube sebagai MP3 |
| `.ytsearch`, `.yts` | Mencari video YouTube lalu mengunduhnya |
| `.filehelp` | Panduan penggunaan fitur pengelolaan file |
| `.totxt` | Mengubah teks menjadi file TXT |
| `.topdf` | Menggabungkan foto dan file TXT menjadi satu PDF |
| `.tozip` | Mengemas beberapa berkas menjadi satu ZIP |
| `.toqr` | Mengubah teks menjadi gambar kode QR |
| `.statusfile` | Status sesi pengumpulan berkas |
| `.batal` | Membatalkan sesi pengumpulan berkas |

## Sticker Studio

- `.sticker`: kirim atau balas gambar/video dengan `.sticker`; gambar menjadi
  stiker statis, video (maksimal 10 detik, atur di `config.stickerStudio`)
  menjadi stiker animasi.
- `.brat`: kirim `.brat` diikuti teksnya, atau balas pesan teks dengan `.brat`.
  Teks dirender 512 x 512 piksel: background putih solid, teks hitam
  sans-serif, ukuran font dan pemenggalan baris dihitung otomatis agar teks
  memenuhi kanvas. Hasil berupa WebP statis.
- `.bratvid`: seperti `.brat`, tetapi hasilnya animated WebP. Setiap perintah
  memilih satu dari lima pola keyframe secara acak dengan peluang sama:
  Elastic Snap, Wave Cascade, Orbit Shift, Beat Pulse, dan Split Reassemble.
  Pola yang sama tidak muncul dua kali berturut-turut dalam satu proses bot.
  Animated WebP divalidasi (format, dimensi, animasi, ukuran) sebelum dikirim.
- `.toimg`: mengubah stiker menjadi gambar PNG (stiker animasi diambil dari
  bingkai pertamanya).
- `.togif`: mengubah stiker animasi menjadi berkas GIF; `.tovideo` menjadi
  video MP4. Keduanya menolak stiker statis.
- `.take`: kirim atau balas stiker dengan `.take nama pack | nama author` untuk
  mengubah metadata pembuatnya; tanpa argumen memakai default `config.sticker`.
- `.steal`: mengambil stiker dengan metadata baru (author diisi nama pengguna).
  Tambahkan nama, contoh `.steal kucing`, untuk menyimpannya ke koleksi.
- `.getsticker`, `.liststicker`, `.delsticker`: mengelola koleksi stiker
  tersimpan. Hanya penyimpan stiker atau owner bot yang dapat menghapus.
  Koleksi disimpan di `storage/stickers/` dan dibatasi `config.stickerStudio.store`.

## Sosmed Downloader

- `.tiktok`, `.instagram` (alias `.ig`), `.youtube` (alias `.yt`): kirim
  perintah diikuti tautannya, atau balas pesan berisi tautan. Platform dikenali
  otomatis; tautan yang tidak sesuai perintah akan ditolak dengan saran perintah
  yang tepat.
- Video dikirim sebagai pesan video bila memenuhi batas ukuran, selain itu
  sebagai dokumen. Postingan foto/carousel Instagram dikirim hingga lima foto
  pertama.
- `.mp3`: mengunduh audio dari tautan TikTok, Instagram, atau YouTube (platform
  dikenali otomatis), lalu mengonversinya menjadi MP3 192 kbps dengan metadata
  ID3v2.3 dan sampul bila tersedia. Hasil yang melebihi batas dikompresi ulang
  sekali pada 128 kbps.
- Resolver membaca halaman publik platform tanpa API resmi; seluruh permintaan
  memakai fetch bawaan Node dengan batas waktu. Cookie sesi media disimpan di
  memori proses untuk meneruskan unduhan ke CDN TikTok/Instagram.
- Batas ukuran media, durasi, foto per postingan, bitrate MP3, dan waktu tunggu
  diatur di blok `downloader` pada `config.js`. Detail teknis ada di
  `docs/SOSDOWN.md`.

## Pencarian YouTube

- `.ytsearch <kata kunci>` (alias `.yts`): mencari video YouTube dan menampilkan
  daftar hasil bernomor berisi judul, kanal, durasi, jumlah tayangan, dan
  tautan. Teks pesan yang dibalas juga dapat dipakai sebagai kata kunci.
- `.ytsearch <nomor>`: mengunduh video pada nomor tersebut;
  `.ytsearch <nomor> mp3` mengirim audionya sebagai MP3. Unduhan memakai
  pipeline Sosmed Downloader sehingga batas durasi dan ukurannya sama.
- Hasil pencarian terakhir disimpan per pengguna dan berlaku 10 menit
  (atur di blok `ytsearch` pada `config.js`); setelah itu pencarian harus
  diulang. Detail teknis ada di `docs/YTSEARCH.md`.

## Pengelolaan file

- `.totxt`: balas pesan teks dengan `.totxt`, atau kirim `.totxt` diikuti teksnya;
  bot mengirim `hasil.txt` yang isinya sama dengan teks sumber.
- `.topdf`: mulai sesi, lalu kirim foto atau file TXT satu per satu, lalu kirim
  nama output diawali titik (contoh `.tugasbahasainggris`). Bot mengirim PDF dengan
  urutan halaman sesuai urutan kiriman.
- `.tozip`: alurnya sama dengan `.topdf`, tetapi menerima foto, video, audio,
  pesan suara, dan dokumen; isi asli setiap berkas dipertahankan.
- `.toqr`: balas pesan teks dengan `.toqr`, atau kirim `.toqr` diikuti teksnya;
  bot mengirim gambar kode QR. Maksimal 1000 karakter (atur di `config.files`);
  media tidak dapat diubah menjadi kode QR.
- `.statusfile` dan `.batal` berlaku selama sesi berjalan.
- Batas bawaan: 20 berkas per sesi, 50 MB per berkas, 200 MB total, sesi berakhir
  setelah 15 menit tidak aktif. Batas dapat diatur di blok `files` pada `config.js`.

## Pengujian

```bash
npm test
```

Suite berada di `tests/`. Bagian murni (utilitas sesi, tata letak BRAT, pola
keyframe, deteksi tautan sosmed, penguraian pilihan pencarian) berjalan tanpa
dependensi tambahan. Bagian integrasi (renderer, animated WebP, penyimpanan,
konversi MP3, pencarian YouTube) memerlukan `npm install` dan otomatis
dilewati dengan laporan jika dependensi belum tersedia.

## Struktur proyek

```
NAZE Bot
├── index.js        Titik masuk
├── config.js       Konfigurasi
├── case/           Perintah berbasis case
├── plugins/        Perintah berbasis plugin (per kategori)
├── src/
│   ├── connection.js   Koneksi dan pairing WhatsApp
│   ├── handler.js      Penanganan pesan dan perintah
│   ├── lib/            Library internal (plugin loader, serializer, PDF, sticker, dll.)
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
