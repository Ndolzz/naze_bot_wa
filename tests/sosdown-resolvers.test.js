// Pengujian resolver sosdown (TikTok dan Instagram) setelah perbaikan bug
// unduhan pada tahap verifikasi lapangan. Seluruhnya murni: globalThis.fetch
// diganti stub lokal sehingga tidak ada akses jaringan saat pengujian.
// Jalankan dengan: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { resolveTikTok } from "../src/lib/sosdown/tiktok.js";
import { resolveInstagram } from "../src/lib/sosdown/instagram.js";

// ---------------------------------------------------------------------------
// Stub fetch dan pembantu fiksatur
// ---------------------------------------------------------------------------

function createFakeResponse({ status = 200, html = "", url = "", cookies = [] } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {
      getSetCookie: () => cookies,
      get: (name) => (name === "set-cookie" ? cookies.join("\n") : null),
    },
    text: async () => html,
  };
}

function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (input, options) => {
    const url = String(input);
    calls.push({ url, options: options ?? {} });
    return handler(url, options ?? {});
  };

  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const TIKTOK_VIDEO_URL = "https://www.tiktok.com/@kucingresmi/video/7300000000000000001";
const TIKTOK_HOME_URL = "https://www.tiktok.com/";

const TIKTOK_VIDEO_ITEM = {
  id: "7300000000000000001",
  desc: "kucing menari",
  author: { uniqueId: "kucingresmi" },
  video: {
    ratio: "720p",
    playAddr: "https://v16-webapp.tiktok.com/video-no-wm.mp4",
    downloadAddr: "https://v16-webapp.tiktok.com/video-wm.mp4",
    originCover: "https://p16-sign.tiktokcdn.com/cover.jpg",
    bitrateInfo: [
      { Bitrate: 300000, PlayAddr: { UrlList: ["https://v16-webapp.tiktok.com/sd.mp4"] } },
      { Bitrate: 900000, PlayAddr: { UrlList: ["https://v16-webapp.tiktok.com/hd.mp4"] } },
    ],
  },
};

function wrapRehydration(payload) {
  return (
    '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" data-cache-host="tiktok">' +
    JSON.stringify(payload) +
    "</script>"
  );
}

function rehydrationPage(itemStruct, statusCode = 0) {
  return wrapRehydration({
    __DEFAULT_SCOPE__: {
      "webapp.video-detail": { statusCode, itemInfo: { itemStruct } },
    },
  });
}

function sigiPage(itemModule) {
  return (
    '<script id="__SIGI_STATE__">' + JSON.stringify({ ItemModule: itemModule }) + "</script>"
  );
}

function instagramContextPage(context) {
  return (
    "<script>window.__additionalDataLoaded(\"extra\",{\"contextJSON\":" +
    JSON.stringify(JSON.stringify(context)) +
    "});</script>"
  );
}

// ---------------------------------------------------------------------------
// resolveTikTok (src/lib/sosdown/tiktok.js)
// ---------------------------------------------------------------------------

test("resolveTikTok menghasilkan item video dari blok rehidrasi", async () => {
  const stub = stubFetch(() => createFakeResponse({ html: rehydrationPage(TIKTOK_VIDEO_ITEM) }));

  try {
    const result = await resolveTikTok(TIKTOK_VIDEO_URL);

    assert.equal(result.ok, true);
    assert.equal(result.data.platform, "tiktok");
    assert.equal(result.data.type, "video");
    assert.equal(result.data.author, "kucingresmi");
    assert.equal(result.data.caption, "kucing menari");

    const labels = result.data.items.map((item) => item.label);
    assert.deepEqual(labels, ["hd", "sd", null]);
    assert.equal(result.data.items[0].url, "https://v16-webapp.tiktok.com/hd.mp4");
    assert.equal(result.data.items[1].url, "https://v16-webapp.tiktok.com/sd.mp4");
    assert.equal(result.data.items[2].hasWatermark, true);

    assert.equal(stub.calls.length, 1);
    assert.equal("Cookie" in stub.calls[0].options.headers, false);
  } finally {
    stub.restore();
  }
});

test("resolveTikTok mengulang dengan cookie saat halaman pertama tanpa blok data", async () => {
  const goodHtml = rehydrationPage(TIKTOK_VIDEO_ITEM);
  let videoPageCalls = 0;
  const stub = stubFetch((url) => {
    if (url === TIKTOK_HOME_URL) {
      return createFakeResponse({ cookies: ["tt_webid=abc123; Path=/; Max-Age=0"] });
    }
    videoPageCalls += 1;
    return createFakeResponse({
      html: videoPageCalls === 1 ? "<html>halaman pemeriksaan anti-bot</html>" : goodHtml,
    });
  });

  try {
    const result = await resolveTikTok(TIKTOK_VIDEO_URL);

    assert.equal(result.ok, true);
    assert.equal(result.data.items.length > 0, true);

    assert.equal(stub.calls.length, 3);
    assert.equal("Cookie" in stub.calls[0].options.headers, false);
    assert.equal(stub.calls[2].options.headers.Cookie, "tt_webid=abc123");
  } finally {
    stub.restore();
  }
});

test("resolveTikTok melaporkan bot_blocked bila pengulangan tetap tanpa data", async () => {
  const stub = stubFetch((url) => {
    if (url === TIKTOK_HOME_URL) {
      return createFakeResponse({ cookies: ["tt_webid=abc123; Path=/"] });
    }
    return createFakeResponse({ html: "<html>halaman pemeriksaan anti-bot</html>" });
  });

  try {
    const result = await resolveTikTok(TIKTOK_VIDEO_URL);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "bot_blocked");
    assert.ok(result.error.message.includes("menolak"));

    const withCookie = stub.calls.filter(
      (call) => call.options.headers && call.options.headers.Cookie === "tt_webid=abc123",
    );
    assert.equal(withCookie.length > 0, true);
  } finally {
    stub.restore();
  }
});

test("resolveTikTok memakai SIGI_STATE sebagai jalur cadangan", async () => {
  const item = {
    id: "7300000000000000001",
    desc: "dari sigi",
    author: { uniqueId: "kucingresmi" },
    video: {
      ratio: "720p",
      playAddr: "https://v16-webapp.tiktok.com/sigi.mp4",
    },
  };
  const stub = stubFetch(() =>
    createFakeResponse({
      html: "<html><head>" + sigiPage({ "7300000000000000001": item }) + "</head></html>",
    }),
  );

  try {
    const result = await resolveTikTok(TIKTOK_VIDEO_URL);

    assert.equal(result.ok, true);
    assert.equal(result.data.items[0].url, "https://v16-webapp.tiktok.com/sigi.mp4");
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
  }
});

test("resolveTikTok menampilkan kode statusCode bila konten tidak tersedia", async () => {
  const stub = stubFetch(() => createFakeResponse({ html: rehydrationPage(null, 10221) }));

  try {
    const result = await resolveTikTok(TIKTOK_VIDEO_URL);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "content_unavailable");
    assert.ok(result.error.message.includes("10221"));
  } finally {
    stub.restore();
  }
});

test("resolveTikTok gagal rapi bila halaman tidak dapat diambil", async () => {
  const stub = stubFetch(() => createFakeResponse({ status: 503, html: "" }));

  try {
    const result = await resolveTikTok(TIKTOK_VIDEO_URL);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "parse_failed");
  } finally {
    stub.restore();
  }
});

// ---------------------------------------------------------------------------
// resolveInstagram (src/lib/sosdown/instagram.js)
// ---------------------------------------------------------------------------

const INSTAGRAM_REEL_URL = "https://www.instagram.com/reel/Cxyz123abc/";

test("resolveInstagram memparsing contextJSON foto dengan lengkap", async () => {
  const context = {
    shortcode_media: {
      is_video: false,
      display_url: "https://scontent.cdninstagram.com/foto1.jpg",
      dimensions: { width: 1080, height: 1080 },
      owner: { username: "kucinggram" },
      edge_media_to_caption: { edges: [{ node: { text: "foto kucing" } }] },
    },
  };
  const stub = stubFetch(() =>
    createFakeResponse({ html: instagramContextPage(context) }),
  );

  try {
    const result = await resolveInstagram(INSTAGRAM_REEL_URL);

    assert.equal(result.ok, true);
    assert.equal(result.data.type, "photo");
    assert.equal(result.data.author, "kucinggram");
    assert.equal(result.data.caption, "foto kucing");
    assert.equal(result.data.items[0].url, "https://scontent.cdninstagram.com/foto1.jpg");
    assert.equal(result.data.items[0].mimeType, "image/jpeg");
  } finally {
    stub.restore();
  }
});

test("resolveInstagram memakai URL CDN dan og meta saat contextJSON hilang", async () => {
  const html =
    "<html><head>" +
    '<meta property="og:video" content="https://scontent.cdninstagram.com/v/video1.mp4">' +
    '<meta content="https://scontent.cdninstagram.com/poster1.jpg" property="og:image">' +
    "<title>embed</title></head><body>" +
    '<script>var player="https:\\/\\/scontent.cdninstagram.com\\/v\\/video2.mp4?oe=1\\u0026h=abc";</script>' +
    "</body></html>";
  const stub = stubFetch(() => createFakeResponse({ html }));

  try {
    const result = await resolveInstagram(INSTAGRAM_REEL_URL);

    assert.equal(result.ok, true);
    assert.equal(result.data.type, "video");
    assert.equal(result.data.items[0].mimeType, "video/mp4");
    assert.equal(
      result.data.items[0].url,
      "https://scontent.cdninstagram.com/v/video1.mp4",
    );

    const videoFromScript = result.data.items.find(
      (item) => item.url === "https://scontent.cdninstagram.com/v/video2.mp4?oe=1&h=abc",
    );
    assert.ok(videoFromScript, "URL CDN ter-escape harus ikut terdeteksi");

    const poster = result.data.items.find(
      (item) => item.url === "https://scontent.cdninstagram.com/poster1.jpg",
    );
    assert.ok(poster, "og:image harus ikut menjadi item foto");
    assert.equal(poster.mimeType, "image/jpeg");
  } finally {
    stub.restore();
  }
});

test("resolveInstagram menolak tautan tanpa penanda postingan", async () => {
  const result = await resolveInstagram("https://www.instagram.com/kucinggram/");

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_link");
});

test("resolveInstagram menyatakan konten tidak tersedia", async () => {
  const stub = stubFetch(() =>
    createFakeResponse({ html: "<html>Sorry, this page isn't available.</html>" }),
  );

  try {
    const result = await resolveInstagram(INSTAGRAM_REEL_URL);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "content_unavailable");
  } finally {
    stub.restore();
  }
});

test("resolveInstagram gagal rapi bila halaman embed tidak memuat data", async () => {
  const stub = stubFetch(() => createFakeResponse({ html: "<html>kosong</html>" }));

  try {
    const result = await resolveInstagram(INSTAGRAM_REEL_URL);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "parse_failed");
    assert.ok(result.error.message.includes("membatasi akses"));
  } finally {
    stub.restore();
  }
});
