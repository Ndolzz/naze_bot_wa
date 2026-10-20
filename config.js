import fs from "fs";
import { getDatabase } from "./src/lib/naze-database.js";
import * as ownerPremiumDb from "./src/lib/naze-premium-db.js";

// Muat file .env (jika ada) tanpa dependency tambahan.
// Nilai yang sudah ada di environment server/panel tidak ditimpa.
function loadEnvFile(file = ".env") {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      if (!(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnvFile();
const env = (key) => process.env[key] || "";

const config = {
  info: {
    website: "",
    grupwa: "",
  },

  owner: {
    name: "Nendi", // Nama owner
    number: ["6281936694946"], // Format: 628xxx (tanpa + atau 0)
  },

  session: {
    pairingNumber: "6281936694946", // Nomor WA yang akan di-pair
    usePairingCode: true, // true = Pairing Code, false = QR Code
  },

  bot: {
    name: "NAZE", // Nama bot
    version: "3.8.0", // Versi bot
    developer: "Nendi", // Nama developer
  },

  assets: {
    "naze-logo": "./assets/image/naze-logo.jpg",
    "naze": "./assets/image/naze-logo-square.jpg",
    "naze-daftar": "./assets/image/naze-daftar.png",
    "naze-demote": "./assets/image/naze-demote.png",
    "naze-promote": "./assets/image/naze-promote.png",
    "naze-levelup": "./assets/image/naze-levelup.jpg",
    "naze-winner": "./assets/image/naze-winner.jpg",
    "naze-rules": "./assets/image/naze-rules.jpg",
    "naze-games": "./assets/image/naze-games.jpg",
    "naze-fishit": "./assets/image/naze-fishit.jpg",
    "naze-minecraft": "./assets/image/naze-minecraft.jpg",
    "naze-kertas": "./assets/image/naze-kertas.jpg",
    "naze-font": "./assets/naze-font.ttf",
    "pp-kosong": "./assets/image/pp-kosong.jpg",
  },

  mode: "public",

  // Prefix perintah
  command: {
    prefix: ".",
  },

  // Batas sistem pengelolaan file (.totxt, .topdf, .tozip, .toqr)
  files: {
    maxSizePerFile: 52428800, // 50 MB per berkas
    maxFiles: 20, // jumlah berkas maksimal per sesi
    maxTotalSize: 209715200, // 200 MB total per sesi
    sessionTimeoutMinutes: 15, // sesi berakhir setelah tidak aktif selama ini
    qrMaxTextBytes: 1000, // panjang teks maksimal (UTF-8) untuk .toqr
  },

  vercel: {
    // Token Vercel untuk fitur .deploy (isi lewat environment: VERCEL_TOKEN)
    token: env("VERCEL_TOKEN"),
  },

  // Isi sendiri jika ingin menampilkan informasi donasi
  donasi: {
    payment: [],
    links: [],
    benefits: [
      "Mendukung pengembangan",
      "Server lebih stabil",
      "Pembaruan lebih cepat",
    ],
    qris: "",
  },

  energi: {
    enabled: true, // Jika true, sistem energi/limit bekerja
    default: 99999,
    premium: 99999999,
    owner: -1,
  },

  sticker: {
    packname: "NAZE", // Nama pack sticker
    author: "NAZE", // Author sticker
  },

  stickerStudio: {
    maxTextLength: 500, // panjang teks maksimal untuk .brat dan .bratvid
    maxMediaBytes: 31457280, // 30 MB ukuran maksimal media sumber stiker
    maxVideoSeconds: 10, // durasi video maksimal untuk .sticker
    bratvidDurationSeconds: 3, // durasi satu putaran animasi .bratvid
    bratvidFps: 10, // frame rate animasi .bratvid
    bratvidMaxBytes: 1048576, // 1 MB ukuran maksimal animated WebP
    gifMaxBytes: 15728640, // 15 MB ukuran maksimal hasil .togif
    store: {
      maxStickers: 100, // kapasitas koleksi stiker tersimpan
      maxStickerBytes: 1048576, // 1 MB ukuran maksimal per stiker tersimpan
    },
  },

  // Batas Sosmed Downloader (.tiktok, .instagram, .youtube, .mp3)
  downloader: {
    maxMediaBytes: 104857600, // 100 MB ukuran maksimal media yang diunduh
    maxDurationSeconds: 1800, // 30 menit durasi maksimal video sumber
    maxPhotosPerPost: 5, // foto maksimal per postingan foto/carousel
    mediaMessageMaxBytes: 67108864, // 64 MB batas kirim sebagai pesan media
    requestTimeoutMs: 30000, // batas waktu permintaan ke platform
    mp3BitrateKbps: 192, // bitrate MP3 bawaan
    mp3MinBitrateKbps: 128, // bitrate percobaan ulang bila hasil terlalu besar
    mp3MaxBytes: 52428800, // 50 MB ukuran maksimal hasil MP3
    audioMessageMaxBytes: 16777216, // 16 MB batas kirim sebagai pesan audio
  },

  saluran: {
    id: "", // ID saluran (contoh: 120363xxx@newsletter)
    name: "NAZE", // Nama saluran
    link: "", // Link saluran
  },

  groupProtection: {
    antilink: "*Antilink* - @%user% mengirim link.\nPesan dihapus.",
    antilinkKick: "*Antilink* - @%user% dikeluarkan karena mengirim link grup WhatsApp.\nPesan dihapus.",
    antilinkGc: "*Antilink WA* - @%user% mengirim link grup WhatsApp.\nPesan dihapus.",
    antilinkGcKick: "*Antilink WA* - @%user% dikeluarkan karena mengirim link grup WhatsApp.",
    antilinkAll: "*Antilink* - @%user% mengirim link.\nPesan dihapus.",
    antilinkAllKick: "*Antilink* - @%user% dikeluarkan karena mengirim link.\nPesan dihapus.",
    antitagsw: "*Anti Tag Status* - Tag status dari @%user% dihapus.",
    antiviewonce: "*View Once* - Dikirim oleh @%user%",
    antiremove: "*Anti Delete* - @%user% menghapus pesan:",
    antiswgc: "*Anti Status Grup* - Status grup dari @%user% tidak diizinkan.",
    antihidetag: "*Anti Hidetag* - Hidetag dari @%user% dihapus.",
    antitoxicWarn:
      "@%user% menggunakan kata tidak pantas.\nPeringatan %warn% dari %max%, pelanggaran berikutnya dikenai sanksi %method%.",
    antitoxicAction:
      "@%user% dikenai sanksi %method% karena kata tidak pantas. (%warn%/%max%)",
    antidocument: "*Anti Dokumen* - Dokumen dari @%user% dihapus.",
    antisticker: "*Anti Stiker* - Stiker dari @%user% dihapus.",
    antimedia: "*Anti Media* - Media dari @%user% dihapus.",
    antibot: "*Anti Bot* - @%user% terdeteksi sebagai bot dan dikeluarkan.",
    notAdmin: "Bot bukan admin sehingga tidak dapat menghapus pesan.",
  },

  errorTemplate: `Perintah \`{prefix}{command}\` sedang mengalami kendala.\nSilakan coba lagi nanti, {pushName}.\n\n_Jika masalah berlanjut, hubungi owner bot._`,

  features: {
    antiCall: false, // Jika true, bot menolak panggilan masuk
    blockIfCall: false, // Jika true, bot memblokir nomor yang menelepon bot
    autoTyping: true,
    autoRead: true,
    logMessage: true,
    dailyLimitReset: true,
    smartTriggers: false,
  },

  registration: {
    enabled: false, // Jika true, pengguna harus mendaftar sebelum memakai bot
    rewards: {
      koin: 30000,
      energi: 300,
      exp: 300000,
    },
  },

  welcome: { defaultEnabled: false },
  goodbye: { defaultEnabled: false },

  messages: {
    wait: "*Memproses...* Mohon tunggu sebentar.",
    success: "*Berhasil.* Permintaan kamu sudah selesai.",
    error: "*Terjadi kesalahan.* Silakan coba lagi nanti.",

    ownerOnly: "*Akses ditolak.* Fitur ini khusus owner bot.",
    premiumOnly:
      "*Khusus Premium.* Ketik *.benefitpremium* untuk info upgrade.",

    groupOnly: "*Khusus grup.* Fitur ini hanya dapat digunakan di dalam grup.",
    privateOnly:
      "*Khusus chat pribadi.* Fitur ini hanya dapat digunakan di chat pribadi dengan bot.",

    adminOnly:
      "*Khusus admin.* Kamu harus menjadi admin grup untuk memakai fitur ini.",
    botAdminOnly:
      "*Bot bukan admin.* Jadikan bot admin grup terlebih dahulu.",

    cooldown:
      "*Mohon tunggu.* Perintah ini sedang cooldown, coba lagi dalam %time% detik.",
    energiExceeded:
      "*Energi habis.* Tunggu reset harian atau upgrade ke Premium.",
    limitDeducted:
      "Limit berkurang sebanyak {amount}. Sisa limit: {sisa}",

    banned:
      "*Akses diblokir.* Kamu tidak dapat menggunakan bot ini karena melanggar aturan.",

    rejectCall: "Bot tidak menerima panggilan. Silakan kirim pesan teks.",
  },

  database: { path: "./database/main" },
  backup: { enabled: false, intervalHours: 24, retainDays: 7 },
  scheduler: { resetHour: 0, resetMinute: 0 },

  // Mode dev (aktif otomatis jika NODE_ENV=development)
  dev: {
    enabled: process.env.NODE_ENV === "development",
    watchPlugins: true, // Hot reload plugin
    watchSrc: false, // Dinonaktifkan: reload src memicu konflik koneksi 440
    debugLog: false, // Tampilkan stack trace
  },

  // API key layanan pihak ketiga. Isi lewat file .env atau environment panel
  // (lihat .env.example). Fitur yang bergantung pada layanan itu tidak akan
  // berjalan sampai key miliknya diisi.
  APIkey: {
    neoxr: env("APIKEY_NEOXR"),
    fgsi: env("APIKEY_FGSI"),
    covenant: env("APIKEY_COVENANT"),
    obscura: env("APIKEY_OBSCURA"),
    firefly: env("APIKEY_FIREFLY"),
    cuki: env("APIKEY_CUKI"),
    termai: env("APIKEY_TERMAI"),
    tenor: env("APIKEY_TENOR"),
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function isOwner(number) {
  if (!number) return false;
  const cleanNumber = number.split(":")[0].replace(/[^0-9]/g, "");
  if (!cleanNumber) return false;

  if (config.bot?.number) {
    const botNum = config.bot.number.replace(/[^0-9]/g, "");
    if (
      botNum &&
      (cleanNumber.includes(botNum) || botNum.includes(cleanNumber))
    )
      return true;
  }

  try {
    const db = getDatabase();

    if (config.owner?.number) {
      const match = config.owner.number.some((own) => {
        const c = own.replace(/[^0-9]/g, "");
        return (
          c &&
          (cleanNumber === c ||
            cleanNumber.endsWith(c) ||
            c.endsWith(cleanNumber))
        );
      });
      if (match) return true;
    }

    if (db?.data && Array.isArray(db.data.owner)) {
      const match = db.data.owner.some((own) => {
        const c = String(own).replace(/[^0-9]/g, "");
        return (
          c &&
          (cleanNumber === c ||
            cleanNumber.endsWith(c) ||
            c.endsWith(cleanNumber))
        );
      });
      if (match) return true;
    }
    if (db) {
      const definedOwner = db.setting("ownerNumbers");
      if (Array.isArray(definedOwner)) {
        const match = definedOwner.some((own) => {
          const c = String(own).replace(/[^0-9]/g, "");
          return (
            c &&
            (cleanNumber === c ||
              cleanNumber.endsWith(c) ||
              c.endsWith(cleanNumber))
          );
        });
        if (match) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function isPremium(number) {
  if (!number) return false;
  if (isOwner(number)) return true;
  if (isPartner(number)) return true;

  const cleanNumber = number
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");
  const premiumList = config.premiumUsers || [];

  const inConfig = premiumList.some((premium) => {
    if (!premium) return false;
    const cleanPremium = premium
      .split(":")[0]
      .split("@")[0]
      .replace(/[^0-9]/g, "");
    return (
      cleanNumber === cleanPremium ||
      cleanNumber.endsWith(cleanPremium) ||
      cleanPremium.endsWith(cleanNumber)
    );
  });

  if (inConfig) return true;

  try {
    if (ownerPremiumDb && ownerPremiumDb.isPremium(cleanNumber)) return true;
  } catch { }

  try {
    const db = getDatabase();
    if (db && db.data && Array.isArray(db.data.premium)) {
      const now = Date.now();
      const foundIndex = db.data.premium.findIndex((p) => {
        if (typeof p === "string") return p === cleanNumber;
        if (p.id) return p.id === cleanNumber;
        return false;
      });

      if (foundIndex !== -1) {
        const found = db.data.premium[foundIndex];
        if (typeof found === "string") return true;

        const expireTime =
          found.expired ||
          (found.expiredAt ? new Date(found.expiredAt).getTime() : 0);
        if (expireTime && expireTime < now) {
          db.data.premium.splice(foundIndex, 1);
          const jid = cleanNumber + "@s.whatsapp.net";
          const user = db.getUser(jid);
          if (user) {
            user.isPremium = false;
            db.setUser(jid, user);
          }
          db.save();
          return false;
        }
        return true;
      }
    }
    if (db) {
      const savedPremium = db.setting("premiumUsers") || [];
      const inDb = savedPremium.some((premium) => {
        if (!premium) return false;
        const cleanPremium = premium
          .split(":")[0]
          .split("@")[0]
          .replace(/[^0-9]/g, "");
        return (
          cleanNumber === cleanPremium ||
          cleanNumber.endsWith(cleanPremium) ||
          cleanPremium.endsWith(cleanNumber)
        );
      });
      if (inDb) return true;
    }
  } catch { }

  return false;
}

function isPartner(number) {
  if (!number) return false;
  if (isOwner(number)) return true;

  const cleanNumber = number
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");
  const partnerList = config.partnerUsers || [];

  const inConfig = partnerList.some((partner) => {
    if (!partner) return false;
    const cleanPartner = partner
      .split(":")[0]
      .split("@")[0]
      .replace(/[^0-9]/g, "");
    return (
      cleanNumber === cleanPartner ||
      cleanNumber.endsWith(cleanPartner) ||
      cleanPartner.endsWith(cleanNumber)
    );
  });

  if (inConfig) return true;

  try {
    if (ownerPremiumDb && ownerPremiumDb.isPartner(cleanNumber)) return true;
  } catch { }

  try {
    const db = getDatabase();
    if (db && db.data && Array.isArray(db.data.partner)) {
      const now = Date.now();
      const foundIndex = db.data.partner.findIndex((p) => {
        if (typeof p === "string") return p === cleanNumber;
        if (p.id) return p.id === cleanNumber;
        return false;
      });

      if (foundIndex !== -1) {
        const found = db.data.partner[foundIndex];
        if (typeof found === "string") return true;

        const expireTime =
          found.expired ||
          (found.expiredAt ? new Date(found.expiredAt).getTime() : 0);
        if (expireTime && expireTime < now) {
          db.data.partner.splice(foundIndex, 1);
          const jid = cleanNumber + "@s.whatsapp.net";
          const user = db.getUser(jid);
          if (user) {
            user.isPartner = false;
            db.setUser(jid, user);
          }
          db.save();
          return false;
        }
        return true;
      }
    }
  } catch { }

  return false;
}

function isBanned(number) {
  if (!number) return false;
  if (isOwner(number)) return false;

  const cleanNumber = number
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");

  let bannedList = [];
  try {
    const db = getDatabase();
    if (db) {
      bannedList = db.setting("bannedUsers") || [];
      config.bannedUsers = bannedList;
    }
  } catch { }

  return bannedList.some((banned) => {
    const cleanBanned = String(banned)
      .split(":")[0]
      .split("@")[0]
      .replace(/[^0-9]/g, "");
    return (
      cleanNumber === cleanBanned ||
      cleanNumber.endsWith(cleanBanned) ||
      cleanBanned.endsWith(cleanNumber)
    );
  });
}

function setBotNumber(number) {
  if (number) config.bot.number = number.replace(/[^0-9]/g, "");
}

function isSelf(number) {
  if (!number || !config.bot.number) return false;
  const cleanNumber = number.replace(/[^0-9]/g, "");
  const botNumber = config.bot.number.replace(/[^0-9]/g, "");
  return cleanNumber.includes(botNumber) || botNumber.includes(cleanNumber);
}

function getOwnerName(number) {
  if (!number) return config.owner?.name || "Owner";
  const cleanNumber = String(number).replace(/[^0-9]/g, "");
  try {
    const db = getDatabase();
    const nameMap = db.setting("ownerNames") || {};
    if (nameMap[cleanNumber]) return nameMap[cleanNumber];
  } catch { }
  if (config.owner?.number) {
    const isMainOwner = config.owner.number.some((own) => {
      const c = own.replace(/[^0-9]/g, "");
      return (
        c &&
        (cleanNumber === c ||
          cleanNumber.endsWith(c) ||
          c.endsWith(cleanNumber))
      );
    });
    if (isMainOwner) return config.owner?.name || "Owner";
  }
  return "Owner";
}

function getConfig() {
  return config;
}

config.isOwner = isOwner;
config.isPremium = isPremium;
config.isPartner = isPartner;
config.isBanned = isBanned;
config.setBotNumber = setBotNumber;
config.isSelf = isSelf;
config.getOwnerName = getOwnerName;

export default config;
export {
  config,
  getConfig,
  isOwner,
  isPartner,
  isPremium,
  isBanned,
  setBotNumber,
  isSelf,
  getOwnerName,
};
