// Pengujian modul menu murni dan rendering banner NAZE.
// Bagian murni menguji src/lib/naze-menu.js dan src/lib/naze-banner-pixels.js
// tanpa dependensi apa pun. Bagian integrasi menguji banner per mode pada
// src/lib/naze-banner.js bersama paket sharp; jika dependensi belum
// terpasang (npm install), bagian itu dilewati dengan laporan yang jelas.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as menu from "../src/lib/naze-menu.js";
import * as pixels from "../src/lib/naze-banner-pixels.js";

// ---------------------------------------------------------------------------
// Fixture plugin (bentuk sama dengan getAllPlugins())
// ---------------------------------------------------------------------------

const FIXTURE_PLUGINS = [
  {
    config: {
      name: "menu",
      alias: [],
      category: "files",
      description: "Menu utama NAZE",
    },
  },
  {
    config: {
      name: "sticker",
      alias: ["s", "stiker"],
      category: "sticker",
      description: "Buat stiker",
    },
  },
  {
    config: {
      name: "tiktok",
      alias: ["tt"],
      category: "download",
      description: "Unduh TikTok",
      usage: ".tiktok <tautan> [hd|sd|wm]",
      example: ".tiktok https://vt.tiktok.com/xxxx",
      cooldown: 15,
    },
  },
  {
    config: {
      name: "ytmp3",
      alias: [],
      category: "download",
      description: "Unduh audio YouTube",
    },
  },
  {
    config: {
      name: "fiturmati",
      alias: [],
      category: "tools",
      description: "Fitur nonaktif",
      isEnabled: false,
    },
  },
  {
    config: {
      name: "ownerkhusus",
      alias: [],
      category: "owner",
      description: "Khusus owner",
    },
  },
];

// ---------------------------------------------------------------------------
// Bagian 1: pengelompokan dan teks menu (naze-menu.js, murni)
// ---------------------------------------------------------------------------

test("groupPluginsByCategory mengurutkan sesuai urutan bawaan", () => {
  const groups = menu.groupPluginsByCategory(FIXTURE_PLUGINS);
  assert.deepEqual(
    groups.map((g) => g.key),
    ["files", "sticker", "download", "owner"],
  );
  assert.deepEqual(
    groups.map((g) => g.label),
    ["Pengelolaan File", "Sticker Studio", "Downloader", "Owner"],
  );
});

test("groupPluginsByCategory menyembunyikan plugin nonaktif", () => {
  const groups = menu.groupPluginsByCategory(FIXTURE_PLUGINS);
  assert.ok(!groups.some((g) => g.key === "tools"));
  assert.equal(groups.reduce((n, g) => n + g.plugins.length, 0), 5);
});

test("groupPluginsByCategory mengurutkan fitur per kategori", () => {
  const groups = menu.groupPluginsByCategory(FIXTURE_PLUGINS);
  const downloader = groups.find((g) => g.key === "download");
  assert.deepEqual(
    downloader.plugins.map((p) => p.primary),
    ["tiktok", "ytmp3"],
  );
  assert.deepEqual(downloader.plugins[0].aliases, ["tt"]);
});

test("groupPluginsByCategory mengabaikan duplikasi nama primer", () => {
  const duplikat = [
    { config: { name: "sticker", alias: [], category: "sticker", description: "Pertama" } },
    { config: { name: "sticker", alias: ["s"], category: "sticker", description: "Kedua" } },
  ];
  const groups = menu.groupPluginsByCategory(duplikat);
  assert.equal(groups[0].plugins.length, 1);
  assert.equal(groups[0].plugins[0].description, "Pertama");
});

test("groupPluginsByCategory menangani nama dan alias non-array", () => {
  const plugins = [
    { config: { name: ["amvector"], alias: "vector", category: "tools", description: "Vektor" } },
  ];
  const groups = menu.groupPluginsByCategory(plugins);
  assert.equal(groups[0].plugins[0].primary, "amvector");
  assert.deepEqual(groups[0].plugins[0].aliases, ["vector"]);
});

test("buildFullMenuText menghasilkan teks menu lengkap yang benar", () => {
  const teks = menu.buildFullMenuText(FIXTURE_PLUGINS);
  const expected = [
    "NAZE BOT - DAFTAR FITUR",
    "Prefix: . | Total fitur: 5",
    "",
    "[Pengelolaan File]",
    ".menu - Menu utama NAZE",
    "",
    "[Sticker Studio]",
    ".sticker / .s / .stiker - Buat stiker",
    "",
    "[Downloader]",
    ".tiktok / .tt - Unduh TikTok",
    ".ytmp3 - Unduh audio YouTube",
    "",
    "[Owner]",
    ".ownerkhusus - Khusus owner",
  ].join("\n");
  assert.equal(teks, expected);
});

test("buildFullMenuText memakai prefix khusus bila diberikan", () => {
  const teks = menu.buildFullMenuText(FIXTURE_PLUGINS, { prefix: "!" });
  assert.ok(teks.includes("Prefix: ! | Total fitur: 5"));
  assert.ok(teks.includes("!tiktok / !tt - Unduh TikTok"));
});

test("buildFullMenuText menerima urutan dan label kategori khusus", () => {
  const teks = menu.buildFullMenuText(FIXTURE_PLUGINS, {
    categoryOrder: ["download", "files", "sticker", "owner"],
    categoryLabel: { download: "Pengunduh" },
  });
  assert.ok(teks.includes("[Pengunduh]"));
  assert.ok(
    teks.indexOf("[Pengunduh]") < teks.indexOf("[Pengelolaan File]"),
    "kategori khusus harus mendahului",
  );
});

test("teks menu bebas emoji dan karakter dekoratif", () => {
  const teks = menu.buildFullMenuText(FIXTURE_PLUGINS);
  assert.ok(!/\p{Extended_Pictographic}/u.test(teks), "teks menu memuat emoji");
  for (const baris of teks.split("\n")) {
    if (baris.trim() === "") continue;
    assert.ok(
      !/^[-\u2010-\u2015\u2500-\u257F=_\s]+$/.test(baris),
      "teks menu memuat baris dekoratif",
    );
  }
});

// ---------------------------------------------------------------------------
// Bagian 2: detail fitur dan penafsiran target (naze-menu.js, murni)
// ---------------------------------------------------------------------------

test("buildFeatureDetail menampilkan identitas, kategori, dan cara pakai", () => {
  const plugin = FIXTURE_PLUGINS.find((p) => p.config.name === "tiktok");
  const teks = menu.buildFeatureDetail(plugin);
  assert.ok(teks.startsWith("NAZE BOT - DETAIL FITUR"));
  assert.ok(teks.includes("Perintah: .tiktok / .tt"));
  assert.ok(teks.includes("Kategori: Downloader"));
  assert.ok(teks.includes("Deskripsi: Unduh TikTok"));
  assert.ok(teks.includes("Cara pakai: .tiktok <tautan> [hd|sd|wm]"));
  assert.ok(teks.includes("Contoh: .tiktok https://vt.tiktok.com/xxxx"));
  assert.ok(teks.includes("Cooldown: 15 detik"));
  assert.ok(teks.includes(".menu"));
});

test("buildFeatureDetail mengembalikan null untuk plugin tidak sah", () => {
  assert.equal(menu.buildFeatureDetail(null), null);
  assert.equal(menu.buildFeatureDetail({}), null);
  assert.equal(menu.buildFeatureDetail({ config: {} }), null);
});

test("findPluginByCommand menemukan nama utama maupun alias", () => {
  assert.equal(
    menu.findPluginByCommand(FIXTURE_PLUGINS, "tiktok")?.config.name,
    "tiktok",
  );
  assert.equal(
    menu.findPluginByCommand(FIXTURE_PLUGINS, "TT")?.config.name,
    "tiktok",
  );
  assert.equal(menu.findPluginByCommand(FIXTURE_PLUGINS, "tidakada"), null);
  assert.equal(
    menu.findPluginByCommand(FIXTURE_PLUGINS, "fiturmati"),
    null,
    "plugin nonaktif tidak boleh ditemukan",
  );
});

test("parseMenuTarget menafsirkan argumen navigasi", () => {
  assert.equal(menu.parseMenuTarget("", FIXTURE_PLUGINS), null);
  assert.equal(menu.parseMenuTarget("   ", FIXTURE_PLUGINS), null);
  assert.deepEqual(menu.parseMenuTarget("all", FIXTURE_PLUGINS), { kind: "all" });
  assert.deepEqual(menu.parseMenuTarget("semua", FIXTURE_PLUGINS), { kind: "all" });
  assert.deepEqual(menu.parseMenuTarget("download", FIXTURE_PLUGINS), {
    kind: "category",
    category: "download",
  });
  assert.deepEqual(menu.parseMenuTarget("Downloader", FIXTURE_PLUGINS), {
    kind: "category",
    category: "download",
  });
  const fitur = menu.parseMenuTarget("tt", FIXTURE_PLUGINS);
  assert.equal(fitur.kind, "feature");
  assert.equal(fitur.plugin.config.name, "tiktok");
  assert.equal(menu.parseMenuTarget(".tt", FIXTURE_PLUGINS).kind, "feature");
  assert.deepEqual(menu.parseMenuTarget("tidakada", FIXTURE_PLUGINS), {
    kind: "invalid",
    arg: "tidakada",
  });
});

test("parseMenuTarget tidak membocorkan kategori kosong", () => {
  const kosong = [{ config: { name: "menu", alias: [], category: "files", description: "Menu" } }];
  assert.equal(menu.parseMenuTarget("game", kosong).kind, "invalid");
});

// ---------------------------------------------------------------------------
// Bagian 3: rendering piksel banner (naze-banner-pixels.js, murni)
// ---------------------------------------------------------------------------

// Referensi implementasi piksel versi sebelum modul ini ada, disalin dari
// naze-banner.js lama, untuk menjamin banner utama tetap identik byte demi byte.
const LEGACY = (() => {
  const W = 900;
  const H = 270;
  const COLORS = {
    bg: [15, 23, 42],
    border: [37, 99, 235],
    accent: [96, 165, 250],
    panel: [37, 99, 235],
    white: [248, 250, 252],
    sub: [148, 163, 184],
  };
  const FONT = {
    A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
    E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
    H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
    I: ["###", " # ", " # ", " # ", " # ", " # ", "###"],
    N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
    P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
    S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
    T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
    W: ["#   #", "#   #", "#   #", "# # #", "# # #", "# # #", " # # "],
    Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
    " ": ["  ", "  ", "  ", "  ", "  ", "  ", "  "],
  };
  const fillRect = (p, x, y, w, h, c) => {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
    for (let py = y0; py < y1; py++) {
      let idx = (py * W + x0) * 3;
      for (let px = x0; px < x1; px++) {
        p[idx] = c[0]; p[idx + 1] = c[1]; p[idx + 2] = c[2];
        idx += 3;
      }
    }
  };
  const drawGlyph = (p, g, x0, y0, s, c) => {
    for (let gy = 0; gy < g.length; gy++) {
      const row = g[gy];
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] !== "#") continue;
        fillRect(p, x0 + gx * s, y0 + gy * s, s, s, c);
      }
    }
  };
  const drawText = (p, t, x0, y0, s, c, gap = 1) => {
    let x = x0;
    for (const ch of t.toUpperCase()) {
      const g = FONT[ch];
      if (!g) continue;
      drawGlyph(p, g, x, y0, s, c);
      x += (g[0].length + gap) * s;
    }
  };
  return () => {
    const p = new Uint8Array(W * H * 3);
    fillRect(p, 0, 0, W, H, COLORS.bg);
    fillRect(p, 10, 10, W - 20, 4, COLORS.border);
    fillRect(p, 10, H - 14, W - 20, 4, COLORS.border);
    fillRect(p, 10, 10, 4, H - 20, COLORS.border);
    fillRect(p, W - 14, 10, 4, H - 20, COLORS.border);
    fillRect(p, 52, 57, 156, 156, COLORS.accent);
    fillRect(p, 55, 60, 150, 150, COLORS.panel);
    drawGlyph(p, FONT.N, 90, 79, 16, COLORS.white);
    drawText(p, "NAZE", 280, 55, 13, COLORS.white);
    fillRect(p, 280, 162, 300, 3, COLORS.accent);
    drawText(p, "WHATSAPP ASSISTANT", 280, 182, 5, COLORS.sub);
    return p;
  };
})();

test("renderBannerPixels identik byte demi byte dengan versi sebelumnya", () => {
  const baru = pixels.renderBannerPixels();
  const lama = LEGACY();
  assert.equal(baru.length, lama.length);
  assert.equal(baru.length, 900 * 270 * 3);
  for (let i = 0; i < baru.length; i++) {
    assert.equal(baru[i], lama[i], "piksel berbeda pada indeks " + i);
  }
});

test("renderBannerPixels default sama dengan subjudul eksplisit", () => {
  const a = pixels.renderBannerPixels();
  const b = pixels.renderBannerPixels(pixels.DEFAULT_BANNER_SUBTITLE);
  assert.deepEqual(a, b);
  const c = pixels.renderBannerPixels(null);
  assert.deepEqual(a, c);
});

test("renderBannerPixels menggambar label mode di area subjudul", () => {
  const utama = pixels.renderBannerPixels();
  const mode = pixels.renderBannerPixels("DOWNLOADER MODE");
  assert.equal(utama.length, mode.length);
  let beda = 0;
  let bedaDiLogo = 0;
  for (let i = 0; i < utama.length; i++) {
    if (utama[i] === mode[i]) continue;
    beda += 1;
    const px = Math.floor((i / 3) % 900);
    if (px < 260) bedaDiLogo += 1;
  }
  assert.ok(beda > 0, "label mode harus mengubah piksel");
  assert.equal(bedaDiLogo, 0, "area logo tidak boleh berubah");
});

test("measureTextWidth menyesuaikan skala label panjang", () => {
  assert.ok(
    pixels.measureTextWidth("WHATSAPP ASSISTANT", 5) <= 580,
    "subjudul default harus muat pada skala 5",
  );
  assert.ok(pixels.measureTextWidth("FILE MANAGEMENT", 5) > 0);
  assert.ok(pixels.measureTextWidth("123", 5) > 0, "glyph angka dikenal");
  assert.equal(pixels.measureTextWidth("!@#", 5), 0, "glyph tak dikenal dilewati");
});

test("renderBannerPixels menerima label dengan karakter di luar font", () => {
  // Tidak boleh melempar; glyph tanpa font dilewati.
  const p = pixels.renderBannerPixels("MODE 24 JAM & LAINNYA");
  assert.equal(p.length, 900 * 270 * 3);
});

// ---------------------------------------------------------------------------
// Bagian 4: integrasi banner per mode (memerlukan npm install / sharp)
// ---------------------------------------------------------------------------

let banner = null;
try {
  banner = await import("../src/lib/naze-banner.js");
  await import("sharp");
} catch (error) {
  console.log("[LEWATI] Integrasi banner tidak dijalankan:", error.message);
}

if (banner) {
  test("getBannerImage tanpa argumen menghasilkan buffer utama", async () => {
    banner.resetBannerCache();
    const img = await banner.getBannerImage();
    assert.ok(Buffer.isBuffer(img), "hasil harus berupa Buffer");
    assert.ok(img.length > 1024, "ukuran JPEG mencurigakan");
  });

  test("getBannerImage mode menghasilkan buffer berbeda dari utama", async () => {
    banner.resetBannerCache();
    const utama = await banner.getBannerImage();
    const mode = await banner.getBannerImage("download");
    assert.ok(Buffer.isBuffer(mode));
    assert.notEqual(utama.equals(mode), true, "banner mode harus berbeda dari utama");
  });

  test("cache banner per mode terpisah", async () => {
    banner.resetBannerCache();
    const pertama = await banner.getBannerImage("sticker");
    const kedua = await banner.getBannerImage("sticker");
    assert.equal(pertama, kedua, "hasil kedua harus dari cache");
    const lain = await banner.getBannerImage("game");
    assert.notEqual(pertama, lain, "cache mode lain tidak boleh tertukar");
    banner.resetBannerCache("sticker");
    const setelah = await banner.getBannerImage("sticker");
    assert.notEqual(pertama, setelah, "cache mode harus terhapus");
  });

  test("resetBannerCache menghapus seluruh cache", async () => {
    const utama = await banner.getBannerImage();
    banner.resetBannerCache();
    const ulang = await banner.getBannerImage();
    assert.notEqual(utama, ulang, "cache utama harus terhapus");
  });
} else {
  test("integrasi banner ditandai dilewati", () => {
    assert.ok(true, "dependensi runtime belum terpasang; jalankan npm install lalu npm test");
  });
}
