// Pembuat menu NAZE: struktur Main / Tools / Games / Groups / System / Owner.
// Semua isi menu diambil dari plugin yang benar-benar terdaftar (tidak ada command palsu).
import { getPluginsByCategory, getCategories } from "./naze-plugins.js";
import { getCasesByCategory } from "../../case/naze.js";

/* ------------------------------------------------------------------ */
/* Struktur                                                            */
/* ------------------------------------------------------------------ */
export const SECTIONS = [
  { key: "main", label: "Main", desc: "Profil, bantuan, dan informasi bot" },
  { key: "tools", label: "Tools", desc: "Downloader, media, dokumen, konverter, dan utilitas" },
  { key: "games", label: "Games", desc: "Permainan, clan, dan peringkat" },
  { key: "groups", label: "Groups", desc: "Moderasi, proteksi, dan pengaturan grup" },
  { key: "system", label: "System", desc: "Status, statistik, dan informasi" },
  { key: "owner", label: "Owner", desc: "Panel pengelolaan bot (khusus owner)", ownerOnly: true },
];

// Command yang tidak ditampilkan di menu (internal atau tidak untuk umum)
const HIDDEN = new Set([
  "antitoxic", "addtoxic", "deltoxic", "listtoxic",
  "android1-get", "apkmod-get", "filmget",
]);

// Penempatan berdasarkan kategori plugin: [section, submenu]
const BY_CATEGORY = {
  main: ["main", "Help"],
  user: ["main", "Profile"],
  download: ["tools", "Downloader"],
  downloader: ["tools", "Downloader"],
  sticker: ["tools", "Stickers"],
  canvas: ["tools", "Media"],
  ephoto: ["tools", "Text Effects"],
  maker: ["tools", "Media"],
  convert: ["tools", "Converter"],
  tools: ["tools", "Utilities"],
  utility: ["tools", "Utilities"],
  search: ["tools", "Search"],
  stalker: ["tools", "Account Lookup"],
  fun: ["games", "Fun"],
  anime: ["games", "Fun"],
  game: ["games", "Games"],
  clan: ["games", "Clan"],
  group: ["groups", "Management"],
  info: ["system", "Information"],
  cek
: ["system", "Status"],
  owner: ["owner", "System Management"],
};

const list = (s) => s.split(/\s+/).filter(Boolean);

// Penempatan berdasarkan nama command (mengalahkan penempatan kategori)
const BY_NAME = new Map();
function place(section, sub, names) {
  for (const n of list(names)) BY_NAME.set(n, [section, sub]);
}

// Main
place("main", "Help", "menu allmenu carifitur totalfitur rules groupmenu");
place("main", "About", "about owner donasi benefitowner benefitpremium benefitpartner fiturpremium");
place("main", "Profile", "profile daftar unreg bataldaftar listdaftar daily energi koin buyenergi buyfitur birthday birthdaylist setbirthday");

// Tools
place("tools", "Media", "carbon removebg hd2 hdvid setpp delpp");
place("tools", "Converter", "converter toimg tovideo toaudio tovn tourl ptv emojitoimage emojitoanimasi txt2qr qrcustom cjstoesm esmtocjs");
place("tools", "Documents", "ocr nulis readmore pastebin getpaste invoicemaker");
place("tools", "Utilities", "jadibot stopjadibot");

// Games
place("games", "Rank", "leaderboard level levelup exp topchat");

// Groups
place("groups", "Moderation", `warn resetwarn listwarn kick add promote demote acc mute unmute mutemember unmutemember
  mutegc unmutegc close open hidetag ht hidetag2 htpremium hidetagpremium htprem tagall totag banchat delete delchat
  deletechat clearchat cc cleangc slowmode`);
place("groups", "Protection", `antibot botdetect anticulik anticustom antidocument antijudol antilinkall antilinkgc
  antimedia antiphising antiremove antispam antisticker antiswgc antitagsw addantilink delantilink listantilink`);
place("groups", "Automation", `absen mulaiabsen cekabsen hapusabsen autodl autodownload autoforward automedia autoreply
  autosticker autosambut notifclosegroup notifdemote notifgantitag notifopengroup notifpromote notifmakan notiftidur
  poll afk addcmdsticker delstickercmd game jadwalgroup`);

// System
place("system", "Status", "ping system stats cekonline cekowner cekpartner cekprem"
);

// Owner
place("owner", "Bot Management", `public self restart stop autobio autoread autoreadsw autotyping autoreactsw autojoingc
  anticall botafk onlyadmin onlygc onlypc onlythisgrup addprefix gantiprefix setprefix delprefix listprefix resetprefix
  ganti-namabot ganti-namadev ganti-namaowner ganti-asset sistemdaftar sistemenergi setownertype setlimitdefault
  resetlimitdefault schedule startschedule stopschedule cekschedule setname setbio ownermenu`);
place("owner", "User Management", `ban unban listban checkban block blokir unblock unblocknomor addprem addpremall
  delpremall capprem capfree sprem stickerpremium premiumsticker addowner addpartner akses addenergi addexp addkoin
  addlevel addenergiall delenergi delexp delkoin dellevel capenergi enableenergi disableenergi`);
place("owner", "Group Management", `join leave hapusgrup deletegrup delgrup buatgrup creategroup newgroup addsewa delsewa
  listsewa renewsewa sewabot bcgc bcpc bcpcjeda stopbcpc goodbyeall welcomeall setwelcometype setgoodbyetype setrules
  resetrules swgc swgcall swgcv2 swgcv2all upch ptvch buatsaluran createsaluran createnewsletter hapussaluran
  deletesaluran deletenewsletter mutechat pinchat arsip archive star bintang baca read markread colongpp savekontak`);
place("owner", "Plugin Management", `addplugin delplugin getplugin enableplugin disableplugin searchplugin templateplugin
  ganticode gantiscraper eval exec get q deploy similarity`);
place("owner", "System Management", `backupdb backupsc autobackup savedb resetdb hapusdata clearsessions sampah listjadibot
  listjadibotaktif stopalljadibot stopdandeletejadibot`);

function locate(name, category) {
  return BY_NAME.get(name) || BY_CATEGORY[category] || ["tools", "Utilities"];
}

/* ------------------------------------------------------------------ */
/* Pengumpulan data                                                    */
/* ------------------------------------------------------------------ */
function shorten(text, n = 70) {
  c
onst t = String(text || "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? t.slice(0, n - 3).trimEnd() + "..." : t;
}

function flagsOf(cfg) {
  const f = [];
  if (cfg.isOwner) f.push("owner");
  if (cfg.isPremium) f.push("premium");
  if (cfg.isAdmin) f.push("admin");
  if (cfg.isGroup) f.push("grup");
  if (cfg.isPrivate) f.push("pribadi");
  return f.length ? ` [${f.join(", ")}]` : "";
}

// Kembalikan [{ key, label, desc, subs: [{ label, items: [{ name, desc, flags }] }] }]
export function buildStructure({ isOwner = false } = {}) {
  const tree = new Map(SECTIONS.map((s) => [s.key, new Map()]));
  const add = (section, sub, item) => {
    const subs = tree.get(section);
    if (!subs.has(sub)) subs.set(sub, []);
    subs.get(sub).push(item);
  };

  const cats = new Set([...getCategories(), ...Object.keys(getCasesByCategory())]);
  for (const cat of cats) {
    for (const p of getPluginsByCategory(cat)) {
      const cfg = p.config || {};
      if (cfg.isEnabled === false) continue;
      // Command khusus owner tidak pernah ditampilkan ke pengguna biasa
      if (cfg.isOwner && !isOwner) continue;
      const names = Array.isArray(cfg.name) ? cfg.name : [cfg.name];
      for (const name of names) {
        if (!name || HIDDEN.has(name)) continue;
        let [section, sub] = locate(name, cat);
        if (cfg.isOwner && section !== "owner") {
          section = "owner";
          sub = cat === "group" ? "Group Management" : cat === "user" ? "User Management" : "Bot Management";
        }
        add(section, sub, { name, desc: shorten(cfg.description), flags: flagsOf(cfg) });
      }
    }
    for (const name of getCasesByCategory()[cat] || []) {
      if (HIDDEN.has(name)) continue;
      const [section, sub] = locate(name, cat);
      add(section, sub, { name, desc: "", flags: "" });
    }
  }

  const out = [];
  for (const s of SECTIONS) {
    if (s.ownerOnly && !isOwner) continue;
    const subs = [...
tree.get(s.key).entries()]
      .map(([label, items]) => ({
        label,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((x) => x.items.length);
    if (subs.length) out.push({ ...s, subs });
  }
  return out;
}

export const countOf = (section) => section.subs.reduce((n, s) => n + s.items.length, 0);

export function findSection(structure, query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return null;
  const alias = { group: "groups", grup: "groups", game: "games", tool: "tools", sistem: "system", utama: "main" };
  const k = alias[q] || q;
  return structure.find((s) => s.key === k || s.label.toLowerCase() === k) || null;
}

export function findSub(section, query) {
  const q = String(query || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!q) return null;
  return (
    section.subs.find((s) => s.label.toLowerCase().replace(/[^a-z0-9]/g, "") === q) ||
    section.subs.find((s) => s.label.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(q)) ||
    null
  );
}

/* ------------------------------------------------------------------ */
/* Tampilan teks                                                       */
/* ------------------------------------------------------------------ */
const RULE = "--------------------------------";

export function buildOverview({ prefix, botName, version, mode, uptime, developer, pushName, role, greeting, structure }) {
  const l = [];
  l.push(`*${botName} BOT*`);
  l.push(RULE);
  l.push(`${greeting}, ${pushName || "pengguna"}.`);
  l.push("");
  l.push(`Versi: ${version}`);
  l.push(`Developer: ${developer}`);
  l.push("Platform: WhatsApp");
  l.push(`Mode: ${mode}`);
  l.push(`Aktif: ${uptime}`);
  l.push(`Status: ${role}`);
  l.push("");
  l.push("*MENU*");
  for (const s of structure.filter((x) => !x.ownerOnly)) {
    l.push(`${prefix}menu ${s.key} : ${s.label} (${countOf(s)})`);
  }
  l.push("");
  l.push(`Detail submenu: ${prefix}menu <menu> <submenu>`);

  l.push(`Contoh: ${prefix}menu tools downloader`);
  l.push(`Semua perintah: ${prefix}allmenu`);
  return l.join("\n");
}

// Daftar submenu dengan nama command ringkas
export function buildSection(section, prefix) {
  const l = [`*${section.label.toUpperCase()}*`, RULE, section.desc, ""];
  for (const sub of section.subs) {
    l.push(`*${sub.label}* (${sub.items.length})`);
    l.push(sub.items.map((i) => `${prefix}${i.name}`).join(" "));
    l.push("");
  }
  l.push(`Detail: ${prefix}menu ${section.key} <submenu>`);
  l.push(`Kembali: ${prefix}menu`);
  return l.join("\n");
}

// Satu submenu lengkap dengan deskripsi
export function buildSub(section, sub, prefix) {
  const l = [`*${section.label.toUpperCase()}*`, `*${sub.label}* (${sub.items.length})`, RULE, ""];
  sub.items.forEach((i, idx) => {
    l.push(`${idx + 1}. ${prefix}${i.name}${i.flags}`);
    if (i.desc) l.push(`   ${i.desc}`);
  });
  l.push("");
  l.push(`Kembali: ${prefix}menu ${section.key}`);
  return l.join("\n");
}

// Seluruh perintah, dipecah menjadi beberapa pesan
export function buildAllChunks(structure, prefix, limit = 3500) {
  const blocks = [];
  for (const s of structure) {
    let b = `*${s.label.toUpperCase()}*\n${RULE}\n`;
    for (const sub of s.subs) {
      b += `\n*${sub.label}* (${sub.items.length})\n${sub.items.map((i) => `${prefix}${i.name}`).join(" ")}\n`;
    }
    blocks.push(b);
  }
  const chunks = [];
  let cur = "*NAZE BOT - SEMUA PERINTAH*\n";
  for (const b of blocks) {
    if (cur.length + b.length > limit && cur.trim()) {
      chunks.push(cur.trimEnd());
      cur = "";
    }
    if (b.length > limit) {
      // bagi berdasarkan submenu jika satu section terlalu panjang
      const parts = b.split(/\n(?=\*[^*\n]+\* \()/);
      for (const part of parts) {
        if (cur.length + part.length > limit && cur.trim()) {
          chunks.push(cur.trimEnd());
          cur = "";
        }
        cur += part + "\n";
      }
    } else cur += b;
  }
  if (cur.trim()) c
hunks.push(cur.trimEnd());
  return chunks;
}
