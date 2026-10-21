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
| `.filehelp` | Panduan penggunaan fitur pengelolaan file |
| `.totxt` | Mengubah teks menjadi file TXT |
| `.topdf` | Menggabungkan foto dan file TXT menjadi satu PDF |
| `.tozip` | Mengemas beberapa berkas menjadi satu ZIP |
| `.toqr` | Mengubah teks menjadi gambar kode QR |
| `.statusfile` | Status sesi pengumpulan berkas |
| `.batal` | Membatalkan sesi pengumpulan berkas |
| `.ytsearch`, `.yts` | Mencari video di YouTube |
| `.ytmp3` | Mengunduh audio YouTube (MP3, maks 64 MB) |
| `.ytmp4` | Mengunduh video YouTube (MP4, maks 64 MB) |
| `.amvector` | Mengubah gambar menjadi siluet vektor XML Alight Motion |
| `.pixelfishing`, `.pixelfish`, `.pfish` | Game memancing Pixel Fishing (pesan interaktif) |

## Banner NAZE

Setiap balasan teks bot otomatis menyertai banner NAZE. Teks pendek (maks 1024
karakter) dikirim sebagai gambar banner dengan caption; teks yang lebih panjang
dikirim sebagai banner tersendiri diikuti pesan teks. Banner diambil dari
`assets/image/naze-logo.jpg` bila tersedia; jika berkas tersebut tidak ada,
banner dibuat otomatis oleh `src/lib/naze-banner.js`. Untuk memakai banner
buatan sendiri, letakkan berkas gambar pada `assets/image/naze-logo.jpg` lalu
restart bot.

## Pencarian dan Downloader

- `.ytsearch` / `.yts`: mencari video di YouTube. Contoh: `.yts musik lofi`.
  Menampilkan 6 hasil berisi judul, durasi, jumlah tayangan, dan tautan.
- `.ytmp3`: mengunduh audio YouTube sebagai MP3. Menerima tautan atau kata
  kunci, diikuti kualitas opsional `92`, `128` (bawaan), `256`, atau `320`.
  Contoh: `.ytmp3 https://youtu.be/xxxx 128`.
- `.ytmp4`: mengunduh video YouTube sebagai MP4. Kualitas opsional `144`,
  `360` (bawaan), `480`, `720`, atau `1080`. Contoh:
  `.ytmp4 https://youtu.be/xxxx 480`.
- Kedua downloader membatasi ukuran berkas 64 MB agar aman dikirim sebagai
  pesan WhatsApp; kata kunci otomatis diubah menjadi video pertama hasil
  pencarian.

## Vektorisasi Alight Motion

- `.amvector`: kirim atau balas gambar (PNG/JPEG/WebP, maks 15 MB) dengan
  `.amvector`. Hasil berupa berkas XML yang dapat diimpor ke Alight Motion.
- Argumen opsional: `isi` (bentuk terisi, bawaan), `garis` (line art dengan
  goresan tipis), `kontur` (satu layer per garis tepi); `asli` untuk memakai
  warna asli gambar per komponen/kontur; `gelap` (bawaan) atau `terang` untuk
  memilih bagian gambar yang menjadi siluet; angka `1-99` untuk ambang
  kecerahan; `#rrggbb` untuk warna global.
- Contoh: `.amvector garis` untuk line art, `.amvector asli 60` untuk bentuk
  terisi dengan warna asli pada ambang 60.
- Pipeline vektorisasi dipindahkan dari repositori nazevector ke
  `src/lib/vector/` (murni, tanpa DOM) dan diorkestrasi oleh
  `src/lib/naze-vector.js`.

## Game

- `.pixelfishing` / `.pixelfish` / `.pfish`: game memancing bergaya pixel
  dengan 20 jenis ikan, 5 tingkat kelangkaan, koleksi, toko, dan penyimpanan
  progres. Game tampil langsung di chat sebagai pesan interaktif; jika versi
  WhatsApp tidak mendukung pesan interaktif, bot memberi tahu lewat balasan
  teks.

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
keyframe) berjalan tanpa dependensi tambahan. Bagian integrasi (renderer,
animated WebP, penyimpanan) memerlukan `npm install` dan otomatis dilewati
dengan laporan jika dependensi belum tersedia.

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
