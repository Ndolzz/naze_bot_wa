// Resolver Sosmed Downloader NAZE, dipindahkan dari repositori naze-sosdown
// (lib/resolvers) lalu disesuaikan untuk JavaScript ESM tanpa dependensi:
// seluruh permintaan memakai fetch bawaan Node dengan batas waktu.
//
// Resolver tidak memanggil API resmi platform dan hanya membaca halaman
// publik, sama seperti aplikasi web naze-sosdown.

import {
  detectPlatform,
  extensionForMime,
} from "./naze-sosdown-utils.js";

const DEFAULT_TIMEOUT_MS = 30000;

function timeoutSignal(timeoutMs) {
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
  return AbortSignal.timeout(ms);
}

// ---------------------------------------------------------------------------
// Cache cookie sumber media (dipindahkan dari naze-sosdown lib/media-cookies.ts)
//
// CDN TikTok/Instagram menolak (403) pengambilan berkas dari IP server bila
// request tidak membawa cookie sesi yang diterima saat halaman sumber diambil
// pada tahap resolve. Modul ini menyimpan cookie per URL media di memori
// proses agar unduhan bisa meneruskannya ke CDN.
// ---------------------------------------------------------------------------

const cookieByUrl = new Map();

function rememberCookies(mediaUrls, cookie) {
  if (!cookie) return;
  for (const url of mediaUrls) {
    cookieByUrl.set(url, cookie);
  }
}

function getCookieFor(mediaUrl) {
  return cookieByUrl.get(mediaUrl) ?? null;
}

function extractResponseCookie(response) {
  const headers = response?.headers;
  if (!headers) return null;

  if (typeof headers.getSetCookie === "function") {
    const setCookieList = headers.getSetCookie();
    if (setCookieList && setCookieList.length > 0) {
      return setCookieList.map((c) => c.split(";")[0]).join("; ");
    }
  }

  const raw = headers.get("set-cookie");
  if (!raw) return null;

  return raw
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Resolver TikTok (dipindahkan dari naze-sosdown lib/resolvers/tiktok.ts)
//
// Pendekatan utama: mengambil halaman web video/foto TikTok lalu membaca blok
// JSON __UNIVERSAL_DATA_FOR_REHYDRATION__ yang disisipkan TikTok di dalam
// HTML halamannya sendiri. Struktur ini tetap bisa berubah sewaktu-waktu.
// Titik yang paling rawan berubah ditandai dengan komentar PERAWATAN.
// ---------------------------------------------------------------------------

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  "Referer": "https://www.tiktok.com/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
};

const TIKTOK_SHORT_LINK_HOST_PATTERN = /(^|\.)(vt|vm)\.tiktok\.com$/i;

async function expandTikTokShortLink(rawUrl, timeoutMs) {
  const parsed = new URL(rawUrl);
  if (!TIKTOK_SHORT_LINK_HOST_PATTERN.test(parsed.hostname)) {
    return rawUrl;
  }

  const response = await fetch(rawUrl, {
    method: "GET",
    redirect: "follow",
    headers: BROWSER_HEADERS,
    signal: timeoutSignal(timeoutMs),
  });

  return response.url || rawUrl;
}

function extractTikTokItemId(canonicalUrl) {
  const videoMatch = canonicalUrl.match(/\/video\/(\d+)/);
  if (videoMatch) return videoMatch[1];

  const photoMatch = canonicalUrl.match(/\/photo\/(\d+)/);
  if (photoMatch) return photoMatch[1];

  return null;
}

async function fetchTikTokPageHtml(canonicalUrl, timeoutMs) {
  const response = await fetch(canonicalUrl, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: timeoutSignal(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`page request failed with status ${response.status}`);
  }

  const cookie = extractResponseCookie(response);
  const html = await response.text();
  return { html, cookie };
}

// PERAWATAN: blok data rehidrasi ini dibaca berdasarkan id script-nya.
function parseTikTokRehydrationData(html) {
  const pattern =
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;
  const match = html.match(pattern);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractTikTokItemStruct(universalData) {
  // PERAWATAN: jalur key di bawah ini mengikuti struktur webapp TikTok
  // saat dokumen ini ditulis.
  const detail = universalData?.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  return detail?.itemInfo?.itemStruct ?? null;
}

function buildTikTokVideoItems(itemStruct) {
  const video = itemStruct?.video;
  if (!video) return [];

  const items = [];
  const quality = video.ratio ? String(video.ratio) : "original";
  const thumbnailUrl = video.originCover ?? video.cover ?? null;

  // PERAWATAN: TikTok menyertakan daftar varian bitrate pada video.bitrateInfo.
  // Varian bitrate tertinggi diberi label hd, varian di bawahnya diberi label
  // sd. Bila struktur ini tidak tersedia, jalur cadangan video.playAddr tetap
  // menghasilkan satu item unduhan.
  const bitrateInfo = Array.isArray(video.bitrateInfo) ? video.bitrateInfo : [];

  const variants = bitrateInfo
    .map((info) => {
      const url = info?.PlayAddr?.UrlList?.[0];
      const bitrate = Number(info?.Bitrate ?? 0);
      return url ? { url, bitrate } : null;
    })
    .filter((variant) => variant !== null)
    .sort((a, b) => b.bitrate - a.bitrate);

  if (variants.length > 0) {
    variants.forEach((variant, index) => {
      items.push({
        url: variant.url,
        quality,
        label: index === 0 ? "hd" : "sd",
        hasWatermark: false,
        mimeType: "video/mp4",
        thumbnailUrl,
      });
    });
  } else if (video.playAddr) {
    items.push({
      url: video.playAddr,
      quality,
      label: "hd",
      hasWatermark: false,
      mimeType: "video/mp4",
      thumbnailUrl,
    });
  }

  const watermarkUrl = video.downloadAddr;
  if (
    watermarkUrl &&
    watermarkUrl !== video.playAddr &&
    !variants.some((variant) => variant.url === watermarkUrl)
  ) {
    items.push({
      url: watermarkUrl,
      quality,
      label: null,
      hasWatermark: true,
      mimeType: "video/mp4",
      thumbnailUrl,
    });
  }

  return items;
}

function buildTikTokPhotoItems(itemStruct) {
  const images = itemStruct?.imagePost?.images;
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => {
      const url = image?.imageURL?.urlList?.[0];
      if (!url) return null;

      return {
        url,
        quality: `${image?.imageWidth ?? "auto"}x${image?.imageHeight ?? "auto"}`,
        hasWatermark: false,
        mimeType: "image/jpeg",
        thumbnailUrl: url,
      };
    })
    .filter((item) => item !== null);
}

async function resolveTikTok(rawUrl, options = {}) {
  const timeoutMs = options.timeoutMs;

  let canonicalUrl;
  try {
    canonicalUrl = await expandTikTokShortLink(rawUrl, timeoutMs);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_link",
        message: "Tautan pendek TikTok tidak dapat dibuka.",
      },
    };
  }

  const itemId = extractTikTokItemId(canonicalUrl);
  if (!itemId) {
    return {
      ok: false,
      error: {
        code: "invalid_link",
        message: "Tautan TikTok tidak mengandung penanda video atau foto yang dikenali.",
      },
    };
  }

  let html;
  let sourceCookie;
  try {
    const page = await fetchTikTokPageHtml(canonicalUrl, timeoutMs);
    html = page.html;
    sourceCookie = page.cookie;
  } catch {
    return {
      ok: false,
      error: {
        code: "parse_failed",
        message: "Gagal mengambil halaman TikTok. Struktur sumber kemungkinan berubah.",
      },
    };
  }

  const universalData = parseTikTokRehydrationData(html);
  const itemStruct = universalData ? extractTikTokItemStruct(universalData) : null;

  if (!itemStruct) {
    return {
      ok: false,
      error: {
        code: "content_unavailable",
        message: "Konten TikTok tidak ditemukan atau sudah tidak tersedia.",
      },
    };
  }

  const isPhotoPost = Boolean(itemStruct?.imagePost?.images?.length);
  const items = isPhotoPost
    ? buildTikTokPhotoItems(itemStruct)
    : buildTikTokVideoItems(itemStruct);

  if (items.length === 0) {
    return {
      ok: false,
      error: {
        code: "parse_failed",
        message: "Data media tidak dapat diurai dari respons TikTok.",
      },
    };
  }

  // Simpan cookie sesi agar pengunduhan bisa mengakses CDN tanpa 403,
  // termasuk untuk URL gambar sampul.
  const mediaUrls = items.flatMap((item) =>
    item.thumbnailUrl && item.thumbnailUrl !== item.url
      ? [item.url, item.thumbnailUrl]
      : [item.url]
  );
  rememberCookies(mediaUrls, sourceCookie);

  return {
    ok: true,
    data: {
      platform: "tiktok",
      type: isPhotoPost ? "photo" : "video",
      items,
      author: itemStruct?.author?.uniqueId ?? null,
      caption: itemStruct?.desc ?? null,
      sourceUrl: canonicalUrl,
    },
  };
}

// ---------------------------------------------------------------------------
// Resolver Instagram (dipindahkan dari naze-sosdown lib/resolvers/instagram.ts)
//
// Instagram membatasi akses tanpa sesi login. Pendekatan yang dipakai di sini
// adalah membaca halaman embed publik (/embed/captioned/) yang masih bisa
// diakses tanpa login untuk konten publik, lalu mengurai blok data JSON yang
// disisipkan di dalam HTML tersebut. Ini adalah bagian paling rawan berubah;
// jika resolver ini mulai gagal secara luas, periksa ulang bentuk HTML
// halaman embed Instagram saat ini, bukan hanya kode di bawah.
// ---------------------------------------------------------------------------

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const INSTAGRAM_SHORTCODE_PATTERN = /\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;

// PERAWATAN: pola ini mengasumsikan Instagram masih menyisipkan blok
// "contextJSON" pada halaman embed.
const INSTAGRAM_CONTEXT_JSON_PATTERN = /"contextJSON":"((?:\\.|[^"\\])*)"/;

function extractInstagramShortcode(rawUrl) {
  const match = rawUrl.match(INSTAGRAM_SHORTCODE_PATTERN);
  if (!match) return null;
  return { type: match[1], shortcode: match[2] };
}

function unescapeJsonString(raw) {
  return JSON.parse(`"${raw}"`);
}

function buildInstagramEmbedUrl(type, shortcode) {
  const embedType = type === "p" ? "p" : type;
  return `https://www.instagram.com/${embedType}/${shortcode}/embed/captioned/`;
}

async function fetchInstagramEmbedHtml(type, shortcode, timeoutMs) {
  const response = await fetch(buildInstagramEmbedUrl(type, shortcode), {
    headers: {
      "User-Agent": DESKTOP_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: timeoutSignal(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`embed page request failed with status ${response.status}`);
  }

  return response.text();
}

function parseInstagramContext(html) {
  const match = html.match(INSTAGRAM_CONTEXT_JSON_PATTERN);
  if (!match) return null;

  try {
    const unescaped = unescapeJsonString(match[1]);
    return JSON.parse(unescaped);
  } catch {
    return null;
  }
}

function looksUnavailable(html) {
  return (
    html.includes("Sorry, this page isn't available") ||
    html.includes("halaman ini tidak tersedia")
  );
}

function buildInstagramItemsFromNode(node) {
  const quality = node.dimensions
    ? `${node.dimensions.width}x${node.dimensions.height}`
    : "original";

  // Halaman embed Instagram hanya menyediakan satu varian media; display_url
  // dipakai sebagai poster video sekaligus pratinjau foto.
  const poster = node.display_url ?? null;

  if (node.is_video && node.video_url) {
    return [
      {
        url: node.video_url,
        quality,
        label: null,
        hasWatermark: false,
        mimeType: "video/mp4",
        thumbnailUrl: poster,
      },
    ];
  }

  if (node.display_url) {
    return [
      {
        url: node.display_url,
        quality,
        label: null,
        hasWatermark: false,
        mimeType: "image/jpeg",
        thumbnailUrl: poster,
      },
    ];
  }

  return [];
}

async function resolveInstagram(rawUrl, options = {}) {
  const timeoutMs = options.timeoutMs;

  const shortcodeInfo = extractInstagramShortcode(rawUrl);
  if (!shortcodeInfo) {
    return {
      ok: false,
      error: {
        code: "invalid_link",
        message: "Tautan Instagram tidak mengandung penanda postingan yang dikenali.",
      },
    };
  }

  const sourceUrl = buildInstagramEmbedUrl(
    shortcodeInfo.type,
    shortcodeInfo.shortcode,
  );

  let html;
  try {
    html = await fetchInstagramEmbedHtml(
      shortcodeInfo.type,
      shortcodeInfo.shortcode,
      timeoutMs,
    );
  } catch {
    return {
      ok: false,
      error: {
        code: "parse_failed",
        message: "Gagal mengambil halaman Instagram. Struktur sumber kemungkinan berubah.",
      },
    };
  }

  if (looksUnavailable(html)) {
    return {
      ok: false,
      error: {
        code: "content_unavailable",
        message: "Postingan Instagram tidak ditemukan, privat, atau sudah dihapus.",
      },
    };
  }

  const context = parseInstagramContext(html);
  const media = context?.shortcode_media;

  if (!media) {
    return {
      ok: false,
      error: {
        code: "parse_failed",
        message: "Data media tidak dapat diurai dari halaman Instagram.",
      },
    };
  }

  const sidecarEdges = media.edge_sidecar_to_children?.edges;
  let items = [];
  let type = "photo";

  if (sidecarEdges && sidecarEdges.length > 0) {
    type = "carousel";
    items = sidecarEdges.flatMap((edge) =>
      edge.node ? buildInstagramItemsFromNode(edge.node) : []
    );
  } else {
    type = media.is_video ? "video" : "photo";
    items = buildInstagramItemsFromNode(media);
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: {
        code: "parse_failed",
        message: "Tidak ada media yang dapat diambil dari postingan ini.",
      },
    };
  }

  const captionEdges = media.edge_media_to_caption?.edges;
  const caption =
    captionEdges && captionEdges.length > 0 ? captionEdges[0].node?.text ?? null : null;

  return {
    ok: true,
    data: {
      platform: "instagram",
      type,
      items,
      author: media.owner?.username ?? null,
      caption: caption ?? null,
      sourceUrl,
    },
  };
}

// ---------------------------------------------------------------------------
// Resolver YouTube (dipindahkan dari naze-sosdown lib/resolvers/youtube.ts)
//
// Strategi utama: endpoint internal innertube dengan konteks klien ANDROID.
// Klien ini mengembalikan URL media langsung tanpa signatureCipher sehingga
// tidak perlu membaca berkas base.js pemutar. Bila strategi utama ditolak
// (misalnya pemeriksaan bot atau klien kedaluwarsa) atau tidak menghasilkan
// URL langsung, resolver beralih ke strategi cadangan: mengambil halaman
// watch, membaca ytInitialPlayerResponse, lalu mendekripsi signatureCipher
// dengan fungsi decipher yang dibangun dari base.js pemutar.
//
// PERAWATAN: sisi YouTube berubah lebih cepat dibanding sumber lain. Titik
// paling rawan berubah: kunci dan versi klien innertube, pola fungsi
// decipher pada base.js, serta struktur ytInitialPlayerResponse.
// ---------------------------------------------------------------------------

const INNERTUBE_ENDPOINT = "https://www.youtube.com/youtubei/v1/player";
// Kunci publik bawaan klien web YouTube, tidak rahasia dan bukan kredensial.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const ANDROID_CLIENT_VERSION = "20.10.38";
const WATCH_URL_PREFIX = "https://www.youtube.com/watch?v=";
const DECIPHER_PROBE_INPUT = "AAAABBBBCCCCDDDD";
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{8,20}$/;

function extractYouTubeVideoId(rawUrl) {
  let parsed;
  try {
    const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "");
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (/(^|\.)youtube\.com$/.test(host)) {
    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery && VIDEO_ID_PATTERN.test(fromQuery)) return fromQuery;

    const pathMatch = parsed.pathname.match(/^\/(shorts|embed|live|v)\/([a-zA-Z0-9_-]+)/);
    if (pathMatch && VIDEO_ID_PATTERN.test(pathMatch[2])) return pathMatch[2];
  }

  return null;
}

async function fetchAndroidPlayer(videoId, timeoutMs) {
  const response = await fetch(INNERTUBE_ENDPOINT + "?key=" + INNERTUBE_KEY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "com.google.android.youtube/" + ANDROID_CLIENT_VERSION + " (Linux; U; Android 11) gzip",
      "X-YouTube-Client-Name": "ANDROID",
      "X-YouTube-Client-Version": ANDROID_CLIENT_VERSION,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: ANDROID_CLIENT_VERSION,
          androidSdkVersion: 30,
          hl: "id",
          gl: "ID",
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
    signal: timeoutSignal(timeoutMs),
  });

  if (!response.ok) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWatchHtml(videoId, timeoutMs) {
  const response = await fetch(
    WATCH_URL_PREFIX + videoId + "&hl=id&bpctr=9999999999&has_verified=1",
    {
      headers: {
        "User-Agent": DESKTOP_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
        "Cookie": "CONSENT=YES+1; SOCS=CAI",
      },
      signal: timeoutSignal(timeoutMs),
    }
  );

  if (!response.ok) return null;

  try {
    return await response.text();
  } catch {
    return null;
  }
}

// Membaca objek JSON mulai dari kurung kurawal pembuka pada openIndex
// sampai kurung penutup yang berimbang, mengabaikan kurung di dalam
// string. Dipakai untuk ytInitialPlayerResponse dan objek helper decipher.
function extractBalancedObject(source, openIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }

  return null;
}

function extractPlayerResponse(html) {
  // PERAWATAN: penanda ini bergantung pada bentuk halaman watch YouTube.
  const marker = "ytInitialPlayerResponse = ";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const openIndex = html.indexOf("{", markerIndex + marker.length);
  if (openIndex === -1) return null;

  const jsonSource = extractBalancedObject(html, openIndex);
  if (!jsonSource) return null;

  try {
    return JSON.parse(jsonSource);
  } catch {
    return null;
  }
}

function findPlayerJsUrl(html) {
  const jsUrlMatch = html.match(/"jsUrl"\s*:\s*"([^"]+)"/);
  if (jsUrlMatch) {
    return "https://www.youtube.com" + jsUrlMatch[1];
  }

  const directMatch = html.match(
    /https:\/\/www\.youtube\.com\/s\/player\/[a-zA-Z0-9/.-]+\/base\.js/
  );
  return directMatch ? directMatch[0] : null;
}

const STRING_METHODS = new Set([
  "split",
  "join",
  "reverse",
  "slice",
  "splice",
  "push",
  "concat",
  "shift",
  "unshift",
  "pop",
  "indexOf",
  "charAt",
  "charCodeAt",
  "substr",
  "substring",
  "replace",
  "toString",
  "fromCharCode",
]);

const GLOBAL_OBJECTS = new Set(["String", "Math", "Array", "Object", "JSON", "Number"]);

function escapeRegExp(value) {
  return value.replace(/[$()*+.?[\\\]^{}]/g, "\\$&");
}

// Fungsi decipher memanggil helper pada objek eksternal, misalnya XX.yz(a, 5),
// sedangkan fungsi transform parameter n berdiri sendiri. Perbedaan inilah
// yang dipakai untuk membedakan kandidat fungsi pada base.js.
function findHelperObjectName(functionBody) {
  const matches = functionBody.matchAll(/([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)\(/g);

  for (const match of matches) {
    const objectName = match[1];
    if (GLOBAL_OBJECTS.has(objectName)) continue;
    if (STRING_METHODS.has(match[2])) continue;
    return objectName;
  }

  return null;
}

/*
  PERAWATAN: membangun fungsi decipher dari base.js adalah bagian paling
  rapuh dari resolver ini. Deteksi memakai ciri umum: fungsi yang memecah
  masukan menjadi array karakter, menggabungkannya kembali, dan memanggil
  helper pada objek yang didefinisikan terpisah. Bila YouTube mengubah pola
  ini, hanya strategi utama (innertube ANDROID) yang tetap bekerja.
*/
function buildDecipher(playerJs) {
  const candidatePattern =
    /(?:function\s+([a-zA-Z_$][\w$]*)\s*\(\s*([a-zA-Z_$][\w$]*)\s*\)|([a-zA-Z_$][\w$]*)\s*=\s*function\s*\(\s*([a-zA-Z_$][\w$]*)\s*\))\s*\{/g;

  let match;

  while ((match = candidatePattern.exec(playerJs)) !== null) {
    const paramName = match[2] ?? match[4];
    const openIndex = match.index + match[0].length - 1;
    const functionBody = extractBalancedObject(playerJs, openIndex);

    if (!functionBody || functionBody.length > 4000) continue;
    if (!functionBody.includes('.split("")') || !functionBody.includes('.join("")')) continue;

    const helperName = findHelperObjectName(functionBody);
    if (!helperName) continue;

    const helperDefinition = new RegExp(
      "\\b" + escapeRegExp(helperName) + "\\s*=\\s*\\{"
    ).exec(playerJs);
    if (!helperDefinition) continue;

    const helperOpenIndex = helperDefinition.index + helperDefinition[0].length - 1;
    const helperSource = extractBalancedObject(playerJs, helperOpenIndex);
    if (!helperSource) continue;

    const innerBody = functionBody.slice(1, functionBody.length - 1);

    try {
      const candidate = new Function(
        paramName,
        "var " + helperName + " = " + helperSource + ";" + innerBody
      );

      const probe = candidate(DECIPHER_PROBE_INPUT);
      if (typeof probe === "string" && probe.length >= 10) {
        return (signature) => {
          try {
            return candidate(signature);
          } catch {
            return null;
          }
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function resolveFormatUrl(format, decipher) {
  if (format.url) return format.url;

  const cipherSource = format.signatureCipher ?? format.cipher;
  if (!cipherSource || !decipher) return null;

  const params = new URLSearchParams(cipherSource);
  const signature = params.get("s");
  const signatureParam = params.get("sp") ?? "sig";
  const mediaUrl = params.get("url");
  if (!signature || !mediaUrl) return null;

  const deciphered = decipher(signature);
  if (!deciphered) return null;

  const result = new URL(mediaUrl);
  result.searchParams.set(signatureParam, deciphered);
  return result.toString();
}

function heightFromQualityLabel(label) {
  const match = label ? label.match(/(\d+)/) : null;
  return match ? Number(match[1]) : 0;
}

/*
  Hanya format progresif (video dan audio dalam satu berkas MP4) yang
  dijadikan item unduhan video. Format adaptif DASH perlu digabungkan
  dengan ffmpeg; resolusi maksimum mengikuti format progresif YouTube.
*/
function buildYouTubeVideoItems(formats, decipher) {
  const muxed = formats
    .filter(
      (format) =>
        typeof format.mimeType === "string" &&
        format.mimeType.startsWith("video/") &&
        format.mimeType.includes("audio/")
    )
    .map((format) => {
      const url = resolveFormatUrl(format, decipher);
      if (!url) return null;
      return {
        url,
        quality: format.qualityLabel ?? String(format.itag ?? "video"),
        height: heightFromQualityLabel(format.qualityLabel),
      };
    })
    .filter((variant) => variant !== null)
    .sort((a, b) => b.height - a.height);

  return muxed.map((variant, index) => ({
    url: variant.url,
    quality: variant.quality,
    label: muxed.length > 1 ? (index === 0 ? "hd" : "sd") : null,
    hasWatermark: false,
    mimeType: "video/mp4",
    thumbnailUrl: null,
  }));
}

// Trek audio terpisah diambil dari format adaptif. AAC dalam wadah MP4
// (umumnya itag 140) diprioritaskan karena paling kompatibel dengan
// konversi MP3 di sisi server.
function buildYouTubeAudioItem(adaptiveFormats, decipher) {
  const audio = adaptiveFormats
    .filter(
      (format) =>
        typeof format.mimeType === "string" &&
        format.mimeType.startsWith("audio/")
    )
    .map((format) => {
      const url = resolveFormatUrl(format, decipher);
      if (!url) return null;
      return {
        url,
        mimeType: format.mimeType,
        bitrate: Number(format.bitrate ?? 0),
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => b.bitrate - a.bitrate);

  if (audio.length === 0) return null;

  const preferred = audio.find((item) => item.mimeType.includes("mp4")) ?? audio[0];

  return {
    url: preferred.url,
    quality: Math.max(1, Math.round(preferred.bitrate / 1000)) + " kbps",
    label: null,
    hasWatermark: false,
    mimeType: preferred.mimeType.split(";")[0],
    thumbnailUrl: null,
  };
}

function isPlayable(player) {
  return player?.playabilityStatus?.status === "OK";
}

function unavailableMessage(player) {
  const reason = player?.playabilityStatus?.reason ?? "";
  if (/sign in|login|bot/i.test(reason)) {
    return "YouTube meminta verifikasi untuk video ini. Coba lagi beberapa saat atau gunakan video lain.";
  }
  return "Video tidak dapat diputar: privat, dibatasi usia, atau diblokir.";
}

async function resolveYouTube(rawUrl, options = {}) {
  const timeoutMs = options.timeoutMs;

  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId) {
    return {
      ok: false,
      error: {
        code: "invalid_link",
        message: "Tautan YouTube tidak mengandung id video yang dikenali.",
      },
    };
  }

  let player = null;
  let watchHtml = null;

  try {
    player = await fetchAndroidPlayer(videoId, timeoutMs);
  } catch {
    player = null;
  }

  const streaming = player?.streamingData;
  const hasDirectUrl =
    (streaming?.formats ?? []).some((format) => format.url) ||
    (streaming?.adaptiveFormats ?? []).some((format) => format.url);

  const androidUsable = isPlayable(player) && hasDirectUrl;

  if (!androidUsable) {
    try {
      watchHtml = await fetchWatchHtml(videoId, timeoutMs);
    } catch {
      watchHtml = null;
    }
    const watchPlayer = watchHtml ? extractPlayerResponse(watchHtml) : null;
    if (watchPlayer) {
      player = watchPlayer;
    }
  }

  if (!isPlayable(player)) {
    return {
      ok: false,
      error: {
        code: "content_unavailable",
        message: unavailableMessage(player),
      },
    };
  }

  const formats = player?.streamingData?.formats ?? [];
  const adaptiveFormats = player?.streamingData?.adaptiveFormats ?? [];

  // Strategi cadangan (halaman watch) umumnya menyisipkan signatureCipher,
  // sehingga fungsi decipher perlu dibangun dari base.js pemutar.
  const needsDecipher =
    watchHtml !== null &&
    formats.concat(adaptiveFormats).some(
      (format) => !format.url && (format.signatureCipher ?? format.cipher)
    );

  let decipher = null;

  if (needsDecipher && watchHtml) {
    const playerJsUrl = findPlayerJsUrl(watchHtml);

    if (playerJsUrl) {
      try {
        const response = await fetch(playerJsUrl, {
          headers: { "User-Agent": DESKTOP_USER_AGENT },
          signal: timeoutSignal(timeoutMs),
        });

        if (response.ok) {
          decipher = buildDecipher(await response.text());
        }
      } catch {
        decipher = null;
      }
    }
  }

  const videoItems = buildYouTubeVideoItems(formats, decipher);
  const audioItem = buildYouTubeAudioItem(adaptiveFormats, decipher);

  if (videoItems.length === 0) {
    return {
      ok: false,
      error: {
        code: "parse_failed",
        message: "Tidak ada format video yang dapat diambil dari YouTube.",
      },
    };
  }

  const thumbnails = player?.videoDetails?.thumbnail?.thumbnails ?? [];
  const bestThumbnail =
    thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url ?? null : null;

  const durationRaw = Number(player?.videoDetails?.lengthSeconds ?? 0);
  const durationSeconds =
    Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : null;

  return {
    ok: true,
    data: {
      platform: "youtube",
      type: "video",
      items: videoItems.map((item) => ({ ...item, thumbnailUrl: bestThumbnail })),
      audio: audioItem ? { ...audioItem, thumbnailUrl: bestThumbnail } : null,
      author: player?.videoDetails?.author ?? null,
      caption: player?.videoDetails?.title ?? null,
      durationSeconds,
      sourceUrl: WATCH_URL_PREFIX + videoId,
    },
  };
}

// ---------------------------------------------------------------------------
// Pemetaan resolver per platform dan pengunduhan berkas media
// ---------------------------------------------------------------------------

const PLATFORM_REFERERS = {
  tiktok: "https://www.tiktok.com/",
  instagram: "https://www.instagram.com/",
  youtube: "https://www.youtube.com/",
};

async function resolveSosmedUrl(rawUrl, options = {}) {
  const detected = detectPlatform(rawUrl);
  if (!detected) {
    return {
      ok: false,
      error: {
        code: "unsupported_platform",
        message: "Tautan tidak dikenali sebagai TikTok, Instagram, atau YouTube.",
      },
    };
  }

  const resolvers = {
    tiktok: resolveTikTok,
    instagram: resolveInstagram,
    youtube: resolveYouTube,
  };

  const resolver = resolvers[detected.platform];
  if (!resolver) {
    return {
      ok: false,
      error: {
        code: "unsupported_platform",
        message: "Platform belum didukung.",
      },
    };
  }

  return resolver(detected.normalizedUrl, options);
}

/**
 * Mengunduh berkas media hasil resolver dengan cookie sesi dan batas ukuran.
 * @param {Object} item - Item media hasil resolver
 * @param {Object} [options]
 * @param {string} [options.platform] - Platform sumber untuk header Referer
 * @param {number} [options.maxBytes] - Batas ukuran berkas
 * @param {number} [options.timeoutMs] - Batas waktu permintaan
 * @returns {Promise<Object>} { ok, buffer } atau { ok: false, reason }
 */
async function downloadMediaItem(item, options = {}) {
  const maxBytes = Number(options.maxBytes) || 0;
  const timeoutMs = options.timeoutMs;
  const referer = PLATFORM_REFERERS[options.platform] ?? "https://www.google.com/";

  const headers = {
    "User-Agent": DESKTOP_USER_AGENT,
    "Accept": "*/*",
    "Referer": referer,
  };
  const cookie = getCookieFor(item.url);
  if (cookie) headers.Cookie = cookie;

  let response;
  try {
    response = await fetch(item.url, {
      headers,
      redirect: "follow",
      signal: timeoutSignal(timeoutMs),
    });
  } catch (error) {
    return { ok: false, reason: "network", error };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "http",
      status: response.status,
    };
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (maxBytes > 0 && contentLength > maxBytes) {
    return { ok: false, reason: "too-large", bytes: contentLength };
  }

  let buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    return { ok: false, reason: "network", error };
  }

  if (!buffer.length) {
    return { ok: false, reason: "empty" };
  }
  if (maxBytes > 0 && buffer.length > maxBytes) {
    return { ok: false, reason: "too-large", bytes: buffer.length };
  }

  return {
    ok: true,
    buffer,
    mimeType: item.mimeType,
    extension: extensionForMime(item.mimeType),
  };
}

export {
  DEFAULT_TIMEOUT_MS,
  extractResponseCookie,
  resolveTikTok,
  resolveInstagram,
  resolveYouTube,
  resolveSosmedUrl,
  downloadMediaItem,
};
