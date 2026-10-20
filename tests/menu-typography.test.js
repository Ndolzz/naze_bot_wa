// Pengujian tipografi dan struktur menu Naze.
//
// Jalankan dengan Node dari root repositori:
//   node tests/menu-typography.test.js
//
// Pada lingkungan tanpa Node CLI, fungsi runMenuTypographyTests dapat
// dievaluasi bersama sumber modul yang disatukan (harness sandbox);
// bagian setelah penanda RUNNER di bawah hanya untuk Node.

export async function runMenuTypographyTests(env) {
  const {
    setPlainMenu, isPlainMenu, stylize, stylizeHeader, menuTitle, menuBrand, separator, menuDot,
    STYLES, SECTION_STYLES, SUB_STYLES,
    SECTIONS, SUB_ORDER, buildStructure, buildOverview, buildSection, buildSub, buildAllChunks,
    countOf, findSection, findSub,
    registerPlugin, pluginStore,
    caseHandler = null,
    integ = null,
  } = env;

  const results = { total: 0, passed: 0, failed: 0, failures: [] };

  async function test(name, fn) {
    results.total++;
    try {
      await fn();
      results.passed++;
    } catch (e) {
      results.failed++;
      results.failures.push(`${name}: ${e && e.message ? e.message : String(e)}`);
    }
  }

  const ok = (cond, msg) => {
    if (!cond) throw new Error(msg || "assertion gagal");
  };
  const eq = (actual, expected, msg) => {
    if (actual !== expected) {
      throw new Error(`${msg || "nilai tidak sama"}: diharapkan ${JSON.stringify(expected)}, didapat ${JSON.stringify(actual)}`);
    }
  };
  const cpAt = (s, i) => String(s).codePointAt(i);

  function numbersOf(text) {
    const out = [];
    for (const line of String(text).split("\n")) {
      const m = line.match(/^(\d+)\. /);
      if (m) out.push(Number(m[1]));
    }
    return out;
  }
  const isSequential = (nums) =>
    nums.length > 0 && nums.every((n, i) => n === i + 1);
  const noBoxArt = (text) => !/[╔╚║┃╰╭╮「」]/.test(String(text));

  function populateFakeStore() {
    pluginStore.commands.clear();
    pluginStore.aliases.clear();
    pluginStore.categories.clear();
    const fake = (name, category, extra = {}) => {
      const cfg = {
        name, alias: [], category,
        description: `Deskripsi ${name}`,
        usage: `.${name}`, example: `.${name}`,
        isOwner: false, isPremium: false, isGroup: false, isPrivate: false, isAdmin: false,
        cooldown: 3, isEnabled: true,
        ...extra,
      };
      registerPlugin({ config: cfg, handler: async () => {} });
    };
    fake("menu", "main", { alias: ["help", "bantuan"] });
    fake("about", "main");
    fake("profile", "user");
    fake("bucin", "fun");
    fake("tebakgambar", "game");
    fake("claninfo", "clan");
    fake("leaderboard", "user");
    fake("ocr", "convert");
    fake("toimg", "convert");
    fake("kick", "group");
    fake("sticker", "sticker");
    fake("carbon", "tools");
    fake("premiumtool", "tools", { isPremium: true });
    fake("joingcowner", "group", { isOwner: true });
    fake("backupdb", "owner", { isOwner: true });
    fake("antitoxic", "group");
    fake("matikanfitur", "tools", { isEnabled: false });
    fake("mistericmd", "misteri");
    fake("ping", "info");
    fake("stats", "cek");
  }

  const flattenNames = (structure) => {
    const names = [];
    for (const s of structure) for (const sub of s.subs) for (const i of sub.items) names.push(i.name);
    return names;
  };

  setPlainMenu(false);

  /* ---------------- Tipografi dasar ---------------- */

  await test("stylize: contoh gaya sesuai spesifikasi (Fun, Games, Clan, Help)", () => {
    eq(stylize("FUN MENU", "sansBold"), "𝗙𝗨𝗡 𝗠𝗘𝗡𝗨", "Fun");
    eq(stylize("GAMES MENU", "sansBoldItalic"), "𝙂𝘼𝙈𝙀𝙎 𝙈𝙀𝙉𝙐", "Games");
    eq(stylize("CLAN MENU", "sans"), "𝖢𝖫𝖠𝖭 𝖬𝖤𝖭𝖴", "Clan");
    eq(stylize("HELP MENU", "serifBold"), "𝐇𝐄𝐋𝐏 𝐌𝐄𝐍𝐔", "Help");
  });

  await test("stylize: offset code point sansBold untuk huruf dan angka", () => {
    eq(cpAt(stylize("A", "sansBold"), 0), 0x1d5d4);
    eq(cpAt(stylize("a", "sansBold"), 0), 0x1d5ee);
    eq(cpAt(stylize("1", "sansBold"), 0), 0x1d7ed);
  });

  await test("stylize: gaya italic mempertahankan angka ASCII", () => {
    eq(stylize("1", "serifItalic"), "1");
    eq(stylize("0123", "serifBoldItalic"), "0123");
  });

  await test("stylize: fullwidth mengubah angka", () => {
    eq(cpAt(stylize("1", "fullwidth"), 0), 0xff11);
  });

  await test("stylize: karakter non-alfanumerik dipertahankan", () => {
    const s = stylize("A-B_C.D E", "mono");
    ok(s.includes("-") && s.includes("_") && s.includes("."), "tanda baca hilang");
    ok(s.includes(" "), "spasi hilang");
  });

  await test("stylize: huruf h italic serif memakai U+210E", () => {
    eq(cpAt(stylize("h", "serifItalic"), 0), 0x210e);
    eq(stylize("hello", "serifItalic").codePointAt(0), 0x210e);
  });

  await test("menuTitle: judul utama fullwidth sesuai contoh", () => {
    eq(menuTitle("NAZE"), "ＮＡＺＥ ＭＥＮＵ");
    eq(menuTitle("naze"), "ＮＡＺＥ ＭＥＮＵ");
    eq(menuTitle(undefined), "ＮＡＺＥ ＭＥＮＵ");
  });

  await test("separator dan brand: panjang konsisten", () => {
    const sep = separator();
    ok(sep.length === 28, `panjang separator ${sep.length}`);
    ok([...sep].every((c) => cpAt(c, 0) === 0x2500), "separator bukan garis ─");
    eq(menuBrand(), "❖");
    eq(menuDot(), "•");
  });

  await test("STYLES: rentang A-Z dan 0-9 tanpa celah untuk semua gaya", () => {
    for (const [key, s] of Object.entries(STYLES)) {
      eq(cpAt(stylize("Z", key), 0) - cpAt(stylize("A", key), 0), 25, `rentang huruf besar ${key}`);
      eq(cpAt(stylize("z", key), 0) - cpAt(stylize("a", key), 0), 25, `rentang huruf kecil ${key}`);
      if (s.digit != null) {
        eq(cpAt(stylize("9", key), 0) - cpAt(stylize("0", key), 0), 9, `rentang angka ${key}`);
      }
    }
  });

  await test("SECTION_STYLES: setiap section memiliki gaya yang valid", () => {
    const valid = new Set(Object.keys(STYLES));
    for (const s of SECTIONS) {
      ok(SECTION_STYLES[s.key], `gaya section ${s.key} tidak terdaftar`);
      ok(valid.has(SECTION_STYLES[s.key]), `gaya section ${s.key} tidak valid`);
    }
  });

  await test("mode plain: fallback teks ASCII", () => {
    setPlainMenu(true);
    ok(isPlainMenu(), "isPlainMenu");
    eq(stylize("Fun Menu", "sansBold"), "FUN MENU");
    eq(menuTitle("NAZE"), "NAZE MENU");
    eq(separator(), "-".repeat(28));
    eq(menuBrand(), "#");
    eq(menuDot(), "|");
    setPlainMenu(false);
    ok(!isPlainMenu(), "mode plain tidak kembali");
    eq(menuTitle("NAZE"), "ＮＡＺＥ ＭＥＮＵ");
  });

  /* ---------------- Struktur (store tiruan) ---------------- */

  populateFakeStore();

  await test("buildStructure: urutan section tetap untuk owner", () => {
    const st = buildStructure({ isOwner: true });
    eq(JSON.stringify(st.map((s) => s.key)), JSON.stringify(["main", "tools", "games", "groups", "system", "owner"]));
  });

  await test("buildStructure: urutan submenu games = Fun, Games, Clan, Rank", () => {
    const st = buildStructure({ isOwner: true });
    const games = st.find((s) => s.key === "games");
    eq(JSON.stringify(games.subs.map((x) => x.label)), JSON.stringify(["Fun", "Games", "Clan", "Rank"]));
  });

  await test("buildStructure: section owner dan command owner disembunyikan bagi non-owner", () => {
    const st = buildStructure({ isOwner: false });
    ok(!st.some((s) => s.key === "owner"), "section owner tampil");
    const names = flattenNames(st);
    ok(!names.includes("joingcowner"), "command owner tampil");
    ok(!names.includes("backupdb"), "command owner tampil");
  });

  await test("buildStructure: command tersembunyi dan nonaktif tidak tampil", () => {
    const st = buildStructure({ isOwner: true });
    const names = flattenNames(st);
    ok(!names.includes("antitoxic"), "command HIDDEN tampil");
    ok(!names.includes("matikanfitur"), "command nonaktif tampil");
  });

  await test("buildStructure: penempatan nama (leaderboard) mengalahkan kategori", () => {
    const st = buildStructure({ isOwner: true });
    const games = st.find((s) => s.key === "games");
    const rank = games.subs.find((x) => x.label === "Rank");
    ok(rank && rank.items.some((i) => i.name === "leaderboard"), "leaderboard tidak di games/Rank");
  });

  await test("buildStructure: kategori tak dikenal masuk tools/Utilities", () => {
    const st = buildStructure({ isOwner: true });
    const tools = st.find((s) => s.key === "tools");
    const util = tools.subs.find((x) => x.label === "Utilities");
    ok(util && util.items.some((i) => i.name === "mistericmd"), "mistericmd tidak di tools/Utilities");
  });

  await test("buildStructure: command owner dari kategori group dipindah ke owner/Group Management", () => {
    const st = buildStructure({ isOwner: true });
    const owner = st.find((s) => s.key === "owner");
    const gm = owner.subs.find((x) => x.label === "Group Management");
    ok(gm && gm.items.some((i) => i.name === "joingcowner"), "joingcowner tidak di owner/Group Management");
    const sm = owner.subs.find((x) => x.label === "System Management");
    ok(sm && sm.items.some((i) => i.name === "backupdb"), "backupdb tidak di owner/System Management");
  });

  await test("buildStructure: command case masuk system/Information", () => {
    const st = buildStructure({ isOwner: true });
    const system = st.find((s) => s.key === "system");
    const info = system.subs.find((x) => x.label === "Information");
    ok(info, "submenu Information tidak ada");
    for (const n of ["cping", "listallcase", "listallplugin"]) {
      ok(info.items.some((i) => i.name === n), `case ${n} tidak tampil`);
    }
  });

  await test("buildStructure: setiap submenu yang tampil punya gaya terdaftar", () => {
    const st = buildStructure({ isOwner: true });
    for (const s of st) {
      for (const sub of s.subs) {
        ok(SUB_STYLES[sub.label], `gaya submenu ${sub.label} tidak terdaftar`);
      }
    }
  });

  await test("SUB_ORDER: memuat seluruh label submenu yang dipakai", () => {
    const st = buildStructure({ isOwner: true });
    const labels = new Set(st.flatMap((s) => s.subs.map((x) => x.label)));
    for (const label of labels) ok(SUB_ORDER.includes(label), `label ${label} tidak ada di SUB_ORDER`);
  });

  await test("alias: registerPlugin memetakan alias ke nama utama", () => {
    eq(pluginStore.aliases.get("bantuan"), "menu");
    eq(pluginStore.aliases.get("help"), "menu");
  });

  await test("countOf: menjumlahkan seluruh item submenu", () => {
    const st = buildStructure({ isOwner: true });
    const games = st.find((s) => s.key === "games");
    eq(countOf(games), games.subs.reduce((n, x) => n + x.items.length, 0));
  });

  /* ---------------- Render ---------------- */

  const stOwner = buildStructure({ isOwner: true });
  const stUser = buildStructure({ isOwner: false });

  await test("buildOverview: judul, header kategori, dan isi sesuai standar", () => {
    const text = buildOverview({
      prefix: ".", botName: "NAZE", version: "1.0.0", mode: "PUBLIC",
      uptime: "2 jam", developer: "Ndolzz", pushName: "Tester", role: "Pengguna",
      greeting: "Selamat malam", structure: stUser,
    });
    ok(text.includes("❖ ＮＡＺＥ ＭＥＮＵ"), "judul utama tidak ada");
    ok(text.includes("𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗬 𝗠𝗘𝗡𝗨"), "header kategori tidak ada");
    ok(text.includes("Selamat malam, Tester."), "sapaan tidak ada");
    ok(text.includes("Versi 1.0.0"), "versi tidak ada");
    ok(text.includes(".menu games fun"), "contoh navigasi tidak ada");
    ok(text.includes(".allmenu"), "petunjuk allmenu tidak ada");
    ok(text.includes("Fun, Games, Clan, Rank"), "petunjuk submenu games tidak ada");
    ok(noBoxArt(text), "masih ada dekorasi box");
    ok(!text.includes("System Management"), "section owner bocor ke non-owner");
  });

  await test("buildOverview: penomoran kategori berurutan tanpa celah", () => {
    const text = buildOverview({
      prefix: ".", botName: "NAZE", version: "1", mode: "PUBLIC",
      uptime: "1 jam", developer: "Ndolzz", pushName: "T", role: "Pengguna",
      greeting: "Halo", structure: stUser,
    });
    const nums = numbersOf(text);
    ok(isSequential(nums), `penomoran tidak berurutan: ${JSON.stringify(nums)}`);
    eq(nums.length, stUser.filter((s) => !s.ownerOnly).length, "jumlah kategori tidak sesuai");
  });

  await test("buildOverview: struktur kosong tetap valid", () => {
    const text = buildOverview({
      prefix: ".", botName: "NAZE", version: "1", mode: "PUBLIC",
      uptime: "1 jam", developer: "Ndolzz", pushName: "T", role: "Pengguna",
      greeting: "Halo", structure: [],
    });
    ok(text.includes("ＮＡＺＥ ＭＥＮＵ"), "judul hilang saat struktur kosong");
    eq(numbersOf(text).length, 0, "seharusnya tidak ada kategori bernomor");
  });

  await test("buildSection: header bergaya, submenu bernomor dari 1, perintah ASCII", () => {
    const tools = stUser.find((s) => s.key === "tools");
    const text = buildSection(tools, ".");
    ok(text.startsWith(`❖ ${stylizeHeader("Tools Menu", "sansBoldItalic")}`), "header section tidak sesuai gaya");
    ok(isSequential(numbersOf(text)), "penomoran submenu tidak berurutan");
    ok(text.includes(`${stylizeHeader("Converter", "sansBoldItalic")} (1)`), "header submenu Converter tidak sesuai");
    ok(text.includes(".ocr"), "perintah .ocr tidak tampil");
    ok(text.includes(".toimg"), "perintah .toimg tidak tampil");
    ok(text.includes(".carbon"), "perintah .carbon tidak tampil");
    ok(text.includes(".mistericmd"), "perintah kategori tak dikenal tidak tampil");
    ok(text.includes("Kembali: .menu"), "petunjuk kembali tidak ada");
    ok(noBoxArt(text), "masih ada dekorasi box");
    ok(!/\*GROUPS\*|\*OWNER\*|\*TOOLS\*/.test(text), "masih ada markup bold lama");
  });

  await test("buildSection: opsi title mengganti judul (NAZE GROUP)", () => {
    const groups = stUser.find((s) => s.key === "groups");
    const text = buildSection(groups, ".", { title: "NAZE GROUP" });
    ok(text.includes(`❖ ${stylizeHeader("NAZE GROUP", "serifBold")}`), "judul khusus grup tidak tampil");
    ok(!text.includes("*GROUPS*"), "markup lama masih ada");
  });

  await test("buildSub: penomoran perintah dari 1 dengan deskripsi terindeksi", () => {
    const tools = stUser.find((s) => s.key === "tools");
    const util = tools.subs.find((x) => x.label === "Utilities");
    const text = buildSub(tools, util, ".");
    ok(isSequential(numbersOf(text)), "penomoran perintah tidak berurutan");
    for (const line of text.split("\n")) {
      if (/^\d+\. /.test(line)) ok(/^\d+\. \.[a-z0-9-]+(\s\[.*\])?$/.test(line), `baris perintah tidak ASCII murni: ${line}`);
    }
    ok(text.includes(".premiumtool [premium]"), "flag premium tidak tampil");
    ok(text.includes("   Deskripsi premiumtool"), "deskripsi tidak terindeksi");
    ok(text.includes("Kembali: .menu tools"), "petunjuk kembali tidak ada");
  });

  await test("buildSub: opsi title mengganti judul (NAZE OWNER PANEL)", () => {
    const owner = stOwner.find((s) => s.key === "owner");
    const sub = owner.subs[0];
    const text = buildSub(owner, sub, ".", { title: "NAZE OWNER PANEL" });
    ok(text.includes(`❖ ${stylizeHeader("NAZE OWNER PANEL", "serifBoldItalic")}`), "judul panel owner tidak tampil");
    ok(!text.includes("*OWNER*"), "markup lama masih ada");
  });

  await test("buildSection: opsi detail mengganti baris petunjuk", () => {
    const owner = stOwner.find((s) => s.key === "owner");
    const text = buildSection(owner, ".", {
      title: "NAZE OWNER PANEL",
      detail: "Ketik .ownermenu <submenu> untuk membuka submenu.",
    });
    ok(text.includes("Ketik .ownermenu <submenu> untuk membuka submenu."), "detail kustom tidak tampil");
    ok(!text.includes("Ketik .menu owner <submenu>"), "detail bawaan masih tampil");
  });

  await test("buildAllChunks: seluruh section tampil, terpotong sesuai batas, tanpa chunk kosong", () => {
    const chunks = buildAllChunks(stUser, ".");
    ok(chunks.length > 0, "tidak ada chunk");
    const joined = chunks.join("\n");
    for (const chunk of chunks) {
      ok(chunk.trim().length > 0, "ada chunk kosong");
      ok(chunk.length <= 3500, `chunk melebihi batas: ${chunk.length}`);
    }
    for (const s of stUser) {
      ok(joined.includes(stylizeHeader(`${s.label} Menu`, SECTION_STYLES[s.key])), `section ${s.key} tidak tampil`);
    }
    ok(joined.includes("ＳＥＭＵＡ ＰＥＲＩＮＴＡＨ"), "judul allmenu tidak tampil");
    ok(joined.includes(".bucin"), "perintah .bucin tidak tampil");
    ok(noBoxArt(joined), "masih ada dekorasi box");
  });

  await test("mode plain: seluruh keluaran menu menjadi ASCII murni", () => {
    setPlainMenu(true);
    const overview = buildOverview({
      prefix: ".", botName: "NAZE", version: "1", mode: "PUBLIC",
      uptime: "1 jam", developer: "Ndolzz", pushName: "T", role: "Pengguna",
      greeting: "Halo", structure: buildStructure({ isOwner: false }),
    });
    const tools = buildStructure({ isOwner: false }).find((s) => s.key === "tools");
    const outputs = [
      overview,
      buildSection(tools, "."),
      buildSub(tools, tools.subs[0], "."),
      ...buildAllChunks(buildStructure({ isOwner: false }), "."),
    ];
    for (const o of outputs) {
      ok(/^[\x00-\x7f]*$/.test(o), "keluaran mode plain masih memuat karakter non-ASCII");
    }
    setPlainMenu(false);
  });

  await test("navigasi: alias findSection/findSub tetap berfungsi, nomor visual bukan kategori", () => {
    ok(findSection(stUser, "games") && findSection(stUser, "game"), "alias game gagal");
    ok(findSection(stUser, "grup") && findSection(stUser, "group"), "alias grup gagal");
    ok(findSection(stUser, "tool") && findSection(stUser, "tools"), "alias tool gagal");
    ok(findSection(stUser, "sistem"), "alias sistem gagal");
    ok(findSection(stUser, "utama"), "alias utama gagal");
    eq(findSection(stUser, "1"), null, "nomor visual salah dianggap kategori");
    const games = findSection(stUser, "games");
    eq(findSub(games, "fun").label, "Fun");
    eq(findSub(games, "rank").label, "Rank");
    const tools = findSection(stUser, "tools");
    eq(findSub(tools, "utilities").label, "Utilities");
    eq(findSub(tools, "texteffects"), null); // submenu kosong difilter dari struktur
  });

  /* ---------------- Case handler (hanya bila disediakan harness) ---------------- */

  if (caseHandler) {
    await test("case listallcase: judul, penomoran dari 1, tanpa dekorasi box", async () => {
      const captured = {};
      const m = { isCommand: true, command: "listallcase", prefix: ".", chat: "t@g.us", react: async () => {} };
      const sock = {
        sendPresenceUpdate: async () => {},
        sendMessage: async (chat, opts) => { captured.text = opts.text; },
      };
      const res = await caseHandler(m, sock);
      ok(res && res.handled === true, "listallcase tidak tertangani");
      ok(typeof captured.text === "string", "teks tidak terkirim");
      ok(captured.text.includes("ＮＡＺＥ ＣＡＳＥ ＬＩＳＴ"), "judul case list tidak sesuai");
      ok(captured.text.includes("Total: 3"), "total case salah");
      ok(isSequential(numbersOf(captured.text)), "penomoran case tidak berurutan");
      ok(captured.text.includes(".listallcase"), "command case tidak tercantum");
      ok(noBoxArt(captured.text), "masih ada dekorasi box");
    });

    await test("case listallplugin: judul, kategori bergaya, perintah ASCII", async () => {
      const captured = {};
      const m = { isCommand: true, command: "listallplugin", prefix: ".", chat: "t@g.us", react: async () => {} };
      const sock = {
        sendPresenceUpdate: async () => {},
        sendMessage: async (chat, opts) => { captured.text = opts.text; },
      };
      const res = await caseHandler(m, sock);
      ok(res && res.handled === true, "listallplugin tidak tertangani");
      ok(typeof captured.text === "string", "teks tidak terkirim");
      ok(captured.text.includes("ＮＡＺＥ ＰＬＵＧＩＮ ＬＩＳＴ"), "judul plugin list tidak sesuai");
      ok(captured.text.includes(".bucin"), "plugin tiruan tidak tercantum");
      ok(captured.text.includes("1. ."), "penomoran per kategori tidak mulai dari 1");
      ok(noBoxArt(captured.text), "masih ada dekorasi box");
    });
  }

  /* ---------------- Pembersihan store tiruan ---------------- */

  pluginStore.commands.clear();
  pluginStore.aliases.clear();
  pluginStore.categories.clear();

  await test("store bersih setelah fase tiruan", () => {
    ok(pluginStore.commands.size === 0, "store command tidak bersih");
    ok(pluginStore.aliases.size === 0, "store alias tidak bersih");
    ok(pluginStore.categories.size === 0, "store kategori tidak bersih");
  });

  /* ---------------- Integrasi plugin nyata (hanya Node) ---------------- */

  if (integ) {
    await test("integ: plugin nyata termuat", async () => {
      const n = await integ.loadPlugins("./plugins");
      ok(n > 0, `jumlah plugin dimuat: ${n}`);
    });

    await test("integ: seluruh nama menu cocok dengan plugin atau case aktual", async () => {
      const structure = buildStructure({ isOwner: true });
      ok(structure.length > 0, "struktur kosong");
      const caseNames = new Set(
        Object.values(integ.getCasesByCategory ? integ.getCasesByCategory() : {}).flat(),
      );
      for (const s of structure) {
        for (const sub of s.subs) {
          for (const item of sub.items) {
            ok(
              pluginStore.commands.has(item.name) || caseNames.has(item.name),
              `perintah tidak terdaftar: ${item.name}`,
            );
          }
        }
      }
    });

    await test("integ: tidak ada nama ganda dalam satu submenu", async () => {
      const structure = buildStructure({ isOwner: true });
      for (const s of structure) {
        for (const sub of s.subs) {
          const seen = new Set();
          for (const item of sub.items) {
            ok(!seen.has(item.name), `nama ganda di ${s.key}/${sub.label}: ${item.name}`);
            seen.add(item.name);
          }
        }
      }
    });

    await test("integ: menu inti tersedia dan ownermenu hanya di tampilan owner", async () => {
      for (const n of ["menu", "allmenu", "groupmenu", "totalfitur", "carifitur"]) {
        ok(pluginStore.commands.has(n), `plugin ${n} tidak terdaftar`);
      }
      const userView = flattenNames(buildStructure({ isOwner: false }));
      ok(!userView.includes("ownermenu"), "ownermenu tampil bagi non-owner");
      const ownerView = flattenNames(buildStructure({ isOwner: true }));
      ok(ownerView.includes("ownermenu"), "ownermenu tidak tampil bagi owner");
    });

    await test("integ: alias perintah tetap dapat dipanggil", async () => {
      eq(integ.getPlugin("help").config.name, "menu");
      eq(integ.getPlugin("menugrup").config.name, "groupmenu");
      eq(integ.getPlugin("panelowner").config.name, "ownermenu");
    });

    await test("integ: overview nyata bernomor urut dan tanpa dekorasi box", async () => {
      const overview = buildOverview({
        prefix: ".", botName: "NAZE", version: "1", mode: "PUBLIC",
        uptime: "1 jam", developer: "Ndolzz", pushName: "T", role: "Pengguna",
        greeting: "Halo", structure: buildStructure({ isOwner: false }),
      });
      ok(isSequential(numbersOf(overview)), "penomoran overview nyata tidak berurutan");
      ok(noBoxArt(overview), "overview nyata masih memuat dekorasi box");
      const section = buildSection(findSection(buildStructure({ isOwner: false }), "games"), ".");
      ok(isSequential(numbersOf(section)), "penomoran section nyata tidak berurutan");
    });
  }

  return results;
}

// ===== RUNNER =====
import {
  setPlainMenu, isPlainMenu, stylize, stylizeHeader, menuTitle, menuBrand, separator, menuDot,
  STYLES, SECTION_STYLES, SUB_STYLES,
} from "../src/lib/naze-menu-typography.js";
import {
  SECTIONS, SUB_ORDER, buildStructure, buildOverview, buildSection, buildSub, buildAllChunks,
  countOf, findSection, findSub,
} from "../src/lib/naze-menu-util.js";
import {
  registerPlugin, pluginStore, getPlugin, loadPlugins,
} from "../src/lib/naze-plugins.js";
import { getCasesByCategory } from "../case/naze.js";
import config from "../config.js";

setPlainMenu(config.features?.plainMenu === true);

const env = {
  setPlainMenu, isPlainMenu, stylize, stylizeHeader, menuTitle, menuBrand, separator, menuDot,
  STYLES, SECTION_STYLES, SUB_STYLES,
  SECTIONS, SUB_ORDER, buildStructure, buildOverview, buildSection, buildSub, buildAllChunks,
  countOf, findSection, findSub,
  registerPlugin, pluginStore,
  integ: { getPlugin, loadPlugins, getCasesByCategory },
};

const results = await runMenuTypographyTests(env);

console.log(`Total: ${results.total} | Lolos: ${results.passed} | Gagal: ${results.failed}`);
for (const f of results.failures) console.log(`- GAGAL: ${f}`);
if (typeof process !== "undefined" && process.exit) process.exit(results.failed ? 1 : 0);
