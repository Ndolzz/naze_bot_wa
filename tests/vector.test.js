// Pengujian Vector NAZE.
// Bagian murni menguji penguraian argumen, resolusi batas, warna, templat
// pesan, dan mesin vektorisasi (mask, kontur, SVG) pada src/lib/naze-vector-utils.js
// dan src/lib/naze-vector-engine.js tanpa dependensi.
// Bagian integrasi menguji alur penuh dengan sharp, registrasi plugin, dan
// menu; otomatis dilewati bila dependensi belum terpasang.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as utils from "../src/lib/naze-vector-utils.js";
import * as engine from "../src/lib/naze-vector-engine.js";

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

// ---------------------------------------------------------------------------
// Bagian 1: utilitas murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("parseVectorArgs memakai nilai bawaan tanpa argumen", () => {
  const limits = utils.resolveVectorLimits();
  assert.deepEqual(utils.parseVectorArgs("", limits), {
    mode: "gelap",
    thresholdPercent: 50,
    simplification: "sedang",
    color: "#0F172A",
    invalid: [],
  });
  assert.deepEqual(utils.parseVectorArgs(null, limits).invalid, []);
});

test("parseVectorArgs menerima opsi dalam urutan bebas", () => {
  const limits = utils.resolveVectorLimits();
  const settings = utils.parseVectorArgs("terang 70 rendah #2563EB", limits);
  assert.equal(settings.mode, "terang");
  assert.equal(settings.thresholdPercent, 70);
  assert.equal(settings.simplification, "rendah");
  assert.equal(settings.color, "#2563EB");
  assert.equal(settings.invalid.length, 0);
});

test("parseVectorArgs tidak membedakan kapitalisasi", () => {
  const limits = utils.resolveVectorLimits();
  const settings = utils.parseVectorArgs("TERANG Sedang #2563eb", limits);
  assert.equal(settings.mode, "terang");
  assert.equal(settings.simplification, "sedang");
  assert.equal(settings.color, "#2563EB");
});

test("parseVectorArgs mengambil token terakhir bila opsi diulang", () => {
  const limits = utils.resolveVectorLimits();
  const settings = utils.parseVectorArgs("gelap terang 70 80 rendah tinggi", limits);
  assert.equal(settings.mode, "terang");
  assert.equal(settings.thresholdPercent, 80);
  assert.equal(settings.simplification, "tinggi");
});

test("parseVectorArgs mengumpulkan token tidak dikenali", () => {
  const limits = utils.resolveVectorLimits();
  const settings = utils.parseVectorArgs("foo 100 #12345 0 zzz", limits);
  assert.equal(settings.mode, "gelap", "token tidak dikenali tidak boleh mengubah pengaturan");
  assert.equal(settings.thresholdPercent, 50);
  assert.deepEqual(settings.invalid, ["foo", "100", "#12345", "0", "zzz"]);
});

test("resolveVectorLimits menerima nilai sah dan mengabaikan nilai tidak sah", () => {
  const defaults = utils.resolveVectorLimits();
  assert.equal(defaults.maxMediaBytes, 15728640);
  assert.equal(defaults.maxWorkDimension, 1024);
  assert.equal(defaults.defaultThresholdPercent, 50);
  assert.equal(defaults.defaultMode, "gelap");
  assert.equal(defaults.defaultSimplification, "sedang");
  assert.equal(defaults.defaultColor, "#0F172A");
  assert.equal(defaults.previewMaxWidth, 1280);

  const custom = utils.resolveVectorLimits({
    maxMediaBytes: 1048576,
    maxWorkDimension: 512,
    defaultThresholdPercent: 70,
    defaultMode: "terang",
    defaultSimplification: "tinggi",
    defaultColor: "#2563eb",
    previewMaxWidth: 640,
  });
  assert.equal(custom.maxMediaBytes, 1048576);
  assert.equal(custom.maxWorkDimension, 512);
  assert.equal(custom.defaultThresholdPercent, 70);
  assert.equal(custom.defaultMode, "terang");
  assert.equal(custom.defaultSimplification, "tinggi");
  assert.equal(custom.defaultColor, "#2563EB", "warna harus dinormalkan ke huruf besar");
  assert.equal(custom.previewMaxWidth, 640);

  const invalid = utils.resolveVectorLimits({
    maxMediaBytes: "besar",
    maxWorkDimension: 0,
    defaultThresholdPercent: 0,
    defaultMode: "birus",
    defaultSimplification: "ekstrem",
    defaultColor: "hijau",
    previewMaxWidth: -1,
  });
  assert.equal(invalid.maxMediaBytes, 15728640, "nilai tidak sah harus diabaikan");
  assert.equal(invalid.maxWorkDimension, 1024);
  assert.equal(invalid.defaultThresholdPercent, 50);
  assert.equal(invalid.defaultMode, "gelap");
  assert.equal(invalid.defaultSimplification, "sedang");
  assert.equal(invalid.defaultColor, "#0F172A");
  assert.equal(invalid.previewMaxWidth, 1280);
});

test("parseHexColor dan isColorHex memvalidasi warna #RRGGBB", () => {
  assert.deepEqual(utils.parseHexColor("#2563EB"), { r: 37, g: 99, b: 235 });
  assert.equal(utils.parseHexColor("#000000"), null);
  assert.equal(utils.parseHexColor("#abc"), null);
  assert.equal(utils.parseHexColor("birus"), null);
  assert.equal(utils.parseHexColor(null), null);

  assert.equal(utils.isColorHex("#ABCDEF"), true);
  assert.equal(utils.isColorHex("#abc123"), true);
  assert.equal(utils.isColorHex("#ABCDE"), false);
  assert.equal(utils.isColorHex("ABCDEF"), false);
  assert.equal(utils.isColorHex("#GGGGGG"), false);
});

test("formatVectorSettings merangkai pengaturan", () => {
  assert.equal(
    utils.formatVectorSettings({
      mode: "terang",
      thresholdPercent: 70,
      simplification: "rendah",
      color: "#2563EB",
    }),
    "mode terang, ambang 70%, penyederhanaan rendah, warna #2563EB",
  );
});

test("menu Vector menampilkan entri lengkap", () => {
  const menu = utils.vectorMenuText();
  assert.ok(menu.includes("VECTOR"));
  assert.ok(menu.includes('".vector"'));
  assert.ok(menu.includes('".vektor"'));
  assert.equal(EMOJI_PATTERN.test(menu), false);
});

test("templat pesan memuat isi yang jelas dan tanpa emoji", () => {
  const limits = utils.resolveVectorLimits();

  const guide = utils.vectorGuideMessage(limits);
  assert.ok(guide.includes(".vector"));
  assert.ok(guide.includes("gelap"));
  assert.ok(guide.includes("#2563EB"));
  assert.equal(EMOJI_PATTERN.test(guide), false);

  const unsupported = utils.vectorMediaUnsupportedMessage("video");
  assert.ok(unsupported.includes('"video"'));
  assert.ok(unsupported.includes("tidak dapat diubah menjadi vektor"));
  assert.equal(EMOJI_PATTERN.test(unsupported), false);

  const tooLarge = utils.vectorMediaTooLargeMessage(15728640);
  assert.ok(tooLarge.includes("MB"));
  assert.equal(EMOJI_PATTERN.test(tooLarge), false);

  const invalidArgs = utils.vectorInvalidArgsMessage(["foo", "bar"]);
  assert.ok(invalidArgs.includes('"foo"'));
  assert.ok(invalidArgs.includes('"bar"'));

  const settings = utils.parseVectorArgs("terang 70", limits);
  const empty = utils.vectorEmptySilhouetteMessage(settings);
  assert.ok(empty.includes("siluet kosong"));
  assert.ok(empty.includes("mode terang, ambang 70%"));

  const failed = utils.vectorFailedMessage("media gagal diunduh");
  assert.ok(failed.includes("media gagal diunduh"));

  const caption = utils.vectorDoneCaption(
    { width: 32, height: 32, componentCount: 1, pathCount: 2, vertexCount: 8 },
    settings,
  );
  assert.ok(caption.includes("32 x 32 piksel"));
  assert.ok(caption.includes('"siluet.svg"'));
  assert.equal(EMOJI_PATTERN.test(caption), false);
});

// ---------------------------------------------------------------------------
// Bagian 2: mesin vektorisasi murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("computePreviewDimensions mengecilkan gambar tanpa memperbesar", () => {
  assert.deepEqual(engine.computePreviewDimensions(2000, 1000, 1024), {
    width: 1024,
    height: 512,
  });
  assert.deepEqual(engine.computePreviewDimensions(100, 50, 1024), {
    width: 100,
    height: 50,
  });
  assert.deepEqual(engine.computePreviewDimensions(1400, 700), {
    width: 700,
    height: 350,
  });
  assert.deepEqual(engine.computePreviewDimensions(1, 1, 1024), {
    width: 1,
    height: 1,
  });
});

test("computePreviewDimensions menolak dimensi tidak sah", () => {
  assert.throws(() => engine.computePreviewDimensions(0, 10, 1024));
  assert.throws(() => engine.computePreviewDimensions(10.5, 10, 1024));
  assert.throws(() => engine.computePreviewDimensions(10, -1, 1024));
});

function pixelsFromRgb(colors) {
  const pixels = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((color, index) => {
    pixels[index * 4] = color[0];
    pixels[index * 4 + 1] = color[1];
    pixels[index * 4 + 2] = color[2];
    pixels[index * 4 + 3] = color.length > 3 ? color[3] : 255;
  });
  return pixels;
}

test("computeSilhouetteMaskFromPixels membentuk mask sesuai mode dan ambang", () => {
  const black = [0, 0, 0];
  const white = [255, 255, 255];
  const pixels = pixelsFromRgb([black, white, white, black]);
  const dark = engine.computeSilhouetteMaskFromPixels(pixels, 2, 2, "gelap", 50);
  assert.deepEqual(Array.from(dark.mask), [255, 0, 0, 255]);

  const bright = engine.computeSilhouetteMaskFromPixels(pixels, 2, 2, "terang", 50);
  assert.deepEqual(Array.from(bright.mask), [0, 255, 255, 0]);

  const transparent = pixelsFromRgb([[0, 0, 0, 0], white, white, white]);
  const withAlpha = engine.computeSilhouetteMaskFromPixels(transparent, 2, 2, "gelap", 50);
  assert.deepEqual(Array.from(withAlpha.mask), [0, 0, 0, 0], "piksel transparan selalu luar");
});

test("computeSilhouetteMaskFromPixels menolak data piksel tidak sesuai", () => {
  assert.throws(() =>
    engine.computeSilhouetteMaskFromPixels(new Uint8ClampedArray(4), 2, 2, "gelap", 50),
  );
  assert.throws(() => engine.computeSilhouetteMaskFromPixels(null, 2, 2, "gelap", 50));
});

function ringMask5x5() {
  const mask = new Uint8ClampedArray(25).fill(255);
  mask[12] = 0;
  return { mask, width: 5, height: 5 };
}

test("vectorizeSilhouette menelusuri kontur luar dan lubang", () => {
  const result = engine.vectorizeSilhouette(ringMask5x5(), {
    simplification: "sedang",
    color: "#2563EB",
  });
  assert.equal(result.ok, true);
  assert.equal(result.empty, false);
  assert.equal(result.pathCount, 2, "satu kontur luar dan satu lubang");
  assert.equal(result.componentCount, 1);
  assert.ok(result.vertexCount >= 8);
  const roles = result.subpaths.map((subpath) => subpath.role).sort();
  assert.deepEqual(roles, ["hole", "outer"]);
  assert.ok(result.svg.includes("<svg"));
  assert.ok(result.svg.includes('fill="#2563EB"'));
  assert.ok(result.svg.includes('viewBox="0 0 5 5"'));
});

test("vectorizeSilhouette mengembalikan hasil kosong untuk mask kosong", () => {
  const result = engine.vectorizeSilhouette(
    { mask: new Uint8ClampedArray(25), width: 5, height: 5 },
    { simplification: "sedang" },
  );
  assert.equal(result.ok, true);
  assert.equal(result.empty, true);
  assert.equal(result.pathCount, 0);
  assert.equal(result.componentCount, 0);
  assert.equal(result.svg, null);
});

test("vectorizeSilhouette menolak mask tidak valid", () => {
  assert.throws(() => engine.vectorizeSilhouette(null, {}));
  assert.throws(() => engine.vectorizeSilhouette({ mask: null, width: 5, height: 5 }, {}));
  assert.throws(() =>
    engine.vectorizeSilhouette({ mask: new Uint8ClampedArray(4), width: 5, height: 5 }, {}),
  );
  assert.throws(() =>
    engine.vectorizeSilhouette({ mask: new Uint8ClampedArray(25), width: 0, height: 5 }, {}),
  );
});

test("vectorizeSilhouette mengikuti tingkat penyederhanaan dan toleransi", () => {
  const rendah = engine.vectorizeSilhouette(ringMask5x5(), { simplification: "rendah" });
  const tinggi = engine.vectorizeSilhouette(ringMask5x5(), { simplification: "tinggi" });
  assert.equal(rendah.tolerancePx, engine.SIMPLIFICATION_LEVELS.rendah.tolerancePx);
  assert.equal(tinggi.tolerancePx, engine.SIMPLIFICATION_LEVELS.tinggi.tolerancePx);

  const custom = engine.vectorizeSilhouette(ringMask5x5(), { tolerancePx: 0 });
  assert.equal(custom.tolerancePx, 0);

  const unknown = engine.vectorizeSilhouette(ringMask5x5(), {});
  assert.equal(unknown.tolerancePx, engine.SIMPLIFICATION_LEVELS.sedang.tolerancePx);
});

test("buildSvgDocument membangun ulang SVG dan menolak data kosong", () => {
  const result = engine.vectorizeSilhouette(ringMask5x5(), {
    simplification: "sedang",
    color: "#0F172A",
  });
  const svg = engine.buildSvgDocument(result, "#2563EB");
  assert.ok(svg.includes('fill="#2563EB"'));
  assert.ok(svg.includes('fill-rule="evenodd"'));

  assert.equal(engine.buildSvgDocument(result, "birus"), engine.buildSvgDocument(result, "#0F172A"));

  assert.equal(engine.buildSvgDocument(null, "#2563EB"), "");
  assert.equal(
    engine.buildSvgDocument({ ok: true, empty: true, subpaths: [] }, "#2563EB"),
    "",
  );
});

test("sanitizeColorHex menormalkan warna dan jatuh ke bawaan", () => {
  assert.equal(engine.sanitizeColorHex("#abc123"), "#ABC123");
  assert.equal(engine.sanitizeColorHex("#ABCDEF"), "#ABCDEF");
  assert.equal(engine.sanitizeColorHex("hijau"), "#0F172A");
  assert.equal(engine.sanitizeColorHex(null), "#0F172A");
});

// ---------------------------------------------------------------------------
// Bagian 3: integrasi (memerlukan npm install; dilewati bila dependensi
// belum tersedia)
// ---------------------------------------------------------------------------

let depsReady = false;
let depsError = null;
let manager = null;

try {
  manager = await import("../src/lib/naze-vector-manager.js");
  depsReady = true;
} catch (error) {
  depsError = error.message;
}

if (!depsReady) {
  test("integrasi Vector ditandai dilewati", () => {
    assert.ok(
      true,
      "dependensi runtime belum terpasang (" + depsError + "); jalankan npm install lalu npm test",
    );
  });
} else {
  const sharp = (await import("sharp")).default;

  async function squarePng(size, squareFrom, squareTo) {
    const pixels = Buffer.alloc(size * size * 3, 255);
    for (let y = squareFrom; y < squareTo; y += 1) {
      for (let x = squareFrom; x < squareTo; x += 1) {
        const index = (y * size + x) * 3;
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
      }
    }
    return sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
      .png()
      .toBuffer();
  }

  function fakeMessage(pngBuffer, text) {
    const sent = { replies: [], images: [], documents: [] };
    const m = {
      text: text || "",
      reply: async (text) => {
        sent.replies.push(text);
      },
      replyImage: async (buffer, caption) => {
        sent.images.push({ buffer, caption });
      },
      replyDocument: async (buffer, filename, mime) => {
        sent.documents.push({ buffer, filename, mime });
      },
    };
    if (pngBuffer !== null) {
      m.quoted = {
        isImage: true,
        download: async () => pngBuffer,
      };
    }
    return { m, sent };
  }

  test("createVector tanpa media membalas panduan", async () => {
    const { m, sent } = fakeMessage(null, "");
    await manager.createVector(m);
    assert.equal(sent.replies.length, 1);
    assert.ok(sent.replies[0].includes(".vector"));
    assert.equal(sent.images.length, 0);
    assert.equal(sent.documents.length, 0);
  });

  test("createVector menolak argumen tidak dikenali", async () => {
    const png = await squarePng(32, 8, 24);
    const { m, sent } = fakeMessage(png, "zzz");
    await manager.createVector(m);
    assert.equal(sent.replies.length, 1);
    assert.ok(sent.replies[0].includes('Argumen tidak dikenali: "zzz"'));
    assert.equal(sent.images.length, 0);
  });

  test("createVector mengubah gambar menjadi SVG ujung ke ujung", async () => {
    const png = await squarePng(32, 8, 24);
    const { m, sent } = fakeMessage(png, "");
    await manager.createVector(m);

    assert.ok(
      sent.replies.some((text) => text.includes("tunggu") || text.includes("Memproses")),
      "pesan tunggu harus dikirim",
    );
    assert.equal(sent.images.length, 1, "satu pratinjau PNG harus dikirim");
    assert.ok(sent.images[0].buffer.length > 0);
    assert.ok(sent.images[0].caption.includes("Siluet vektor berhasil dibuat."));
    assert.ok(sent.images[0].caption.includes("32 x 32 piksel"));
    assert.ok(sent.images[0].caption.includes("Komponen: 1"));
    assert.ok(sent.images[0].caption.includes("Pengaturan: mode gelap, ambang 50%"));

    assert.equal(sent.documents.length, 1, "satu berkas SVG harus dikirim");
    assert.equal(sent.documents[0].filename, "siluet.svg");
    assert.equal(sent.documents[0].mime, "image/svg+xml");
    const svg = sent.documents[0].buffer.toString("utf-8");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes('viewBox="0 0 32 32"'));
    assert.ok(svg.includes('fill="#0F172A"'));
    assert.equal(EMOJI_PATTERN.test(sent.images[0].caption), false);
  });

  test("createVector menolak gambar tanpa objek", async () => {
    const png = await sharp(
      Buffer.alloc(32 * 32 * 3, 255),
      { raw: { width: 32, height: 32, channels: 3 } },
    )
      .png()
      .toBuffer();
    const { m, sent } = fakeMessage(png, "");
    await manager.createVector(m);
    assert.equal(sent.images.length, 0, "siluet kosong tidak boleh mengirim gambar");
    assert.equal(sent.documents.length, 0);
    assert.ok(
      sent.replies.some((text) => text.includes("siluet kosong")),
      "pesan siluet kosong harus dikirim",
    );
  });

  test("plugin vector terdaftar dengan konfigurasi sah dan tanpa benturan nama", async () => {
    const modul = await import("../plugins/tools/vector.js");
    assert.equal(modul.config.name, "vector");
    assert.deepEqual(modul.config.alias, ["vektor"]);
    assert.equal(modul.config.category, "tools");
    assert.equal(typeof modul.handler, "function");

    const names = new Set([modul.config.name]);
    const aliases = new Set(modul.config.alias || []);

    const downloaderPlugins = ["tiktok", "instagram", "youtube", "mp3", "ytsearch"];
    for (const pluginName of downloaderPlugins) {
      const other = await import(`../plugins/downloader/${pluginName}.js`);
      assert.ok(!names.has(other.config.name), "benturan dengan perintah downloader: " + other.config.name);
      assert.ok(!aliases.has(other.config.name), "benturan alias dengan perintah downloader: " + other.config.name);
      for (const alias of other.config.alias || []) {
        assert.ok(!names.has(alias), "benturan command dengan alias downloader: " + alias);
        assert.ok(!aliases.has(alias), "benturan alias dengan alias downloader: " + alias);
      }
    }

    const filesPlugins = ["menu", "filehelp", "totxt", "topdf", "tozip", "toqr", "statusfile", "batal"];
    for (const pluginName of filesPlugins) {
      const other = await import(`../plugins/files/${pluginName}.js`);
      assert.ok(!names.has(other.config.name), "benturan dengan perintah files: " + other.config.name);
      for (const alias of other.config.alias || []) {
        assert.ok(!aliases.has(alias), "benturan alias dengan alias files: " + alias);
      }
    }

    const stickerPlugins = [
      "sticker", "brat", "bratvid", "toimg", "togif", "tovideo",
      "take", "steal", "getsticker", "liststicker", "delsticker",
    ];
    for (const pluginName of stickerPlugins) {
      const other = await import(`../plugins/sticker/${pluginName}.js`);
      assert.ok(!names.has(other.config.name), "benturan dengan perintah sticker: " + other.config.name);
      for (const alias of other.config.alias || []) {
        assert.ok(!aliases.has(alias), "benturan alias dengan alias sticker: " + alias);
      }
    }
  });

  test("menu utama menampilkan bagian VECTOR", async () => {
    const menuPlugin = await import("../plugins/files/menu.js");
    const m = {
      reply: (text) => {
        assert.ok(text.includes("VECTOR"));
        assert.ok(text.includes('".vector"'));
        assert.ok(text.includes('".vektor"'));
        assert.ok(text.includes("YOUTUBE SEARCH"));
        assert.ok(text.includes("SOSMED DOWNLOADER"));
        assert.ok(text.includes("STICKER"));
        assert.ok(text.includes("FILE MANAGEMENT"));
        assert.equal(EMOJI_PATTERN.test(text), false);
      },
    };
    await menuPlugin.handler(m);
  });
}
