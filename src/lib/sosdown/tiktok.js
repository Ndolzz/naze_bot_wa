import { extractResponseCookie, rememberCookies } from "./media-cookies.js";

/*
  Resolver TikTok

  Pendekatan utama: mengambil halaman web video/foto TikTok lalu membaca blok
  JSON __UNIVERSAL_DATA_FOR_REHYDRATION__ yang disisipkan TikTok di dalam
  HTML halamannya sendiri. Blok ini dipakai oleh aplikasi web TikTok untuk
  menghidrasikan konten, sehingga strukturnya jauh lebih stabil dibanding
  endpoint internal /api/item/detail/ yang memerlukan signature dan cookie.
  Struktur ini tetap bisa berubah sewaktu-waktu. Titik yang paling rawan
  berubah ditandai dengan komentar PERAWATAN di bawah.

  TikTok juga kerap menyajikan halaman pemeriksaan anti-bot untuk permintaan
  tanpa cookie yang datang dari IP server. Karena itu, bila blok rehidrasi
  tidak ditemukan sama sekali, resolver mengambil cookie sesi dari halaman
  depan TikTok lalu mengulang permintaan halaman video satu kali dengan
  cookie tersebut, serta memakai blok lama __SIGI_STATE__ sebagai jalur
  cadangan.

  Dipindahkan dari repositori naze-sosdown (lib/resolvers/tiktok.ts) tanpa
  perubahan logika, hanya tanpa anotasi TypeScript.
*/

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  Referer: "https://www.tiktok.com/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
};

const SHORT_LINK_HOST_PATTERN = /(^|\.)(vt|vm)\.tiktok\.com$/i;

const TIKTOK_HOME_URL = "https://www.tiktok.com/";

async function expandShortLink(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!SHORT_LINK_HOST_PATTERN.test(parsed.hostname)) {
    return rawUrl;
  }

  const response = await fetch(rawUrl, {
    method: "GET",
    redirect: "follow",
    headers: BROWSER_HEADERS,
  });

  return response.url || rawUrl;
}

function extractItemId(canonicalUrl) {
  const videoMatch = canonicalUrl.match(/\/video\/(\d+)/);
  if (videoMatch) return videoMatch[1];

  const photoMatch = canonicalUrl.match(/\/photo\/(\d+)/);
  if (photoMatch) return photoMatch[1];

  return null;
}

async function fetchPageHtml(canonicalUrl, cookie) {
  const headers = cookie ? { ...BROWSER_HEADERS, Cookie: cookie } : BROWSER_HEADERS;

  const response = await fetch(canonicalUrl, {
    headers,
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`page request failed with status ${response.status}`);
  }

  const extractedCookie = extractResponseCookie(response);
  const html = await response.text();

  return { html, cookie: extractedCookie ?? cookie ?? null };
}

// Cookie sesi dari halaman depan TikTok. Halaman video yang sebelumnya
// menyajikan halaman pemeriksaan anti-bot biasanya bisa diambil setelah
// permintaan ulang membawa cookie ini.
async function fetchSessionCookie() {
  try {
    const response = await fetch(TIKTOK_HOME_URL, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    const cookie = extractResponseCookie(response);

    try {
      await response.text();
    } catch {
      // Isi halaman depan tidak dipakai; kegagalan membacanya diabaikan.
    }

    return cookie;
  } catch {
    return null;
  }
}

// PERAWATAN: blok data rehidrasi ini dibaca berdasarkan id script-nya.
// Jika resolver mulai gagal secara luas, periksa apakah TikTok masih
// menyisipkan script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" pada HTML.
function parseRehydrationData(html) {
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

function extractItemStruct(universalData) {
  // PERAWATAN: jalur key di bawah ini mengikuti struktur webapp TikTok
  // saat dokumen ini ditulis.
  const detail = universalData?.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  return detail?.itemInfo?.itemStruct ?? null;
}

function extractDetailStatusCode(universalData) {
  const statusCode =
    universalData?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.statusCode;
  return typeof statusCode === "number" && statusCode !== 0 ? statusCode : null;
}

// PERAWATAN: sebelum blok rehidrasi, TikTok menyisipkan blok
// id="__SIGI_STATE__" dengan struktur ItemModule. Blok ini dipakai sebagai
// jalur cadangan bila blok rehidrasi tidak ada atau tidak memuat itemStruct.
function parseSigiState(html) {
  const pattern = /<script id="__SIGI_STATE__"[^>]*>([\s\S]*?)<\/script>/;
  const match = html.match(pattern);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractItemStructFromSigi(html, itemId) {
  if (!itemId) return null;
  const sigiState = parseSigiState(html);
  return sigiState?.ItemModule?.[itemId] ?? null;
}

function buildVideoItems(itemStruct) {
  const video = itemStruct?.video;
  if (!video) return [];

  const items = [];
  const quality = video.ratio ? String(video.ratio) : "original";
  const thumbnailUrl = video.originCover ?? video.cover ?? null;

  // PERAWATAN: TikTok menyertakan daftar varian bitrate pada video.bitrateInfo.
  // Varian bitrate tertinggi diberi label hd, varian di bawahnya diberi label
  // sd. Bila struktur ini tidak tersedia, jalur cadangan video.playAddr di
  // bawah tetap menghasilkan satu item unduhan.
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

function buildPhotoItems(itemStruct) {
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

export async function resolveTikTok(rawUrl) {
  let canonicalUrl;

  try {
    canonicalUrl = await expandShortLink(rawUrl);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_link",
        message: "Tautan pendek TikTok tidak dapat dibuka.",
      },
    };
  }

  const itemId = extractItemId(canonicalUrl);
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
    const page = await fetchPageHtml(canonicalUrl, null);
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

  let universalData = parseRehydrationData(html);
  let itemStruct = universalData ? extractItemStruct(universalData) : null;

  if (!itemStruct) {
    itemStruct = extractItemStructFromSigi(html, itemId);
  }

  // Halaman tanpa blok rehidrasi sama sekali biasanya halaman pemeriksaan
  // anti-bot untuk permintaan tanpa cookie. Ambil cookie sesi dari halaman
  // depan TikTok, lalu ulangi permintaan halaman video satu kali.
  if (!itemStruct && !universalData) {
    const warmCookie = sourceCookie ?? (await fetchSessionCookie());
    if (warmCookie) {
      try {
        const retry = await fetchPageHtml(canonicalUrl, warmCookie);
        const retryData = parseRehydrationData(retry.html);
        const retryStruct =
          (retryData ? extractItemStruct(retryData) : null) ??
          extractItemStructFromSigi(retry.html, itemId);

        if (retryStruct) {
          html = retry.html;
          sourceCookie = retry.cookie ?? warmCookie;
          universalData = retryData;
          itemStruct = retryStruct;
        }
      } catch {
        // Diabaikan; pesan galat akhir dibentuk dari data yang sudah ada.
      }
    }
  }

  if (!itemStruct) {
    if (!universalData && !parseSigiState(html)) {
      return {
        ok: false,
        error: {
          code: "bot_blocked",
          message:
            "TikTok menolak permintaan dari server ini. Tunggu beberapa saat lalu coba lagi, atau gunakan tautan lain.",
        },
      };
    }

    const statusCode = extractDetailStatusCode(universalData);
    return {
      ok: false,
      error: {
        code: "content_unavailable",
        message: statusCode
          ? "Konten TikTok tidak dapat diambil (kode " +
            statusCode +
            "). Postingan mungkin privat atau sudah dihapus."
          : "Konten TikTok tidak ditemukan atau sudah tidak tersedia.",
      },
    };
  }

  const isPhotoPost = Boolean(itemStruct?.imagePost?.images?.length);
  const items = isPhotoPost ? buildPhotoItems(itemStruct) : buildVideoItems(itemStruct);

  if (items.length === 0) {
    return {
      ok: false,
      error: {
        code: "parse_failed",
        message: "Data media tidak dapat diurai dari respons TikTok.",
      },
    };
  }

  // Simpan cookie sesi agar tahap unduh bisa mengakses CDN tanpa 403,
  // termasuk untuk URL gambar sampul.
  const mediaUrls = items.flatMap((item) =>
    item.thumbnailUrl && item.thumbnailUrl !== item.url
      ? [item.url, item.thumbnailUrl]
      : [item.url],
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
