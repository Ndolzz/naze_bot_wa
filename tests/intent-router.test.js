// Pengujian Naze Intent Router.
// Bagian keputusan (decideIntent) menguji korpus pada
// tests/fixtures/intent-corpus.json dengan plugin stub, tanpa WhatsApp.
// Bagian integrasi (handleIntent) memakai pesan palsu dan dispatch palsu,
// mengikuti pola pengujian berkas lain di folder ini. Jika dependensi
// runtime belum terpasang (npm install), seluruh pengujian dilewati dengan
// laporan yang jelas.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const corpus = JSON.parse(
  fs.readFileSync(new URL("./fixtures/intent-corpus.json", import.meta.url), "utf8"),
)[0];

let router = null;
let registry = null;
let pluginsLib = null;
let config = null;
let loadError = null;

try {
  router = await import("../src/lib/naze-intent-router.js");
  registry = await import("../src/lib/naze-intent-registry.js");
  pluginsLib = await import("../src/lib/naze-plugins.js");
  config = (await import("../config.js")).default;
} catch (error) {
  loadError = error.message;
}

if (!router) {
  test("intent router ditandai dilewati", () => {
    assert.ok(
      true,
      "dependensi runtime belum terpasang (" + loadError + "); jalankan npm install lalu npm test",
    );
  });
} else {
  const { decideIntent, handleIntent, detectMediaKind, clearIntentRouterState } =
    router;

  // Plugin stub mewakili setiap deklarasi kemampuan sehingga validasi
  // runtime (getPlugin) pada router terpenuhi tanpa memuat plugin asli.
  for (const declaration of registry.getAllDeclarations()) {
    pluginsLib.registerPlugin({
      config: {
        name: declaration.plugin,
        alias: [],
        category: "intent-stub",
        description: declaration.description,
        cooldown: 0,
        isEnabled: true,
      },
      handler: async () => {},
      filePath: "tests://intent-stub/" + declaration.id + ".js",
    });
  }

  test("deklarasi router hanya merujuk plugin yang terdaftar", () => {
    for (const declaration of registry.getAllDeclarations()) {
      assert.ok(
        pluginsLib.getPlugin(declaration.plugin),
        "plugin tidak terdaftar: " + declaration.plugin,
      );
    }
  });

  test("router tidak menambah command atau alias baru", () => {
    const names = pluginsLib.getAllCommandNames();
    assert.equal(
      new Set(names).size,
      registry.getAllDeclarations().length,
      "jumlah command berubah",
    );
  });

  test("korpus positif: intent dikenali dengan benar", () => {
    assert.ok(corpus.positive.length >= 30, "korpus positif minimal 30 kasus");
    let benar = 0;
    for (const kasus of corpus.positive) {
      const hasil = decideIntent(kasus.text, kasus.media);
      assert.equal(
        hasil.type,
        "execute",
        JSON.stringify(kasus) + " menghasilkan " + hasil.type,
      );
      assert.equal(
        hasil.capability.id,
        kasus.expect.cap,
        "kasus: " + kasus.text,
      );
      benar++;
    }
    assert.ok(
      benar / corpus.positive.length >= 0.95,
      "akurasi korpus positif minimal 95%",
    );
  });

  test("korpus negatif: tidak ada eksekusi", () => {
    for (const kasus of corpus.negative) {
      const hasil = decideIntent(kasus.text, kasus.media);
      assert.equal(
        hasil.type,
        "passthrough",
        JSON.stringify(kasus) + " menghasilkan " + hasil.type,
      );
    }
  });

  test("kasus ambigu: minta klarifikasi dengan daftar kandidat", () => {
    for (const kasus of corpus.clarifyAmbiguous) {
      const hasil = decideIntent(kasus.text, kasus.media);
      assert.equal(hasil.type, "clarify-ambiguous", "kasus: " + kasus.text);
      assert.deepEqual(
        hasil.candidates.map((c) => c.id),
        kasus.expect.caps,
        "kandidat salah untuk: " + kasus.text,
      );
    }
  });

  test("kasus media kurang: minta media terlebih dahulu", () => {
    for (const kasus of corpus.clarifyMedia) {
      const hasil = decideIntent(kasus.text, kasus.media);
      assert.equal(hasil.type, "clarify-media", "kasus: " + kasus.text);
      assert.equal(hasil.capability.id, kasus.expect.cap, "kasus: " + kasus.text);
    }
  });

  test("kasus tidak didukung: jelaskan tanpa eksekusi", () => {
    for (const kasus of corpus.unsupported) {
      const hasil = decideIntent(kasus.text, kasus.media);
      assert.equal(hasil.type, "unsupported", "kasus: " + kasus.text);
      assert.equal(
        hasil.matcher.id,
        kasus.expect.matcher,
        "kasus: " + kasus.text,
      );
    }
  });

  test("kasus multi langkah: ditolak", () => {
    for (const kasus of corpus.multiStep) {
      const hasil = decideIntent(kasus.text, kasus.media);
      assert.equal(
        hasil.type,
        "multi-step-rejected",
        "kasus: " + kasus.text + " menghasilkan " + hasil.type,
      );
    }
  });

  test("detectMediaKind membaca media langsung, kutipan, dan tautan", () => {
    assert.equal(detectMediaKind({ isImage: true, body: "x" }), "image");
    assert.equal(detectMediaKind({ isVideo: true }), "video");
    assert.equal(detectMediaKind({ isSticker: true }), "sticker");
    assert.equal(detectMediaKind({ isDocument: true }), "document");
    assert.equal(detectMediaKind({ isAudio: true }), "audio");
    assert.equal(detectMediaKind({ quoted: { isVideo: true } }), "video");
    assert.equal(detectMediaKind({ quoted: { isSticker: true } }), "sticker");
    assert.equal(detectMediaKind({ body: "cek https://youtu.be/a" }), "url-yt");
    assert.equal(
      detectMediaKind({ body: "halo", quoted: { body: "https://vt.tiktok.com/x" } }),
      "url-tt",
    );
    assert.equal(
      detectMediaKind({ body: "halo", quoted: { body: "https://instagram.com/x" } }),
      "url-ig",
    );
    assert.equal(detectMediaKind({ body: "halo" }), "text");
    assert.equal(detectMediaKind({}), "none");
  });

  // ---------------------------------------------------------------------------
  // Integrasi handleIntent dengan pesan palsu dan dispatch palsu
  // ---------------------------------------------------------------------------

  let nomor = 0;

  function buatPesanPalsu({ body = "", extra = {} } = {}) {
    nomor++;
    const m = {
      sender: "uji-" + nomor + "@s.whatsapp.net",
      chat: "chat-uji@s.whatsapp.net",
      body,
      isCommand: false,
      isBot: false,
      isNewsletter: false,
      isBanned: false,
      isOwner: false,
      isPremium: true,
      isGroup: false,
      isPrivate: true,
      isAdmin: false,
      isBotAdmin: false,
      isImage: false,
      isVideo: false,
      isAudio: false,
      isSticker: false,
      isDocument: false,
      quoted: null,
      balasan: [],
      reply: async (teks) => {
        m.balasan.push(String(teks));
      },
      raw: { key: { id: "id-" + nomor } },
      ...extra,
    };
    return m;
  }

  function buatDispatchPalsu() {
    const panggilan = [];
    return {
      panggilan,
      dispatch: async (im, sock, plugin) => {
        panggilan.push({
          plugin: plugin.config.name,
          text: im.text,
          args: [...im.args],
        });
        return true;
      },
    };
  }

  function aktifkanSmartTriggers() {
    config.features.smartTriggers = true;
  }

  function pulihkan() {
    config.features.smartTriggers = false;
    clearIntentRouterState();
  }

  test("smartTrigger nonaktif: tidak ada eksekusi", async () => {
    const spy = buatDispatchPalsu();
    config.features.smartTriggers = false;
    try {
      const m = buatPesanPalsu({ body: "cari lagu lathi" });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, false);
      assert.equal(spy.panggilan.length, 0);
      assert.equal(m.balasan.length, 0);
    } finally {
      pulihkan();
    }
  });

  test("permintaan lagu dieksekusi dengan payload benar", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({ body: "cari lagu potong bebek pangkas" });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, true);
      assert.equal(spy.panggilan.length, 1);
      assert.equal(spy.panggilan[0].plugin, "lagu");
      assert.equal(spy.panggilan[0].text, "potong bebek pangkas");
      assert.deepEqual(spy.panggilan[0].args, ["potong", "bebek", "pangkas"]);
    } finally {
      pulihkan();
    }
  });

  test("payload stiker koleksi dan format diekstrak dengan benar", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m1 = buatPesanPalsu({ body: "ambil stiker kucing dari koleksi" });
      const hasil1 = await handleIntent(m1, null, spy.dispatch);
      assert.equal(hasil1, true);
      assert.equal(spy.panggilan[0].plugin, "getsticker");
      assert.equal(spy.panggilan[0].text, "kucing");

      const m2 = buatPesanPalsu({ body: "hapus stiker kucing dari koleksi" });
      const hasil2 = await handleIntent(m2, null, spy.dispatch);
      assert.equal(hasil2, true);
      assert.equal(spy.panggilan[1].plugin, "delsticker");
      assert.equal(spy.panggilan[1].text, "kucing");

      const m3 = buatPesanPalsu({
        body: "ubah gambar ini ke png",
        extra: { isImage: true },
      });
      const hasil3 = await handleIntent(m3, null, spy.dispatch);
      assert.equal(hasil3, true);
      assert.equal(spy.panggilan[2].plugin, "reformat");
      assert.equal(spy.panggilan[2].text, "png");
    } finally {
      pulihkan();
    }
  });

  test("stiker dari gambar dieksekusi tanpa payload", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({
        body: "ubah gambar ini jadi stiker",
        extra: { isImage: true },
      });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, true);
      assert.equal(spy.panggilan[0].plugin, "sticker");
      assert.equal(spy.panggilan[0].text, "");
      assert.deepEqual(spy.panggilan[0].args, []);
    } finally {
      pulihkan();
    }
  });

  test("pengguna terbanned tidak dieksekusi", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({
        body: "cari lagu lathi",
        extra: { isBanned: true },
      });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, false);
      assert.equal(spy.panggilan.length, 0);
      assert.equal(m.balasan.length, 0);
    } finally {
      pulihkan();
    }
  });

  test("ambigu minta klarifikasi lalu nama fitur mengeksekusi", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m1 = buatPesanPalsu({
        body: "bikin gambar ini lebih kecil dan tajam",
        extra: { isImage: true },
      });
      const hasil1 = await handleIntent(m1, null, spy.dispatch);
      assert.equal(hasil1, true);
      assert.equal(spy.panggilan.length, 0, "ambigu tidak boleh mengeksekusi");
      assert.ok(m1.balasan[0].includes("kompres"), "daftar tanpa kompres");
      assert.ok(m1.balasan[0].includes("hdimg"), "daftar tanpa hdimg");

      const m2 = buatPesanPalsu({
        body: "kompres",
        extra: { sender: m1.sender, chat: m1.chat, isImage: true },
      });
      const hasil2 = await handleIntent(m2, null, spy.dispatch);
      assert.equal(hasil2, true);
      assert.equal(spy.panggilan.length, 1);
      assert.equal(spy.panggilan[0].plugin, "kompres");
    } finally {
      pulihkan();
    }
  });

  test("ambigu minta klarifikasi lalu nomor pilihan mengeksekusi", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m1 = buatPesanPalsu({
        body: "bikin gambar ini lebih kecil dan tajam",
        extra: { isImage: true },
      });
      await handleIntent(m1, null, spy.dispatch);
      assert.equal(spy.panggilan.length, 0);

      const m2 = buatPesanPalsu({
        body: "2",
        extra: { sender: m1.sender, chat: m1.chat, isImage: true },
      });
      const hasil2 = await handleIntent(m2, null, spy.dispatch);
      assert.equal(hasil2, true);
      assert.equal(spy.panggilan[0].plugin, "hdimg");
    } finally {
      pulihkan();
    }
  });

  test("totxt memakai teks pesan yang dibalas", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({
        body: "ubah teks ini jadi file txt",
        extra: { quoted: { body: "Nama saya Nendi", isImage: false } },
      });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, true);
      assert.equal(spy.panggilan[0].plugin, "totxt");
      assert.equal(spy.panggilan[0].text, "Nama saya Nendi");
    } finally {
      pulihkan();
    }
  });

  test("ytmp3 mengambil tautan dari pesan yang dibalas", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({
        body: "unduh audio dari video youtube ini",
        extra: { quoted: { body: "cek https://youtu.be/abc123 ya" } },
      });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, true);
      assert.equal(spy.panggilan[0].plugin, "ytmp3");
      assert.equal(spy.panggilan[0].text, "https://youtu.be/abc123");
    } finally {
      pulihkan();
    }
  });

  test("permintaan tidak didukung dijelaskan tanpa eksekusi", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({
        body: "kompres video ini",
        extra: { isVideo: true },
      });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, true);
      assert.equal(spy.panggilan.length, 0);
      assert.ok(m.balasan[0].includes("Kompres video"), "penjelasan hilang");
    } finally {
      pulihkan();
    }
  });

  test("permintaan tanpa argumen wajib meminta keterangan", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({ body: "bikin brat" });
      const hasil = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil, true);
      assert.equal(spy.panggilan.length, 0);
      assert.ok(m.balasan[0].includes("teks"), "petunjuk teks hilang");
    } finally {
      pulihkan();
    }
  });

  test("pesan berulang tidak dieksekusi dua kali", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      const m = buatPesanPalsu({ body: "cari lagu lathi" });
      const hasil1 = await handleIntent(m, null, spy.dispatch);
      const hasil2 = await handleIntent(m, null, spy.dispatch);
      assert.equal(hasil1, true);
      assert.equal(hasil2, false, "pesan sama harus dilewati");
      assert.equal(spy.panggilan.length, 1);
    } finally {
      pulihkan();
    }
  });

  test("korpus negatif tidak memicu balasan atau eksekusi", async () => {
    const spy = buatDispatchPalsu();
    aktifkanSmartTriggers();
    try {
      for (const kasus of corpus.negative) {
        const extra = {};
        if (kasus.media === "image") extra.isImage = true;
        if (kasus.media === "video") extra.isVideo = true;
        if (kasus.media === "document") extra.isDocument = true;
        if (kasus.media === "audio") extra.isAudio = true;
        if (kasus.media === "sticker") extra.isSticker = true;
        const m = buatPesanPalsu({ body: kasus.text, extra });
        const hasil = await handleIntent(m, null, spy.dispatch);
        assert.equal(hasil, false, "korpus negatif tereksekusi: " + kasus.text);
        assert.equal(m.balasan.length, 0, "korpus negatif membalas: " + kasus.text);
      }
      assert.equal(spy.panggilan.length, 0);
    } finally {
      pulihkan();
    }
  });
}
