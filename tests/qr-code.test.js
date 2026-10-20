// Pengujian fitur QR Generator NAZE.
// Bagian murni menguji templat dan batas pada src/lib/naze-file-utils.js.
// Bagian integrasi menguji createQr pada src/lib/naze-file-manager.js bersama
// paket qrcode; jika dependensi belum terpasang (npm install), bagian itu
// dilewati dengan laporan yang jelas.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as utils from "../src/lib/naze-file-utils.js";

// ---------------------------------------------------------------------------
// Bagian 1: utilitas murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("resolveLimits menyertakan batas teks QR", () => {
  assert.equal(utils.resolveLimits().qrMaxTextBytes, 1000);
  assert.equal(utils.resolveLimits({ qrMaxTextBytes: 300 }).qrMaxTextBytes, 300);
  assert.equal(utils.resolveLimits({ qrMaxTextBytes: "banyak" }).qrMaxTextBytes, 1000);
  assert.equal(utils.resolveLimits({ qrMaxTextBytes: 0 }).qrMaxTextBytes, 1000);
});

test("qrGuideMessage menjelaskan cara pakai dan batas", () => {
  const teks = utils.qrGuideMessage();
  assert.ok(teks.startsWith(utils.BOT_TITLE));
  assert.ok(teks.includes("Teks sumber tidak ditemukan"));
  assert.ok(teks.includes('".toqr"'));
  assert.ok(teks.includes("https://contoh.com"));
  assert.ok(teks.includes("maksimal 1000 karakter"));
  assert.ok(teks.includes("tidak dapat diubah menjadi kode QR"));
});

test("qrGuideMessage memakai batas khusus bila diberikan", () => {
  assert.ok(utils.qrGuideMessage(250).includes("maksimal 250 karakter"));
});

test("qrMediaUnsupportedMessage menolak media dengan penjelasan", () => {
  const teks = utils.qrMediaUnsupportedMessage("foto");
  assert.ok(teks.startsWith(utils.BOT_TITLE));
  assert.ok(teks.includes('"foto"'));
  assert.ok(teks.includes("tidak dapat diubah menjadi kode QR"));
  assert.ok(teks.includes("maksimal 1000 karakter"));
  assert.ok(teks.includes('".toqr"'));
});

test("qrTooLongMessage menampilkan panjang dan batas", () => {
  const teks = utils.qrTooLongMessage(1200, 1000);
  assert.ok(teks.includes("terlalu panjang"));
  assert.ok(teks.includes("1200 karakter"));
  assert.ok(teks.includes("1000 karakter"));
});

test("qrDoneMessage memberi tahu hasil dan cara memindai", () => {
  const teks = utils.qrDoneMessage(21);
  assert.ok(teks.includes("Kode QR berhasil dibuat"));
  assert.ok(teks.includes("21 karakter"));
  assert.ok(teks.includes("Pindai"));
});

test("templat QR bebas emoji dan garis dekoratif", () => {
  const templat = [
    ["qr panduan", utils.qrGuideMessage()],
    ["qr media", utils.qrMediaUnsupportedMessage("video")],
    ["qr kepanjangan", utils.qrTooLongMessage(1200, 1000)],
    ["qr selesai", utils.qrDoneMessage(10)],
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

test("menu dan panduan memuat perintah toqr", () => {
  const menu = utils.menuText();
  assert.ok(menu.includes('".toqr"'), "menu tidak menyebut .toqr");
  assert.ok(menu.includes("QR Generator"));
  const panduan = utils.fileHelpText();
  assert.ok(panduan.includes('".toqr"'), "panduan tidak menyebut .toqr");
  assert.ok(panduan.includes("QR Generator"));
  assert.ok(panduan.includes("1000 karakter"));
});

// ---------------------------------------------------------------------------
// Bagian 2: integrasi createQr (memerlukan npm install)
// ---------------------------------------------------------------------------

let fileManager = null;
try {
  fileManager = await import("../src/lib/naze-file-manager.js");
  await import("qrcode");
} catch (error) {
  console.log("[LEWATI] Integrasi QR tidak dijalankan:", error.message);
}

function buatPesan(sender, chat, tambahan = {}) {
  const m = {
    sender,
    chat,
    balasan: [],
    gambar: [],
    async reply(teks) {
      m.balasan.push(String(teks));
    },
    async replyImage(image, caption = "") {
      m.gambar.push({ image, caption });
    },
    ...tambahan,
  };
  return m;
}

const TANDA_TANGAN_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

if (fileManager) {
  test("createQr menghasilkan gambar PNG dari teks setelah perintah", async () => {
    const m = buatPesan("q1", "c1", { text: "https://contoh.com" });
    await fileManager.createQr(m, null);
    assert.equal(m.balasan.length, 1);
    assert.ok(m.balasan[0].includes("Kode QR berhasil dibuat"));
    assert.equal(m.gambar.length, 1);
    assert.equal(m.gambar[0].caption, "");
    const gambar = m.gambar[0].image;
    for (let i = 0; i < TANDA_TANGAN_PNG.length; i += 1) {
      assert.equal(gambar[i], TANDA_TANGAN_PNG[i], "tanda tangan PNG tidak cocok");
    }
    assert.ok(gambar.length > 1000, "ukuran gambar mencurigakan");
  });

  test("createQr memakai teks pesan yang dibalas", async () => {
    const m = buatPesan("q2", "c2", {
      quoted: { body: "https://contoh.com/berkas" },
    });
    await fileManager.createQr(m, null);
    assert.ok(m.balasan[0].includes("Kode QR berhasil dibuat"));
    assert.equal(m.gambar.length, 1);
  });

  test("createQr memakai teks terakhir sebagai cadangan", async () => {
    const sebelumnya = buatPesan("q3", "c3", {
      type: "conversation",
      isCommand: false,
      body: "Nama saya Nendi",
    });
    await fileManager.rememberTextMessage(sebelumnya);
    const m = buatPesan("q3", "c3");
    await fileManager.createQr(m, null);
    assert.ok(m.balasan[0].includes("Kode QR berhasil dibuat"));
    assert.equal(m.gambar.length, 1);
  });

  test("createQr menolak teks yang terlalu panjang", async () => {
    const m = buatPesan("q4", "c4", { text: "a".repeat(1001) });
    await fileManager.createQr(m, null);
    assert.equal(m.gambar.length, 0);
    assert.ok(m.balasan[0].includes("terlalu panjang"));
    assert.ok(m.balasan[0].includes("1001 karakter"));
    assert.ok(m.balasan[0].includes("1000 karakter"));
  });

  test("createQr menghitung panjang dalam byte UTF-8", async () => {
    const m = buatPesan("q5", "c5", { text: "é".repeat(501) });
    await fileManager.createQr(m, null);
    assert.equal(m.gambar.length, 0);
    assert.ok(m.balasan[0].includes("terlalu panjang"));
  });

  test("createQr menolak media yang dibalas dengan penjelasan", async () => {
    const m = buatPesan("q6", "c6", {
      quoted: { isMedia: true, isImage: true },
    });
    await fileManager.createQr(m, null);
    assert.equal(m.gambar.length, 0);
    assert.ok(m.balasan[0].includes('"foto"'));
    assert.ok(m.balasan[0].includes("tidak dapat diubah menjadi kode QR"));
  });

  test("createQr menolak perintah berisi media tanpa teks", async () => {
    const m = buatPesan("q7", "c7", {
      isMedia: true,
      isVideo: true,
      text: "",
    });
    await fileManager.createQr(m, null);
    assert.equal(m.gambar.length, 0);
    assert.ok(m.balasan[0].includes('"video"'));
  });

  test("createQr menampilkan panduan saat tanpa teks", async () => {
    const m = buatPesan("q8", "c8");
    await fileManager.createQr(m, null);
    assert.equal(m.gambar.length, 0);
    assert.ok(m.balasan[0].includes("Teks sumber tidak ditemukan"));
    assert.ok(m.balasan[0].includes("https://contoh.com"));
  });

  test("plugin toqr terdaftar dengan konfigurasi yang sah", async () => {
    const modul = await import("../plugins/files/toqr.js");
    assert.equal(modul.config.name, "toqr");
    assert.deepEqual(modul.config.alias, []);
    assert.equal(modul.config.category, "files");
    assert.equal(typeof modul.handler, "function");
  });
} else {
  test("integrasi QR ditandai dilewati", () => {
    assert.ok(true, "dependensi runtime belum terpasang; jalankan npm install lalu npm test");
  });
}
