# Sosmed Downloader NAZE

Dokumentasi teknis fitur Sosmed Downloader (NAZE Bot 3.8.0). Fitur ini
dipindahkan dari repositori `naze-sosdown` (aplikasi web) lalu disesuaikan
menjadi modul bot tanpa dependensi baru.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `.tiktok <tautan>` | Mengunduh video atau foto TikTok |
| `.instagram <tautan>`, `.ig <tautan>` | Mengunduh video, foto, atau carousel Instagram |
| `.youtube <tautan>`, `.yt <tautan>` | Mengunduh video YouTube |
| `.mp3 <tautan>` | Mengunduh audio dari tiga platform sebagai MP3 |

Tautan dapat dikirim setelah perintah atau dengan membalas pesan berisi
tautan. Platform dikenali otomatis dari tautannya; bila tautan tidak sesuai
perintah yang dipakai, bot menolak dengan saran perintah yang tepat.

## Struktur modul

- `src/lib/naze-sosdown-utils.js` — modul murni: deteksi platform dari
  tautan, batas unduhan, pemilihan varian media, penyusun opsi ffmpeg MP3,
  templat pesan, dan teks menu. Tanpa efek samping sehingga mudah diuji.
- `src/lib/naze-sosdown-resolvers.js` — resolver jaringan per platform
  (dipindahkan dari `naze-sosdown` `lib/resolvers`), cache cookie media,
  dan pengunduh berkas. Seluruh permintaan memakai fetch bawaan Node dengan
  batas waktu (`AbortSignal.timeout`).
- `src/lib/naze-sosdown-manager.js` — orkestrator perintah: sumber tautan,
  validasi, unduhan, konversi MP3, dan pengiriman hasil.
- `plugins/downloader/` — plugin tipis per perintah (`tiktok`, `instagram`,
  `youtube`, `mp3`), mengikuti konvensi `config` + `handler` repositori.

## Sumber tautan

Urutan pencarian teks: argumen setelah perintah (`m.text`), lalu isi pesan
yang dibalas (`m.quoted.body`, hanya bila bukan media). `findSosmedLink`
memecah teks menjadi token, membersihkan tanda baca di tepi token, lalu
memeriksa tiap token dengan `detectPlatform`, sehingga tautan di tengah
kalimat tetap dikenali.

## Cara kerja resolver

Resolver tidak memanggil API resmi platform dan hanya membaca halaman
publik, sama seperti aplikasi web `naze-sosdown`. Titik yang paling rawan
berubah pada struktur platform ditandai dengan komentar PERAWATAN di kode.

### TikTok

1. Tautan pendek (`vt.tiktok.com`, `vm.tiktok.com`) dibuka untuk mendapatkan
   URL kanonik (mengikuti pengalihan).
2. Halaman web video/foto diambil, lalu blok JSON
   `__UNIVERSAL_DATA_FOR_REHYDRATION__` dibaca dari HTML.
3. Video: daftar varian pada `video.bitrateInfo` diurutkan menurun bitrate;
   varian tertinggi diberi label `hd`, sisanya `sd`, semua tanpa watermark.
   Bila daftar tidak tersedia, dipakai `video.playAddr`. Varian
   `video.downloadAddr` (berwatermark) tetap disertakan sebagai cadangan,
   tetapi `choosePreferredItem` selalu memilih varian tanpa watermark lebih
   dulu.
4. Foto: URL diambil dari `imagePost.images`; setiap foto menjadi satu item
   unduhan.

### Instagram

1. Shortcode diambil dari jalur `/p/`, `/reel/`, atau `/tv/`.
2. Halaman embed publik (`/{type}/{shortcode}/embed/captioned`) diambil;
   halaman ini dapat dibaca tanpa login untuk sebagian besar konten publik.
3. Blok JSON konteks dibaca dari HTML; postingan yang dibatasi usia, dihapus,
   atau privat terdeteksi dan dilaporkan dengan pesan yang jelas.
4. Video menghasilkan satu item; carousel menghasilkan satu item per foto.

### YouTube

1. Id video diambil dari parameter `v`, `youtu.be`, atau jalur
   `/shorts/`, `/embed/`, `/live/`, `/v/`.
2. Utama: player Innertube dengan klien ANDROID (endpoint
   `player` versi `20.10.38`) yang kerap memberi URL langsung tanpa
   decipher.
3. Cadangan: halaman `watch` diambil, `ytInitialPlayerResponse` dibaca dari
   HTML, URL player JS (`base.js`) diikuti, lalu fungsi decipher dibangun
   secara dinamis untuk membuka URL format yang tersandi.
4. Video: format progresif (video+audio) diurutkan menurun resolusi; varian
   tertinggi diberi label `hd`.
5. Audio (untuk `.mp3`): trek audio adaptif diambil; AAC dalam wadah MP4
   diprioritaskan karena paling kompatibel dengan konversi MP3.

### Pengunduhan berkas

CDN TikTok/Instagram menolak (403) pengambilan dari IP server tanpa cookie
sesi yang diterima saat halaman sumber diambil. Karena itu cookie disimpan
per URL media di memori proses lalu diteruskan saat mengunduh berkas.
Unduhan dibatasi `maxMediaBytes`; `content-length` diperiksa sebelum isi
berkas dibaca sehingga berkas besar digagalkan lebih awal.

## Pengiriman hasil

- Video: dikirim sebagai pesan video bila ukurannya tidak melebihi
  `mediaMessageMaxBytes` (bawaan 64 MB); selain itu dikirim sebagai dokumen.
- Foto/carousel: dikirim berurutan sebagai pesan gambar; foto pertama membawa
  keterangan hasil. Maksimal `maxPhotosPerPost` (bawaan 5) foto per
  postingan; sisanya dilaporkan bila ada.
- Kaption memuat judul/keterangan konten, penulis, kualitas, dan tautan
  sumber.

## Konversi MP3

`.mp3` memakai ffmpeg di sisi server (menggantikan konversi peramban pada
aplikasi web `naze-sosdown` yang tidak memiliki ffmpeg):

1. Sumber audio dipilih dengan `chooseAudioSource`: trek audio terpisah bila
   ada (YouTube), atau varian video terbaik untuk platform tanpa trek
   terpisah. Konten foto ditolak.
2. Unduhan sumber disimpan sementara di `storage/temp`.
3. Sampul (thumbnail) diunduh bila tersedia dan hanya diterima bila JPEG
   atau PNG (ffmpeg menempelkan gambar tanpa transkode).
4. Konversi memakai `libmp3lame` pada `mp3BitrateKbps` (bawaan 192) dengan
   metadata ID3v2.3 (+ID3v1), judul, penulis, dan sampul sebagai attached
   picture.
5. Hasil yang melebihi `mp3MaxBytes` dikonversi ulang sekali pada
   `mp3MinBitrateKbps` (bawaan 128); bila masih melebihi batas, pengunduhan
   digagalkan dengan pesan.
6. Hasil dikirim sebagai pesan audio bila tidak melebihi
   `audioMessageMaxBytes` (bawaan 16 MB); selain itu sebagai dokumen
   `audio/mpeg`. Berkas sementara selalu dihapus.

## Batas

Seluruh batas diatur di blok `downloader` pada `config.js`:

| Kunci | Bawaan | Fungsi |
| --- | --- | --- |
| `maxMediaBytes` | 100 MB | ukuran maksimal berkas yang diunduh |
| `maxDurationSeconds` | 1800 | durasi maksimal video sumber |
| `maxPhotosPerPost` | 5 | foto maksimal per postingan |
| `mediaMessageMaxBytes` | 64 MB | batas kirim sebagai pesan media |
| `requestTimeoutMs` | 30000 | batas waktu permintaan ke platform |
| `mp3BitrateKbps` | 192 | bitrate MP3 bawaan |
| `mp3MinBitrateKbps` | 128 | bitrate percobaan ulang |
| `mp3MaxBytes` | 50 MB | ukuran maksimal hasil MP3 |
| `audioMessageMaxBytes` | 16 MB | batas kirim sebagai pesan audio |

## Batasan yang diketahui

1. Struktur halaman platform dapat berubah sewaktu-waktu. Resolver memakai
   jalur resmi yang paling stabil (halaman publik, embed, Innertube), tetapi
   titik rawan ditandai komentar PERAWATAN dan perlu diperiksa bila fitur
   tiba-tiba gagal.
2. Cookie media disimpan di memori proses; bot yang berjalan lama dengan
   banyak unduhan menyimpan banyak entri, dan cache hilang saat bot
   direstart (tidak berbahaya, hanya mengunduh ulang cookie berikutnya).
3. Konten Instagram privat, dibatasi usia, atau dihapus tidak dapat diunduh
   tanpa login; bot menolak dengan pesan yang jelas.
4. URL format YouTube berumur pendek; unduhan dilakukan segera setelah
   resolve sehingga jarang kedaluwarsa, tetapi tautan yang lama tidak dapat
   dipakai ulang.
5. Konversi MP3 memerlukan ffmpeg dengan `libmp3lame`; `ffmpeg-static` pada
   `optionalDependencies` sudah memenuhinya, begitu juga build ffmpeg sistem
   pada umumnya.
6. Pengujian di lingkungan tanpa dependensi hanya menjalankan bagian murni;
   bagian integrasi (konversi MP3) otomatis dilewati dengan laporan. Resolver
   memerlukan jaringan sehingga hanya diuji di lingkungan nyata.
