# Naze Intent Router

Naze Intent Router memungkinkan pengguna menjalankan fitur bot melalui bahasa
Indonesia sehari-hari tanpa prefix perintah. Router mengenali maksud pesan,
memilih plugin yang sesuai, lalu mengeksekusinya melalui dispatcher plugin
bersama sehingga seluruh gerbang (mode self, izin, dan cooldown) tetap
berlaku sama dengan perintah eksplisit.

Router nonaktif secara bawaan dan tidak mengubah perilaku bot apa pun sampai
fitur sengaja dinyalakan.

## Cara mengaktifkan

Ubah `features.smartTriggers` menjadi `true` pada `config.js`:

```js
features: {
  // ... pengaturan lainnya ...
  smartTriggers: true,
},
```

Seluruh perintah eksplisit seperti `.menu` tetap berjalan normal baik saat
router aktif maupun nonaktif.

## Pengaturan

Blok `intentRouter` pada `config.js`:

| Pengaturan | Nilai bawaan | Keterangan |
| --- | --- | --- |
| threshold | 6 | Skor minimal agar sebuah intent dianggap sah |
| minMargin | 2 | Selisih skor minimal antara kandidat teratas dan kandidat kedua |
| maxTextLength | 500 | Panjang teks pesan maksimal yang diproses router |
| clarifyTtlMs | 60000 | Masa berlaku balasan klarifikasi dalam milidetik |

## Perilaku

- Router hanya memproses pesan tanpa prefix (non-perintah) dan berhenti
  sementara saat ada sesi pengumpulan berkas aktif, agar isi sesi tidak salah
  dikenali sebagai permintaan baru.
- Pesan ambigu meminta klarifikasi berupa daftar fitur; balas dengan nomor
  pilihan atau nama fitur dalam 60 detik.
- Permintaan yang membutuhkan media meminta media terlebih dahulu bila media
  belum dikirim atau dibalas.
- Permintaan multi-langkah dalam satu pesan ditolak dengan penjelasan.
- Permintaan yang dikenali tetapi belum didukung dijelaskan tanpa eksekusi,
  misalnya kompres video dan transkripsi pesan suara.
- Setiap pesan hanya diproses sekali meskipun peristiwa masuk terduplikasi.

## Daftar periksa uji lapangan

Jalankan pengujian berikut pada bot yang aktif setelah `smartTriggers`
dinyalakan. Setiap baris harus menghasilkan perilaku yang tertulis; bila ada
yang meleset, matikan kembali `smartTriggers` dan laporkan kasusnya.

| Nomor | Aksi | Hasil yang diharapkan |
| --- | --- | --- |
| 1 | Kirim gambar lalu tulis "ubah gambar ini jadi stiker" | Stiker dibuat |
| 2 | Tulis "cari lagu lathi" | Lagu ditemukan dan MP3 dikirim |
| 3 | Balas pesan berisi tautan YouTube dengan "unduh audio dari video youtube ini" | MP3 YouTube dikirim |
| 4 | Tulis "download video tiktok ini" disertai tautan TikTok | Video TikTok dikirim |
| 5 | Kirim gambar lalu tulis "ubah gambar ini ke png" | Gambar PNG dikirim |
| 6 | Tulis "bikin brat semangat pagi" | Stiker brat dibuat |
| 7 | Tulis "brat vid jangan menyerah" | Stiker brat animasi dibuat |
| 8 | Balas pesan teks dengan "ubah teks ini jadi file txt" | Berkas TXT dikirim |
| 9 | Kirim gambar lalu tulis "bikin gambar ini lebih kecil dan tajam" | Bot meminta klarifikasi; balas "kompres" lalu gambar terkompres |
| 10 | Kirim video lalu tulis "kompres video ini" | Penjelasan bahwa kompres video belum tersedia |
| 11 | Tulis "ubah gambar ini jadi stiker lalu jadi pdf" | Ditolak dengan penjelasan multi-langkah |
| 12 | Tulis "halo", "lagunya enak banget", atau kirim dokumen dengan pesan "ini pdf tugas dari dosen" | Tidak ada balasan atau eksekusi |
| 13 | Tulis "menu" | Daftar fitur dikirim |
| 14 | Kirim perintah eksplisit ".menu" saat router aktif | Perintah berjalan normal seperti sebelumnya |
| 15 | Gunakan fitur yang sama dua kali berturut-turut dalam waktu cooldown | Balasan cooldown muncul, sama seperti perintah eksplisit |

## Tolok ukur latensi

Latensi pemrosesan router diukur dengan skrip terpisah agar `npm test`
tetap cepat. Jalankan pada mesin tempat bot dijalankan:

```
npm install
node tests/intent-router.bench.js
```

Skrip melaporkan rata-rata, p50, p95, p99, maksimum, dan throughput untuk
tiga jalur: keputusan pada kasus positif, keputusan pada kasus negatif
(passthrough), dan jalur integrasi penuh. Target yang ditetapkan: p95 di
bawah 50 milidetik per pesan. Jalankan beberapa kali dan gunakan hasil pada
keadaan stabil; bila p95 melebihi target, laporkan angka beserta spesifikasi
mesin (tercetak pada bagian atas laporan skrip).

## Pengujian otomatis

`npm test` menjalankan `tests/intent-router.test.js` yang menguji korpus
permintaan pada `tests/fixtures/intent-corpus.json`, integrasi jalur
penuh, serta dispatcher dan deteksi media. Pengujian menggunakan plugin stub
tanpa koneksi WhatsApp.
