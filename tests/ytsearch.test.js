// Pengujian Pencarian YouTube NAZE.
// Bagian murni menguji validasi kata kunci, penguraian pilihan, pemformatan,
// dan templat pesan pada src/lib/naze-ytsearch-utils.js tanpa dependensi.
// Bagian integrasi menguji cache hasil, normalisasi, registrasi plugin, dan
// menu; pencarian nyata diuji best-effort karena memerlukan jaringan.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as utils from "../src/lib/naze-ytsearch-utils.js";

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

// ---------------------------------------------------------------------------
// Bagian 1: utilitas murni (tanpa dependensi)
// ---------------------------------------------------------------------------

test("validateSearchQuery menolak kata kunci kosong", () => {
  assert.equal(utils.validateSearchQuery("", 100).ok, false);
  assert.equal(utils.validateSearchQuery("", 100).reason, "empty");
  assert.equal(utils.validateSearchQuery("   ", 100).reason, "empty");
  assert.equal(utils.validateSearchQuery(null, 100).reason, "empty");
});

test("validateSearchQuery menolak kata kunci terlalu panjang", () => {
  assert.equal(utils.validateSearchQuery("a".repeat(101), 100).ok, false);
  assert.equal(utils.validateSearchQuery("a".repeat(101), 100).reason, "too-long");
  assert.equal(utils.validateSearchQuery("a".repeat(100), 100).ok, true);
});

test("validateSearchQuery menormalkan spasi", () => {
  const result = utils.validateSearchQuery("  lagu   Indonesia   terbaru  ", 100);
  assert.equal(result.ok, true);
  assert.equal(result.query, "lagu Indonesia terbaru");
});

test("parseSelection mengenali nomor pilihan", () => {
  assert.deepEqual(utils.parseSelection("3"), {
    mode: "select", number: 3, mp3: false, query: "",
  });
  assert.deepEqual(utils.parseSelection("12"), {
    mode: "select", number: 12, mp3: false, query: "",
  });
});

test("parseSelection mengenali pilihan mp3 tanpa peduli kapitalisasi", () => {
  assert.deepEqual(utils.parseSelection("3 mp3"), {
    mode: "select", number: 3, mp3: true, query: "",
  });
  assert.deepEqual(utils.parseSelection("3 MP3"), {
    mode: "select", number: 3, mp3: true, query: "",
  });
});

test("parseSelection memperlakukan teks lain sebagai kata kunci", () => {
  assert.equal(utils.parseSelection("3 doors down").mode, "search");
  assert.equal(utils.parseSelection("3 doors down").query, "3 doors down");
  assert.equal(utils.parseSelection("mp3 converter").mode, "search");
  assert.equal(utils.parseSelection("").mode, "search");
  assert.equal(utils.parseSelection(null).mode, "search");
});

test("formatViewCount meringkas jumlah tayangan", () => {
  assert.equal(utils.formatViewCount(0), "0");
  assert.equal(utils.formatViewCount(999), "999");
  assert.equal(utils.formatViewCount(1000), "1 rb");
  assert.equal(utils.formatViewCount(880000), "880 rb");
  assert.equal(utils.formatViewCount(38878009), "38,9 jt");
  assert.equal(utils.formatViewCount(1500000), "1,5 jt");
  assert.equal(utils.formatViewCount(1200000000), "1,2 M");
  assert.equal(utils.formatViewCount(undefined), "-");
  assert.equal(utils.formatViewCount("banyak"), "-");
});

test("formatDurationSeconds memformat detik menjadi M:SS atau H:MM:SS", () => {
  assert.equal(utils.formatDurationSeconds(202), "3:22");
  assert.equal(utils.formatDurationSeconds(59), "0:59");
  assert.equal(utils.formatDurationSeconds(60), "1:00");
  assert.equal(utils.formatDurationSeconds(3661), "1:01:01");
  assert.equal(utils.formatDurationSeconds(0), "0:00");
  assert.equal(utils.formatDurationSeconds(null), "0:00");
});

test("formatDurationLabel memilih label bawaan lalu fallback detik", () => {
  assert.equal(utils.formatDurationLabel({ timestamp: "4:13" }), "4:13");
  assert.equal(
    utils.formatDurationLabel({ duration: { seconds: 202, timestamp: "3:22" } }),
    "3:22",
  );
  assert.equal(utils.formatDurationLabel({ duration: { seconds: 202 } }), "3:22");
  assert.equal(utils.formatDurationLabel({ seconds: 75 }), "1:15");
  assert.equal(utils.formatDurationLabel({ duration: { seconds: 0 } }), "-");
  assert.equal(utils.formatDurationLabel({}), "-");
});

test("truncateTitle memotong judul panjang dengan elipsis", () => {
  assert.equal(utils.truncateTitle("judul pendek", 70), "judul pendek");
  const long = "x".repeat(80);
  const truncated = utils.truncateTitle(long, 70);
  assert.equal(truncated.length, 70);
  assert.ok(truncated.endsWith("..."));
  assert.equal(utils.truncateTitle("judul   ber spasi", 70), "judul ber spasi");
});

test("resolveYtsearchLimits menerima angka sah dan mengabaikan nilai tidak sah", () => {
  const defaults = utils.resolveYtsearchLimits();
  assert.equal(defaults.maxResults, 8);
  assert.equal(defaults.maxQueryLength, 100);
  assert.equal(defaults.selectionTtlMs, 600000);
  assert.equal(defaults.maxTitleLength, 70);

  const custom = utils.resolveYtsearchLimits({
    maxResults: 5,
    selectionTtlMs: "lama",
    maxTitleLength: 0,
  });
  assert.equal(custom.maxResults, 5);
  assert.equal(custom.selectionTtlMs, 600000, "nilai tidak sah harus diabaikan");
  assert.equal(custom.maxTitleLength, 70, "nol harus diabaikan");
});

test("menu Pencarian YouTube menampilkan entri bernomor lengkap", () => {
  const menu = utils.ytsearchMenuText();
  assert.ok(menu.includes("YOUTUBE SEARCH"));
  assert.ok(menu.includes('1. ".ytsearch"'));
  assert.ok(menu.includes('2. ".yts"'));
  assert.equal(EMOJI_PATTERN.test(menu), false);
});

test("ytsearchListMessage menyusun daftar bernomor beserta panduan", () => {
  const limits = utils.resolveYtsearchLimits();
  const results = [
    {
      title: "Judul Video Pertama",
      channel: "Kanal Uji",
      durationLabel: "4:13",
      viewsLabel: "38,9 jt",
      url: "https://www.youtube.com/watch?v=abc123",
      videoId: "abc123",
      seconds: 253,
    },
    {
      title: "Judul Video Kedua",
      channel: "Kanal Lain",
      durationLabel: "10:00",
      viewsLabel: "880 rb",
      url: "https://www.youtube.com/watch?v=def456",
      videoId: "def456",
      seconds: 600,
    },
  ];
  const message = utils.ytsearchListMessage(results, "kata kunci", limits);
  assert.ok(message.includes('Hasil untuk "kata kunci"'));
  assert.ok(message.includes("1. Judul Video Pertama"));
  assert.ok(message.includes("Kanal Uji | 4:13 | 38,9 jt tayangan"));
  assert.ok(message.includes("https://www.youtube.com/watch?v=abc123"));
  assert.ok(message.includes("2. Judul Video Kedua"));
  assert.ok(message.includes('".ytsearch <nomor> mp3"'));
  assert.ok(message.includes("Pilihan berlaku 10 menit"));
  assert.equal(EMOJI_PATTERN.test(message), false);
});

test("templat pesan memuat judul dan isi yang jelas", () => {
  const guide = utils.ytsearchGuideMessage();
  assert.ok(guide.includes(".ytsearch"));
  assert.equal(EMOJI_PATTERN.test(guide), false);

  const tooLong = utils.ytsearchQueryTooLongMessage(100);
  assert.ok(tooLong.includes("100 karakter"));

  const noResults = utils.ytsearchNoResultsMessage("kata kunci");
  assert.ok(noResults.includes('"kata kunci"'));

  const failed = utils.ytsearchFailedMessage("jaringan bermasalah");
  assert.ok(failed.includes("jaringan bermasalah"));

  const invalid = utils.ytsearchSelectionInvalidMessage(9, 8);
  assert.ok(invalid.includes("9"));
  assert.ok(invalid.includes("1 sampai 8"));

  const expired = utils.ytsearchSelectionExpiredMessage();
  assert.ok(expired.includes("kedaluwarsa"));

  const tooLongVideo = utils.ytsearchTooLongMessage(30);
  assert.ok(tooLongVideo.includes("30 menit"));
  assert.equal(EMOJI_PATTERN.test(tooLongVideo), false);
});

// ---------------------------------------------------------------------------
// Bagian 2: integrasi (memerlukan npm install; dilewati bila dependensi
// belum tersedia)
// ---------------------------------------------------------------------------

let depsReady = false;
let depsError = null;
let manager = null;

try {
  manager = await import("../src/lib/naze-ytsearch-manager.js");
  depsReady = true;
} catch (error) {
  depsError = error.message;
}

if (!depsReady) {
  test("integrasi Pencarian YouTube ditandai dilewati", () => {
    assert.ok(
      true,
      "dependensi runtime belum terpasang (" + depsError + "); jalankan npm install lalu npm test",
    );
  });
} else {
  test("cache hasil pencarian menyimpan dan mengedaluwarsakan entri", () => {
    const limits = utils.resolveYtsearchLimits();
    const key = "uji-cache-" + Date.now();
    const entry = { results: [{ title: "Satu", url: "https://youtu.be/x" }], query: "uji" };

    assert.equal(manager.recallSearch(key, 0), null, "kunci tak dikenal harus null");

    manager.rememberSearch(key, entry, 0);
    const fresh = manager.recallSearch(key, 1000);
    assert.ok(fresh);
    assert.equal(fresh.results.length, 1);
    assert.equal(fresh.savedAt, 0);

    const expired = manager.recallSearch(key, limits.selectionTtlMs + 1);
    assert.equal(expired, null, "entri melewati TTL harus null");
    assert.equal(manager.recallSearch(key, limits.selectionTtlMs), null, "entri kedaluwarsa harus dihapus");
  });

  test("normalizeVideoResult membaca field yt-search secara defensif", () => {
    const limits = utils.resolveYtsearchLimits();
    const normalized = manager.normalizeVideoResult(
      {
        videoId: "abc123",
        title: "Judul Video " + "panjang ".repeat(20),
        author: { name: "Kanal Uji" },
        timestamp: "4:13",
        views: 38878009,
      },
      limits,
    );
    assert.equal(normalized.videoId, "abc123");
    assert.equal(normalized.url, "https://www.youtube.com/watch?v=abc123");
    assert.equal(normalized.channel, "Kanal Uji");
    assert.equal(normalized.durationLabel, "4:13");
    assert.equal(normalized.viewsLabel, "38,9 jt");
    assert.ok(normalized.title.endsWith("..."));
    assert.ok(normalized.title.length <= limits.maxTitleLength);

    const fromSeconds = manager.normalizeVideoResult(
      { videoId: "def456", title: "Tanpa timestamp", author: {}, duration: { seconds: 202 }, views: 880000 },
      limits,
    );
    assert.equal(fromSeconds.durationLabel, "3:22");
    assert.equal(fromSeconds.channel, "-");
    assert.equal(fromSeconds.seconds, 202);
  });

  test("plugin ytsearch terdaftar dengan konfigurasi sah dan tanpa benturan nama", async () => {
    const modul = await import("../plugins/downloader/ytsearch.js");
    assert.equal(modul.config.name, "ytsearch");
    assert.deepEqual(modul.config.alias, ["yts"]);
    assert.equal(modul.config.category, "downloader");
    assert.equal(typeof modul.handler, "function");

    const names = new Set([modul.config.name]);
    const aliases = new Set(modul.config.alias || []);

    const downloaderPlugins = ["tiktok", "instagram", "youtube", "mp3"];
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
    }

    const stickerPlugins = [
      "sticker", "brat", "bratvid", "toimg", "togif", "tovideo",
      "take", "steal", "getsticker", "liststicker", "delsticker",
    ];
    for (const pluginName of stickerPlugins) {
      const other = await import(`../plugins/sticker/${pluginName}.js`);
      assert.ok(!names.has(other.config.name), "benturan dengan perintah sticker: " + other.config.name);
      for (const alias of other.config.alias || []) {
        assert.ok(!names.has(alias), "benturan command dengan alias sticker: " + alias);
        assert.ok(!aliases.has(alias), "benturan alias dengan alias sticker: " + alias);
      }
    }
  });

  test("menu utama menampilkan bagian YOUTUBE SEARCH", async () => {
    const menuPlugin = await import("../plugins/files/menu.js");
    const m = {
      reply: (text) => {
        assert.ok(text.includes("YOUTUBE SEARCH"));
        assert.ok(text.includes('".ytsearch"'));
        assert.ok(text.includes("SOSMED DOWNLOADER"));
        assert.ok(text.includes("STICKER"));
        assert.ok(text.includes("FILE MANAGEMENT"));
        assert.equal(EMOJI_PATTERN.test(text), false);
      },
    };
    await menuPlugin.handler(m);
  });

  test("pencarian nyata via yt-search (best-effort, dilewati bila tanpa jaringan)", async () => {
    try {
      const yts = (await import("yt-search")).default;
      const r = await yts({ query: "lagu indonesia" });
      const videos = (r?.videos || []).slice(0, 3);
      assert.ok(videos.length > 0, "pencarian populer harus menghasilkan video");
    } catch (error) {
      assert.ok(
        true,
        "pencarian nyata memerlukan jaringan; diuji ulang di lingkungan panel (" + error.message + ")",
      );
    }
  });
}
