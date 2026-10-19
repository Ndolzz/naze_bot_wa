# Preset Instan — Fitur Bot

Fitur `.preset` memungkinkan pengguna bot mengganti foto pada preset Alight Motion tanpa membuang animasi asli: pengguna mengirim berkas proyek, bot menganalisis slot media, lalu meminta foto pengganti satu per satu (Foto 1, Foto 2, dst). Hasil akhir berupa XML remix dan paket ZIP berisi media pengganti beserta instruksi impor manual.

## Cara pakai

1. Kirim atau reply berkas proyek `.xml` (atau `.zip` berisi XML proyek) dengan caption `.preset`.
2. Bot membalas ringkasan proyek: judul, kanvas, FPS, durasi, jumlah layer, jumlah keyframe, dan daftar slot media yang benar-benar terdeteksi.
3. Bot meminta foto pengganti satu per satu. Kirim foto (JPEG/PNG/WebP, maksimal 10 MB) untuk slot yang aktif.
4. Perintah selama sesi:
   - `skip` / `lewati` — pertahankan slot ini apa adanya, lanjut ke slot berikutnya.
   - `selesai` / `done` / `finish` — proses dengan media yang sudah terkumpul (slot tersisa dipertahankan asli).
   - `batal` / `cancel` — akhiri sesi dan hapus seluruh berkas sementara.
5. Bot mengirim XML remix (lolos validasi struktur) dan, bila ada media terkumpul, ZIP berisi XML, foto pengganti (`FOTO-<n>-<nama>`), dan `BACA-DULU.txt`.

Tautan berbagi `alightcreative.com` hanya menghasilkan metadata proyek (bila kunci API `obscura` terpasang), bukan unduhan berkas. Untuk penggantian media, pengguna wajib mengirim XML/ZIP proyek.

## Arsitektur

| Berkas | Peran |
| --- | --- |
| `src/lib/naze-am-preset/parser.js` | Parser XML proyek (scene, media, layer, keyframe, slot aset) |
| `src/lib/naze-am-preset/xml-validation.js` | Validasi struktur (prolog, atribut wajib, waktu, warna, outline) |
| `src/lib/naze-am-preset/remixer.js` | Penggantian aset presisi tanpa menulis ulang bagian lain |
| `src/lib/naze-am-preset/workflow.js` | Orkestrasi: validasi berkas, analisis, perakitan penggantian |
| `src/lib/naze-preset-session-core.js` | Mesin keadaan sesi murni: slot, TTL, validasi media, URL, ZIP |
| `src/lib/naze-preset-session.js` | Manajer sesi: penyimpanan, isolasi pengguna, keluaran ZIP, hook pesan |
| `plugins/tools/preset.js` | Perintah `.preset` |
| `src/handler.js` | Hook sesi (pola `giveawaySessions`) |
| `tests/preset-instan.test.js` | 64 pengujian (parser, remixer, sesi, keamanan, plugin) |

Modul parser/remixer/workflow adalah porting dari `Ndolzz/nazevector` (IPR-1..IPR-3, commit `b3b5aed`), disalin apa adanya dengan penyesuaian jalur import dan satu penggantian nama helper internal; repositori tersebut milik pemilik yang sama dengan bot ini.

## Keamanan

- Tautan hanya diproses bila `https` dengan hostname `alightcreative.com`/`www.alightcreative.com`; skema lain, userinfo, IP, localhost, dan host asing ditolak (pencegahan SSRF).
- Jenis berkas dideteksi dari signature byte (JPEG/PNG/WebP/ZIP/XML), bukan dari ekstensi.
- Nama entri ZIP divalidasi terhadap path traversal, jalur absolut, backslash, dan karakter kontrol.
- Sesi diisolasi per JID pengirim dan per chat; media antar pengguna tidak mungkin tertukar.
- Berkas sementara disimpan di `storage/preset/<id-sesi>/` dan dihapus saat sesi selesai, dibatalkan, atau kedaluwarsa (TTL 30 menit).
- Parser XML adalah parser teks buatan tanpa resolusi entitas eksternal (tanpa XXE).
- Batas bawaan: preset 15 MB, ZIP 20 MB, media 10 MB, TTL 30 menit. Dapat diganti lewat `config.preset` (`presetMaxBytes`, `zipMaxBytes`, `mediaMaxBytes`, `sessionTtlMs`).

## Batasan yang harus dipahami (jujur)

1. Tidak ada render MP4. Bot tidak merender video; hasil akhir adalah XML/ZIP untuk diimpor ke Alight Motion.
2. URI `naze-preset://slot/<n>/<nama>` pada XML hasil adalah penanda slot, bukan media aktif. Setelah impor, pengguna harus menghubungkan foto pengganti melalui Ganti Media (Replace Media) sesuai daftar pada `BACA-DULU.txt`. Bot tidak menaruh path server atau URI perangkat pengguna ke dalam XML.
3. Validasi struktur XML adalah bukti struktural, bukan jaminan bahwa proyek pasti dapat diimpor atau tampil identik. Fitur ini belum diuji pada aplikasi Alight Motion asli.
4. Hanya slot foto terdeklarasi yang dapat diganti pada versi ini. Slot video/audio dilaporkan "belum didukung penggantian"; slot tanpa deklarasi media ditolak remixer demi keamanan.
5. Audio asli tidak disentuh; penggantian audio belum tersedia.
6. Struktur yang tidak dipahami (efek, blending, path-stroke, border, shadow, grup, layer teks) dipertahankan apa adanya dan dilaporkan pada ringkasan.
7. Impor XML penuh didukung Alight Motion di Android; iOS terbatas.
8. Uji lapangan (impor ke aplikasi asli dan perilaku di WhatsApp nyata) masih diperlukan sebelum menyatakan kompatibilitas lapangan.

## Pengujian

Jalankan:

```
node tests/preset-instan.test.js
```

Cakupan: parsing valid/rusak, analisis scene dan slot, penggantian aset, penolakan slot tidak dikenal/tanpa deklarasi/duplikat, keutuhan keyframe-durasi-urutan layer, deteksi signature, validasi URL (SSRF), keamanan nama entri ZIP, state machine sesi, isolasi multi-pengguna, TTL dan pembersihan, alur penuh sesi, dan kontrak plugin `.preset` dengan objek pesan palsu meniru kontrak `src/lib/naze-serialize.js`. Fixture adalah dua ekspor asli Alight Motion 5.0.273 (Android). Pengujian ini tidak menggantikan uji WhatsApp nyata maupun uji impor di aplikasi Alight Motion.
