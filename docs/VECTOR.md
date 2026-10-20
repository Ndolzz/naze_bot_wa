# Vector NAZE

Dokumentasi teknis fitur Vector (NAZE Bot 3.10.0). Fitur ini mengubah gambar
atau stiker menjadi siluet vektor SVG. Mesin vektorisasinya diadaptasi dari
repositori Ndolzz/nazevector (modul `silhouette.js` dan `vectorEngine.js`,
versi 0.5.1) dengan algoritme yang dipertahankan identik; hanya bagian yang
bergantung pada kanvas peramban yang diganti dengan pembacaan piksel via sharp.
Sesuai permintaan, hanya fitur vector yang dibawa: preset animasi, mode warna,
dan ekspor XML Alight Motion pada aplikasi sumber tidak disertakan.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `.vector`, `.vektor` | Mengubah gambar/stiker menjadi siluet vektor SVG |

Cara pakai: kirim gambar/stiker dengan teks `.vector` atau balas pesan
gambar/stiker dengan `.vector`. Argumen opsional boleh digabung dalam urutan
bebas; token yang sama diulang mengambil nilai terakhir.

| Argumen | Fungsi | Bawaan |
| --- | --- | --- |
| `gelap` / `terang` | bagian gambar yang menjadi siluet | `gelap` |
| angka 1-99 | ambang luminansi dalam persen | 50 |
| `rendah` / `sedang` / `tinggi` | tingkat penyederhanaan titik | `sedang` |
| `#RRGGBB` | warna isi siluet | `#0F172A` |

Contoh: `.vector terang 70 sedang #2563EB`.

Hasil dikirim dalam dua pesan: PNG pratinjau dengan keterangan statistik
(dimensi kerja, jumlah komponen, jumlah kontur, jumlah titik, pengaturan),
lalu berkas `siluet.svg` sebagai dokumen dengan tipe MIME `image/svg+xml`.

## Struktur modul

- `src/lib/naze-vector-engine.js` — mesin murni tanpa dependensi: mask biner
  berbasis luminansi, penelusuran kontur crack boundary (marching squares),
  penggabungan titik kolinear, penyederhanaan Ramer-Douglas-Peucker,
  dan pembangun dokumen SVG. Diadaptasi dari nazevector.
- `src/lib/naze-vector-utils.js` — modul murni: resolusi batas, penguraian
  argumen, pemformatan pengaturan, templat pesan, dan teks menu.
- `src/lib/naze-vector-manager.js` — orkestrator: pembacaan media dari pesan,
  pembacaan piksel via sharp, pemanggilan mesin, rasterisasi pratinjau,
  dan pengiriman hasil.
- `plugins/tools/vector.js` — plugin tipis mengikuti konvensi `config` +
  `handler`.

## Cara kerja

1. Pesan diperiksa: gambar/stiker langsung atau pesan yang dibalas. Tanpa
   media, bot membalas dengan panduan; media selain gambar/stiker ditolak
   dengan pesan yang sesuai.
2. Argumen diurai oleh `parseVectorArgs`. Token yang tidak dikenali membalas
   daftar token tersebut beserta contoh pemakaian.
3. Media diunduh (`source.download()`), dijatuhkan bila kosong atau melebihi
   `maxMediaBytes`.
4. `readWorkingPixels` membaca dimensi asli lewat sharp, menghitung dimensi
   kerja dengan `computePreviewDimensions` (tidak pernah memperbesar, sisi
   terpanjang dibatasi `maxWorkDimension`), lalu mengambil piksel RGBA mentah
   pada dimensi kerja.
5. `computeSilhouetteMaskFromPixels` membentuk mask biner: piksel transparan
   (alpha < 16) selalu dianggap luar; luminansi (0.2126 R + 0.7152 G +
   0.0722 B) dibandingkan dengan ambang. Mode `gelap` menandai piksel gelap
   sebagai isi, mode `terang` menandai piksel terang sebagai isi.
6. `vectorizeSilhouette` menelusuri kontur pada grid sudut piksel: setiap
   crack antar piksel dalam/luar dilalui tepat satu arah, jadi kontur
   tertutup dan komponen yang bersentuhan diagonal tetap terpisah. Titik
   kolinear digabung, lalu setiap kontur disederhanakan dengan
   Ramer-Douglas-Peucker pada dua jangkar (titik terluar dan titik terjauh
   darinya) agar ring tertutup tidak terpotong pada satu sisi saja.
   Orientasi kontur luar dan lubang ditegakkan sehingga `fill-rule="evenodd"`
   menghasilkan lubang yang benar.
7. Mask kosong bukan kesalahan: bot membalas saran mengubah mode atau
   ambang.
8. Pratinjau PNG dirasterisasi dari SVG pada latar putih; bila build sharp
   yang berjalan tidak mendukung rasterisasi SVG, bot jatuh kembali ke
   pratinjau yang dibangun langsung dari mask (geometrinya setara dengan
   hasil sebelum penyederhanaan titik).
9. Pratinjau dikirim dengan `replyImage` dan keterangan statistik, lalu SVG
   dikirim dengan `replyDocument`.

## Batas

Seluruh batas diatur di blok `vector` pada `config.js`:

| Kunci | Bawaan | Fungsi |
| --- | --- | --- |
| `maxMediaBytes` | 15728640 | ukuran maksimal gambar sumber (15 MB) |
| `maxWorkDimension` | 1024 | sisi terpanjang resolusi kerja mask |
| `defaultThresholdPercent` | 50 | ambang luminansi bawaan (persen) |
| `defaultMode` | `gelap` | mode bawaan: `gelap` atau `terang` |
| `defaultSimplification` | `sedang` | penyederhanaan bawaan: `rendah`/`sedang`/`tinggi` |
| `defaultColor` | `#0F172A` | warna isi siluet bawaan |
| `previewMaxWidth` | 1280 | lebar maksimal PNG pratinjau |

Toleransi penyederhanaan (0.3 / 1.5 / 3.5 piksel) ditetapkan pada
`SIMPLIFICATION_LEVELS` di `naze-vector-engine.js`.

## Batasan yang diketahui

1. Hanya mode isi (fill) satu warna yang disertakan; mode garis, kontur
   berwarna, warna asli, preset animasi, dan ekspor XML Alight Motion pada
   aplikasi sumber tidak dibawa sesuai permintaan fitur vector saja.
2. Hasil adalah siluet: detail gradasi dan warna di dalam objek hilang.
   Kualitas bergantung pada kontras objek dengan latarnya.
3. Gambar yang sangat besar diproses pada resolusi kerja
   `maxWorkDimension`, jadi siluet hasilnya mengikuti resolusi tersebut,
   bukan resolusi asli.
4. Rasterisasi SVG untuk pratinjau bergantung pada librsvg pada build sharp
   yang terpasang; bila tidak tersedia, pratinjau dibangun dari mask sebagai
   fallback. Berkas SVG hasil selalu dapat dibuka perangkat penerima.
5. Stiker animasi hanya diproses pada bingkai pertamanya.
