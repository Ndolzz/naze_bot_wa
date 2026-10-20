# Sticker Studio NAZE

Dokumentasi teknis fitur Sticker Studio (NAZE Bot 3.7.0).

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `.sticker`, `.s`, `.stiker` | Membuat stiker dari gambar atau video |
| `.brat <teks>` | Stiker teks BRAT statis |
| `.bratvid <teks>` | Stiker teks BRAT animasi (lima pola acak) |
| `.toimg` | Stiker menjadi gambar PNG |
| `.togif` | Stiker animasi menjadi berkas GIF |
| `.tovideo` | Stiker animasi menjadi video MP4 |
| `.take [pack \| author]` | Mengubah metadata EXIF stiker |
| `.steal [nama]` | Mengambil stiker dengan metadata baru; opsional menyimpan |
| `.getsticker <nama>` | Mengambil stiker tersimpan |
| `.liststicker` | Daftar stiker tersimpan |
| `.delsticker <nama>` | Menghapus stiker tersimpan (penyimpan atau owner) |

## Struktur modul

- `src/lib/naze-sticker-utils.js` — modul murni: tata letak BRAT, fungsi
  easing, lima pola keyframe, pemilih pola acak, validasi nama, templat
  pesan, dan teks menu. Tanpa efek samping sehingga mudah diuji.
- `src/lib/naze-sticker-renderer.js` — menggambar frame di kanvas
  `@napi-rs/canvas` dan menyandikan WebP statis/animasi lewat ffmpeg
  (`fluent-ffmpeg`), lalu menambah EXIF lewat `node-webpmux`.
- `src/lib/naze-sticker-store.js` — penyimpanan koleksi stiker di
  `storage/stickers/` dengan indeks `index.json`.
- `src/lib/naze-sticker-manager.js` — orkestrator perintah: sumber media,
  validasi, konversi, dan balasan pengguna.
- `plugins/sticker/` — plugin tipis per perintah, mengikuti konvensi
  `config` + `handler` repositori.

## Cara kerja rendering BRAT

1. Teks divalidasi (tidak kosong, maksimal `stickerStudio.maxTextLength`,
   bawaan 500 karakter).
2. `computeBratLayout` mencari ukuran font terbesar (16-260 px) yang tetap
   menampung seluruh teks pada kanvas 512 x 512 dengan margin 24 px dan
   rasio tinggi baris 1.15. Pemenggalan baris dilakukan per kata; kata yang
   lebih panjang dari lebar baris dipenggal per karakter sehingga tidak ada
   teks yang keluar frame. Teks pendek otomatis dirender besar.
3. Frame digambar dengan background putih solid `#FFFFFF` dan teks hitam
   `#000000` (sans-serif, ketebalan normal; font sistem pertama yang
   ditemukan didaftarkan sebagai `NAZESans`). Tidak ada blur, bayangan,
   outline, glow, tekstur, gradasi, atau efek lain.
4. Frame PNG disandikan ffmpeg (`libwebp`) menjadi WebP 512 x 512, lalu
   diberi EXIF metadata (packname/author dari `config.sticker`) lewat
   `node-webpmux`. Hasil divalidasi (`isValidWebp`, dimensi tepat 512 x 512)
   sebelum dikirim sebagai stiker.

## Cara kerja BRATVID

1. Tata letak teks sama dengan BRAT statis.
2. Satu putaran animasi (`stickerStudio.bratvidDurationSeconds`, bawaan 3
   detik) dibagi menjadi frame tetap (`bratvidFps`, bawaan 10 fps). Setiap
   frame adalah nilai pola pada waktu normal `t = i / jumlahFrame`.
3. Lima pola keyframe (semuanya siklik: nilai pada `t = 0` sama dengan
   `t = 1`, sehingga animasi berulang mulus):
   - Elastic Snap — blok teks menuju posisi akhir dengan easing elastis
     (melewati target lalu kembali), diam, lalu keluar.
   - Wave Cascade — tiap baris bergerak vertical bergantian dengan jeda
     waktu membentuk gelombang.
   - Orbit Shift — blok teks menempuh lintasan melingkar dengan rotasi
     ringan, lalu kembali ke susunan semula.
   - Beat Pulse — skala teks membesar-mengecil ritmis dua ketukan per
     putaran.
   - Split Reassemble — blok teks terbelah dua; tiap belahan menempuh jalur
     berbeda lalu menyatu kembali.
4. Pola dipilih acak dengan peluang sama. Bila pola sebelumnya diketahui
   (disimpan di memori proses), pola tersebut dikeluarkan dari giliran sekali
   sehingga tidak ada pola yang muncul dua kali berturut-turut. Konsekuensi:
   pemilihan antar perintah tidak sepenuhnya independen, tetapi peluang
   jangka panjang setiap pola tetap sama. State tidak tersimpan permanen dan
   hilang saat bot direstart.
5. Frame PNG dirangkai ffmpeg menjadi animated WebP (`libwebp`, `-loop 0`).
   Hasil divalidasi: format WebP sah, benar-benar beranimasi (chunk `ANIM`/
   `ANMF`), dan ukuran di bawah `bratvidMaxBytes` (bawaan 1 MB; bila lebih,
   disandikan ulang sekali dengan kualitas lebih rendah sebelum gagal dengan
   pesan yang jelas). EXIF ditambahkan setelah validasi. `.bratvid` selalu
   mengirim animated WebP, bukan MP4 atau GIF.

## Konversi media

- `.toimg` memakai `sharp` untuk menyandi ulang WebP ke PNG. Stiker animasi
  diambil dari bingkai pertamanya.
- `.togif` dan `.tovideo` memakai ffmpeg dan hanya menerima stiker animasi
  (divalidasi lewat `isAnimatedWebp`); stiker statis ditolak dengan pesan.
  Hasil GIF dibatasi `gifMaxBytes` (bawaan 15 MB).
- `.sticker` menerima gambar (WebP statis) dan video (WebP animasi lewat
  ffmpeg, maksimal `maxVideoSeconds` detik, bawaan 10).

## Metadata (take dan steal)

`.take` serta `.steal` memuat ulang stiker lewat `node-webpmux` dan mengganti
EXIF `sticker-pack-name`/`sticker-pack-publisher`; konten gambar dan animasi
stiker tidak diubah. `.steal` menambahkan opsi penyimpanan ke koleksi: token
pertama yang sah sebagai nama (huruf kecil, angka, `_`, `-`, maksimal 32
karakter) akan menyimpan stiker untuk dipambil kembali dengan `.getsticker`.

## Penyimpanan koleksi

Koleksi disimpan di `storage/stickers/` (terabaik oleh git) dengan indeks
`index.json` yang ditulis secara atomik (tulis berkas sementara lalu ganti
nama). Batas: `store.maxStickers` (100) dan `store.maxStickerBytes` (1 MB),
diatur di blok `stickerStudio` pada `config.js`. `.delsticker` hanya
diizinkan bagi pengguna yang menyimpan stiker tersebut atau owner bot.

## Batasan yang diketahui

1. Rendering teks bergantung pada ketersediaan font sans-serif di server
   (`DejaVu Sans`, `Liberation Sans`, `Noto Sans`, `Arial`, atau
   `Helvetica`). Bila tidak ada satu pun, renderer memakai fallback
   `sans-serif` milik `@napi-rs/canvas` yang tampilannya bergantung sistem.
2. Konversi animated WebP (BRATVID, `.togif`, `.tovideo`) memerlukan ffmpeg
   dengan dukungan `libwebp`; `ffmpeg-static` pada `optionalDependencies`
   sudah memenuhinya, begitu juga build ffmpeg sistem pada umumnya.
3. Kompatibilitas pengiriman akhirnya bergantung library WhatsApp `naze`
   (Wileys/Baileys). Batas yang dipakai (512 x 512, maksimal 1 MB,
   10 fps, 3 detik) mengikuti praktik umum stiker WhatsApp, tetapi valid
   bila diuji di panel.
4. Pengujian di lingkungan tanpa dependensi hanya menjalankan bagian murni;
   bagian integrasi otomatis dilewati dengan laporan.
