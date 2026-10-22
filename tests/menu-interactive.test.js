// Pengujian menu interaktif NAZE (Tahap 2).
// Seluruhnya murni: pembangun tampilan dari src/lib/naze-menu.js dan
// pengiriman dari src/lib/naze-menu-send.js dengan socket serta banner stub.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as menu from "../src/lib/naze-menu.js";
import * as menuSend from "../src/lib/naze-menu-send.js";

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

const MANY_TOOLS_PLUGINS = Array.from({ length: 12 }, (_, i) => ({
  config: {
    name: "cmd" + i,
    alias: [],
    category: "tools",
    description: "Fitur nomor " + i,
  },
}));

function collectRows(sections) {
  return sections.flatMap((section) => section.rows);
}

function assertAscii(actual, label) {
  const text = String(actual);
  assert.ok(
    /^[\x20-\x7E\n]*$/.test(text),
    label + " harus ASCII murni, ditemukan: " + JSON.stringify(text)
  );
}

// ---------------------------------------------------------------------------
// Pembangun tampilan (naze-menu.js, murni)
// ---------------------------------------------------------------------------

test("buildMainMenuView membuat baris kategori tanpa kategori kosong", () => {
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS);
  assert.equal(view.kind, "main");
  assert.equal(view.mode, null);
  assert.equal(view.buttonText, "Pilih Menu");
  const kategori = view.sections[0];
  assert.equal(kategori.title, "Kategori");
  assert.deepEqual(
    kategori.rows.map((r) => r.rowId),
    [".menu files", ".menu sticker", ".menu download", ".menu owner"]
  );
  assert.deepEqual(
    kategori.rows.map((r) => r.title),
    ["Pengelolaan File", "Sticker Studio", "Downloader", "Owner"]
  );
  assert.ok(kategori.rows.every((r) => r.description.endsWith(" fitur")));
  const lainnya = view.sections[view.sections.length - 1];
  assert.equal(lainnya.title, "Lainnya");
  assert.deepEqual(
    lainnya.rows.map((r) => r.rowId),
    [".menu all"]
  );
});

test("buildMainMenuView memakai teks menu lengkap sebagai fallback", () => {
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS);
  assert.equal(view.fallbackText, menu.buildFullMenuText(FIXTURE_PLUGINS));
  assert.ok(view.caption.includes("Total fitur: 5"));
  assert.ok(view.caption.includes("Pilih kategori"));
});

test("seluruh rowId dan teks tampilan ASCII murni", () => {
  const views = [
    menu.buildMainMenuView(FIXTURE_PLUGINS),
    menu.buildCategoryView(FIXTURE_PLUGINS, "download"),
    menu.buildFeatureView(FIXTURE_PLUGINS, FIXTURE_PLUGINS[2]),
  ];
  for (const view of views) {
    assertAscii(view.caption, "caption");
    assertAscii(view.listText, "listText");
    assertAscii(view.buttonText, "buttonText");
    for (const section of view.sections) {
      assertAscii(section.title, "section title");
      for (const row of section.rows) {
        assertAscii(row.rowId, "rowId");
        assertAscii(row.title, "row title");
        assertAscii(row.description, "row description");
      }
    }
  }
});

test("buildCategoryView menampilkan fitur dan navigasi kembali", () => {
  const view = menu.buildCategoryView(FIXTURE_PLUGINS, "download");
  assert.equal(view.kind, "category");
  assert.equal(view.mode, "download");
  assert.equal(view.buttonText, "Pilih Fitur");
  const fitur = view.sections[0];
  assert.deepEqual(
    fitur.rows.map((r) => r.rowId),
    [".menu tiktok", ".menu ytmp3"]
  );
  assert.deepEqual(
    fitur.rows.map((r) => r.title),
    [".tiktok", ".ytmp3"]
  );
  const navigasi = view.sections[view.sections.length - 1];
  assert.equal(navigasi.title, "Navigasi");
  assert.deepEqual(
    navigasi.rows.map((r) => r.rowId),
    [".menu", ".menu all"]
  );
  assert.ok(view.caption.includes("DOWNLOADER"));
  assert.ok(view.caption.includes("Total fitur: 2"));
});

test("buildCategoryView mengembalikan null untuk kategori kosong atau tidak dikenal", () => {
  assert.equal(menu.buildCategoryView(FIXTURE_PLUGINS, "game"), null);
  assert.equal(menu.buildCategoryView(FIXTURE_PLUGINS, "tidakada"), null);
  assert.equal(menu.buildCategoryView([], "files"), null);
});

test("buildCategoryView membatasi maksimum 10 baris per seksi", () => {
  const view = menu.buildCategoryView(MANY_TOOLS_PLUGINS, "tools");
  const featureSections = view.sections.filter((s) => s.title !== "Navigasi");
  assert.equal(featureSections.length, 2);
  assert.deepEqual(
    featureSections.map((s) => s.rows.length),
    [10, 2]
  );
  assert.deepEqual(
    featureSections.map((s) => s.title),
    ["Alat", "Alat (2)"]
  );
  const rowIds = collectRows(view.sections).map((r) => r.rowId);
  assert.equal(new Set(rowIds).size, rowIds.length, "rowId harus unik");
  const featureIds = rowIds
    .filter((id) => id.startsWith(".menu cmd"))
    .sort();
  assert.deepEqual(
    featureIds,
    Array.from({ length: 12 }, (_, i) => ".menu cmd" + i).sort()
  );
});

test("buildCategoryText menghasilkan teks kategori sebagai fallback", () => {
  const view = menu.buildCategoryView(FIXTURE_PLUGINS, "download");
  assert.ok(view.fallbackText.includes("NAZE BOT - DOWNLOADER"));
  assert.ok(view.fallbackText.includes(".tiktok / .tt - Unduh TikTok"));
  assert.ok(view.fallbackText.includes("Ketik .menu untuk kembali ke menu utama."));
  assert.equal(menu.buildCategoryText(null), null);
});

test("buildFeatureView menampilkan detail fitur dan navigasi kembali", () => {
  const tiktok = FIXTURE_PLUGINS[2];
  const view = menu.buildFeatureView(FIXTURE_PLUGINS, tiktok);
  assert.equal(view.kind, "feature");
  assert.equal(view.mode, "download");
  assert.ok(view.caption.includes("Perintah: .tiktok / .tt"));
  assert.equal(view.fallbackText, menu.buildFeatureDetail(tiktok));
  assert.deepEqual(
    collectRows(view.sections).map((r) => r.rowId),
    [".menu download", ".menu", ".menu all"]
  );
});

test("buildFeatureView mengembalikan null untuk plugin tidak sah", () => {
  assert.equal(menu.buildFeatureView(FIXTURE_PLUGINS, null), null);
  assert.equal(menu.buildFeatureView(FIXTURE_PLUGINS, {}), null);
  assert.equal(menu.buildFeatureView(FIXTURE_PLUGINS, { config: {} }), null);
});

test("buildFeatureView menyertakan navigasi kategori di luar urutan bawaan", () => {
  const lepas = [
    { config: { name: "lepasia", alias: [], category: "tidakada", description: "Tanpa kategori" } },
  ];
  const view = menu.buildFeatureView(lepas, lepas[0]);
  assert.equal(view.mode, "tidakada");
  assert.deepEqual(
    collectRows(view.sections).map((r) => r.rowId),
    [".menu tidakada", ".menu", ".menu all"]
  );
});

test("prefix khusus diterapkan pada rowId navigasi", () => {
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS, { prefix: "!" });
  assert.deepEqual(
    view.sections[0].rows.map((r) => r.rowId),
    ["!menu files", "!menu sticker", "!menu download", "!menu owner"]
  );
  assert.equal(view.sections[view.sections.length - 1].rows[0].rowId, "!menu all");
  assert.equal(view.fallbackText, menu.buildFullMenuText(FIXTURE_PLUGINS, { prefix: "!" }));
});

test("buildInvalidMenuText memberi panduan untuk input tidak valid", () => {
  const teks = menu.buildInvalidMenuText("xyz");
  assert.ok(teks.includes("xyz"));
  assert.ok(teks.includes("tidak dikenali"));
  assert.ok(teks.includes(".menu "));
  assert.ok(teks.includes(".menu all"));
});

test("setiap rowId dipetakan balik ke target navigasi yang sah", () => {
  const pairs = [
    [menu.buildMainMenuView(FIXTURE_PLUGINS), FIXTURE_PLUGINS],
    [menu.buildCategoryView(FIXTURE_PLUGINS, "download"), FIXTURE_PLUGINS],
    [menu.buildCategoryView(MANY_TOOLS_PLUGINS, "tools"), MANY_TOOLS_PLUGINS],
    [menu.buildFeatureView(FIXTURE_PLUGINS, FIXTURE_PLUGINS[2]), FIXTURE_PLUGINS],
  ];
  const kinds = new Set(["all", "category", "feature"]);
  for (const [view, plugins] of pairs) {
    for (const row of collectRows(view.sections)) {
      assert.ok(row.rowId.startsWith(".menu"), "rowId harus perintah .menu: " + row.rowId);
      const arg = row.rowId.slice(".menu".length).trim();
      const target = menu.parseMenuTarget(arg, plugins);
      if (!arg) {
        assert.equal(target, null, "rowId .menu harus menuju tampilan utama");
        continue;
      }
      assert.ok(target, "rowId harus dikenali: " + row.rowId);
      assert.ok(kinds.has(target.kind), "kind tidak sah untuk " + row.rowId + ": " + target.kind);
    }
  }
});

test("buildCategoryView menghindari rowId fitur yang bertabrakan dengan kategori", () => {
  const view = menu.buildCategoryView(FIXTURE_PLUGINS, "sticker");
  const fitur = view.sections[0];
  assert.deepEqual(
    fitur.rows.map((r) => r.rowId),
    [".menu s"]
  );
  assert.deepEqual(
    fitur.rows.map((r) => r.title),
    [".sticker"]
  );
  const target = menu.parseMenuTarget("s", FIXTURE_PLUGINS);
  assert.equal(target.kind, "feature");
  assert.equal(target.plugin, FIXTURE_PLUGINS[1]);
});

test("parseMenuTarget memprioritaskan kategori atas nama fitur yang sama", () => {
  const kategori = menu.parseMenuTarget("sticker", FIXTURE_PLUGINS);
  assert.equal(kategori.kind, "category");
  assert.equal(kategori.category, "sticker");
  assert.equal(kategori.plugin, undefined);
  const fitur = menu.parseMenuTarget("stiker", FIXTURE_PLUGINS);
  assert.equal(fitur.kind, "feature");
  assert.equal(fitur.plugin, FIXTURE_PLUGINS[1]);
});

// ---------------------------------------------------------------------------
// sendInteractiveView (naze-menu-send.js, murni dengan socket stub)
// ---------------------------------------------------------------------------

function createStubSock(resultShape) {
  const calls = [];
  const sock = {
    async sendMessage(jid, payload, opts) {
      calls.push({ jid, payload, opts });
      if (resultShape === "fail-list" && calls.length === 1) {
        throw new Error("simulasi kegagalan kirim");
      }
      if (resultShape === "text-only") {
        return { key: { id: "t1" }, message: { conversation: payload.text } };
      }
      if (resultShape === "list-ok") {
        return { key: { id: "l1" }, message: { listMessage: { sections: payload.sections } } };
      }
      return { key: { id: "stub-" + calls.length } };
    },
  };
  return { sock, calls };
}

test("sendInteractiveView mengirim banner lalu list dan melaporkan sukses", async () => {
  const { sock, calls } = createStubSock();
  const view = menu.buildCategoryView(FIXTURE_PLUGINS, "download");
  const banner = Buffer.from("banner-palsu");
  const hasil = await menuSend.sendInteractiveView(sock, "chat@x", view, banner, {
    quoted: { key: { id: "q1" } },
  });
  assert.deepEqual(hasil, { sent: true, error: null });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].jid, "chat@x");
  assert.equal(calls[0].payload.image, banner);
  assert.equal(calls[0].payload.caption, view.caption);
  assert.equal(calls[0].opts.quoted.key.id, "q1");
  assert.equal(calls[1].payload.text, view.listText);
  assert.equal(calls[1].payload.buttonText, view.buttonText);
  assert.equal(calls[1].payload.sections, view.sections);
  assert.equal(calls[1].opts.quoted.key.id, "q1");
});

test("sendInteractiveView tanpa banner menyatukan caption ke teks list", async () => {
  const { sock, calls } = createStubSock();
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS);
  const hasil = await menuSend.sendInteractiveView(sock, "chat@x", view, null);
  assert.equal(hasil.sent, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].payload.text.includes(view.caption));
  assert.ok(calls[0].payload.text.includes(view.listText));
});

test("sendInteractiveView gagal dan melaporkan galat saat kirim list error", async () => {
  const { sock } = createStubSock("fail-list");
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS);
  const hasil = await menuSend.sendInteractiveView(sock, "chat@x", view, null);
  assert.equal(hasil.sent, false);
  assert.equal(hasil.error, "simulasi kegagalan kirim");
});

test("sendInteractiveView menganggap gagal bila list terkirim sebagai teks biasa", async () => {
  const { sock } = createStubSock("text-only");
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS);
  const hasil = await menuSend.sendInteractiveView(sock, "chat@x", view, null);
  assert.equal(hasil.sent, false);
  assert.ok(hasil.error.includes("tidak didukung"));
});

test("sendInteractiveView menerima hasil list message yang sah", async () => {
  const { sock } = createStubSock("list-ok");
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS);
  const hasil = await menuSend.sendInteractiveView(sock, "chat@x", view, null);
  assert.deepEqual(hasil, { sent: true, error: null });
});

test("sendInteractiveView gagal saat socket tidak tersedia", async () => {
  const view = menu.buildMainMenuView(FIXTURE_PLUGINS);
  assert.equal((await menuSend.sendInteractiveView(null, "chat@x", view)).sent, false);
  assert.equal((await menuSend.sendInteractiveView({}, "chat@x", view)).sent, false);
});

test("sendInteractiveView menolak tampilan tanpa seksi", async () => {
  const { sock } = createStubSock();
  assert.equal((await menuSend.sendInteractiveView(sock, "chat@x", {})).sent, false);
  assert.equal((await menuSend.sendInteractiveView(sock, "chat@x", { sections: [] })).sent, false);
});
