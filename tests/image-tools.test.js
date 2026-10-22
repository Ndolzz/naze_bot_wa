// Pengujian fitur gambar NAZE: utilitas murni (pembacaan argumen, tangga
// kompresi) dan pengelola dengan sharp sungguhan melalui pesan palsu.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import * as imageUtils from "../src/lib/naze-image-utils.js";
import * as imageTools from "../src/lib/naze-image-tools.js";

// ---------------------------------------------------------------------------
// Utilitas murni
// ---------------------------------------------------------------------------

test("normalizeFormatName mengenali alias dan menolak format asing", () => {
  assert.equal(imageUtils.normalizeFormatName("jpg"), "jpeg");
  assert.equal(imageUtils.normalizeFormatName("JPE"), "jpeg");
  assert.equal(imageUtils.normalizeFormatName("WebP"), "webp");
  assert.equal(imageUtils.normalizeFormatName("heic"), null);
  assert.equal(imageUtils.normalizeFormatName(""), null);
});

test("parseReformatArgs membaca format dan kualitas dengan benar", () => {
  assert.deepEqual(imageUtils.parseReformatArgs(""), { ok: false, reason: "empty" });
  assert.deepEqual(imageUtils.parseReformatArgs("png"), { ok: true, format: "png", quality: null });
  assert.deepEqual(imageUtils.parseReformatArgs("jpg 80"), { ok: true, format: "jpeg", quality: 80 });
  assert.deepEqual(imageUtils.parseReformatArgs("webp 500"), { ok: false, reason: "bad-quality" });
  assert.deepEqual(imageUtils.parseReformatArgs("heic"), { ok: false, reason: "bad-format" });
});

test("parseEnhanceArgs menerima faktor 1 sampai 4 dan bawaan 2", () => {
  assert.deepEqual(imageUtils.parseEnhanceArgs(""), { ok: true, scale: 2 });
  assert.deepEqual(imageUtils.parseEnhanceArgs("3x"), { ok: true, scale: 3 });
  assert.deepEqual(imageUtils.parseEnhanceArgs("x2"), { ok: true, scale: 2 });
  assert.deepEqual(imageUtils.parseEnhanceArgs("1"), { ok: true, scale: 1 });
  assert.deepEqual(imageUtils.parseEnhanceArgs("5"), { ok: false, reason: "bad-scale" });
  assert.deepEqual(imageUtils.parseEnhanceArgs("besar"), { ok: false, reason: "bad-scale" });
});

test("pickCompressFormatLadder mempertahankan format asal kecuali PNG", () => {
  assert.deepEqual(imageUtils.pickCompressFormatLadder("png"), ["png", "webp"]);
  assert.deepEqual(imageUtils.pickCompressFormatLadder("jpeg"), ["jpeg"]);
  assert.deepEqual(imageUtils.pickCompressFormatLadder("webp"), ["webp"]);
  assert.deepEqual(imageUtils.pickCompressFormatLadder("tiff"), ["webp"]);
});

test("compressUnderLimit langsung menerima kualitas maksimum bila muat", async () => {
  const panggilan = [];
  const encode = async (arg) => {
    panggilan.push(arg);
    return { buffer: { length: 500000 }, width: arg.targetWidth, height: 100 };
  };

  const hasil = await imageUtils.compressUnderLimit(
    { width: 2000, height: 1000, format: "jpeg", buffer: { length: 9000000 } },
    { encode },
  );

  assert.equal(hasil.ok, true);
  assert.equal(hasil.quality, 90);
  assert.equal(hasil.scale, 1);
  assert.equal(panggilan.length, 1);
});

test("compressUnderLimit mencari kualitas tertinggi di bawah batas", async () => {
  const encode = async (arg) => ({
    buffer: { length: arg.quality * 12000 },
    width: arg.targetWidth,
    height: 100,
  });

  const hasil = await imageUtils.compressUnderLimit(
    { width: 2000, height: 1000, format: "jpeg", buffer: { length: 9000000 } },
    { encode },
  );

  // 87 * 12000 = 1.044.000 < 1.048.576, sedangkan 88 sudah melewati batas.
  assert.equal(hasil.ok, true);
  assert.equal(hasil.quality, 87);
  assert.equal(hasil.scale, 1);
  assert.equal(hasil.sizeBytes, 1044000);
});

test("compressUnderLimit menurunkan resolusi bila kualitas terendah tetap terlalu besar", async () => {
  const encode = async (arg) => {
    const skala = arg.targetWidth / 2000;
    const ukuran = Math.round(3000000 * skala * skala * (0.4 + arg.quality / 100));
    return { buffer: { length: ukuran }, width: arg.targetWidth, height: 100 };
  };

  const hasil = await imageUtils.compressUnderLimit(
    { width: 2000, height: 1000, format: "jpeg", buffer: { length: 9000000 } },
    { encode },
  );

  // Pada skala 1 semua kualitas gagal; turun ke skala 0,6 dengan kualitas
  // maksimum 57: 1.080.000 * (0,4 + 0,57) = 1.047.600 < 1.048.576.
  assert.equal(hasil.ok, true);
  assert.equal(hasil.scale, 0.6);
  assert.equal(hasil.quality, 57);
  assert.equal(hasil.sizeBytes, 1047600);
  assert.ok(hasil.sizeBytes < 1024 * 1024);
});

test("compressUnderLimit memakai WebP bila PNG tidak dapat mencapai batas", async () => {
  const urutanFormat = [];
  const encode = async (arg) => {
    urutanFormat.push(arg.format);
    const ukuran = arg.format === "png" ? 5000000 : 400000;
    return { buffer: { length: ukuran }, width: arg.targetWidth, height: 100 };
  };

  const hasil = await imageUtils.compressUnderLimit(
    { width: 2000, height: 1000, format: "png", buffer: { length: 9000000 } },
    { encode },
  );

  assert.equal(hasil.ok, true);
  assert.equal(hasil.format, "webp");
  assert.equal(hasil.scale, 1);
  assert.equal(urutanFormat[0], "png");
});

test("compressUnderLimit melaporkan kegagalan bila semua tingkat gagal", async () => {
  const encode = async (arg) => ({
    buffer: { length: 5000000 },
    width: arg.targetWidth,
    height: 100,
  });

  const hasil = await imageUtils.compressUnderLimit(
    { width: 2000, height: 1000, format: "jpeg", buffer: { length: 9000000 } },
    { encode },
  );

  assert.equal(hasil.ok, false);
});

test("compressUnderLimit menolak masukan tidak lengkap", async () => {
  await assert.rejects(() => imageUtils.compressUnderLimit(null, { encode: async () => ({}) }));
  await assert.rejects(() =>
    imageUtils.compressUnderLimit({ width: 10, height: 10, format: "jpeg", buffer: {} }, {}),
  );
});

// ---------------------------------------------------------------------------
// Pengelola dengan sharp sungguhan
// ---------------------------------------------------------------------------

function buatPesanPalsu({ buffer, text = "" }) {
  const riwayat = { replies: [], documents: [] };
  return {
    riwayat,
    isImage: true,
    text,
    download: async () => buffer,
    reply: async (pesan) => {
      riwayat.replies.push(pesan);
    },
    replyDocument: async (dokumen, nama, mime) => {
      riwayat.documents.push({ buffer: dokumen, name: nama, mime });
    },
  };
}

async function buatPngUji(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 96, g: 130, blue: 182, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function buatJpegBesar(width, height) {
  const channels = 3;
  const data = Buffer.alloc(width * height * channels);
  let seed = 123456789;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed >> 16) & 0xff;
  }
  return sharp(data, { raw: { width, height, channels } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

test("enhanceImage menggandakan resolusi dan mengirim dokumen", async () => {
  const png = await buatPngUji(100, 80);
  const m = buatPesanPalsu({ buffer: png });

  await imageTools.enhanceImage(m);

  assert.equal(m.riwayat.documents.length, 1);
  const dokumen = m.riwayat.documents[0];
  assert.equal(dokumen.mime, "image/png");
  const meta = await sharp(dokumen.buffer).metadata();
  assert.equal(meta.width, 200);
  assert.equal(meta.height, 160);
});

test("reformatImage mengubah PNG menjadi JPG", async () => {
  const png = await buatPngUji(120, 90);
  const m = buatPesanPalsu({ buffer: png, text: "jpg 85" });

  await imageTools.reformatImage(m);

  assert.equal(m.riwayat.documents.length, 1);
  const dokumen = m.riwayat.documents[0];
  assert.equal(dokumen.mime, "image/jpeg");
  const meta = await sharp(dokumen.buffer).metadata();
  assert.equal(meta.format, "jpeg");
});

test("compressImage menghasilkan berkas di bawah 1 MB dari gambar besar", async () => {
  const jpegBesar = await buatJpegBesar(2000, 1300);
  assert.ok(jpegBesar.length >= 1024 * 1024, "fiksatur harus di atas 1 MB");
  const m = buatPesanPalsu({ buffer: jpegBesar });

  await imageTools.compressImage(m);

  assert.equal(m.riwayat.documents.length, 1);
  const dokumen = m.riwayat.documents[0];
  assert.ok(dokumen.buffer.length < 1024 * 1024, "hasil harus di bawah 1 MB");
  const meta = await sharp(dokumen.buffer).metadata();
  assert.equal(meta.format, "jpeg");
});

test("compressImage menolak mengompres gambar yang sudah di bawah 1 MB", async () => {
  const png = await buatPngUji(200, 150);
  const m = buatPesanPalsu({ buffer: png });

  await imageTools.compressImage(m);

  assert.equal(m.riwayat.documents.length, 0);
  assert.equal(m.riwayat.replies.length, 1);
  assert.ok(m.riwayat.replies[0].includes("sudah di bawah 1 MB"));
});

test("removeBackground menyampaikan status dalam pengembangan", async () => {
  const m = buatPesanPalsu({ buffer: Buffer.alloc(0) });

  await imageTools.removeBackground(m);

  assert.equal(m.riwayat.replies.length, 1);
  assert.ok(m.riwayat.replies[0].includes("dalam pengembangan"));
});
