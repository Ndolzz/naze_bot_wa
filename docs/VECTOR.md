# Vector NAZE

Dokumentasi teknis fitur Vector (NAZE Bot 3.10.0). Fitur ini mengubah gambar
atau stiker menjadi vektor XML Alight Motion dengan dua bentuk hasil: mode
isi (siluet area terisi) dan mode garis (satu garis di tengah setiap goresan,
untuk line art). Mesin vektorisasi, ekstraksi centerline, dan serializer XML
diadaptasi dari repositori Ndolzz/nazevector (modul `silhouette.js`,
`vectorEngine.js`, `centerline.js`, dan `amAdapter.js`, versi 0.5.1) dengan
algoritme yang dipertahankan identik; hanya bagian yang bergantung pada kanvas
peramban yang diganti dengan pembacaan piksel via sharp. Sesuai permintaan,
bot mengirim XML sebagai keluaran; preset animasi dan mode warna asli pada
aplikasi sumber tidak disertakan.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `.vector`, `.vektor` | Mengubah gambar/stiker menjadi vektor XML Alight Motion |

Cara pakai: kirim gambar/stiker dengan teks `.vector` atau balas pesan
gambar/stiker dengan `.vector`. Argumen opsional boleh digabung dalam urutan
bebas; token yang sama diulang mengambil nilai terakhir.

| Argumen | Fungsi | Bawaan |
| --- | --- | --- |
| `gelap` / `terang` | bagian gambar yang menjadi siluet | `gelap` |
| angka 1-99 | ambang luminansi dalam persen | 50 |
| `rendah` / `sedang` / `tinggi` | tingkat penyederhanaan titik | `sedang` |
| `isi` / `garis` | bentuk hasil: area terisi atau garis tunggal | `isi` |
| `#RRGGBB` | warna hasil | `#0F172A` |

Contoh: `.vector terang 70 sedang #2563EB`; untuk line art: `.vector garis`.

Hasil dikirim dalam dua pesan: PNG pratinjau dengan keterangan statistik,
lalu berkas `siluet.xml` sebagai dokumen dengan tipe MIME `application/xml`.
Berkas tersebut adalah scene XML Alight Motion yang dapat diimpor ke aplikasi
Alight Motion (satu layer shape per komponen pada mode isi, atau per goresan
pada mode garis).

## Struktur modul

- `src/lib/naze-vector-engine.js` — mesin murni tanpa dependensi: mask biner
  berbasis luminansi, penelusuran kontur crack boundary (marching squares),
  penggabungan titik kolinear, penyederhanaan Ramer-Douglas-Peucker,
  pembangun SVG pratinjau, pelabelan region mask, dan penyederhanaan
  poliline. Diadaptasi dari `silhouette.js` dan `vectorEngine.js`.
- `src/lib/naze-vector-centerline.js` — ekstraksi garis tunggal (centerline)
  untuk mode garis: skeletonisasi Zhang-Suen per region, perunututan rantai
  piksel (garis terbuka, loop tertutup, segmen pada simpang), penyederhanaan
  RDP, dan perkiraan lebar pita. Diadaptasi dari `centerline.js`.
- `src/lib/naze-vector-amxml.js` — serializer XML Alight Motion: membangun
  dokumen scene dari hasil vektorisasi. Bot memakai representasi `isi` dan
  `garis`; representasi `kontur` dipertahankan dari sumber agar port tetap
  setia. Diadaptasi dari `amAdapter.js`.
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
6. `vectorizeSilhouette` menelusuri kontur pada grid sudut piksel (crack
   boundary), menggabungkan titik kolinear, menyederhanakan setiap kontur
   dengan Ramer-Douglas-Peucker, dan menegakkan orientasi kontur luar dan
   lubang. Mask kosong bukan kesalahan: bot membalas saran mengubah mode
   atau ambang.
7. Mode isi: `buildAlightMotionXml` mengelompokkan subpath menjadi komponen
   (satu kontur luar beserta lubang di dalamnya) dan menulis satu `<shape>`
   (satu layer Alight Motion) per komponen dengan outline pada `<path d>`.
8. Mode garis: `extractCenterlines` merapatkan region mask per komponen
   (skeletonisasi Zhang-Suen), merunut rantai piksel menjadi garis terbuka
   atau loop tertutup, menyederhanakannya dengan RDP, dan memperkirakan
   lebar goresan dari luas region dibagi panjang skeleton. Bot membalas pesan
   khusus bila tidak ada goresan yang terekstraksi. `buildAlightMotionXml`
   menulis satu `<shape>` per garis dengan `<path-stroke>` berisi tebal
   sesuai lebar pita; path tidak ditutup `Z`.
9. Warna hasil ditulis sebagai `fillColor` per layer dalam format
   `#FFRRGGBB` (alpha penuh).
10. Pratinjau PNG dirasterisasi dari SVG (siluet pada mode isi, garis
    berstroke pada mode garis) pada latar putih; bila build sharp yang
    berjalan tidak mendukung rasterisasi SVG, bot jatuh kembali ke pratinjau
    yang dibangun langsung dari mask.
11. Pratinjau dikirim dengan `replyImage` dan keterangan statistik, lalu XML
    dikirim dengan `replyDocument` sebagai `siluet.xml`.

## Batas

Seluruh batas diatur di blok `vector` pada `config.js`:

| Kunci | Bawaan | Fungsi |
| --- | --- | --- |
| `maxMediaBytes` | 15728640 | ukuran maksimal gambar sumber (15 MB) |
| `maxWorkDimension` | 1024 | sisi terpanjang resolusi kerja mask |
| `defaultThresholdPercent` | 50 | ambang luminansi bawaan (persen) |
| `defaultMode` | `gelap` | mode bawaan: `gelap` atau `terang` |
| `defaultSimplification` | `sedang` | penyederhanaan bawaan: `rendah`/`sedang`/`tinggi` |
| `defaultRepresentation` | `isi` | bentuk hasil bawaan: `isi` atau `garis` |
| `defaultColor` | `#0F172A` | warna hasil bawaan |
| `previewMaxWidth` | 1280 | lebar maksimal PNG pratinjau |

Toleransi penyederhanaan (0.3 / 1.5 / 3.5 piksel) ditetapkan pada
`SIMPLIFICATION_LEVELS` di `naze-vector-engine.js`.

## Batasan yang diketahui

1. Keluaran berupa bentuk statis tanpa keyframe; preset animasi, mode warna
   asli per komponen, dan preset remix pada aplikasi sumber tidak disertakan
   sesuai permintaan. Representasi `kontur` (satu layer per kontur) ada pada
   modul serializer tetapi belum diekspos sebagai opsi perintah.
2. Mode isi menghasilkan siluet satu warna: detail gradasi dan warna di dalam
   objek hilang. Kualitas bergantung pada kontras objek dengan latarnya.
3. Mode garis paling sesuai untuk line art (goresan tipis). Batas dari
   sumbernya berlaku: duri skeleton pendek dibuang, region sangat kecil
   (< 2 piksel) dilewati, ujung goresan menyusut maksimal ±1 piksel akibat
   penipisan, dan tebal per segmen pada simpang memakai tebal rata-rata
   komponen.
4. Struktur XML mengikuti parser asli Alight Motion 5.0.273 yang dibuktikan
   pada sumber untuk mode isi; mode garis (`path-stroke`) menunggu uji
   lapangan pada perangkat nyata.
5. Gambar yang sangat besar diproses pada resolusi kerja
   `maxWorkDimension`, jadi hasil mengikuti resolusi tersebut, bukan
   resolusi asli.
6. Rasterisasi SVG untuk pratinjau bergantung pada librsvg pada build sharp
   yang terpasang; bila tidak tersedia, pratinjau dibangun dari mask sebagai
   fallback. Berkas XML hasil tidak bergantung pada rasterisasi.
7. Stiker animasi hanya diproses pada bingkai pertamanya.
