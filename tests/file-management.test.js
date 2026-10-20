// Pengujian sistem pengelolaan file NAZE.
// Bagian murni menguji src/lib/naze-file-utils.js dan src/lib/naze-pdf-builder.js
// tanpa dependensi eksternal. Bagian integrasi menguji src/lib/naze-file-manager.js
// beserta adm-zip; jika dependensi belum terpasang (npm install), bagian itu
// dilewati dengan laporan yang jelas.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as utils from "../src/lib/naze-file-utils.js";
import * as pdfBuilder from "../src/lib/naze-pdf-builder.js";

const TEMP_ROOT = path.join(process.cwd(), "storage", "temp", "naze-files");

// ---------------------------------------------------------------------------
// Bagian 1: utilitas murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("resolveLimits mengembalikan batas bawaan", () => {
  const limits = utils.resolveLimits();
  assert.equal(limits.maxSizePerFile, 50 * 1024 * 1024);
  assert.equal(limits.maxFiles, 20);
  assert.equal(limits.maxTotalSize, 200 * 1024 * 1024);
  assert.equal(limits.sessionTimeoutMinutes, 15);
});

test("resolveLimits menerima nilai sah dan mengabaikan nilai tidak sah", () => {
  assert.equal(utils.resolveLimits({ maxFiles: 5 }).maxFiles, 5);
  assert.equal(utils.resolveLimits({ maxFiles: "x" }).maxFiles, 20);
  assert.equal(utils.resolveLimits({ maxFiles: -3 }).maxFiles, 20);
});

test("sanitizeFileName mencegah path traversal", () => {
  assert.equal(utils.sanitizeFileName("../../etc/passwd"), "passwd");
  assert.equal(utils.sanitizeFileName("a/b/c.txt"), "c.txt");
  assert.equal(utils.sanitizeFileName("a\\b\\d.txt"), "d.txt");
});

test("sanitizeFileName membersihkan nama berbahaya", () => {
  assert.equal(utils.sanitizeFileName("", "fallback"), "fallback");
  assert.equal(utils.sanitizeFileName('fi"le.txt'), "fi'le.txt");
  assert.equal(utils.sanitizeFileName("..hidden"), "hidden");
  assert.equal(utils.sanitizeFileName("a\u0000b\u001fc.txt"), "abc.txt");
  assert.ok(utils.sanitizeFileName("x".repeat(150) + ".txt").length <= 100);
});

test("validateOutputName menerima nama sah", () => {
  const hasil = utils.validateOutputName("tugas bahasa inggris");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.name, "tugas bahasa inggris");
  assert.equal(utils.validateOutputName("  tugas   akhir  ").name, "tugas akhir");
  assert.equal(utils.validateOutputName("a".repeat(64)).valid, true);
});

test("validateOutputName menolak nama tidak sah", () => {
  assert.equal(utils.validateOutputName("").valid, false);
  assert.equal(utils.validateOutputName("a".repeat(65)).reason, "length");
  assert.equal(utils.validateOutputName("../x").reason, "charset");
  assert.equal(utils.validateOutputName("_abc").reason, "charset");
  assert.equal(utils.validateOutputName("a/b").reason, "charset");
});

test("uniqueFileName menangani duplikasi nama", () => {
  assert.equal(utils.uniqueFileName([], "a.txt"), "a.txt");
  assert.equal(utils.uniqueFileName(["a.txt"], "a.txt"), "a (2).txt");
  assert.equal(utils.uniqueFileName(["a.txt", "a (2).txt"], "a.txt"), "a (3).txt");
  assert.equal(utils.uniqueFileName(["A.TXT"], "a.txt"), "a (2).txt");
  assert.equal(utils.uniqueFileName(["foto"], "foto"), "foto (2)");
});

test("extFromMime memetakan mimetype ke ekstensi", () => {
  assert.equal(utils.extFromMime("image/jpeg"), "jpg");
  assert.equal(utils.extFromMime("audio/opus"), "ogg");
  assert.equal(utils.extFromMime("application/pdf"), "bin");
  assert.equal(utils.extFromMime("image/png; charset=x"), "png");
});

test("formatBytes memformat ukuran berkas", () => {
  assert.equal(utils.formatBytes(0), "0 B");
  assert.equal(utils.formatBytes(512), "512 B");
  assert.equal(utils.formatBytes(1024), "1 KB");
  assert.equal(utils.formatBytes(1536), "1.5 KB");
  assert.equal(utils.formatBytes(5242880), "5 MB");
  assert.equal(utils.formatBytes(52428800), "50 MB");
});

test("inti sesi: mulai, lanjut, konflik, dan isolasi antar pengguna", () => {
  const core = utils.createSessionCore({ now: () => 1000 });
  const mulai = core.start("userA", "chatX", "pdf");
  assert.equal(mulai.ok, true);
  assert.equal(mulai.resumed, false);
  assert.equal(mulai.session.label, "PDF Creator");

  const lanjut = core.start("userA", "chatX", "pdf");
  assert.equal(lanjut.ok, true);
  assert.equal(lanjut.resumed, true);

  const konflik = core.start("userA", "chatX", "zip");
  assert.equal(konflik.ok, false);
  assert.equal(konflik.error, "conflict");

  assert.equal(core.get("userB", "chatX"), null);
  const kedua = core.start("userB", "chatX", "zip");
  assert.equal(kedua.ok, true);
  assert.equal(core.get("userA", "chatX").type, "pdf");
});

test("inti sesi: ringkasan berkas dan penghapusan", () => {
  const core = utils.createSessionCore({ now: () => 1000 });
  const { session } = core.start("userA", "chatX", "zip");
  core.addFile(session, { entryName: "a.txt", size: 10 });
  core.addFile(session, { entryName: "b.txt", size: 20 });
  const ringkasan = core.summary(session);
  assert.equal(ringkasan.received, 2);
  assert.equal(ringkasan.totalBytes, 30);
  assert.deepEqual(ringkasan.names, ["a.txt", "b.txt"]);
  assert.equal(ringkasan.failed, 0);

  core.remove("userA", "chatX");
  assert.equal(core.get("userA", "chatX"), null);
});

test("inti sesi: kedaluwarsa memakai jam yang dapat disuntikkan", () => {
  let waktu = 1000;
  const core = utils.createSessionCore({
    now: () => waktu,
    limits: utils.resolveLimits({ sessionTimeoutMinutes: 15 }),
  });
  core.start("userA", "chatX", "pdf");
  waktu += 14 * 60 * 1000;
  assert.notEqual(core.get("userA", "chatX"), null);
  waktu += 2 * 60 * 1000;
  assert.equal(core.get("userA", "chatX"), null);
});

test("inti sesi: batas jumlah, ukuran, dan total berkas", () => {
  const limits = utils.resolveLimits({
    maxFiles: 2,
    maxSizePerFile: 100,
    maxTotalSize: 150,
  });
  const core = utils.createSessionCore({ now: () => 1, limits });

  const a = core.start("u1", "c1", "zip");
  assert.equal(core.checkNewFile(a.session, 50).ok, true);
  core.addFile(a.session, { entryName: "x", size: 50 });
  core.addFile(a.session, { entryName: "y", size: 10 });
  assert.equal(core.checkNewFile(a.session, 5).error, "maxfiles");

  const b = core.start("u2", "c2", "zip");
  assert.equal(core.checkNewFile(b.session, 200).error, "maxsize");
  core.addFile(b.session, { entryName: "z", size: 100 });
  assert.equal(core.checkNewFile(b.session, 100).error, "maxtotal");
});

test("pickTotxtSource memilih teks sumber dengan prioritas yang benar", () => {
  const kini = 999999999;
  assert.equal(
    utils.pickTotxtSource({ quoted: { body: "Nama saya Nendi" }, text: "lain" }, null, kini),
    "Nama saya Nendi",
  );
  assert.equal(utils.pickTotxtSource({ text: "Halo" }, null, kini), "Halo");
  assert.equal(
    utils.pickTotxtSource({}, { text: "lama", at: kini - 5 * 60 * 1000 }, kini),
    "lama",
  );
  assert.equal(
    utils.pickTotxtSource({}, { text: "lama", at: kini - 11 * 60 * 1000 }, kini),
    null,
  );
  assert.equal(utils.pickTotxtSource({}, null, kini), null);
  assert.equal(
    utils.pickTotxtSource({ text: "   " }, { text: "ok", at: kini - 60 * 1000 }, kini),
    "ok",
  );
});

test("seluruh templat pesan bebas emoji dan garis dekoratif", () => {
  const templat = [
    ["menu", utils.menuText()],
    ["filehelp", utils.fileHelpText()],
    ["mulai pdf", utils.sessionStartMessage("pdf")],
    ["mulai zip", utils.sessionStartMessage("zip")],
    ["lanjut", utils.resumedSessionMessage("PDF Creator")],
    ["konflik", utils.sessionConflictMessage("ZIP Archive")],
    ["terima", utils.fileAcceptedMessage("foto 1.jpg", 2)],
    ["tolak", utils.fileRejectedMessage("video", "jenis berkas ini tidak didukung")],
    ["status", utils.statusMessage({
      label: "PDF Creator", received: 3, failed: 1,
      names: ["a.txt", "b.jpg", "c.txt"], busy: false,
    })],
    ["tanpa sesi", utils.noSessionMessage()],
    ["batal", utils.cancelMessage("PDF Creator")],
    ["batal tanpa sesi", utils.cancelNoSessionMessage()],
    ["nama invalid", utils.invalidNameMessage("../etc")],
    ["tanpa berkas", utils.noFilesToFinishMessage("ZIP Archive")],
    ["pdf selesai", utils.finishedPdfMessage("tugasbahasainggris.pdf", 3, ["rusak.jpg (gagal diproses)"], 1)],
    ["zip selesai", utils.finishedZipMessage("tugasakhir.zip", 4, [], 2)],
    ["gagal proses", utils.processFailedMessage("kesalahan uji")],
    ["totxt panduan", utils.totxtGuideMessage()],
    ["totxt selesai", utils.totxtDoneMessage()],
    ["sibuk", utils.busyMessage()],
  ];
  for (const [nama, teks] of templat) {
    assert.ok(!/\p{Extended_Pictographic}/u.test(teks), "templat " + nama + " memuat emoji");
    for (const baris of teks.split("\n")) {
      if (baris.trim() === "") continue;
      assert.ok(
        !/^[-\u2010-\u2015\u2500-\u257F=_\s]+$/.test(baris),
        "templat " + nama + " memuat baris dekoratif",
      );
    }
    assert.ok(teks.startsWith(utils.BOT_TITLE), "templat " + nama + " tanpa judul");
  }
});

test("menu memuat ketujuh perintah secara utuh", () => {
  const menu = utils.menuText();
  for (const perintah of ["totxt", "topdf", "tozip", "statusfile", "batal", "menu", "filehelp"]) {
    assert.ok(menu.includes('".' + perintah + '"'), "perintah ." + perintah + " tidak ada di menu");
  }
  assert.ok(menu.includes("FILE MANAGEMENT"));
  assert.ok(menu.includes("PROCESS CONTROL"));
  assert.ok(menu.includes("HELP CENTER"));
});

test("panduan menjelaskan batas dan perintah", () => {
  const panduan = utils.fileHelpText();
  assert.ok(panduan.includes("20 berkas"));
  assert.ok(panduan.includes("50 MB"));
  assert.ok(panduan.includes("200 MB"));
  assert.ok(panduan.includes("15 menit"));
  for (const perintah of ["totxt", "topdf", "tozip", "statusfile", "batal", "menu"]) {
    assert.ok(panduan.includes('".' + perintah + '"'), "panduan tidak menyebut ." + perintah);
  }
});

// ---------------------------------------------------------------------------
// Bagian 2: penyusun PDF murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("normalizeText menyeragamkan karakter pengodean", () => {
  assert.equal(pdfBuilder.normalizeText("a\r\nb\rc"), "a\nb\nc");
  assert.equal(pdfBuilder.normalizeText("\u201Cnasi\u201D \u2018goreng\u2019"), '"nasi" \'goreng\'');
  assert.equal(pdfBuilder.normalizeText("a\u2026b"), "a...b");
  assert.equal(pdfBuilder.normalizeText("a\tb"), "a    b");
  assert.equal(pdfBuilder.normalizeText("a\u000Bb"), "ab");
});

test("wrapText mempertahankan baris baru dan memotong baris terlalu panjang", () => {
  assert.deepEqual(pdfBuilder.wrapText("Halo dunia", 10000), ["Halo dunia"]);
  assert.deepEqual(pdfBuilder.wrapText("a\n\nb", 10000), ["a", "", "b"]);
  const potongan = pdfBuilder.wrapText("x".repeat(1000), 50, 11);
  assert.ok(potongan.length > 10, "kata panjang tidak terpotong");
  for (const baris of potongan) {
    assert.ok(baris.length <= 9, "baris melebihi lebar halaman: " + baris);
  }
});

test("maxLinesPerPage konsisten dengan ukuran halaman", () => {
  const harapan = Math.floor((pdfBuilder.PAGE_HEIGHT - pdfBuilder.MARGIN * 2) / pdfBuilder.LINE_HEIGHT);
  assert.equal(pdfBuilder.maxLinesPerPage(), harapan);
});

const JPEG_BASELINE = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x08, 0x08,
  0x01, 0x00, 0x01, 0x00, 0x03, 0xFF, 0xD9,
]);
const JPEG_PROGRESSIVE = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xC2, 0x00, 0x08, 0x08,
  0x00, 0x80, 0x00, 0x80, 0x01, 0xFF, 0xD9,
]);

test("parseJpegSize membaca penanda SOF dengan benar", () => {
  const dasar = pdfBuilder.parseJpegSize(JPEG_BASELINE);
  assert.equal(dasar.width, 256);
  assert.equal(dasar.height, 256);
  assert.equal(dasar.components, 3);
  assert.equal(dasar.progressive, false);

  const progresif = pdfBuilder.parseJpegSize(JPEG_PROGRESSIVE);
  assert.equal(progresif.width, 128);
  assert.equal(progresif.progressive, true);

  assert.equal(pdfBuilder.parseJpegSize(Buffer.from([1, 2, 3])), null);
  assert.equal(pdfBuilder.parseJpegSize(null), null);
});

function decodeLatin1(bytes) {
  let hasil = "";
  for (let i = 0; i < bytes.length; i += 1) hasil += String.fromCharCode(bytes[i]);
  return hasil;
}

function validasiStrukturPdf(bytes, jumlahHalaman) {
  const teks = decodeLatin1(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  assert.ok(teks.startsWith("%PDF-1.4"), "header PDF salah");
  assert.ok(teks.includes("%%EOF"), "penutup PDF hilang");
  assert.ok(teks.includes("/Helvetica"), "font Helvetica hilang");
  assert.ok(teks.includes("/WinAnsiEncoding"), "pengodean font hilang");
  assert.equal(teks.split("/Type /Page ").length - 1, jumlahHalaman, "jumlah halaman salah");
  assert.ok(teks.includes("/Count " + jumlahHalaman), "jumlah halaman pada Pages salah");

  const posisiStartxref = teks.lastIndexOf("startxref\n");
  const offsetXref = parseInt(teks.slice(posisiStartxref + 10), 10);
  assert.ok(teks.slice(offsetXref, offsetXref + 4) === "xref", "startxref tidak menunjuk tabel xref");
  const barisXref = teks.slice(offsetXref).split("\n");
  assert.ok(barisXref[2].startsWith("0000000000 65535 f"), "entri xref objek nol salah");
  const offsetObjek1 = parseInt(barisXref[3].slice(0, 10), 10);
  assert.ok(teks.slice(offsetObjek1, offsetObjek1 + 8) === "1 0 obj\n", "offset objek 1 salah");
  return teks;
}

test("buildPdf menyusun dokumen teks berhalaman banyak", () => {
  const isi = Array.from({ length: 200 }, (_, i) => "Baris ke " + (i + 1)).join("\n");
  const pdf = pdfBuilder.buildPdf([{ kind: "text", text: isi }]);
  assert.ok(pdf instanceof Uint8Array && pdf.length > 0, "PDF kosong");
  const harapan = Math.ceil(200 / pdfBuilder.maxLinesPerPage());
  const teks = validasiStrukturPdf(pdf, harapan);
  assert.ok(teks.includes("(Baris ke 1) Tj"), "isi halaman pertama hilang");
  assert.ok(teks.includes("(Baris ke 200) Tj"), "isi halaman terakhir hilang");
});

test("buildPdf menyisipkan gambar JPEG dengan DCTDecode", () => {
  const pdf = pdfBuilder.buildPdf([
    { kind: "text", text: "Halo PDF" },
    { kind: "jpeg", data: JPEG_BASELINE },
  ]);
  const teks = validasiStrukturPdf(pdf, 2);
  assert.ok(teks.includes("/DCTDecode"), "filter DCTDecode hilang");
  assert.ok(teks.includes("/Width 256") && teks.includes("/Height 256"), "dimensi gambar salah");
  assert.ok(teks.includes("/DeviceRGB"), "ruang warna salah");
  assert.ok(teks.includes("(Halo PDF) Tj"), "halaman teks hilang");
});

test("buildPdf menolak masukan tidak valid", () => {
  assert.equal(pdfBuilder.buildPdf([]), null);
  assert.equal(pdfBuilder.buildPdf(null), null);
  assert.equal(pdfBuilder.buildPdf([null]), null);
  assert.equal(
    pdfBuilder.buildPdf([{ kind: "jpeg", data: Buffer.from([1, 2, 3]) }]),
    null,
  );
});

// ---------------------------------------------------------------------------
// Bagian 3: integrasi orkestrator (butuh npm install; dilewati bila tidak ada)
// ---------------------------------------------------------------------------

let fileManager = null;
try {
  fileManager = await import("../src/lib/naze-file-manager.js");
} catch (error) {
  console.log("[LEWATI] Integrasi naze-file-manager tidak dijalankan:", error.message);
}

function buatPesan(sender, chat, tambahan = {}) {
  const m = {
    sender,
    chat,
    balasan: [],
    lampiran: [],
    unduhan: 0,
    async reply(teks) {
      m.balasan.push(String(teks));
    },
    async replyDocument(buffer, fileName, mimetype) {
      m.lampiran.push({ buffer, fileName, mimetype });
    },
    async download() {
      m.unduhan += 1;
      return Buffer.from(m.isi || "");
    },
    ...tambahan,
  };
  return m;
}

function pesanMedia(sender, chat, kolom) {
  const isi = kolom.isi || "isi berkas";
  const m = buatPesan(sender, chat, {
    isi,
    isImage: kolom.isImage || false,
    isVideo: kolom.isVideo || false,
    isAudio: kolom.isAudio || false,
    isDocument: kolom.isDocument || false,
    mimetype: kolom.mimetype || "",
    fileName: kolom.fileName || "",
    fileLength: kolom.fileLength !== undefined ? kolom.fileLength : Buffer.byteLength(isi),
    ptt: kolom.ptt || false,
  });
  return m;
}

function folderSesi(sender, chat) {
  const kunci = String(sender) + "|" + String(chat);
  return path.join(TEMP_ROOT, kunci.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120));
}

if (fileManager) {
  test("createTxt menghasilkan hasil.txt dari pesan yang dibalas", async () => {
    const m = buatPesan("t1", "c1", { quoted: { body: "Nama saya Nendi" } });
    await fileManager.createTxt(m, null);
    assert.equal(m.balasan.length, 1);
    assert.ok(m.balasan[0].includes('Nama file: "hasil.txt"'));
    assert.equal(m.lampiran.length, 1);
    assert.equal(m.lampiran[0].fileName, "hasil.txt");
    assert.equal(m.lampiran[0].mimetype, "text/plain");
    assert.equal(m.lampiran[0].buffer.toString("utf8"), "Nama saya Nendi");
  });

  test("createTxt memakai teks setelah perintah dan mengesampingkan perintah", async () => {
    const m = buatPesan("t1", "c2", { text: "Nama saya Nendi" });
    await fileManager.createTxt(m, null);
    assert.equal(m.lampiran[0].buffer.toString("utf8"), "Nama saya Nendi");
  });

  test("createTxt memakai teks terakhir sebagai cadangan", async () => {
    const teks = buatPesan("t1", "c3", {
      isCommand: false, type: "conversation", body: "Teks terakhir pengguna",
    });
    fileManager.rememberTextMessage(teks);
    const m = buatPesan("t1", "c3");
    await fileManager.createTxt(m, null);
    assert.equal(m.lampiran[0].buffer.toString("utf8"), "Teks terakhir pengguna");
  });

  test("createTxt tanpa sumber menampilkan panduan", async () => {
    const m = buatPesan("t2", "c1");
    await fileManager.createTxt(m, null);
    assert.equal(m.lampiran.length, 0);
    assert.ok(m.balasan[0].includes("TXT GENERATOR"));
  });

  test("alur PDF lengkap: sesi, penolakan, status, hasil, dan pembersihan", async () => {
    const pengirim = "t3";
    const percakapan = "c1";

    const mulai = buatPesan(pengirim, percakapan);
    await fileManager.startSession(mulai, "pdf", null);
    assert.ok(mulai.balasan[0].includes("PDF CREATOR"));

    const sesi = fileManager.getActiveSession(pengirim, percakapan);
    assert.ok(sesi, "sesi tidak aktif");

    const catatan = pesanMedia(pengirim, percakapan, {
      isDocument: true, mimetype: "text/plain", fileName: "catatan.txt",
      isi: "Baris pertama\nBaris kedua",
    });
    await fileManager.ingestMedia(sesi, catatan, null);
    assert.ok(catatan.balasan[0].includes('Berkas diterima: "catatan.txt"'));

    const foto = pesanMedia(pengirim, percakapan, {
      isImage: true, mimetype: "image/jpeg", isi: JPEG_BASELINE,
    });
    await fileManager.ingestMedia(sesi, foto, null);
    assert.equal(sesi.files.length, 2);

    const video = pesanMedia(pengirim, percakapan, {
      isVideo: true, mimetype: "video/mp4", isi: "video",
    });
    await fileManager.ingestMedia(sesi, video, null);
    assert.equal(sesi.files.length, 2, "video tidak boleh masuk sesi PDF");
    assert.equal(sesi.failedCount, 1);
    assert.ok(video.balasan[0].includes("Berkas ditolak"));

    const terlaluBesar = pesanMedia(pengirim, percakapan, {
      isDocument: true, mimetype: "text/plain", fileName: "besar.txt",
      isi: "besar", fileLength: 60 * 1024 * 1024,
    });
    await fileManager.ingestMedia(sesi, terlaluBesar, null);
    assert.equal(terlaluBesar.unduhan, 0, "berkas terlalu besar tidak boleh diunduh");
    assert.ok(terlaluBesar.balasan[0].includes("ukuran berkas melebihi batas"));

    const status = buatPesan(pengirim, percakapan);
    await fileManager.sendStatus(status);
    assert.ok(status.balasan[0].includes("Berkas diterima: 2"));
    assert.ok(status.balasan[0].includes("Berkas gagal diterima: 2"));
    assert.ok(status.balasan[0].includes("catatan.txt"));

    const namaInvalid = buatPesan(pengirim, percakapan);
    await fileManager.finishWithName(sesi, "../etc", namaInvalid, null);
    assert.ok(namaInvalid.balasan[0].includes("KESALAHAN NAMA OUTPUT"));
    assert.ok(fileManager.getActiveSession(pengirim, percakapan), "sesi tidak boleh berakhir karena nama invalid");

    const selesai = buatPesan(pengirim, percakapan);
    await fileManager.finishWithName(sesi, "tugas bahasa inggris", selesai, null);
    assert.equal(selesai.lampiran.length, 1, "PDF tidak dikirim");
    assert.equal(selesai.lampiran[0].fileName, "tugas bahasa inggris.pdf");
    assert.equal(selesai.lampiran[0].mimetype, "application/pdf");
    const pdfBytes = new Uint8Array(selesai.lampiran[0].buffer);
    validasiStrukturPdf(pdfBytes, 2);
    const teks = decodeLatin1(pdfBytes);
    assert.ok(teks.includes("/DCTDecode"), "gambar JPEG tidak masuk PDF");
    assert.ok(teks.includes("(Baris pertama) Tj"), "teks TXT tidak masuk PDF");
    assert.ok(selesai.balasan[0].includes("tugas bahasa inggris.pdf"));
    assert.ok(selesai.balasan[0].includes("Jumlah halaman: 2"));
    assert.ok(selesai.balasan[0].includes("ditolak saat pengumpulan"), "kegagalan pengumpulan tidak dilaporkan");

    assert.equal(fileManager.getActiveSession(pengirim, percakapan), null, "sesi tidak diakhiri");
    assert.equal(fs.existsSync(folderSesi(pengirim, percakapan)), false, "folder sesi tidak dibersihkan");
  });

  test("alur ZIP lengkap: beragam jenis berkas, traversal, duplikasi, dan integritas", async () => {
    let AdmZip;
    try {
      AdmZip = (await import("adm-zip")).default;
    } catch {
      console.log("[LEWATI] adm-zip tidak tersedia, verifikasi arsip dilewati");
      return;
    }

    const pengirim = "t4";
    const percakapan = "c1";
    const mulai = buatPesan(pengirim, percakapan);
    await fileManager.startSession(mulai, "zip", null);
    const sesi = fileManager.getActiveSession(pengirim, percakapan);
    assert.ok(sesi);

    const daftarIsi = [
      { isImage: true, mimetype: "image/jpeg", isi: JPEG_BASELINE },
      { isVideo: true, mimetype: "video/mp4", isi: "isi video" },
      { isAudio: true, mimetype: "audio/ogg", ptt: true, isi: "isi suara" },
      { isDocument: true, mimetype: "application/pdf", fileName: "../../etc/passwd", isi: "isi passwd" },
      { isDocument: true, mimetype: "text/plain", fileName: "a.txt", isi: "satu" },
      { isDocument: true, mimetype: "text/plain", fileName: "a.txt", isi: "dua" },
    ];
    for (const kolom of daftarIsi) {
      const m = pesanMedia(pengirim, percakapan, kolom);
      await fileManager.ingestMedia(sesi, m, null);
      assert.ok(m.balasan[0].includes("Berkas diterima"), "berkas tidak diterima: " + JSON.stringify(kolom));
    }
    assert.equal(sesi.files.length, 6);

    assert.ok(sesi.files.some((f) => f.entryName === "passwd"), "nama traversal tidak disanitasi");
    assert.ok(sesi.files.some((f) => f.entryName === "a.txt"));
    assert.ok(sesi.files.some((f) => f.entryName === "a (2).txt"), "duplikasi nama tidak ditangani");

    const selesai = buatPesan(pengirim, percakapan);
    await fileManager.finishWithName(sesi, "arsip uji", selesai, null);
    assert.equal(selesai.lampiran.length, 1, "ZIP tidak dikirim");
    assert.equal(selesai.lampiran[0].fileName, "arsip uji.zip");
    assert.equal(selesai.lampiran[0].mimetype, "application/zip");

    const zip = new AdmZip(selesai.lampiran[0].buffer);
    const entri = zip.getEntries().map((e) => e.entryName);
    assert.equal(entri.length, 6, "jumlah entri ZIP salah: " + entri.join(", "));
    assert.ok(entri.includes("passwd"), "entri traversal hilang");
    assert.ok(!entri.some((n) => n.includes("/") || n.includes("\\")), "entri memuat path: " + entri.join(","));
    assert.equal(zip.readAsText("a.txt"), "satu", "isi berkas pertama berubah");
    assert.equal(zip.readAsText("a (2).txt"), "dua", "isi berkas duplikat berubah");
    assert.ok(zip.readAsText("passwd").includes("isi passwd"));

    assert.equal(fileManager.getActiveSession(pengirim, percakapan), null);
    assert.equal(fs.existsSync(folderSesi(pengirim, percakapan)), false);
  });

  test("isolasi sesi antar pengguna dan pembatalan", async () => {
    const mulaiA = buatPesan("t5", "c1");
    await fileManager.startSession(mulaiA, "zip", null);
    const mulaiB = buatPesan("t6", "c1");
    await fileManager.startSession(mulaiB, "zip", null);

    const sesiA = fileManager.getActiveSession("t5", "c1");
    const sesiB = fileManager.getActiveSession("t6", "c1");
    assert.notEqual(sesiA, sesiB);
    assert.equal(fileManager.getActiveSession("t5", "c9"), null);

    const berkasA = pesanMedia("t5", "c1", { isDocument: true, mimetype: "text/plain", fileName: "milik.txt", isi: "milik A" });
    await fileManager.ingestMedia(sesiA, berkasA, null);
    assert.equal(sesiB.files.length, 0, "berkas pengguna A bocor ke pengguna B");

    const batalB = buatPesan("t6", "c1");
    await fileManager.cancelSession(batalB);
    assert.ok(batalB.balasan[0].includes("PROSES DIBATALKAN"));
    assert.equal(fileManager.getActiveSession("t6", "c1"), null);
    assert.ok(fileManager.getActiveSession("t5", "c1"), "pembatalan pengguna B memengaruhi pengguna A");
    assert.equal(fs.existsSync(folderSesi("t6", "c1")), false);

    const batalLagi = buatPesan("t6", "c1");
    await fileManager.cancelSession(batalLagi);
    assert.ok(batalLagi.balasan[0].includes("Tidak ada proses"));

    const batalA = buatPesan("t5", "c1");
    await fileManager.cancelSession(batalA);
    assert.equal(fileManager.getActiveSession("t5", "c1"), null);
    assert.equal(fs.existsSync(folderSesi("t5", "c1")), false);
  });

  test("status tanpa sesi aktif memberi tahu pengguna", async () => {
    const m = buatPesan("t7", "c1");
    await fileManager.sendStatus(m);
    assert.ok(m.balasan[0].includes("Tidak ada proses pengumpulan berkas"));
  });

  test("menyelesaikan sesi tanpa berkas menampilkan petunjuk", async () => {
    const mulai = buatPesan("t8", "c1");
    await fileManager.startSession(mulai, "pdf", null);
    const sesi = fileManager.getActiveSession("t8", "c1");
    const m = buatPesan("t8", "c1");
    await fileManager.finishWithName(sesi, "hasil kosong", m, null);
    assert.equal(m.lampiran.length, 0);
    assert.ok(m.balasan[0].includes("Belum ada berkas"));
    await fileManager.cancelSession(buatPesan("t8", "c1"));
  });

  test("plugin pengelolaan file terdaftar dengan nama yang unik", async () => {
    const daftar = ["totxt", "topdf", "tozip", "statusfile", "batal", "menu", "filehelp"];
    const nama = [];
    for (const plugin of daftar) {
      const modul = await import("../plugins/files/" + plugin + ".js");
      assert.equal(modul.config.name, plugin);
      assert.deepEqual(modul.config.alias, []);
      assert.equal(modul.config.category, "files");
      assert.equal(typeof modul.handler, "function");
      nama.push(modul.config.name);
    }
    assert.equal(new Set(nama).size, 7, "nama perintah tidak unik");
  });
} else {
  test("integrasi naze-file-manager ditandai dilewati", () => {
    assert.ok(true, "dependensi runtime belum terpasang; jalankan npm install lalu npm test");
  });
}
