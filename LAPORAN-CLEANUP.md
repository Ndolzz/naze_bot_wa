# Laporan Cleanup NAZE Bot 3.4.0

Tahap ini hanya pembersihan dan penataan ulang. Tidak ada fitur baru yang ditambahkan dan Store tidak disentuh.

Ringkasan angka (dibanding zip awal `naze-bot11.zip`):

| | Awal | Sekarang |
| --- | --- | --- |
| Total file | 891 | 704 |
| Ukuran | 32.8 MB | 6.6 MB |
| File plugin | 661 | 547 |
| Nama command ganda | 68 | 0 |
| Dependency | 64 | 60 |
| Emoji di source | 694+ | 0 |

## 1. Removed Files

- `plugins/ai/` (43 file), `plugins/tts/` (2), `plugins/media/` (2), `plugins/primbon/` (8), `plugins/random/` (6), `plugins/religi/` (4), `plugins/islamic/` (2)
- `plugins/owner/` (26): aktifaudiomenu, autosholat, cmdvn, ganti-naze, ganti-naze-demote, ganti-naze-games, ganti-naze-goodbye, ganti-naze-large, ganti-naze-levelup, ganti-naze-mp3, ganti-naze-mp4, ganti-naze-promote, ganti-naze-rpg, ganti-naze-rules, ganti-naze-v8, ganti-naze-welcome, ganti-naze-winner, ganti-naze2, ganti-naze3, ganti-pp-kosong, setallmenu, setaudioallmenu, setmenu, setmenucat, setreply, srt
- `plugins/tools/` (7): caribug, hd, imgtoprompt, styleteks, transkrip, videotranscribe, wink
- `plugins/main/`: menucat, ping2, sc, tqto
- `plugins/search/`: google, nerdfont, nerdfont-ambil, pap
- `plugins/group/`: autoai, notifsholat, openvo; `plugins/rpg/`: daily, ngemis; `plugins/canvas/`: pakustad; `plugins/info/`: berita; `plugins/stalker/`: discordstalk; `plugins/sticker/`: animebrat
- `plugins/game/`: htmlgame (diganti `arcade`), chatgame dan game2048 (duplikat arcade)
- `src/lib/` (10): naze-auto-ai, naze-backup, naze-carbon, naze-channels, naze-game-queue, naze-latex, naze-message, naze-reconnect, naze-sholat-api, naze-sholat-scheduler
- `src/scraper/` (41): claudehaiku, deepseek, douyin, dramabox, feeb, gemini, geminiVision, google, gpt5, gpt52, gsmarena, hd, hdvid, hdvid2, hokinfo, img2img, img2prompt, imglarger, konachan, kusonime, logic-bell, lufemboy, qwen3, reddit, reelsvideo, seaart, sfiledl, soundcloud, spotify, topmedia, twitter, txt2img, txt2img2, unlimitedai, upscaler, videy, wallpapersearch, wink, wwchar, youtube, yt
- `src/data/`: asmaulhusna, tebakbendera (versi lama), tebakkabupaten; `src/tiktok/` (8 file data)
- Aset: video dan audio menu, 9 gambar lama (anime dan duplikat), 2 font duplikat/tak terpakai, `assets/kertas/`, `data/`, `database/chatgot.json`, `database/sitagrup_pp.jpg`
- Skrip Termux (`install-termux.sh`, `start-termux.sh`, `check-termux.sh`, `scripts/`, `TERMUX_README.txt`), `UPDATE.txt`, `CHANGELOG-CLEANUP.txt`

Semua penghapusan file JS divalidasi dengan graf import (tidak ada import atau dynamic import yang menunjuk file itu). Hasil akhir: 0 file JS yatim dan 0 import putus.

## 2. Removed Features

- Kategori primbon, islamic, religi, random, dan fitur berita (termasuk pencarian Google News)
- Pengingat dan scheduler sholat, auto sahur
- Sound/musik novelty (mengkane, music), pengatur audio dan gif menu
- Balasan varian dokumen palsu, gif, dan preview; sistem gambar acak SRT
- `pap` (permintaan foto), `toblack`, `pakustad`, `styleteks`, reaksi anime kekerasan, mode NSFW mywaifu, perintah `loli`
- `sc` (tautan proyek lama), `ping2` (duplikat)
- Fitur duplikat: rpg/daily, rpg/ngemis, group/openvo, stalker/discordstalk, search/nerdfont, sticker/animebrat
- 19 plugin `ganti-naze*` (menunjuk path yang tidak ada, digantikan `ganti-asset`)

## 3. AI Removed

- Seluruh `plugins/ai/`: chat, gambar (text2img, txt2img, sologo, to3d, tofigure, dan sebagainya), asisten, dan pengubah gambar berbasis AI
- `group/autoai`, fitur voice-note-sebagai-perintah berbasis Groq (`cmdvn` dan blok di `handler.js`)
- `tools/`: hd, wink, imgtoprompt, transkrip, videotranscribe, caribug; `plugins/tts/` (TTS berbasis Gemini)
- 14 scraper AI (claudehaiku, deepseek, gemini, geminiVision, gpt5, gpt52, qwen3, unlimitedai, logic-bell, txt2img, txt2img2, img2img, img2prompt, seaart)
- `naze-auto-ai.js`, method AI di `apimanager` (gpt4, mathGpt, rewrite, geminiImage, seedream, flux, geminiTts, gitagpt, muslim, copilot)
- Konfigurasi AI (API key Google dan Groq, persona auto-AI), item "AI Access" di buyfitur, `@google/generative-ai`, `google-tts-api`
- Pencarian akhir: tidak ada sisa fitur AI. Sisa kata "AI" hanya di header library Nixel (`naze-builder.js`, pembangun pesan, bukan fitur AI) dan ekstensi file `.ai` di daftar konverter.

## 4. Old Branding Removed

Proyek asal: **Ourin MD** (Lucky Archz/naze, HyuuSATAN, Keisya, Danzzz; sempat bernama Mahiru Multidevice dan Tenka MD).

- Nama fallback "Naze-AI/Ourin-AI", footer "MAHIRU MULTIDEVICE", kode pairing jadibot lama, ID saluran WhatsApp lama (41 tempat), API key fallback proyek lama, contoh perintah bernama pengembang lama, gambar anime dan gambar game pihak ketiga
- Daftar kontributor lama di menu (`tqto` diganti `about`)
- Header kredit di `naze-exif.js`, `schedule.js`, `naze-reconnect.js` (dihapus bersama file yang tidak terpakai)
- **Atribusi tidak dihapus**: kredit pengembang asli dipindahkan ke `NOTICE.md` karena header aslinya meminta kredit tidak dihapus dan script tidak dijual. Lisensi header Nixel di `naze-builder.js` dan kredit game Qiro (`assets/arcade/CREDITS.txt`) juga dipertahankan.
- Metadata: nama paket `naze-bot`, author Nendi, README baru, `package.json` dirapikan.

## 5. Games Cleaned

- Dipertahankan: game kuis dan RPG (data dan logika tidak diubah), werewolf, minecraft, fisch, dan game lain di `plugins/game/`
- Arcade (`.arcade`): Dino Run, Speedy Dash, Fishing, Tetris, Catur, Ular Rimba, Tic Tac Toe, Teka-Teki Silang. Tampil dengan identitas "NAZE GAMES"; isi game dan credit pembuatnya tidak diubah (lisensi)
- Dihapus: game tombol buatan sebelumnya (duplikat arcade), tutorial dipindah ke `docs/`
- Banner game diganti banner Naze; path gambar yang salah (`assets/images`) diperbaiki di 6 plugin
- Perlu perhatian: beberapa game memakai tema/nama pihak ketiga (Minecraft, Fisch, kyubi). Logika tidak diubah.

## 6. Dependencies Removed (4, setelah koreksi)

`@bochilteam/scraper-primbon`, `@img/sharp-wasm32` — dihapus dengan alasan spesifik (fitur primbon sengaja dihapus; sharp-wasm32 khusus Termux dan menyebabkan error platform di server x64).
`@google/generative-ai`, `google-tts-api` — khusus dipakai file AI yang sengaja dihapus (Gemini dan TTS berbasis Gemini).

**Koreksi penting**: pada iterasi sebelumnya saya sempat menghapus 26 dependency lain (jimp, @adiwajshing/keyed-db, jsdom, dan sejenisnya) karena tidak ditemukan `import`/`require` untuk itu di source milikmu. Ini salah — sebagian dependency itu dipakai **secara internal oleh library `naze` (Wileys/Baileys)** sendiri, bukan oleh kode plugin. Karena `naze` diinstal dari registry npm dan saya tidak punya salinannya untuk diperiksa isinya, saya tidak bisa memverifikasi satu per satu mana yang benar-benar aman dihapus. Setelah error `Cannot find module 'jimp'` muncul di panel, ke-26 dependency itu **dikembalikan semua** ke `package.json`, kecuali dua yang jelas berasal dari fitur yang sengaja dihapus (`@bochilteam/scraper-primbon`) dan satu yang dihapus dengan alasan lain (`@img/sharp-wasm32`). Ditambah `ffmpeg-static` (opsional) sebagai cadangan ffmpeg di panel.

Pelajaran: pencarian statis di source sendiri tidak cukup untuk memutuskan dependency mana yang aman dihapus ketika salah satu dependency (`naze`) adalah library eksternal dengan kebutuhan internal yang tidak terlihat dari kode milikmu. **`npm install` wajib dijalankan dan diuji di panel** sebelum dianggap final — ini belum bisa saya lakukan di lingkungan kerja saya karena tidak ada akses jaringan.

## 7. Menu Refactored

**Sebelum**: menu bervarian (gif, audio, dokumen palsu), font small-caps, hiasan kotak, emoji, banyak kategori campur (primbon, islamic, random, dan lainnya) dengan ratusan command dalam satu daftar.

**Sesudah** (dibangun dari command yang benar-benar terdaftar, dihitung dengan pemuat plugin asli):

| Menu | Command | Submenu |
| --- | --- | --- |
| Main | 25 | Help, About, Profile |
| Tools | 214 | Downloader, Media, Stickers, Text Effects, Converter, Documents, Utilities, Search, Account Lookup |
| Games | 134 | Games, RPG, Clan, Fun, Rank |
| Groups | 110 | Moderation, Protection, Management, Automation |
| System | 20 | Status, Information |
| Owner (panel terpisah) | 152 | Bot, User, Group, Plugin, dan System Management |

- `.menu`, `.menu <menu>`, `.menu <menu> <submenu>`, `.allmenu`, `.groupmenu`, `.ownermenu`
- Command owner tidak tampil di menu pengguna biasa; command yang dihapus tidak muncul; `.totalfitur` mengikuti struktur yang sama
- 68 bentrok nama/alias diselesaikan (52 alias dibuang, 6 plugin duplikat dihapus, beberapa nama diganti: rpg/nulis menjadi `cerpen`, group/pin menjadi `pinmsg`)
- Command moderasi kata kasar (`antitoxic`, `addtoxic`, `deltoxic`, `listtoxic`) tetap berfungsi tetapi disembunyikan dari menu

## 8. Core Preserved

Tidak diubah sama sekali: `naze-database.js`, `naze-asset-manager.js`, `naze-premium-db.js`, `naze-group-protection.js`, `naze-game-data.js`, seluruh logika plugin loader (`naze-plugins.js`, hanya satu komentar diperbaiki), sistem izin (owner, premium, admin), scheduler, dan penanganan grup.

Diubah seperlunya:
- `index.js`: hook sholat dan sahur dibuang, ringkasan startup ditambahkan
- `src/connection.js`: pesan sambutan saat bot masuk grup (fake forward 9999 dibuang), kode pairing kustom `NAZENAZE` (atas permintaan), komentar. **Alur koneksi, autentikasi, sesi, dan reconnect tidak diubah.**
- `src/handler.js`: hook AI, voice-command, srt, dan sticker-reply yang menunjuk file tidak ada dibuang
- `src/lib/naze-socket.js`: pembersih teks keluar (`naze-textclean.js`)
- `src/lib/naze-serialize.js`: `m.reply` disederhanakan menjadi teks polos
- `src/lib/naze-middleware.js`: perbaikan bug laten `config.config.mode`
- `config.js`: ditulis ulang (rahasia ke environment, pesan profesional)
- Perubahan kecil lain di file `src/lib` hanya kosmetik (teks/emoji/salah ketik)

## 9. Pairing Test

Diuji dengan menjalankan `index.js` asli, `connection.js`, handler, dan seluruh plugin, dengan **library pihak ketiga (termasuk Baileys) diganti tiruan** karena tidak ada `node_modules` dan jaringan.

- Startup: 623 dari 623 modul JS berhasil diimpor tanpa error; config terbaca; database terbuka (ready); 547 plugin dimuat; aset ter-cache
- Pairing: `requestPairingCode` dipanggil dengan nomor dari config dan kode `NAZENAZE` setelah jeda 3 detik
- Event terdaftar: messages.upsert, connection.update, creds.update, group-participants.update, dan lainnya
- Alur `connection.update` untuk `open` dan untuk `close` (jalur reconnect) berjalan tanpa error
- **Belum teruji**: jabat tangan WhatsApp sungguhan, penyimpanan sesi ke `storage/session/` oleh Baileys asli, dan reconnect nyata. Uji ini harus dilakukan di panel.

## 10. Command Test (setelah pembersihan kunci API, diuji ulang)

Pesan disuntikkan lewat `messages.upsert` dan diproses handler serta plugin asli:

- Owner, chat pribadi: `.menu`, `.menu tools downloader`, `.about`, `.ownermenu`, `.arcade` membalas benar
- Non-owner, pribadi: `.ownermenu` ditolak, `.menu owner` tidak ditemukan, `.allmenu` (2 pesan), `.totalfitur`, `.ping`, `.arcade dino`, `.tetris` (widget), `.tebakkata`, `.daily`, `.profile`, `.leaderboard` membalas
- Grup, non-admin: `.groupmenu`, `.menu groups moderation` membalas; `.kick`, `.warn`, `.antilinkall` ditolak dengan pesan "Khusus admin"
- Semua teks menu: tanpa emoji dan tanpa karakter non-ASCII; command tersembunyi dan command owner tidak bocor ke menu pengguna
- Sintaks: 624 file lolos `node --check`; nama command ganda runtime: 0
- Tidak diuji: pengunduhan/scraping, API pihak ketiga, pengolahan media (butuh jaringan, ffmpeg, dan library asli)

## 11. Remaining Issues

1. **Riwayat bug dependency (sudah diperbaiki)**: sempat menghapus 26 dependency yang ternyata sebagian dibutuhkan internal oleh library `naze`, menyebabkan bot gagal start dengan error `Cannot find module 'jimp'`. Sudah dikembalikan (lihat bagian 6). Karena ini terbukti tidak selalu terdeteksi lewat pencarian statis, jalankan `npm install` lalu start bot di panel dan cek console untuk error module lain sebelum dipakai produksi.
2. **API key**: kunci lama yang hardcoded (termasuk Google/Gemini, Groq, dan kunci layanan gambar/upload yang tersebar di 18 file lain seperti termai dan tenor) telah dihapus dari seluruh source, bukan hanya `config.js`. Anggap semua kunci itu bocor. Fitur yang bergantung pada layanan neoxr, fgsi, covenant, obscura, firefly, cuki, termai, dan tenor baru berjalan setelah kamu mengisi key milikmu sendiri di `.env`.
3. **Endpoint tidak terverifikasi**: status hidup/matinya API downloader dan scraper tidak bisa dicek tanpa jaringan. Gambar kuis `tebakgambar` (1000 URL cademedia) dan `renungan` (telegra.ph) bergantung host eksternal. Uji di panel lalu hapus yang mati.
4. **Konten yang perlu keputusan**: `autoanimewinbu` dan `film`/`movieku` mengambil video dari situs tidak resmi (risiko legal); `stalker` (pencarian akun), `confess`, `tohijab`.
5. **Pembersihan teks masih sebagian dilakukan saat runtime**: hiasan kotak dan sebagian pesan berformat lama di source dibersihkan oleh `naze-textclean.js` sebelum terkirim. Sumber teksnya belum ditulis ulang satu per satu. Ada sekitar 187 import tak terpakai yang belum dibersihkan (tidak berbahaya).
6. **Tema pihak ketiga**: game bertema Minecraft/Fisch/Kyubi dan teks humor RPG bernada kasar ringan masih ada.
7. **Donasi**: `config.donasi` dikosongkan (nomor/QRIS lama dihapus). Isi sendiri bila dibutuhkan. Komponen Store (`pgPayments`, `pgTopups`, teks pembayaran) tidak disentuh.
8. **Lisensi**: pembuat asli meminta kredit tidak dihapus dan script tidak dijual; game Qiro melarang perubahan besar tanpa izin. Hormati `NOTICE.md`.
9. **`npm install`** belum diverifikasi menyeluruh di lingkungan sebenarnya (baru diketahui satu bug lewat laporanmu). Jika muncul konflik versi `sharp`, `.npmrc` sudah mengaktifkan `legacy-peer-deps`. Jika muncul error `Cannot find module` lain, kemungkinan besar itu dependency internal `naze` lain yang belum diketahui — laporkan nama modulnya dan saya tambahkan ke `package.json`.

## 12. Final Structure

```
NAZE Bot
├── index.js                  Titik masuk
├── config.js                 Konfigurasi (rahasia lewat .env)
├── .env.example, .gitignore, .npmrc
├── README.md, CHANGELOG.md, NOTICE.md
├── case/naze.js              Perintah berbasis case
├── plugins/                  547 plugin
│   ├── main (Help, About, Profile)     ├── group
│   ├── download, convert, canvas,      ├── owner
│   │   sticker, ephoto, tools,         ├── info, cek
│   │   utility, search, stalker        └── user
│   └── game, rpg, clan, fun, anime
├── src/
│   ├── connection.js         Koneksi, pairing, reconnect
│   ├── handler.js            Penanganan pesan dan perintah
│   ├── lib/                  Database, plugin loader, menu, scheduler, dll.
│   ├── scraper/              Scraper downloader dan tools
│   └── data/                 Data game
├── assets/                   image, fonts, arcade (game HTML)
├── database/                 Data bot
└── docs/                     Dokumentasi tambahan
```
