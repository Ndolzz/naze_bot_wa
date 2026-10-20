# Pencarian YouTube NAZE

Dokumentasi teknis fitur Pencarian YouTube (NAZE Bot 3.9.0). Fitur ini
mencari video lewat paket `yt-search` yang sudah tersedia pada dependensi,
menampilkan daftar hasil bernomor, lalu meneruskan pilihan pengguna ke
pipeline unduhan Sosmed Downloader.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `.ytsearch <kata kunci>`, `.yts <kata kunci>` | Mencari video YouTube |
| `.ytsearch <nomor>` | Mengunduh video pada nomor hasil terakhir |
| `.ytsearch <nomor> mp3` | Mengunduh audio hasil terakhir sebagai MP3 |

Kata kunci dapat dikirim setelah perintah atau dengan membalas pesan teks.
Daftar hasil terakhir disimpan per pengirim sehingga pengguna cukup mengirim
`.ytsearch 3` tanpa harus membalas pesan daftar.

## Struktur modul

- `src/lib/naze-ytsearch-utils.js` — modul murni: validasi kata kunci,
  penguraian pilihan (nomor vs kueri), pemformatan durasi/jumlah tayangan,
  templat pesan, dan teks menu. Tanpa efek samping sehingga mudah diuji.
- `src/lib/naze-ytsearch-manager.js` — orkestrator: pencarian via yt-search,
  cache hasil terakhir per pengirim, normalisasi hasil, dan penerusan
  pilihan ke `downloadByUrl` pada Sosmed Downloader.
- `plugins/downloader/ytsearch.js` — plugin tipis mengikuti konvensi
  `config` + `handler`.

## Cara kerja

1. Teks pesan dibaca dari argumen perintah, atau dari isi pesan yang dibalas
   (bila bukan media).
2. `parseSelection` membedakan pilihan hasil (`"3"`, `"3 mp3"`) dari kata
   kunci pencarian; teks lain apa pun dianggap kueri.
3. Kueri divalidasi (tidak kosong, maksimal `maxQueryLength` karakter), lalu
   `yt-search` dipanggil dengan `{ query }`. Hasil difilter agar hanya
   entri dengan `videoId` atau `url` yang dipakai, lalu dipotong menjadi
   `maxResults` entri.
4. Setiap hasil dinormalisasi secara defensif: label durasi memakai
   `timestamp` bila ada, jika tidak dihitung dari `duration.seconds`; jumlah
   tayangan diringkas menjadi bentuk Indonesia (`rb`, `jt`, `M`); judul
   dipotong sesuai `maxTitleLength`; tautan dibentuk dari `url` atau
   `https://www.youtube.com/watch?v=<videoId>`.
5. Hasil disimpan di cache per pengirim (`sender` sebagai kunci) beserta
   waktu penyimpanannya, lalu daftar bernomor dikirim beserta panduan
   pilihan.
6. Saat pilihan diterima, cache diperiksa terhadap `selectionTtlMs`;
   nomor divalidasi terhadap jumlah hasil, durasi video diperiksa terhadap
   `downloader.maxDurationSeconds` sebelum mengunduh, lalu `downloadByUrl`
   menjalankan pipeline Sosmed Downloader (pesan tunggu, resolve,
   unduhan, konversi MP3 bila diminta).

## Integrasi dengan Sosmed Downloader

`naze-sosdown-manager.js` mengekspor `downloadByUrl(m, url, intent)` dengan
intent `"video"` atau `"mp3"`. Pipeline unduhan (resolve, validasi durasi,
unduhan berkas, pengiriman, konversi MP3) diekstrak menjadi
`performSosmedDownload` dan `performMp3Download` sehingga perintah
`.tiktok`/`.instagram`/`.youtube`/`.mp3` dan Pencarian YouTube memakai
jalur yang sama; perbaikan pada satu jalur otomatis berlaku untuk semua.

## Batas

Seluruh batas diatur di blok `ytsearch` pada `config.js`:

| Kunci | Bawaan | Fungsi |
| --- | --- | --- |
| `maxResults` | 8 | jumlah hasil maksimal per pencarian |
| `maxQueryLength` | 100 | panjang kata kunci maksimal |
| `selectionTtlMs` | 600000 | masa berlaku pilihan hasil (10 menit) |
| `maxTitleLength` | 70 | panjang judul pada daftar hasil |

Batas durasi dan ukuran unduhan mengikuti blok `downloader` (lihat
`docs/SOSDOWN.md`).

## Batasan yang diketahui

1. `yt-search` membaca halaman hasil pencarian YouTube; bila YouTube
   mengubah strukturnya, hasil pencarian dapat gagal. Pembacaan field
   dilakukan defensif untuk menahan perubahan kecil.
2. Cache hasil disimpan di memori proses; bot yang direstart kehilangan
   daftar hasil (pengguna cukup mencari ulang).
3. Cache per pengirim tidak dibatasi jumlahnya; pada bot dengan sangat
   banyak pengguna aktif, entri berumur pendek dan otomatis dihapus saat
   kedaluwarsa serta saat pengguna mencari ulang.
4. Pencarian memerlukan jaringan; suite pengujian hanya dapat memverifikasi
   bagian murni dan integrasi lokal tanpa jaringan, dan menguji pencarian
   nyata secara best-effort.
5. Pilihan bernomor hanya berlaku pada hasil pencarian terakhir pengguna
   yang bersangkutan.
