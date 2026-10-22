// Utilitas murni untuk fitur pencarian lagu NAZE.
// Tidak mengimpor modul lain agar pembacaan argumen dan pemilihan hasil
// pencarian dapat diuji tanpa yt-search maupun lingkungan WhatsApp.

export const VALID_SONG_QUALITIES = ["92", "128", "256", "320"];

// Jendela durasi lagu yang wajar: 1 sampai 10 menit. Hasil di luar jendela
// (cuplikan pendek, mix satu jam, siaran langsung) hanya dipakai bila
// tidak ada kandidat lain sama sekali.
export const MIN_SONG_SECONDS = 60;
export const MAX_SONG_SECONDS = 600;

// Membaca argumen ".lagu <judul lagu> [kualitas]".
// Kualitas bersifat opsional: 92, 128, 256, atau 320 kbps; bawaan 128.
export function parseSongArgs(text) {
  const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, reason: "empty" };

  let quality = "128";
  const last = parts[parts.length - 1];
  if (VALID_SONG_QUALITIES.indexOf(last) >= 0) {
    quality = last;
    parts.pop();
  }

  const query = parts.join(" ").trim();
  if (!query) return { ok: false, reason: "empty" };

  return { ok: true, query, quality };
}

// Memilih kandidat terbaik dari hasil pencarian: video pertama dengan
// tautan dan durasi 1-10 menit; bila tidak ada, video pertama yang
// memiliki tautan. Mengembalikan null bila tidak ada kandidat sama sekali.
export function pickSongFromResults(videos) {
  const list = Array.isArray(videos) ? videos : [];
  let fallback = null;
  for (const video of list) {
    if (!video || !video.url) continue;
    if (!fallback) fallback = video;
    const seconds = video.duration && video.duration.seconds;
    if (
      typeof seconds === "number" &&
      seconds >= MIN_SONG_SECONDS &&
      seconds <= MAX_SONG_SECONDS
    ) {
      return video;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Pesan pengguna
// ---------------------------------------------------------------------------

export function songGuideMessage() {
  return (
    "Gunakan format: .lagu <judul lagu> [92|128|256|320]\n" +
    "Contoh: .lagu potong bebek pangkas"
  );
}

export function songReceivedMessage(query) {
  return (
    "Permintaan diterima. Mencari: " + query +
    ". Lagu akan dikirim setelah selesai diproses."
  );
}

export function songSearchFailedMessage() {
  return "Pencarian gagal. Periksa koneksi internet lalu coba lagi.";
}

export function songNotFoundMessage(query) {
  return "Tidak ditemukan lagu untuk: " + query;
}

export function songSentMessage(title, quality) {
  return "Lagu terkirim. Judul: " + title + "\nKualitas: " + quality + " kbps";
}

export function songDownloadFailedMessage(reason) {
  return "Unduhan gagal: " + (reason || "kesalahan tidak diketahui");
}
