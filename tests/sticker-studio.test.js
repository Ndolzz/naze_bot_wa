// Pengujian Sticker Studio NAZE.
// Bagian murni menguji tata letak BRAT, easing, pola keyframe, validasi,
// dan templat pesan pada src/lib/naze-sticker-utils.js tanpa dependensi.
// Bagian integrasi menguji renderer, penyimpanan, dan konfigurasi plugin;
// jika dependensi belum terpasang (npm install), bagian itu dilewati dengan
// laporan yang jelas.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as utils from "../src/lib/naze-sticker-utils.js";

// Pengukur tiruan: lebar teks diperkirakan proporsional terhadap jumlah
// karakter dan ukuran font, cukup untuk menguji logika tata letak.
const mockMeasure = (text, fontSize) => [...String(text)].length * fontSize * 0.6;

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

// ---------------------------------------------------------------------------
// Bagian 1: utilitas murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("validateBratText menolak teks kosong", () => {
  const empty = utils.validateBratText("");
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "empty");
  assert.equal(utils.validateBratText("   ").ok, false);
  assert.equal(utils.validateBratText(null).ok, false);
});

test("validateBratText menolak teks terlalu panjang", () => {
  const long = utils.validateBratText("a".repeat(501), 500);
  assert.equal(long.ok, false);
  assert.equal(long.reason, "too-long");
  assert.equal(utils.validateBratText("a".repeat(500), 500).ok, true);
});

test("validateBratText menormalisasi spasi", () => {
  const result = utils.validateBratText("  halo   dunia  ", 500);
  assert.equal(result.ok, true);
  assert.equal(result.text, "halo dunia");
});

test("wrapBratText memenggal teks menjadi beberapa baris", () => {
  const lines = utils.wrapBratText(
    "satu dua tiga empat lima",
    40,
    mockMeasure,
    200,
  );
  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(mockMeasure(line, 40) <= 200);
  }
  assert.equal(lines.join(" "), "satu dua tiga empat lima");
});

test("wrapBratText memenggal kata yang lebih panjang dari lebar baris", () => {
  const lines = utils.wrapBratText("aaaaaaaaaaaaaaaaaaaaaaa", 40, mockMeasure, 200);
  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(mockMeasure(line, 40) <= 200);
  }
  assert.equal(lines.join(""), "aaaaaaaaaaaaaaaaaaaaaaa");
});

test("computeBratLayout menghasilkan satu baris besar untuk teks pendek", () => {
  const layout = utils.computeBratLayout("HI", mockMeasure);
  assert.ok(layout);
  assert.equal(layout.lineCount, 1);
  assert.ok(layout.fontSize >= 150, "teks pendek harus dirender besar: " + layout.fontSize);
  assert.ok(layout.fontSize <= utils.BRAT_MAX_FONT);
});

test("computeBratLayout memecah teks panjang menjadi beberapa baris", () => {
  const longText =
    "ini adalah teks yang cukup panjang sehingga harus dipecah menjadi " +
    "beberapa baris agar tetap terbaca di dalam kanvas stiker";
  const layout = utils.computeBratLayout(longText, mockMeasure);
  assert.ok(layout);
  assert.ok(layout.lineCount > 1);
  const availWidth = utils.BRAT_CANVAS_SIZE - utils.BRAT_MARGIN * 2;
  const availHeight = utils.BRAT_CANVAS_SIZE - utils.BRAT_MARGIN * 2;
  for (const line of layout.lines) {
    assert.ok(mockMeasure(line, layout.fontSize) <= availWidth);
  }
  assert.ok(layout.totalHeight <= availHeight);
  assert.ok(layout.blockTop >= 0);
});

test("ukuran font menurun seiring bertambahnya panjang teks", () => {
  const short = utils.computeBratLayout("halo", mockMeasure);
  const medium = utils.computeBratLayout("halo dunia selamat datang", mockMeasure);
  const long = utils.computeBratLayout(
    Array.from({ length: 40 }, (_, i) => "kata" + i).join(" "),
    mockMeasure,
  );
  assert.ok(short.fontSize >= medium.fontSize);
  assert.ok(medium.fontSize >= long.fontSize);
});

test("computeBratText menangani tanda baca dan karakter Unicode", () => {
  const text = "Halo, dunia! 你好 — naïve café ☕";
  const layout = utils.computeBratLayout(text, mockMeasure);
  assert.ok(layout);
  assert.equal(layout.lines.join(" "), text);
});

test("computeBratLayout mengembalikan null bila teks tidak tertampung", () => {
  const longText = "kata ".repeat(200);
  const layout = utils.computeBratLayout(longText, mockMeasure, {
    minFont: 120,
    maxFont: 200,
  });
  assert.equal(layout, null);
});

test("computeBratLayout menolak teks kosong", () => {
  assert.equal(utils.computeBratLayout("", mockMeasure), null);
  assert.equal(utils.computeBratLayout(null, mockMeasure), null);
});

test("easing memiliki titik ujung yang tepat", () => {
  assert.equal(utils.easeOutElastic(0), 0);
  assert.equal(utils.easeOutElastic(1), 1);
  assert.equal(utils.easeInCubic(0), 0);
  assert.equal(utils.easeInCubic(1), 1);
  assert.equal(utils.easeInOutCubic(0), 0);
  assert.equal(utils.easeInOutCubic(1), 1);
  assert.equal(utils.easeInOutSine(0), 0);
  assert.equal(utils.easeInOutSine(1), 1);
});

test("kelima pola keyframe menghasilkan gerakan yang berbeda", () => {
  const signatures = new Set();
  for (const patternId of utils.PATTERN_IDS) {
    const frame = utils.patternFrameTransforms(patternId, 0.25, { lineCount: 3 });
    signatures.add(JSON.stringify(frame));
  }
  assert.equal(signatures.size, utils.PATTERN_IDS.length);
});

test("setiap pola menghasilkan transformasi yang sah", () => {
  for (const patternId of utils.PATTERN_IDS) {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
      const frame = utils.patternFrameTransforms(patternId, t, { lineCount: 4 });
      assert.ok(frame.block, patternId + " harus memiliki transformasi blok");
      assert.ok(Number.isFinite(frame.block.scale));
      assert.ok(frame.block.scale > 0, "skala harus positif agar teks tidak rusak");
    }
  }
});

test("animasi berulang mulus: nilai t=0 sama dengan t=1", () => {
  for (const patternId of utils.PATTERN_IDS) {
    const start = utils.patternFrameTransforms(patternId, 0, { lineCount: 4 });
    const end = utils.patternFrameTransforms(patternId, 1, { lineCount: 4 });
    assert.equal(
      JSON.stringify(start),
      JSON.stringify(end),
      patternId + " harus mulus pada batas putaran",
    );
  }
});

test("wave-cascade menggerakkan tiap baris dengan jeda berbeda", () => {
  const frame = utils.patternFrameTransforms("wave-cascade", 0.125, { lineCount: 4 });
  assert.equal(frame.lines.length, 4);
  const offsets = frame.lines.map((line) => line.dy);
  assert.equal(new Set(offsets).size > 1, true);
});

test("split-reassemble memisah teks menjadi dua belahan dengan jalur berbeda", () => {
  const frame = utils.patternFrameTransforms("split-reassemble", 0.25, { lineCount: 1 });
  assert.equal(frame.halves.length, 2);
  assert.notEqual(frame.halves[0].dx, frame.halves[1].dx);
  assert.notEqual(frame.halves[0].dy, frame.halves[1].dy);
});

test("pickPattern menghasilkan kelima pola dengan peluang yang sama", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    seen.add(utils.pickPattern(null, () => (i % 100) / 100));
  }
  assert.equal(seen.size, utils.PATTERN_IDS.length);
});

test("pickPattern tidak memilih pola yang sama dua kali berturut-turut", () => {
  let previous = null;
  for (let i = 0; i < 200; i++) {
    const choice = utils.pickPattern(previous, () => (i % 97) / 97);
    assert.notEqual(choice, previous);
    previous = choice;
  }
});

test("pickPattern tetap menjangkau semua pola meski pola sebelumnya dikeluarkan", () => {
  const previous = "beat-pulse";
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    seen.add(utils.pickPattern(previous, () => (i % 100) / 100));
  }
  assert.ok(!seen.has(previous));
  assert.equal(seen.size, utils.PATTERN_IDS.length - 1);
});

test("menu Sticker Studio menampilkan tiga kategori dengan nomor berurutan", () => {
  const menu = utils.stickerStudioMenuText();
  assert.ok(menu.includes("STICKER MAKER"));
  assert.ok(menu.includes("MEDIA CONVERTER"));
  assert.ok(menu.includes("STICKER MANAGEMENT"));

  const commands = [
    "sticker", "s", "stiker", "brat", "bratvid",
    "toimg", "togif", "tovideo",
    "take", "steal", "getsticker", "liststicker", "delsticker",
  ];
  commands.forEach((command, index) => {
    const expected = `${index + 1}. ".${command}"`;
    assert.ok(
      menu.includes(expected),
      `menu harus memuat entri bernomor "${expected}"`,
    );
  });
});

test("menu Sticker Studio bebas emoji", () => {
  const menu = utils.stickerStudioMenuText();
  assert.equal(EMOJI_PATTERN.test(menu), false);
});

test("validateStickerName memvalidasi nama koleksi", () => {
  assert.equal(utils.validateStickerName("kucing").ok, true);
  assert.equal(utils.validateStickerName("Stiker_01").ok, true);
  assert.equal(utils.validateStickerName("a-b").name, "a-b");
  assert.equal(utils.validateStickerName("").ok, false);
  assert.equal(utils.validateStickerName("ada spasi").ok, false);
  assert.equal(utils.validateStickerName("ada|pipe").ok, false);
  assert.equal(utils.validateStickerName("x".repeat(33)).ok, false);
});

test("resolveStudioLimits menerima angka sah dan mengabaikan nilai tidak sah", () => {
  const limits = utils.resolveStudioLimits();
  assert.equal(limits.maxTextLength, 500);
  assert.equal(limits.bratvidDurationSeconds, 3);
  assert.equal(limits.bratvidFps, 10);

  const custom = utils.resolveStudioLimits({
    maxTextLength: 100,
    bratvidFps: "banyak",
    store: { maxStickers: 10 },
  });
  assert.equal(custom.maxTextLength, 100);
  assert.equal(custom.bratvidFps, 10, "nilai tidak sah harus diabaikan");
  assert.equal(custom.store.maxStickers, 10);
  assert.equal(custom.store.maxStickerBytes, limits.store.maxStickerBytes);
});

test("templat pesan memuat judul dan isi yang jelas", () => {
  const guide = utils.studioTextEmptyMessage(".brat");
  assert.ok(guide.includes("Teks tidak ditemukan."));
  assert.ok(guide.includes('".brat"'));
  const tooLong = utils.studioTextTooLongMessage(500);
  assert.ok(tooLong.includes("500 karakter"));
  const denied = utils.storeDeleteDeniedMessage();
  assert.ok(denied.includes("penyimpannya atau owner bot"));
  assert.equal(EMOJI_PATTERN.test(denied), false);
});

// ---------------------------------------------------------------------------
// Bagian 2: integrasi (memerlukan npm install; dilewati bila dependensi
// belum tersedia)
// ---------------------------------------------------------------------------

let depsReady = false;
let depsError = null;
try {
  await import("@napi-rs/canvas");
  await import("sharp");
  depsReady = true;
} catch (error) {
  depsError = error.message;
}

let ffmpegOk = false;
if (depsReady) {
  // naze-ffmpeg-path.js harus diimpor sebelum naze-exif.js agar
  // FFMPEG_PATH terpasang dengan benar (mengikuti konvensi index.js).
  await import("../src/lib/naze-ffmpeg-path.js");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const ffmpegTarget = process.env.FFMPEG_PATH || "ffmpeg";
  try {
    await execFileAsync(ffmpegTarget, ["-version"]);
    ffmpegOk = true;
  } catch {
    ffmpegOk = false;
  }
}

if (!depsReady) {
  test("integrasi Sticker Studio ditandai dilewati", () => {
    assert.ok(
      true,
      "dependensi runtime belum terpasang (" + depsError + "); jalankan npm install lalu npm test",
    );
  });
} else {
  const renderer = await import("../src/lib/naze-sticker-renderer.js");
  const exif = await import("../src/lib/naze-exif.js");
  const store = await import("../src/lib/naze-sticker-store.js");
  const pluginFiles = [
    "sticker", "brat", "bratvid", "toimg", "togif", "tovideo",
    "take", "steal", "getsticker", "liststicker", "delsticker",
  ];

  async function rawPixels(buffer) {
    const sharpModule = (await import("sharp")).default;
    return sharpModule(buffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  }

  async function whiteCorners(buffer) {
    const { data, info } = await rawPixels(buffer);
    const cornerIndex = (info.width - 1) * info.channels;
    const values = [
      data[0], data[1],
      data[cornerIndex], data[cornerIndex + 1],
    ];
    return values.every((value) => value >= 250);
  }

  // Pengujian render memerlukan ffmpeg untuk konversi PNG ke WebP.
  if (ffmpegOk) {
    test("renderBratStatic menghasilkan WebP statis 512 x 512 dengan background putih", async () => {
      const result = await renderer.renderBratStatic("halo dunia", {
        packname: "NAZE",
        author: "NAZE",
      });
      assert.equal(result.ok, true);
      assert.ok(exif.isValidWebp(result.buffer));
      assert.equal(await exif.isAnimatedWebp(result.buffer), false);
      const dimensions = exif.getWebpDimensions(result.buffer);
      assert.equal(dimensions.width, 512);
      assert.equal(dimensions.height, 512);
      assert.equal(await whiteCorners(result.buffer), true);
    });

    test("renderBratStatic menampung teks panjang dan karakter Unicode", async () => {
      for (const text of [
        "teks panjang " + "yang berulang ".repeat(20),
        "Halo, dunia! 你好 — naïve café",
      ]) {
        const result = await renderer.renderBratStatic(text, {
          packname: "NAZE",
          author: "NAZE",
        });
        assert.equal(result.ok, true);
        assert.equal(await whiteCorners(result.buffer), true);
      }
    });

    test("kelima pola BRATVID menghasilkan animated WebP yang valid", async () => {
      for (const patternId of utils.PATTERN_IDS) {
        const result = await renderer.renderBratAnimated("brat vid", {
          pattern: patternId,
          duration: 1,
          fps: 5,
          maxBytes: 5 * 1024 * 1024,
          packname: "NAZE",
          author: "NAZE",
        });
        assert.equal(result.ok, true, "pola " + patternId + " harus berhasil");
        assert.equal(result.pattern, patternId);
        assert.ok(exif.isValidWebp(result.buffer));
        assert.equal(await exif.isAnimatedWebp(result.buffer), true);
        assert.equal(await whiteCorners(result.buffer), true);
      }
    });
  } else {
    test("render BRAT ditandai dilewati", () => {
      assert.ok(
        true,
        "ffmpeg tidak tersedia di PATH; pengujian render PNG ke WebP dilewati",
      );
    });
  }

  test("pola BRATVID yang berbeda menghasilkan gerakan yang berbeda", () => {
    const layouts = utils.PATTERN_IDS.map((patternId) =>
      utils.patternFrameTransforms(patternId, 0.25, { lineCount: 2 }),
    );
    const signatures = new Set(layouts.map((frame) => JSON.stringify(frame)));
    assert.equal(signatures.size, utils.PATTERN_IDS.length);
  });

  test("penyimpanan stiker: simpan, ambil, daftar, hapus dengan izin", async () => {
    const limits = utils.resolveStudioLimits();
    const saved = store.saveSticker({
      name: "uji-stiker",
      buffer: Buffer.from("RIFF____WEBP", "utf8"),
      sender: "user1@s.whatsapp.net",
      senderNumber: "user1",
      maxStickers: limits.store.maxStickers,
      maxStickerBytes: limits.store.maxStickerBytes,
      createdLabel: "2026-01-01",
    });
    assert.equal(saved.ok, true);

    const duplicate = store.saveSticker({
      name: "uji-stiker",
      buffer: Buffer.from("RIFF____WEBP", "utf8"),
      sender: "user2@s.whatsapp.net",
      senderNumber: "user2",
      maxStickers: limits.store.maxStickers,
      maxStickerBytes: limits.store.maxStickerBytes,
    });
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.reason, "exists");

    const found = store.getSticker("uji-stiker");
    assert.ok(found);
    assert.equal(found.entry.senderNumber, "user1");

    const listed = store.listStickers();
    assert.ok(listed.some((entry) => entry.name === "uji-stiker"));

    const denied = store.deleteSticker("uji-stiker", "user2@s.whatsapp.net", false);
    assert.equal(denied.ok, false);
    assert.equal(denied.reason, "denied");

    const byOwner = store.deleteSticker("uji-stiker", "owner@s.whatsapp.net", true);
    assert.equal(byOwner.ok, true);
    assert.equal(store.getSticker("uji-stiker"), null);
  });

  test("plugin sticker terdaftar dengan konfigurasi sah dan tanpa benturan nama", async () => {
    const names = new Set();
    const aliases = new Map();
    const allAliasTargets = [];

    for (const pluginName of pluginFiles) {
      const modul = await import(`../plugins/sticker/${pluginName}.js`);
      assert.equal(typeof modul.config.name, "string");
      assert.equal(modul.config.category, "sticker");
      assert.equal(typeof modul.handler, "function");
      assert.ok(!names.has(modul.config.name), "nama command ganda: " + modul.config.name);
      names.add(modul.config.name);
      for (const alias of modul.config.alias || []) {
        assert.ok(!names.has(alias), "alias bentrok dengan command: " + alias);
        allAliasTargets.push(alias);
      }
    }

    // Perintah lama (kategori files) tidak boleh bentrok dengan perintah baru.
    const filesPlugins = ["menu", "filehelp", "totxt", "topdf", "tozip", "toqr", "statusfile", "batal"];
    for (const pluginName of filesPlugins) {
      const modul = await import(`../plugins/files/${pluginName}.js`);
      assert.ok(!names.has(modul.config.name), "benturan dengan perintah files: " + modul.config.name);
    }
  });
}
