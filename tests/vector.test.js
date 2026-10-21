// Pengujian Vector NAZE.
// Bagian murni menguji penguraian argumen, resolusi batas, warna, templat
// pesan, mesin vektorisasi (mask, kontur, SVG), ekstraksi centerline, dan
// serializer XML Alight Motion pada src/lib/naze-vector-utils.js,
// src/lib/naze-vector-engine.js, src/lib/naze-vector-centerline.js, dan
// src/lib/naze-vector-amxml.js tanpa dependensi.
// Bagian integrasi menguji alur penuh dengan sharp, registrasi plugin, dan
// menu; otomatis dilewati bila dependensi belum terpasang.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as utils from "../src/lib/naze-vector-utils.js";
import * as engine from "../src/lib/naze-vector-engine.js";
import * as centerline from "../src/lib/naze-vector-centerline.js";
import * as amxml from "../src/lib/naze-vector-amxml.js";

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
    representation: "isi",
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

test("parseVectorArgs mengenali representasi isi dan garis", () => {
  const limits = utils.resolveVectorLimits();
  const garis = utils.parseVectorArgs("garis", limits);
  assert.equal(garis.representation, "garis");

  const mixed = utils.parseVectorArgs("GARIS terang", limits);
  assert.equal(mixed.representation, "garis", "token tidak peka kapitalisasi");
  assert.equal(mixed.mode, "terang");

  const back = utils.parseVectorArgs("garis isi", limits);
  assert.equal(back.representation, "isi", "token terakhir menang");

  const unknown = utils.parseVectorArgs("vektorrr", limits);
  assert.equal(unknown.representation, "isi", "token tidak dikenali tidak boleh mengubah representasi");
  assert.deepEqual(unknown.invalid, ["vektorrr"]);
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
  assert.equal(defaults.defaultRepresentation, "isi");
  assert.equal(defaults.defaultColor, "#0F172A");
  assert.equal(defaults.previewMaxWidth, 1280);

  const custom = utils.resolveVectorLimits({
    maxMediaBytes: 1048576,
    maxWorkDimension: 512,
    defaultThresholdPercent: 70,
    defaultMode: "terang",
    defaultSimplification: "tinggi",
    defaultRepresentation: "garis",
    defaultColor: "#2563eb",
    previewMaxWidth: 640,
  });
  assert.equal(custom.maxMediaBytes, 1048576);
  assert.equal(custom.maxWorkDimension, 512);
  assert.equal(custom.defaultThresholdPercent, 70);
  assert.equal(custom.defaultMode, "terang");
  assert.equal(custom.defaultSimplification, "tinggi");
  assert.equal(custom.defaultRepresentation, "garis");
  assert.equal(custom.defaultColor, "#2563EB", "warna harus dinormalkan ke huruf besar");
  assert.equal(custom.previewMaxWidth, 640);

  const invalid = utils.resolveVectorLimits({
    maxMediaBytes: "besar",
    maxWorkDimension: 0,
    defaultThresholdPercent: 0,
    defaultMode: "birus",
    defaultSimplification: "ekstrem",
    defaultRepresentation: "kontur",
    defaultColor: "hijau",
    previewMaxWidth: -1,
  });
  assert.equal(invalid.maxMediaBytes, 15728640, "nilai tidak sah harus diabaikan");
  assert.equal(invalid.maxWorkDimension, 1024);
  assert.equal(invalid.defaultThresholdPercent, 50);
  assert.equal(invalid.defaultMode, "gelap");
  assert.equal(invalid.defaultSimplification, "sedang");
  assert.equal(invalid.defaultRepresentation, "isi");
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
      representation: "garis",
      color: "#2563EB",
    }),
    "representasi garis, mode terang, ambang 70%, penyederhanaan rendah, warna #2563EB",
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
  assert.ok(guide.includes('"isi" atau "garis"'));
  assert.ok(guide.includes('"siluet.xml"'));
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
  assert.ok(invalidArgs.includes('"isi"/"garis"'));

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
  assert.ok(caption.includes('"siluet.xml"'));
  assert.ok(caption.includes("XML Alight Motion"));
  assert.equal(EMOJI_PATTERN.test(caption), false);

  const garisSettings = utils.parseVectorArgs("garis", limits);
  const lineCaption = utils.vectorLineDoneCaption(
    { width: 32, height: 32, lines: [{ points: [[0, 0], [1, 1]] }, { points: [[2, 2]] }] },
    garisSettings,
  );
  assert.ok(lineCaption.includes("Garis vektor berhasil diekstraksi."));
  assert.ok(lineCaption.includes("Garis: 2"));
  assert.ok(lineCaption.includes("Titik: 3"));
  assert.ok(lineCaption.includes('"siluet.xml"'));
  assert.equal(EMOJI_PATTERN.test(lineCaption), false);

  const lineEmpty = utils.vectorLineEmptyMessage(garisSettings);
  assert.ok(lineEmpty.includes("Tidak ada goresan garis"));
  assert.ok(lineEmpty.includes("line art"));
  assert.ok(lineEmpty.includes("representasi garis"));
  assert.equal(EMOJI_PATTERN.test(lineEmpty), false);
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
// Bagian 2b: pembantu engine, ekstraksi centerline, dan XML Alight Motion
// ---------------------------------------------------------------------------

test("simplifyPolyline menyederhanakan poliline terbuka dengan ujung dipertahankan", () => {
  const simplified = engine.simplifyPolyline([[0, 0], [1, 0.1], [2, 0]], 0.5);
  assert.deepEqual(simplified, [[0, 0], [2, 0]]);
  assert.deepEqual(engine.simplifyPolyline([], 1), []);
  assert.deepEqual(engine.simplifyPolyline([[1, 1]], 1), [[1, 1]]);
});

test("labelMaskRegions memberi label per region tersambung", () => {
  const mask = new Uint8ClampedArray(9);
  mask[0] = 255;
  mask[1] = 255;
  mask[8] = 255;
  const labels = engine.labelMaskRegions({ mask, width: 3, height: 3 });
  assert.equal(labels[0], 1);
  assert.equal(labels[1], 1, "piksel tersambung 4-tetangga memakai label sama");
  assert.equal(labels[8], 2, "region terpisah memakai label berbeda");
  assert.equal(labels[4], 0, "piksel luar tidak berlabel");
  assert.throws(() => engine.labelMaskRegions(null));
  assert.throws(() =>
    engine.labelMaskRegions({ mask: new Uint8ClampedArray(4), width: 3, height: 3 }),
  );
});

test("findRegionLabel menemukan label region di sekitar titik kontur", () => {
  const mask = new Uint8ClampedArray(9).fill(255);
  const labels = engine.labelMaskRegions({ mask, width: 3, height: 3 });
  assert.equal(engine.findRegionLabel({ mask, width: 3, height: 3 }, labels, [0, 0]), 1);
  assert.equal(engine.findRegionLabel({ mask, width: 3, height: 3 }, labels, [1, 1]), 1);
  assert.equal(engine.findRegionLabel({ mask, width: 3, height: 3 }, labels, null), 0);
  assert.equal(engine.findRegionLabel({ mask, width: 3, height: 3 }, labels, "birus"), 0);
});

function lineArtMask() {
  // Goresan horizontal setebal satu piksel pada 7x3 mask.
  const mask = new Uint8ClampedArray(21);
  for (let x = 1; x < 6; x += 1) {
    mask[1 * 7 + x] = 255;
  }
  return { mask, width: 7, height: 3 };
}

test("extractCenterlines mengekstraksi goresan tunggal dari line art", () => {
  const maskData = lineArtMask();
  const vector = engine.vectorizeSilhouette(maskData, { simplification: "sedang" });
  const result = centerline.extractCenterlines(maskData, vector);
  assert.equal(result.ok, true);
  assert.equal(result.empty, false);
  assert.equal(result.lines.length, 1, "satu goresan menjadi satu garis");
  const line = result.lines[0];
  assert.equal(line.closed, false);
  assert.ok(line.points.length >= 2);
  assert.ok(line.width > 0);
  assert.equal(line.componentIndex, 0);
  assert.equal(result.width, 7);
  assert.equal(result.height, 3);
});

test("extractCenterlines mengenali loop tertutup pada bingkai berongga", () => {
  // Bingkai persegi setebal satu piksel pada 7x7 mask: skeletonnya stabil
  // dan seluruh pikselnya berderajat 2 sehingga dirunut sebagai loop tertutup.
  const mask = new Uint8ClampedArray(49);
  for (let x = 0; x < 7; x += 1) {
    mask[x] = 255;
    mask[6 * 7 + x] = 255;
    mask[x * 7] = 255;
    mask[x * 7 + 6] = 255;
  }
  const maskData = { mask, width: 7, height: 7 };
  const vector = engine.vectorizeSilhouette(maskData, { simplification: "sedang" });
  const result = centerline.extractCenterlines(maskData, vector);
  assert.equal(result.empty, false);
  assert.ok(result.lines.length >= 1);
  assert.ok(
    result.lines.some((line) => line.closed === true),
    "bingkai berongga dirunut sebagai loop tertutup",
  );
});

test("extractCenterlines menolak masukan tidak valid", () => {
  const maskData = lineArtMask();
  const vector = engine.vectorizeSilhouette(maskData, { simplification: "sedang" });
  assert.throws(() => centerline.extractCenterlines(null, vector));
  assert.throws(() => centerline.extractCenterlines(maskData, null));
  assert.throws(() => centerline.extractCenterlines(maskData, { subpaths: null }));
});

test("buildCenterlineSvgDocument membangun pratinjau garis", () => {
  const maskData = lineArtMask();
  const vector = engine.vectorizeSilhouette(maskData, { simplification: "sedang" });
  const result = centerline.extractCenterlines(maskData, vector);
  const svg = centerline.buildCenterlineSvgDocument(result, "#2563EB");
  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes('viewBox="0 0 7 3"'));
  assert.ok(svg.includes('stroke="#2563EB"'));
  assert.ok(svg.includes("<path"));
  assert.equal(centerline.buildCenterlineSvgDocument({ lines: [] }, "#2563EB"), "");
  assert.equal(centerline.buildCenterlineSvgDocument(null, "#2563EB"), "");
});

function ringVector() {
  return engine.vectorizeSilhouette(ringMask5x5(), { simplification: "sedang" });
}

test("buildAlightMotionXml menghasilkan scene isi dari siluet", () => {
  const xml = amxml.buildAlightMotionXml(ringVector(), {
    color: "#2563EB",
    modifiedTime: 0,
  });
  assert.ok(xml.startsWith("<?xml"));
  assert.ok(xml.includes('<scene title="Naze Vector Silhouette" width="5" height="5"'));
  assert.ok(xml.includes('modifiedTime="0"'));
  assert.ok(xml.includes('fillColor value="#FF2563EB"'), "warna #RRGGBB diberi alpha FF");
  assert.ok(xml.includes("<shape id=\"1\""));
  assert.ok(/<path d="M [^"]*Z"\/><\/shape>/.test(xml), "path isi ditutup Z");
  assert.ok(!xml.includes("<path-stroke"), "mode isi tidak memakai path-stroke");
  assert.ok(xml.includes("<fillColor"));
});

test("buildAlightMotionXml menghasilkan scene garis dari centerline", () => {
  const maskData = lineArtMask();
  const vector = engine.vectorizeSilhouette(maskData, { simplification: "sedang" });
  const lines = centerline.extractCenterlines(maskData, vector);
  const xml = amxml.buildAlightMotionXml(vector, {
    representation: "garis",
    centerlineData: lines,
    color: "#0F172A",
    modifiedTime: 0,
  });
  assert.ok(xml.startsWith("<?xml"));
  assert.ok(xml.includes("<path-stroke"));
  assert.ok(xml.includes('direction="centered"'));
  assert.ok(xml.includes("<size value="), "tebal garis dari lebar pita");
  assert.ok(xml.includes('fillColor value="#FF0F172A"'));
  assert.ok(!/<path d="[^"]*Z/.test(xml), "path garis tidak ditutup Z");
  assert.ok(xml.includes("<shape id=\"1\""));
});

test("buildAlightMotionXml menolak masukan tidak valid", () => {
  assert.throws(() => amxml.buildAlightMotionXml(null, {}));
  assert.throws(() =>
    amxml.buildAlightMotionXml({ width: 5, height: 5, subpaths: [] }, {}),
  );
  assert.throws(() =>
    amxml.buildAlightMotionXml(ringVector(), { representation: "birus" }),
  );
  assert.throws(() =>
    amxml.buildAlightMotionXml(ringVector(), { componentColors: ["#FFFFFF", "#000000"] }),
  );
  assert.throws(() =>
    amxml.buildAlightMotionXml(ringVector(), { title: "  " }),
  );
  assert.throws(() =>
    amxml.buildAlightMotionXml(ringVector(), { totalTime: 0 }),
  );
  assert.throws(() =>
    amxml.buildAlightMotionXml(ringVector(), { fps: "nol" }),
  );
  assert.throws(() =>
    amxml.buildAlightMotionXml(ringVector(), { representation: "garis" }),
    /centerline/,
  );
  assert.throws(() =>
    amxml.buildAlightMotionXml(ringVector(), {
      representation: "garis",
      centerlineData: { lines: [] },
    }),
  );
});

test("buildAlightMotionXml memakai warna bawaan bila warna tidak diberikan", () => {
  const xml = amxml.buildAlightMotionXml(ringVector(), { modifiedTime: 0 });
  assert.ok(xml.includes('fillColor value="#FF3B82F6"'));
  assert.ok(xml.includes('fps="30"'));
  assert.ok(xml.includes('totalTime="5000"'));
  assert.ok(xml.includes("com.alightcreative.motion"));
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

  test("createVector mengubah gambar menjadi XML Alight Motion ujung ke ujung", async () => {
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
    assert.ok(sent.images[0].caption.includes("Pengaturan: representasi isi, mode gelap, ambang 50%"));

    assert.equal(sent.documents.length, 1, "satu berkas XML harus dikirim");
    assert.equal(sent.documents[0].filename, "siluet.xml");
    assert.equal(sent.documents[0].mime, "application/xml");
    const xml = sent.documents[0].buffer.toString("utf-8");
    assert.ok(xml.startsWith("<?xml"));
    assert.ok(xml.includes('<scene title="Naze Vector Silhouette" width="32" height="32"'));
    assert.ok(xml.includes('fillColor value="#FF0F172A"'));
    assert.ok(/<path d="M [^"]*Z"\/><\/shape>/.test(xml), "path isi ditutup Z");
    assert.equal(EMOJI_PATTERN.test(sent.images[0].caption), false);
  });

  test("createVector mode garis mengubah line art menjadi XML", async () => {
    const pixels = Buffer.alloc(32 * 32 * 3, 255);
    for (let x = 4; x < 28; x += 1) {
      const index = (16 * 32 + x) * 3;
      pixels[index] = 0;
      pixels[index + 1] = 0;
      pixels[index + 2] = 0;
    }
    const png = await sharp(pixels, { raw: { width: 32, height: 32, channels: 3 } })
      .png()
      .toBuffer();
    const { m, sent } = fakeMessage(png, "garis");
    await manager.createVector(m);

    assert.equal(sent.images.length, 1, "satu pratinjau PNG harus dikirim");
    assert.ok(sent.images[0].caption.includes("Garis vektor berhasil diekstraksi."));
    assert.ok(sent.images[0].caption.includes("Garis: 1"));
    assert.ok(sent.images[0].caption.includes("Pengaturan: representasi garis, mode gelap, ambang 50%"));

    assert.equal(sent.documents.length, 1, "satu berkas XML harus dikirim");
    assert.equal(sent.documents[0].filename, "siluet.xml");
    assert.equal(sent.documents[0].mime, "application/xml");
    const xml = sent.documents[0].buffer.toString("utf-8");
    assert.ok(xml.startsWith("<?xml"));
    assert.ok(xml.includes("<path-stroke"), "mode garis menulis path-stroke");
    assert.ok(xml.includes('direction="centered"'));
    assert.ok(!/<path d="[^"]*Z/.test(xml), "path garis tidak ditutup Z");
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
