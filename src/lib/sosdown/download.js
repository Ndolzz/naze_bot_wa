import { extractResponseCookie, getCookieFor, rememberCookies } from "./media-cookies.js";

/*
  Tahap unduh media sosial.

  Media di CDN TikTok/Instagram kadang menolak akses dari IP server dengan
  403 Forbidden, misalnya karena cookie sesi dari tahap resolve sudah
  kedaluwarsa atau CDN menolak permintaan pertama yang membawa cookie sesi
  yang baru diambil. Unduhan karena itu menjalankan tiga upaya berjenjang
  dalam beberapa ronde dengan jeda singkat:

  1. Header lengkap plus cookie tersimpan dari tahap resolve.
  2. Cookie sesi baru yang diambil langsung dari halaman sumber, lalu
     ulangi permintaan. Cookie baru juga disimpan ke cache sehingga ronde
     berikutnya langsung memakainya pada upaya pertama.
  3. Permintaan polos tanpa cookie dan referer untuk CDN yang justru
     menolak header tersebut.

  Logika dipindahkan dari repositori naze-sosdown (app/api/download/route.ts)
  tanpa perubahan strategi; bagian khusus Next.js diganti menjadi fungsi
  unduhan murni yang mengembalikan buffer.
*/

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
};

const PLATFORM_HEADERS = {
  tiktok: {
    Referer: "https://www.tiktok.com/",
  },
  instagram: {
    Referer: "https://www.instagram.com/",
  },
};

const RETRY_ROUNDS = 2;
const RETRY_DELAY_MS = 600;
const PAGE_TIMEOUT_MS = 20000;
const MEDIA_TIMEOUT_MS = 120000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isMediaResponse(status) {
  return (status >= 200 && status < 300) || status === 206;
}

function buildMediaHeaders(platform, cookie, bare) {
  const headers = bare
    ? { "User-Agent": BASE_HEADERS["User-Agent"], Accept: "*/*" }
    : { ...BASE_HEADERS };

  if (!bare && platform in PLATFORM_HEADERS) {
    Object.assign(headers, PLATFORM_HEADERS[platform]);
  }

  if (!bare && cookie) {
    headers["Cookie"] = cookie;
  }

  return headers;
}

// Ambil cookie sesi baru dari halaman sumber. Cookie juga disimpan ke cache
// media agar permintaan berikutnya langsung lolos pada upaya pertama.
async function refreshSessionCookie(sourceUrl, platform, targetUrl) {
  const referer =
    platform in PLATFORM_HEADERS
      ? PLATFORM_HEADERS[platform]["Referer"]
      : "https://www.google.com/";

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": BASE_HEADERS["User-Agent"],
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        Referer: referer,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const cookie = extractResponseCookie(response);
    if (cookie) {
      rememberCookies([targetUrl], cookie);
    }
    return cookie;
  } catch {
    return null;
  }
}

async function fetchMediaWithFallback(targetUrl, platform, sourceUrl) {
  let lastResponse = null;

  for (let round = 0; round < RETRY_ROUNDS; round++) {
    if (round > 0) {
      await delay(RETRY_DELAY_MS);
    }

    // Upaya 1: header lengkap dengan cookie tersimpan dari tahap resolve.
    const first = await fetch(targetUrl, {
      headers: buildMediaHeaders(platform, getCookieFor(targetUrl), false),
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    });
    lastResponse = first;
    if (isMediaResponse(first.status)) return first;

    // Upaya 2: perbarui sesi dari halaman sumber lalu ulangi.
    if (sourceUrl) {
      const freshCookie = await refreshSessionCookie(sourceUrl, platform, targetUrl);
      if (freshCookie) {
        const second = await fetch(targetUrl, {
          headers: buildMediaHeaders(platform, freshCookie, false),
          signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
        });
        lastResponse = second;
        if (isMediaResponse(second.status)) return second;
      }
    }

    // Upaya 3: permintaan polos tanpa cookie dan referer.
    const bare = await fetch(targetUrl, {
      headers: buildMediaHeaders(platform, null, true),
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    });
    lastResponse = bare;
    if (isMediaResponse(bare.status)) return bare;
  }

  return lastResponse;
}

/**
 * Mengunduh satu berkas media dan mengembalikannya sebagai buffer.
 * @param {string} targetUrl - URL berkas media di CDN.
 * @param {string} platform - "tiktok" atau "instagram".
 * @param {string|null} sourceUrl - URL halaman sumber untuk penyegaran cookie.
 * @returns {Promise<{ok: true, buffer: Buffer, mimeType: string} | {ok: false, message: string}>}
 */
export async function downloadMediaBytes(targetUrl, platform, sourceUrl) {
  let response;
  try {
    response = await fetchMediaWithFallback(targetUrl, platform, sourceUrl);
  } catch (err) {
    const reason =
      err && err.name === "TimeoutError"
        ? "waktu unduhan habis"
        : err?.message || "kesalahan jaringan";
    return { ok: false, message: "Media tidak dapat diunduh: " + reason + "." };
  }

  if (!response || !isMediaResponse(response.status)) {
    const status = response ? response.status : 0;
    return {
      ok: false,
      message: "Media tidak dapat diunduh (status " + status + ").",
    };
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_FILE_BYTES) {
    return { ok: false, message: "Ukuran media melebihi batas 64 MB." };
  }

  let buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return { ok: false, message: "Media tidak dapat dibaca dari server." };
  }

  if (!buffer.length) {
    return { ok: false, message: "Media kosong atau tidak dapat dibaca." };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return { ok: false, message: "Ukuran media melebihi batas 64 MB." };
  }

  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  return { ok: true, buffer, mimeType };
}
