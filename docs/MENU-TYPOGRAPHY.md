# Standar Tipografi dan Struktur Menu Naze

Dokumen ini menjelaskan standar tipografi, penomoran, dan struktur menu Naze Bot
setelah refactor, serta cara menonaktifkan karakter dekoratif bila perlu.

## Sumber Menu

Seluruh tampilan menu dibangun dari dua modul:

- `src/lib/naze-menu-typography.js` — sistem gaya Unicode dan fallback teks polos.
- `src/lib/naze-menu-util.js` — struktur kategori/submenu/perintah dan seluruh renderer.

Sumber tampilan yang memakai kedua modul tersebut:

- `.menu` (`plugins/main/menu.js`) — menu utama, section, dan submenu.
- `.allmenu` (`plugins/main/allmenu.js`) — seluruh perintah, dipecah per pesan.
- `.groupmenu` (`plugins/main/groupmenu.js`) — section Groups dengan judul NAZE GROUP.
- `.ownermenu` (`plugins/owner/ownermenu.js`) — section Owner dengan judul NAZE OWNER PANEL.
- `.listallcase` dan `.listallplugin` (`case/naze.js`) — daftar case dan plugin.

## Hierarki Tipografi

Unicode dekoratif hanya dipakai pada elemen penekanan; nama perintah selalu ASCII
biasa agar mudah dibaca, disalin, dan diketik.

| Elemen | Gaya | Contoh |
| --- | --- | --- |
| Judul utama | Fullwidth | ＮＡＺＥ ＭＥＮＵ |
| Header daftar kategori | Sans bold | 𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗬 𝗠𝗘𝗡𝗨 |
| Section: main | Sans bold | 𝗠𝗔𝗜𝗡 𝗠𝗘𝗡𝗨 |
| Section: tools | Sans bold italic | 𝙏𝙊𝙊𝙇𝙎 𝙈𝙀𝙉𝙐 |
| Section: games | Sans | 𝙶𝙰𝙼𝙴𝚂 𝙼𝙴𝙽𝚄 |
| Section: groups | Serif bold | 𝐆𝐑𝐎𝐔𝐏𝐒 𝐌𝐄𝐍𝐔 |
| Section: system | Monospace | 𝚂𝚈𝚂𝚃𝙴𝙼 𝙼𝙴𝙽𝚄 |
| Section: owner | Serif bold italic | 𝙉𝘼𝙕𝙀 𝙊𝙒𝙉𝙀𝙍 𝙋𝘼𝙉𝙀𝙇 |
| Nama kategori pada daftar case/plugin | Sans bold | 𝗜𝗡𝗙𝗢 |
| Nama perintah | ASCII biasa | `.ocr` |

Gaya per submenu ditetapkan pada `SUB_STYLES` di `naze-menu-typography.js`, antara lain:

| Submenu | Gaya | Hasil |
| --- | --- | --- |
| Fun | Sans bold | 𝗙𝗨𝗡 |
| Games | Sans bold italic | 𝙂𝘼𝙈𝙀𝙎 |
| Clan | Sans | 𝖢𝖫𝖠𝖭 |
| Rank | Serif italic | 𝘙𝘈𝘕𝘒 |
| RPG | Serif bold | 𝐑𝐏𝐆 |
| Help | Serif bold | 𝐇𝐄𝐋𝐏 |
| Downloader | Sans bold italic | 𝘋𝘰𝘸𝘯𝘭𝘰𝘢𝘥𝘦𝘳 |
| Information | Monospace | 𝙸𝙽𝙵𝙾𝚁𝙼𝙰𝚃𝙸𝙾𝙽 |
| Moderation | Sans bold italic | 𝘔𝘖𝘋𝘌𝘙𝘈𝘛𝘐𝘖𝘕 |

Label submenu yang belum terdaftar otomatis memakai sans bold. Penambah gaya
baru cukup dengan menambah entri pada `SUB_STYLES`; jangan memberi gaya berbeda
secara acak pada tiap baris.

## Penomoran

1. Menu utama menomori daftar kategori: `1.`, `2.`, `3.`, dan seterusnya.
2. Setiap section menomori daftar submenu dan setiap submenu menomori daftar
   perintah, keduanya dimulai kembali dari `1.`.
3. Nomor hanya visual; pemilihan menu memakai nama, misal `.menu games fun`.
   Nomor bukan nama perintah dan tidak dapat dipakai untuk navigasi.

## Tata Letak WhatsApp

- Baris pendek, jarak antarbagian konsisten, tanpa paragraf panjang.
- Pemisah tunggal: 28 karakter garis `─`.
- Identitas visual: simbol `❖` pada setiap judul menu.
- Tanpa dekorasi box (`╔ ╚ ║ ┃ ╰ ╭`) pada menu, tanpa emoji berlebihan, tanpa
  tabel lebar, dan tanpa mengandalkan warna teks.
- Deskripsi perintah hanya tampil pada tampilan submenu perintah (`.menu
  <kategori> <submenu>`), satu baris terindeksi.

## Mode Teks Polos (Fallback)

Bila perangkat atau lingkungan tidak menampilkan karakter Unicode dekoratif
dengan baik, aktifkan mode teks polos di `config.js`:

```js
features: {
  plainMenu: true,
}
```

Pada mode ini seluruh judul dan header menu dirender sebagai ASCII huruf besar
(`NAZE MENU`, `TOOLS MENU`, `FUN`), pemisah menjadi tanda hubung, dan simbol
identitas menjadi `#`. Nama perintah tidak berubah.

## Pengujian

Jalankan dari root repositori:

```
node tests/menu-typography.test.js
```

Cakupan: gaya Unicode (termasuk verifikasi code point), fallback mode polos,
urutan section dan submenu, penyembunyian command owner/tersembunyi/nonaktif,
penomoran berurutan, keluaran chunk allmenu, navigasi alias, serta (saat
dijalankan dengan Node pada repositori lengkap) pencocokan nama perintah
dengan plugin nyata dan ketersediaan alias.

## Yang Berubah dan Yang Sengaja Tidak Berubah

Berubah: renderer menu di `naze-menu-util.js`, empat plugin menu, dan blok
teks `listallcase`/`listallplugin` pada `case/naze.js`.

Sengaja tidak berubah: logika bisnis plugin, daftar perintah dan alias,
`cping`, `.totalfitur`, dan `.carifitur` (bukan tampilan menu berhierarki).
