/*
  Resolver Instagram

  Instagram jauh lebih ketat dibanding TikTok dalam membatasi akses tanpa
  sesi login. Pendekatan yang dipakai di sini adalah membaca halaman embed
  publik (/embed/captioned/) yang masih bisa diakses tanpa login untuk
  konten publik, lalu mengurai blok data JSON yang disisipkan di dalam HTML
  tersebut. Ini adalah bagian paling rawan berubah dari seluruh proyek.
  Jika resolver ini mulai gagal secara luas, langkah pertama adalah
  memeriksa ulang bentuk HTML halaman embed Instagram saat ini.

  Bila blok contextJSON tidak ada (Instagram mengubah halaman embed atau
  membatasi akses untuk server ini), resolver mencoba jalur cadangan:
  URL media CDN (fbcdn/cdninstagram) yang masih tercetak pada skrip halaman
  embed serta tag meta og:video dan og:image.

  Dipindahkan dari repositori naze-sosdown (lib/resolvers/instagram.ts)
  tanpa perubahan logika, hanya tanpa anotasi TypeScript.
*/

const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SHORTCODE_PATTERN = /\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;

// PERAWATAN: pola ini mengasumsikan Instagram masih menyisipkan blok
// "contextJSON" pada halaman embed. Pola ini yang paling mungkin perlu
// disesuaikan lebih dulu bila resolver berhenti bekerja.
const CONTEXT_JSON_PATTERN = /"contextJSON":"((?:\\.|[^"\\])*)"/;

const CDN_HOST_PATTERN = /(^|\.)(fbcdn\.net|cdninstagram\.com)$/i;
const CDN_MEDIA_PATH_PATTERN = /\.(mp4|jpe?g|png|webp)$/i;

function extractShortcode(rawUrl) {
  const match = rawUrl.match(SHORTCODE_PATTERN);
  if (!match) return null;
  return { type: match[1], shortcode: match[2] };
}

function unescapeJsonString(raw) {
  return JSON.parse(`"${raw}"`);
}

function buildEmbedUrl(type, shortcode) {
  const embedType = type === "p" ? "p" : type;
  return `https://www.instagram.com/${embedType}/${shortcode}/embed/captioned/`;
}

async function fetchEmbedHtml(type, shortcode) {
  const response = await fetch(buildEmbedUrl(type, shortcode), {
    headers: {
      "User-Agent": DESKTOP_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`embed page request failed with status ${response.status}`);
  }

  return response.text();
}

function parseContext(html) {
  const match = html.match(CONTEXT_JSON_PATTERN);
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

// Membaca isi tag meta Open Graph dengan dua kemungkinan urutan atribut:
// property sebelum content, atau content sebelum property.
function extractMetaContent(html, property) {
  const propertyFirst = html.match(
    new RegExp(
      '<meta[^>]+property=["\']' + property + '["\'][^>]+content=["\']([^"\']*)["\']',
    ),
  );
  if (propertyFirst) return propertyFirst[1];

  const contentFirst = html.match(
    new RegExp(
      '<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']' + property + '["\']',
    ),
  );
  if (contentFirst) return contentFirst[1];

  return null;
}

// URL pada skrip halaman embed sering muncul dalam bentuk ter-escape
// (\u0026 untuk &, \/ untuk /) atau memakai entitas HTML (&amp;).
// Seluruh halaman dinormalkan lebih dulu sebelum dipindai.
function collectCdnMediaUrls(html) {
  const decoded = html
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");

  const found = [];
  const seen = new Set();
  const pattern = /https?:\/\/[^\s"'<>\\]+/g;

  let match;
  while ((match = pattern.exec(decoded)) !== null) {
    let parsed;
    try {
      parsed = new URL(match[0]);
    } catch {
      continue;
    }

    if (!CDN_HOST_PATTERN.test(parsed.hostname)) continue;
    if (!CDN_MEDIA_PATH_PATTERN.test(parsed.pathname)) continue;
    if (seen.has(parsed.href)) continue;

    seen.add(parsed.href);
    found.push(parsed.href);
  }

  return found;
}

function mimeFromPath(path) {
  if (/\.mp4$/i.test(path)) return "video/mp4";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "image/jpeg";
}

// Jalur cadangan bila contextJSON tidak ada: item media dibangun dari URL
// CDN yang dipindai dari halaman embed, ditambah tag meta og:video/og:image.
// Video diletakkan lebih dulu agar tipe postingan terdeteksi dengan benar.
function buildFallbackItems(html) {
  const candidates = collectCdnMediaUrls(html);
  const ogVideo = extractMetaContent(html, "og:video");
  const ogImage = extractMetaContent(html, "og:image");

  const items = [];
  const seen = new Set();

  const pushItem = (url, mimeType) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({
      url,
      quality: "original",
      label: null,
      hasWatermark: false,
      mimeType,
      thumbnailUrl: mimeType === "video/mp4" ? (ogImage ?? url) : url,
    });
  };

  if (ogVideo) pushItem(ogVideo, "video/mp4");

  const videoCandidates = candidates.filter((url) => /\.mp4$/i.test(new URL(url).pathname));
  const imageCandidates = candidates.filter((url) => !/\.mp4$/i.test(new URL(url).pathname));

  for (const url of videoCandidates) {
    pushItem(url, "video/mp4");
  }
  for (const url of imageCandidates) {
    pushItem(url, mimeFromPath(new URL(url).pathname));
  }
  if (ogImage) pushItem(ogImage, "image/jpeg");

  return items;
}

function buildItemsFromNode(node) {
  const quality = node.dimensions
    ? `${node.dimensions.width}x${node.dimensions.height}`
    : "original";

  // Halaman embed Instagram hanya menyediakan satu varian media, sehingga
  // item tidak diberi label kualitas. display_url dipakai sebagai poster
  // video sekaligus pratinjau foto.
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

export async function resolveInstagram(rawUrl) {
  const shortcodeInfo = extractShortcode(rawUrl);
  if (!shortcodeInfo) {
    return {
      ok: false,
      error: {
        code: "invalid_link",
        message: "Tautan Instagram tidak mengandung penanda postingan yang dikenali.",
      },
    };
  }

  const sourceUrl = buildEmbedUrl(shortcodeInfo.type, shortcodeInfo.shortcode);

  let html;
  try {
    html = await fetchEmbedHtml(shortcodeInfo.type, shortcodeInfo.shortcode);
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

  const context = parseContext(html);
  const media = context?.shortcode_media;

  if (!media) {
    // contextJSON bisa hilang bila Instagram mengubah halaman embed atau
    // membatasi akses untuk server ini. Sebelum menyerah, coba jalur
    // cadangan berupa URL CDN dan tag meta pada halaman embed.
    const fallbackItems = buildFallbackItems(html);
    if (fallbackItems.length > 0) {
      return {
        ok: true,
        data: {
          platform: "instagram",
          type: fallbackItems.some((item) => item.mimeType === "video/mp4")
            ? "video"
            : "photo",
          items: fallbackItems,
          author: null,
          caption: extractMetaContent(html, "og:title") ?? null,
          sourceUrl,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "parse_failed",
        message:
          "Data media tidak dapat diurai dari halaman Instagram. Postingan mungkin membatasi akses untuk server ini atau struktur halaman sudah berubah.",
      },
    };
  }

  const sidecarEdges = media.edge_sidecar_to_children?.edges;
  let items = [];
  let type = "photo";

  if (sidecarEdges && sidecarEdges.length > 0) {
    type = "carousel";
    items = sidecarEdges.flatMap((edge) =>
      edge.node ? buildItemsFromNode(edge.node) : [],
    );
  } else {
    type = media.is_video ? "video" : "photo";
    items = buildItemsFromNode(media);
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
    captionEdges && captionEdges.length > 0
      ? captionEdges[0].node?.text ?? null
      : null;

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
