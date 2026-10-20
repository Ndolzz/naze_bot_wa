// Utilitas dan templat pesan untuk sistem pengelolaan file NAZE.
// Modul ini sengaja tanpa import apa pun agar logika intinya dapat diuji
// secara terisolasi (lihat tests/file-management.test.js).

const DEFAULT_FILE_LIMITS = {
  maxSizePerFile: 50 * 1024 * 1024,
  maxFiles: 20,
  maxTotalSize: 200 * 1024 * 1024,
  sessionTimeoutMinutes: 15,
  qrMaxTextBytes: 1000,
};

const SESSION_LABELS = {
  pdf: "PDF Creator",
  zip: "ZIP Archive",
};

const TOTXT_LAST_TEXT_TTL_MS = 10 * 60 * 1000;

const BOT_TITLE = "*\uFF2E\uFF21\uFF3A\uFF25*";

const REJECT_REASONS = {
  unsupported: (sessionType) =>
    sessionType === "pdf"
      ? "hanya foto dan file TXT yang didukung untuk proses PDF"
      : "jenis berkas ini tidak didukung untuk proses ini",
  maxsize: () => "ukuran berkas melebihi batas maksimal per berkas",
  maxfiles: () => "jumlah berkas sudah mencapai batas maksimal sesi",
  maxtotal: () => "total ukuran berkas sudah mencapai batas maksimal sesi",
  download: () => "berkas gagal diunduh, silakan kirim ulang",
  empty: () => "berkas kosong atau tidak dapat dibaca",
  store: () => "berkas gagal disimpan, silakan kirim ulang",
};

function resolveLimits(overrides = {}) {
  const merged = { ...DEFAULT_FILE_LIMITS };
  for (const key of Object.keys(DEFAULT_FILE_LIMITS)) {
    const value = Number(overrides?.[key]);
    if (Number.isFinite(value) && value > 0) merged[key] = value;
  }
  return merged;
}

function sanitizeFileName(name, fallback = "berkas") {
  let base = String(name || "").split(/[\\/]/).pop() || "";
  base = base.replace(/[\u0000-\u001f\u007f]/g, "");
  base = base.replace(/"/g, "'");
  base = base.replace(/\.{3,}/g, ".");
  base = base.replace(/\s+/g, " ").trim();
  base = base.replace(/^[. ]+/, "");
  if (base === "") base = fallback;
  if (base.length > 100) {
    const cut = base.slice(0, 100);
    const dot = cut.lastIndexOf(".");
    base = dot > 20 ? cut.slice(0, dot) : cut;
  }
  return base;
}

function validateOutputName(raw) {
  const name = String(raw || "").trim().replace(/\s+/g, " ");
  if (!name) return { valid: false, reason: "empty" };
  if (name.length > 64) return { valid: false, reason: "length" };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 _\-]*$/.test(name)) {
    return { valid: false, reason: "charset" };
  }
  return { valid: true, name };
}

function uniqueFileName(existingNames, desired) {
  const used = new Set(existingNames.map((n) => String(n).toLowerCase()));
  if (!used.has(desired.toLowerCase())) return desired;
  const dot = desired.lastIndexOf(".");
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : "";
  for (let i = 2; i <= 999; i += 1) {
    const candidate = stem + " (" + i + ")" + ext;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return stem + "-" + Date.now() + ext;
}

function extFromMime(mimetype) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/amr": "amr",
    "audio/opus": "ogg",
  };
  const base = String(mimetype || "").split(";")[0].trim().toLowerCase();
  return map[base] || "bin";
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  const mb = value / (1024 * 1024);
  const kb = value / 1024;
  if (mb >= 1) return (Number.isInteger(mb) ? mb : Number(mb.toFixed(1))) + " MB";
  if (kb >= 1) return (Number.isInteger(kb) ? kb : Number(kb.toFixed(1))) + " KB";
  return value + " B";
}

// Inti status sesi: Map berbasis pengirim dan percakapan, dengan jam yang
// dapat disuntikkan agar kedaluwarsa dapat diuji secara deterministik.
function createSessionCore({ now = () => Date.now(), limits = resolveLimits() } = {}) {
  const sessions = new Map();

  function sessionKey(sender, chat) {
    return String(sender) + "|" + String(chat);
  }

  function sweepExpired() {
    const expired = [];
    for (const [key, session] of sessions) {
      if (now() > session.expiresAt) {
        sessions.delete(key);
        expired.push(session);
      }
    }
    return expired;
  }

  function get(sender, chat) {
    sweepExpired();
    return sessions.get(sessionKey(sender, chat)) || null;
  }

  function touch(session) {
    session.expiresAt = now() + limits.sessionTimeoutMinutes * 60 * 1000;
  }

  function start(sender, chat, type) {
    sweepExpired();
    if (!SESSION_LABELS[type]) return { ok: false, error: "unknown-type" };
    const key = sessionKey(sender, chat);
    const existing = sessions.get(key);
    if (existing) {
      if (existing.type === type) {
        touch(existing);
        return { ok: true, session: existing, resumed: true };
      }
      return { ok: false, error: "conflict", session: existing };
    }
    const session = {
      key,
      sender: String(sender),
      chat: String(chat),
      type,
      label: SESSION_LABELS[type],
      files: [],
      failedCount: 0,
      createdAt: now(),
      expiresAt: now() + limits.sessionTimeoutMinutes * 60 * 1000,
      busy: false,
    };
    sessions.set(key, session);
    return { ok: true, session, resumed: false };
  }

  function checkNewFile(session, size) {
    if (session.files.length >= limits.maxFiles) {
      return { ok: false, error: "maxfiles" };
    }
    if (Number(size) > limits.maxSizePerFile) {
      return { ok: false, error: "maxsize" };
    }
    const total =
      session.files.reduce((sum, file) => sum + file.size, 0) + Number(size || 0);
    if (total > limits.maxTotalSize) {
      return { ok: false, error: "maxtotal" };
    }
    return { ok: true };
  }

  function addFile(session, info) {
    touch(session);
    session.files.push(info);
  }

  function remove(sender, chat) {
    const key = sessionKey(sender, chat);
    const session = sessions.get(key);
    if (session) sessions.delete(key);
    return session || null;
  }

  function summary(session) {
    return {
      type: session.type,
      label: session.label,
      received: session.files.length,
      failed: session.failedCount,
      totalBytes: session.files.reduce((sum, file) => sum + file.size, 0),
      names: session.files.map((file) => file.entryName),
      busy: session.busy,
    };
  }

  return {
    sessions,
    sessionKey,
    sweepExpired,
    get,
    touch,
    start,
    checkNewFile,
    addFile,
    remove,
    summary,
    limits,
  };
}

// Memilih teks sumber untuk .totxt dengan prioritas:
// pesan yang dibalas, lalu argumen perintah, lalu teks terakhir pengguna.
function pickTotxtSource(message, lastTextEntry, nowMs) {
  const quotedBody = message?.quoted?.body;
  if (typeof quotedBody === "string" && quotedBody.trim() !== "") {
    return quotedBody;
  }
  const inlineText = message?.text;
  if (typeof inlineText === "string" && inlineText.trim() !== "") {
    return inlineText;
  }
  if (
    lastTextEntry &&
    typeof lastTextEntry.text === "string" &&
    lastTextEntry.text.trim() !== ""
  ) {
    const at = Number(lastTextEntry.at) || 0;
    if (!nowMs || nowMs - at <= TOTXT_LAST_TEXT_TTL_MS) return lastTextEntry.text;
  }
  return null;
}

function messageHeader(subtitle) {
  return subtitle ? BOT_TITLE + "\n\n*" + subtitle + "*" : BOT_TITLE;
}

function sessionStartMessage(type) {
  if (type === "pdf") {
    return [
      messageHeader("PDF CREATOR"),
      "",
      "Sesi pengumpulan berkas PDF dimulai.",
      "",
      "Kirim foto atau file TXT satu per satu. Setiap berkas yang diterima akan dicatat.",
      "",
      "Format yang didukung: foto, file TXT.",
      "Format yang tidak didukung: video, audio, stiker, dan dokumen lain.",
      "",
      'Kirim ".statusfile" untuk melihat jumlah berkas.',
      "",
      "Setelah semua berkas terkirim, kirim nama output diawali titik.",
      "Contoh: .tugasbahasainggris",
      "",
      'Hasil akan dikirim sebagai "tugasbahasainggris.pdf".',
      "",
      'Kirim ".batal" untuk membatalkan sesi.',
    ].join("\n");
  }
  if (type === "zip") {
    return [
      messageHeader("ZIP ARCHIVE"),
      "",
      "Sesi pengumpulan berkas ZIP dimulai.",
      "",
      "Kirim foto, video, audio, pesan suara, atau dokumen satu per satu. Isi asli setiap berkas dipertahankan.",
      "",
      'Kirim ".statusfile" untuk melihat jumlah berkas.',
      "",
      "Setelah semua berkas terkirim, kirim nama output diawali titik.",
      "Contoh: .tugasakhir",
      "",
      'Hasil akan dikirim sebagai "tugasakhir.zip".',
      "",
      'Kirim ".batal" untuk membatalkan sesi.',
    ].join("\n");
  }
  return messageHeader();
}

function resumedSessionMessage(label) {
  return [
    messageHeader(),
    "",
    "Sesi " + label + " sedang berjalan.",
    "",
    "Kirim berkas lanjutan, atau nama output untuk menyelesaikan.",
    "",
    'Kirim ".statusfile" untuk status, atau ".batal" untuk membatalkan.',
  ].join("\n");
}

function sessionConflictMessage(label) {
  return [
    messageHeader(),
    "",
    "Sesi " + label + " sedang berjalan sehingga proses baru tidak dapat dimulai.",
    "",
    'Kirim ".batal" untuk mengakhiri sesi tersebut, lalu coba lagi.',
  ].join("\n");
}

function fileAcceptedMessage(entryName, total) {
  return [
    messageHeader(),
    "",
    'Berkas diterima: "' + entryName + '"',
    "",
    "Total berkas: " + total,
    "",
    'Kirim berkas berikutnya, ".statusfile" untuk status, atau nama output untuk menyelesaikan.',
  ].join("\n");
}

function fileRejectedMessage(name, reason) {
  return [
    messageHeader(),
    "",
    'Berkas ditolak: "' + name + '"',
    "",
    "Alasan: " + reason + ".",
  ].join("\n");
}

function statusMessage(summary) {
  const lines = [
    messageHeader("STATUS PROSES"),
    "",
    "Jenis proses: " + summary.label,
    "",
    "Berkas diterima: " + summary.received,
    "",
    "Berkas gagal diterima: " + summary.failed,
    "",
    "Daftar berkas:",
  ];
  if (summary.names.length === 0) {
    lines.push("Belum ada berkas yang diterima.");
  } else {
    summary.names.forEach((name, index) => lines.push((index + 1) + ". " + name));
  }
  lines.push(
    "",
    "Status: " + (summary.busy
      ? "sedang memproses berkas"
      : summary.received === 0
        ? "menunggu berkas pertama"
        : "menunggu berkas berikutnya"),
    "",
    "Kirim berkas tambahan, atau kirim nama output untuk menyelesaikan.",
  );
  return lines.join("\n");
}

function noSessionMessage() {
  return [
    messageHeader("STATUS PROSES"),
    "",
    "Tidak ada proses pengumpulan berkas yang sedang berjalan.",
    "",
    'Gunakan ".topdf" atau ".tozip" untuk memulai proses baru.',
  ].join("\n");
}

function cancelMessage(label) {
  return [
    messageHeader("PROSES DIBATALKAN"),
    "",
    "Sesi " + label + " dibatalkan.",
    "",
    "Berkas sementara sudah dibersihkan.",
  ].join("\n");
}

function cancelNoSessionMessage() {
  return [
    messageHeader(),
    "",
    "Tidak ada proses yang sedang berjalan sehingga tidak ada yang perlu dibatalkan.",
  ].join("\n");
}

function invalidNameMessage(raw) {
  const shown = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 40);
  return [
    messageHeader("KESALAHAN NAMA OUTPUT"),
    "",
    'Nama "' + shown + '" tidak valid.',
    "",
    "Nama output hanya boleh memuat huruf, angka, spasi, garis bawah, dan tanda hubung.",
    "",
    "Panjang nama maksimal 64 karakter dan harus diawali huruf atau angka.",
    "",
    "Contoh penulisan: .tugasbahasainggris",
  ].join("\n");
}

function noFilesToFinishMessage(label) {
  return [
    messageHeader(),
    "",
    "Belum ada berkas yang diterima pada sesi " + label + ".",
    "",
    'Kirim berkas terlebih dahulu, atau kirim ".batal" untuk membatalkan.',
  ].join("\n");
}

function appendFailureNotes(lines, failedFiles, failedReceived) {
  if (Array.isArray(failedFiles) && failedFiles.length > 0) {
    lines.push("", "Berkas gagal diproses: " + failedFiles.length);
    failedFiles.forEach((item, index) => lines.push((index + 1) + ". " + item));
  }
  if (Number(failedReceived) > 0) {
    lines.push(
      "",
      "Catatan: " + failedReceived + " berkas ditolak saat pengumpulan dan tidak dimasukkan."
    );
  }
}

function finishedPdfMessage(fileName, pageCount, failedFiles, failedReceived) {
  const lines = [
    messageHeader("PROSES SELESAI"),
    "",
    "File PDF berhasil dibuat.",
    "",
    'Nama file: "' + fileName + '"',
    "",
    "Jumlah halaman: " + pageCount,
    "",
    "Berkas dikirim sebagai lampiran pada pesan berikutnya.",
  ];
  appendFailureNotes(lines, failedFiles, failedReceived);
  return lines.join("\n");
}

function finishedZipMessage(fileName, included, failedFiles, failedReceived) {
  const lines = [
    messageHeader("PROSES SELESAI"),
    "",
    "File ZIP berhasil dibuat.",
    "",
    'Nama file: "' + fileName + '"',
    "",
    "Berkas dimasukkan: " + included,
    "",
    "Berkas dikirim sebagai lampiran pada pesan berikutnya.",
  ];
  appendFailureNotes(lines, failedFiles, failedReceived);
  return lines.join("\n");
}

function processFailedMessage(reason) {
  return [
    messageHeader("KESALAHAN PROSES"),
    "",
    "Proses gagal: " + String(reason || "kesalahan tidak diketahui"),
    "",
    "Sesi diakhiri dan berkas sementara sudah dibersihkan.",
    "",
    'Silakan mulai ulang dengan ".topdf" atau ".tozip".',
  ].join("\n");
}

function totxtGuideMessage() {
  return [
    messageHeader("TXT GENERATOR"),
    "",
    "Teks sumber tidak ditemukan atau kosong.",
    "",
    "Cara pakai:",
    "",
    '1. Balas pesan teks yang ingin disimpan dengan ".totxt".',
    "",
    '2. Atau kirim ".totxt" diikuti teksnya.',
    "",
    "Contoh: .totxt Nama saya Nendi",
  ].join("\n");
}

function totxtDoneMessage() {
  return [
    messageHeader("PROSES SELESAI"),
    "",
    "File TXT berhasil dibuat.",
    "",
    'Nama file: "hasil.txt"',
    "",
    "Berkas dikirim sebagai lampiran pada pesan berikutnya.",
  ].join("\n");
}

function busyMessage() {
  return [
    messageHeader(),
    "",
    "Proses sedang berjalan. Mohon tunggu hingga selesai sebelum mengirim berkas baru.",
  ].join("\n");
}

function qrGuideMessage(maxBytes = DEFAULT_FILE_LIMITS.qrMaxTextBytes) {
  return [
    messageHeader("QR GENERATOR"),
    "",
    "Teks sumber tidak ditemukan atau kosong.",
    "",
    "Cara pakai:",
    "",
    '1. Balas pesan teks yang ingin diubah dengan ".toqr".',
    "",
    '2. Atau kirim ".toqr" diikuti teksnya.',
    "",
    "Contoh: .toqr https://contoh.com",
    "",
    "Kapasitas: maksimal " + maxBytes + " karakter teks per kode QR.",
    "",
    "Catatan: foto, video, audio, dan dokumen tidak dapat diubah menjadi kode QR karena kapasitas kode QR hanya cukup untuk teks.",
  ].join("\n");
}

function qrMediaUnsupportedMessage(mediaName, maxBytes = DEFAULT_FILE_LIMITS.qrMaxTextBytes) {
  return [
    messageHeader("QR GENERATOR"),
    "",
    'Berkas "' + mediaName + '" tidak dapat diubah menjadi kode QR.',
    "",
    "Kode QR hanya dapat menampung teks dengan panjang maksimal " + maxBytes + " karakter, sehingga media tidak memenuhi ketentuan tersebut.",
    "",
    'Solusi: kirim ".toqr" diikuti teks atau tautan yang ingin dibagikan.',
    "",
    "Contoh: .toqr https://contoh.com",
  ].join("\n");
}

function qrTooLongMessage(sizeBytes, maxBytes = DEFAULT_FILE_LIMITS.qrMaxTextBytes) {
  return [
    messageHeader("KESALAHAN PROSES"),
    "",
    "Teks terlalu panjang untuk diubah menjadi kode QR.",
    "",
    "Panjang teks: " + sizeBytes + " karakter.",
    "",
    "Batas maksimal: " + maxBytes + " karakter.",
    "",
    'Persingkat teksnya, lalu kirim ulang perintah ".toqr".',
  ].join("\n");
}

function qrDoneMessage(charCount) {
  return [
    messageHeader("PROSES SELESAI"),
    "",
    "Kode QR berhasil dibuat.",
    "",
    "Panjang teks: " + charCount + " karakter.",
    "",
    "Kode dikirim sebagai gambar pada pesan berikutnya.",
    "",
    "Pindai kode tersebut dengan aplikasi pemindai QR.",
  ].join("\n");
}

function menuText(withHeader = true) {
  const header = withHeader ? [messageHeader(), ""] : [];
  return [
    ...header,
    "*FILE MANAGEMENT*",
    "",
    "1. TXT Generator",
    '   Perintah: ".totxt"',
    "   Fungsi: mengubah teks menjadi file TXT",
    '   Cara pakai: balas pesan teks dengan ".totxt", atau kirim ".totxt" diikuti teksnya',
    "",
    "2. PDF Creator",
    '   Perintah: ".topdf"',
    "   Fungsi: menggabungkan foto dan file TXT menjadi satu PDF",
    "   Cara pakai: mulai sesi, kirim berkas satu per satu, tutup dengan nama output",
    "",
    "3. ZIP Archive",
    '   Perintah: ".tozip"',
    "   Fungsi: mengemas berbagai berkas menjadi satu ZIP",
    "   Cara pakai: mulai sesi, kirim berkas satu per satu, tutup dengan nama output",
    "",
    "4. QR Generator",
    '   Perintah: ".toqr"',
    "   Fungsi: mengubah teks menjadi gambar kode QR",
    '   Cara pakai: balas pesan teks dengan ".toqr", atau kirim ".toqr" diikuti teksnya',
    "",
    "*PROCESS CONTROL*",
    "",
    "1. Status Proses",
    '   Perintah: ".statusfile"',
    "   Fungsi: menampilkan status sesi pengumpulan berkas",
    "   Cara pakai: kirim saat sesi berjalan",
    "",
    "2. Batalkan Proses",
    '   Perintah: ".batal"',
    "   Fungsi: menghentikan sesi dan membersihkan berkas sementara",
    "   Cara pakai: kirim saat sesi berjalan",
    "",
    "*HELP CENTER*",
    "",
    "1. Menu Utama",
    '   Perintah: ".menu"',
    "   Fungsi: menampilkan menu utama NAZE",
    '   Cara pakai: kirim ".menu"',
    "",
    "2. Panduan Penggunaan",
    '   Perintah: ".filehelp"',
    "   Fungsi: menampilkan panduan lengkap pengelolaan file",
    '   Cara pakai: kirim ".filehelp"',
  ].join("\n");
}

function fileHelpText(limits = DEFAULT_FILE_LIMITS) {
  return [
    messageHeader("PANDUAN PENGGUNAAN"),
    "",
    "Fitur pengelolaan file NAZE terdiri atas TXT Generator, PDF Creator, ZIP Archive, dan QR Generator.",
    "",
    "1. TXT Generator",
    "",
    'Perintah: ".totxt"',
    "",
    "Fungsi: mengubah teks menjadi file TXT.",
    "",
    "Langkah:",
    'a. Kirim pesan teks yang ingin disimpan, lalu balas pesan itu dengan ".totxt".',
    'b. Atau langsung kirim ".totxt" diikuti teksnya.',
    "",
    "Contoh: .totxt Nama saya Nendi",
    "",
    'Hasil: bot mengirim "hasil.txt" yang isinya sama dengan teks sumber.',
    "",
    "2. PDF Creator",
    "",
    'Perintah: ".topdf"',
    "",
    "Fungsi: menggabungkan foto dan file TXT menjadi satu dokumen PDF.",
    "",
    "Langkah:",
    'a. Kirim ".topdf" untuk memulai sesi.',
    "b. Kirim foto atau file TXT satu per satu. Setiap berkas yang diterima akan dicatat.",
    'c. Kirim ".statusfile" kapan saja untuk melihat jumlah berkas.',
    "d. Setelah semua berkas terkirim, kirim nama output diawali titik.",
    "   Contoh: .tugasbahasainggris",
    'e. Bot membuat dan mengirim "tugasbahasainggris.pdf".',
    "",
    "Urutan halaman PDF mengikuti urutan berkas yang diterima.",
    "",
    "Format yang didukung: foto, file TXT.",
    "Format yang tidak didukung: video, audio, stiker, dan dokumen lain akan ditolak dengan pesan yang jelas.",
    "",
    "3. ZIP Archive",
    "",
    'Perintah: ".tozip"',
    "",
    "Fungsi: mengemas beberapa berkas menjadi satu arsip ZIP tanpa mengubah isi aslinya.",
    "",
    "Langkah:",
    'a. Kirim ".tozip" untuk memulai sesi.',
    "b. Kirim foto, video, audio, pesan suara, atau dokumen satu per satu.",
    'c. Kirim ".statusfile" untuk memeriksa progres.',
    "d. Kirim nama output diawali titik.",
    "   Contoh: .tugasakhir",
    'e. Bot membuat dan mengirim "tugasakhir.zip".',
    "",
    "Batas: maksimal " + limits.maxFiles + " berkas per sesi, " +
    formatBytes(limits.maxSizePerFile) + " per berkas, " +
    formatBytes(limits.maxTotalSize) + " total per sesi, dan sesi berakhir setelah " +
    limits.sessionTimeoutMinutes + " menit tidak aktif.",
    "",
    "4. QR Generator",
    "",
    'Perintah: ".toqr"',
    "",
    "Fungsi: mengubah teks menjadi gambar kode QR yang dapat dipindai.",
    "",
    "Langkah:",
    'a. Balas pesan teks yang ingin diubah dengan ".toqr".',
    'b. Atau kirim ".toqr" diikuti teksnya.',
    "",
    "Contoh: .toqr https://contoh.com",
    "",
    'Hasil: bot mengirim gambar kode QR pada pesan berikutnya.',
    "",
    "Kapasitas: maksimal " + limits.qrMaxTextBytes + " karakter teks per kode QR.",
    "",
    "Foto, video, audio, dan dokumen tidak dapat diubah menjadi kode QR karena kapasitas kode QR hanya cukup untuk teks.",
    "",
    "Pengendalian proses:",
    "",
    '".statusfile" menampilkan jenis proses, jumlah berkas, daftar berkas, dan langkah selanjutnya.',
    "",
    '".batal" menghentikan sesi yang sedang berjalan dan membersihkan berkas sementara.',
    "",
    "Catatan nama output:",
    "",
    "Nama output hanya boleh memuat huruf, angka, spasi, garis bawah, dan tanda hubung, dengan panjang maksimal 64 karakter.",
    "",
    "Penamaan dengan titik hanya berlaku saat sesi pengumpulan sedang aktif.",
    "",
    'Kirim ".menu" untuk melihat daftar fitur.',
  ].join("\n");
}

export {
  DEFAULT_FILE_LIMITS,
  SESSION_LABELS,
  TOTXT_LAST_TEXT_TTL_MS,
  BOT_TITLE,
  REJECT_REASONS,
  resolveLimits,
  sanitizeFileName,
  validateOutputName,
  uniqueFileName,
  extFromMime,
  formatBytes,
  createSessionCore,
  pickTotxtSource,
  messageHeader,
  sessionStartMessage,
  resumedSessionMessage,
  sessionConflictMessage,
  fileAcceptedMessage,
  fileRejectedMessage,
  statusMessage,
  noSessionMessage,
  cancelMessage,
  cancelNoSessionMessage,
  invalidNameMessage,
  noFilesToFinishMessage,
  finishedPdfMessage,
  finishedZipMessage,
  processFailedMessage,
  totxtGuideMessage,
  totxtDoneMessage,
  busyMessage,
  qrGuideMessage,
  qrMediaUnsupportedMessage,
  qrTooLongMessage,
  qrDoneMessage,
  menuText,
  fileHelpText,
};

