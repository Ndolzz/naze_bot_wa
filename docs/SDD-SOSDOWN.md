# SDD — Downloader Media Sosial (Sosdown)

Software Design Document fitur pengunduh media TikTok dan Instagram pada
NAZE Bot 3.8.0. Menjelaskan tujuan, arsitektur, kontrak data, alur pemrosesan,
strategi unduhan, penanganan kesalahan, serta titik perawatan modul yang
dipindahkan dari repositori [naze-sosdown](https://github.com/Ndolzz/naze-sosdown).

## 1. Tujuan dan ruang lingkup

Fitur ini memungkinkan pengguna bot mengunduh media dari tautan TikTok dan
Instagram langsung di chat WhatsApp, tanpa server tambahan, tanpa API resmi
platform, dan tanpa kredensial login apa pun.

Yang termasuk ruang lingkup:

- Perintah `.tiktok` (alias `.tt`) untuk video dan postingan foto TikTok.
- Perintah `.ig` (alias `.instagram`) untuk video, foto, dan carousel Instagram
  publik.
- Batas 64 MB per berkas dan 10 media per postingan.

Yang tidak termasuk ruang lingkup:

- Konten Instagram privat (memerlukan sesi login; sengaja tidak didukung).
- Akun, story, dan pembaruan profil.
- Mengunggah atau meneruskan media ke platform lain.

## 2. Struktur modul

- `src/lib/sosdown/media-cookies.js` — cache cookie sesi per URL media.
  Cookie diterima saat halaman sumber diambil pada tahap resolve, lalu
  diteruskan ke CDN pada tahap unduh. Fungsi: `rememberCookies`,
  `getCookieFor`, `extractResponseCookie`.
- `src/lib/sosdown/tiktok.js` — resolver TikTok: membuka halaman postingan
  lalu mengurai blok JSON `__UNIVERSAL_DATA_FOR_REHYDRATION__`. Fungsi utama:
  `resolveTikTok`.
- `src/lib/sosdown/instagram.js` — resolver Instagram: membuka halaman embed
  publik `/embed/captioned/` lalu mengurai blok `contextJSON`. Fungsi utama:
  `resolveInstagram`.
- `src/lib/sosdown/download.js` — tahap unduh berkas dari CDN dengan strategi
  tiga upaya berjenjang. Fungsi utama: `downloadMediaBytes`.
- `src/lib/naze-sosdown.js` — orkestrator: deteksi platform, pengiriman
  media, dan penyusunan caption. Fungsi: `detectSosdownPlatform`,
  `resolveSosdownLink`, `sendSosdownMedia`.
- `plugins/download/tiktok.js` — plugin tipis: parsing argumen kualitas dan
  pemilihan item.
- `plugins/download/instagram.js` — plugin tipis: mengirim seluruh item hasil
  resolve.

Seluruh modul murni ESM dan hanya memakai `fetch` bawaan Node.js 20; tidak
ada dependensi baru.

## 3. Alur pemrosesan

1. Plugin menerima teks setelah perintah (`m.text`), lalu memanggil
   `resolveSosdownLink` di orkestrator.
2. `detectSosdownPlatform` mengenali platform dari host dan path URL:
   - TikTok: host `tiktok.com` (termasuk subdomain) atau `vt`/`vm`.tiktok.com
     (tautan pendek).
   - Instagram: host `instagram.com` dengan path `/p/`, `/reel/`, atau
     `/tv/` diikuti shortcode.
3. Resolver platform mengembalikan metadata postingan dan daftar item media,
   sekaligus menyimpan cookie sesi halaman sumber ke cache.
4. Plugin memilih item (TikTok: sesuai opsi `hd`/`sd`/`wm`; Instagram: semua
   item) dan memanggil `sendSosdownMedia`.
5. Untuk setiap item, `downloadMediaBytes` mengunduh berkas dari CDN dengan
   strategi berjenjang (bagian 6), lalu media dikirim melalui `m.replyVideo`
   (video) atau `m.replyImage` (foto) dengan caption.

## 4. Kontrak data

Media item hasil resolver:

```
{
  url:          string,           // URL berkas di CDN
  quality:      string,          // "hd"/"sd"/"WxH"/"original"
  label:        "hd" | "sd" | null,
  hasWatermark: boolean,
  mimeType:     "video/mp4" | "image/jpeg",
  thumbnailUrl: string | null
}
```

Hasil resolve:

```
// sukses
{ ok: true,
  data: {
    platform: "tiktok" | "instagram",
    type:     "video" | "photo" | "carousel",
    items:    MediaItem[],
    author:   string | null,   // username tanpa "@"
    caption:  string | null,   // caption postingan
    sourceUrl: string          // URL kanonik (TikTok) / URL embed (Instagram)
  } }

// gagal
{ ok: false, error: { code: string, message: string } }
```

Hasil unduh (`downloadMediaBytes`):

```
{ ok: true, buffer: Buffer, mimeType: string }
{ ok: false, message: string }
```

## 5. Desain resolver

### 5.1 TikTok (`resolveTikTok`)

1. Tautan pendek `vt`/`vm`.tiktok.com dibuka dengan redirect mengikuti
   (header peramban desktop Chrome 124) untuk mendapatkan URL kanonik.
2. ID item diekstrak dari URL kanonik (`/video/<id>` atau `/photo/<id>`).
   Tanpa ID, tautan ditolak sebagai `invalid_link`.
3. Halaman kanonik diambil; cookie `set-cookie` dari respons disimpan ke
   cache untuk seluruh URL media dan sampul.
4. Blok `__UNIVERSAL_DATA_FOR_REHYDRATION__` diparse sebagai JSON, lalu item
   diambil dari jalur `__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct`.
5. Pembentukan item:
   - Video: daftar `video.bitrateInfo` diurutkan menurun berdasarkan bitrate;
     varian pertama diberi label `hd`, sisanya `sd`. Bila daftar tidak
     tersedia, fallback `video.playAddr` dengan label `hd`. `video.downloadAddr`
     (versi watermark) ditambahkan sebagai item `hasWatermark: true` bila
     berbeda dari URL yang sudah ada.
   - Foto: setiap entri `imagePost.images` menjadi item `image/jpeg` dengan
     kualitas `lebar x tinggi`.
6. `author` diambil dari `author.uniqueId`, `caption` dari `desc`.

### 5.2 Instagram (`resolveInstagram`)

1. Shortcode diekstrak dari path `/p|reel|tv/<shortcode>`.
2. Halaman embed publik
   `https://www.instagram.com/<tipe>/<shortcode>/embed/captioned/` diambil
   dengan header peramban desktop.
3. Halaman yang menandai konten tidak tersedia ("Sorry, this page isn't
   available" atau padanan Indonesianya) ditolak sebagai
   `content_unavailable` (postingan privat atau terhapus).
4. Blok `"contextJSON":"..."` diparse dua lapis (unescape lalu JSON.parse)
   menjadi objek `shortcode_media`.
5. Pembentukan item:
   - Bila `edge_sidecar_to_children` ada, setiap anak node menjadi item dan
     tipe postingan `carousel`; jika tidak, `is_video` menentukan item video
     (`video_url`) atau foto (`display_url`).
   - Halaman embed hanya menyediakan satu varian media, sehingga item tidak
     diberi label kualitas.
6. `author` diambil dari `owner.username`, caption dari
   `edge_media_to_caption`.

## 6. Strategi unduhan (`downloadMediaBytes`)

CDN TikTok dan Instagram sering menolak (403) permintaan dari IP server.
Unduhan karena itu menjalankan tiga upaya berjenjang dalam dua ronde (jeda
600 ms antar ronde):

1. Header lengkap (peramban desktop, referer platform) plus cookie tersimpan
   dari tahap resolve.
2. Cookie sesi baru diambil langsung dari halaman sumber (timeout 20 detik),
   disimpan ke cache, lalu permintaan diulang.
3. Permintaan polos: hanya `User-Agent` dan `Accept`, tanpa cookie dan
   referer, untuk CDN yang justru menolak header tersebut.

Status 2xx dan 206 diterima. Timeout media 120 detik (dilaporkan sebagai
"waktu unduhan habis"). Batas ukuran 64 MB diperiksa dua kali: dari header
`content-length` sebelum membaca tubuh respons, dan dari panjang buffer
sesudahnya. Buffer kosong ditolak. MIME type diambil dari header
`content-type` respons.

## 7. Orkestrator (`naze-sosdown.js`)

- `detectSosdownPlatform(rawUrl)` — menormalkan URL (menambahkan `https://`
  bila perlu) dan mengembalikan platform, atau `null` bila tidak dikenali.
- `resolveSosdownLink(rawUrl)` — mendeteksi platform lalu mendelegasikan ke
  resolver yang sesuai; tautan non-TikTok/Instagram ditolak sebagai
  `unsupported_platform`.
- `sendSosdownMedia(m, data, items)` — memotong daftar ke maksimal 10 item;
  untuk setiap item: unduh, susun caption, kirim video (`video/*`) atau foto.
  Bila satu item gagal, proses berhenti dan pesan kesalahan diteruskan ke
  pengguna; item setelahnya tidak dikirim (bagian 9).

Caption disusun dari `@author`, caption postingan (maks 800 karakter), dan
`Sumber: <url>`, digabung dengan baris kosong dan dipotong ke 1000 karakter,
lalu diberi akhiran `(i/n)` bila postingan multi-media.

## 8. Perintah pengguna

| Perintah | Perilaku |
| --- | --- |
| `.tiktok <tautan> [hd\|sd\|wm]` | `hd` (bawaan): video tanpa watermark kualitas tertinggi; `sd`: varian bitrate lebih rendah; `wm`: versi asli dengan watermark. Postingan foto dikirim utuh. |
| `.ig <tautan>` | Mengirim seluruh media postingan publik (video, foto, atau carousel). |

Kedua plugin berkategori `download`, ber-cooldown 15 detik, dan muncul
otomatis pada menu dinamis `.menu`. Balasan status plugin memakai `m.reply`
sehingga tetap menyertai banner NAZE; media dikirim lewat `replyVideo` /
`replyImage` dengan caption.

## 9. Penanganan kesalahan

| Kode | Kondisi | Pesan pengguna |
| --- | --- | --- |
| `unsupported_platform` | Tautan bukan TikTok/Instagram | Tautan tidak dikenali sebagai tautan TikTok atau Instagram. |
| `invalid_link` | Tautan tanpa penanda postingan yang dikenali | Bervariasi per platform. |
| `parse_failed` | Halaman terambil tetapi data tidak dapat diurai | Struktur sumber kemungkinan berubah. |
| `content_unavailable` | Konten terhapus, privat, atau tidak ditemukan | Bervariasi per platform. |
| Kegagalan unduhan | 403/timeout/ukuran melebihi 64 MB | Diteruskan sebagai "Unduhan gagal: <alasan>". |

Perilaku parsial yang diketahui: bila media ke-i dari n gagal diunduh, media
1..i-1 sudah terkirim dan tidak dapat ditarik kembali; proses berhenti di
situ. Ini pilihan sadar agar kegagalannya jelas terlapor sejak dini daripada
diam-diam dilewati.

## 10. Keputusan desain

1. Port self-contained dari naze-sosdown tanpa perubahan logika resolver;
   hanya anotasi TypeScript yang dihapus dan bagian khusus Next.js pada route
   unduhan yang diganti fungsi murni penghasil buffer.
2. Tidak memakai API resmi platform: bebas kunci API dan kredensial, tetapi
   bergantung pada struktur HTML internal yang dapat berubah (bagian 11).
3. Cache cookie per URL media, bukan per proses: cookie batal/403 pada satu
   media tidak merusak media lain, dan cookie segar dari ronde unduhan dapat
   dipakai ulang.
4. Batas 64 MB per berkas konsisten dengan `.ytmp3`/`.ytmp4`; batas 10 media
   menjaga agar carousel panjang tidak membanjiri chat.
5. Resolver Instagram memakai halaman embed, satu-satunya halalaman publik
   yang stabil tanpa login; akibatnya hanya tersedia satu varian kualitas.

## 11. Titik perawatan

Kode sumber menandai titik rawan dengan komentar `PERAWATAN`. Bila resolver
mulai gagal secara luas, periksa berikut sesuai platform:

- TikTok: apakah halaman masih menyisipkan
  `script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"`; jalur kunci
  `webapp.video-detail` -> `itemInfo` -> `itemStruct`; bentuk
  `video.bitrateInfo[].PlayAddr.UrlList` dan `imagePost.images[].imageURL.urlList`.
- Instagram: pola `"contextJSON":"..."` pada halaman embed
  `/embed/captioned/`, dan teks penanda halaman tidak tersedia.

## 12. Pengujian dan verifikasi

- Seluruh berkas JS lolos pemeriksaan sintaks (parse-check modul).
- Konten remote pasca-push diverifikasi identik dengan konten lokal untuk
  semua berkas fitur ini.
- Pengujian runtime (tautan TikTok/Instagram nyata) belum dapat dilakukan
  di lingkungan pengembangan; jalankan `.tiktok` dan `.ig` pada panel setelah
  `npm install` dan restart bot.

## 13. Referensi

- Repositori sumber: [naze-sosdown](https://github.com/Ndolzz/naze-sosdown)
  (`lib/resolvers/tiktok.ts`, `lib/resolvers/instagram.ts`,
  `lib/media-cookies.ts`, `app/api/download/route.ts`).
- Entri changelog terkait: `CHANGELOG.md` bagian 3.8.0.
