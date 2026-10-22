// Tolok ukur latensi Naze Intent Router.
//
// Mengukur latensi keputusan (decideIntent) dan jalur integrasi penuh
// (handleIntent) terhadap korpus tests/fixtures/intent-corpus.json dengan
// plugin stub, tanpa koneksi WhatsApp. Angka yang bermakna adalah hasil pada
// mesin tempat bot dijalankan, jadi jalankan langsung di lingkungan
// deployment setelah dependensi terpasang:
//
//   npm install
//   node tests/intent-router.bench.js
//
// Skrip ini sengaja tidak dimasukkan ke "npm test" supaya pengujian rutin
// tetap cepat. Nilai yang dilaporkan adalah latensi pemrosesan di dalam
// proses (termasuk overhead stub dan timer), bukan latensi jaringan
// WhatsApp. Jalankan beberapa kali dan ambil keadaan stabil; bandingkan p95
// dengan target yang ditetapkan pada dokumentasi docs/INTENT-ROUTER.md.

import fs from "node:fs";
import os from "node:os";
import { performance } from "node:perf_hooks";

const WARMUP_PASSES = 5;
const TIMED_PASSES_DECIDE = 200;
const TIMED_PASSES_HANDLE = 50;
const P95_TARGET_MS = 50;

const corpus = JSON.parse(
  fs.readFileSync(new URL("./fixtures/intent-corpus.json", import.meta.url), "utf8"),
)[0];

let router = null;
let registry = null;
let pluginsLib = null;
let config = null;
let loadError = null;

try {
  router = await import("../src/lib/naze-intent-router.js");
  registry = await import("../src/lib/naze-intent-registry.js");
  pluginsLib = await import("../src/lib/naze-plugins.js");
  config = (await import("../config.js")).default;
} catch (error) {
  loadError = error.message;
}

if (!router) {
  console.error(
    "Dependensi runtime belum terpasang (" +
      loadError +
      "). Jalankan npm install terlebih dahulu.",
  );
  process.exitCode = 1;
} else {
  const { decideIntent, handleIntent, clearIntentRouterState } = router;

  // Stub plugin yang sama dengan tests/intent-router.test.js supaya validasi
  // keberadaan plugin pada router terpenuhi tanpa memuat plugin asli.
  for (const declaration of registry.getAllDeclarations()) {
    pluginsLib.registerPlugin({
      config: {
        name: declaration.plugin,
        alias: [],
        category: "intent-stub",
        description: declaration.description,
        cooldown: 0,
        isEnabled: true,
      },
      handler: async () => {},
      filePath: "tests://intent-bench/" + declaration.id + ".js",
    });
  }

  function mediaFlags(media) {
    const flags = {};
    if (media === "image") flags.isImage = true;
    if (media === "video") flags.isVideo = true;
    if (media === "audio") flags.isAudio = true;
    if (media === "sticker") flags.isSticker = true;
    if (media === "document") flags.isDocument = true;
    return flags;
  }

  let messageCounter = 0;

  function buatPesan(body, extra) {
    messageCounter++;
    const m = {
      sender: "bench-" + messageCounter + "@s.whatsapp.net",
      chat: "chat-bench-" + (messageCounter % 8) + "@s.whatsapp.net",
      body: body,
      isCommand: false,
      isBot: false,
      isNewsletter: false,
      isBanned: false,
      isOwner: false,
      isPremium: true,
      isGroup: false,
      isPrivate: true,
      isAdmin: false,
      isBotAdmin: false,
      isImage: false,
      isVideo: false,
      isAudio: false,
      isSticker: false,
      isDocument: false,
      quoted: null,
      reply: async () => {},
      raw: { key: { id: "bench-id-" + messageCounter } },
    };
    return Object.assign(m, extra || {});
  }

  function stats(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;
    const at = (p) =>
      sorted[Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1))];
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    return { n: n, mean: mean, p50: at(50), p95: at(95), p99: at(99), max: sorted[n - 1] };
  }

  function fmt(ms) {
    return ms.toFixed(3) + " ms";
  }

  function printReport(label, samples) {
    const s = stats(samples);
    console.log(label);
    console.log("  sampel     : " + s.n);
    console.log("  rata-rata  : " + fmt(s.mean));
    console.log("  p50        : " + fmt(s.p50));
    console.log(
      "  p95        : " +
        fmt(s.p95) +
        (s.p95 < P95_TARGET_MS
          ? " (memenuhi target < " + P95_TARGET_MS + " ms)"
          : " (MELEBIHI target " + P95_TARGET_MS + " ms)"),
    );
    console.log("  p99        : " + fmt(s.p99));
    console.log("  maksimum   : " + fmt(s.max));
    console.log("  throughput : " + Math.round(1000 / s.mean) + " pesan/detik");
    console.log("");
  }

  const originalSmartTriggers = config.features.smartTriggers;
  config.features.smartTriggers = true;

  try {
    console.log("Tolor ukur Naze Intent Router");
    console.log("  Node     : " + process.version);
    console.log("  Platform : " + os.platform() + " " + os.arch());
    const cpu = os.cpus()[0];
    console.log("  CPU      : " + (cpu ? cpu.model : "tidak diketahui"));
    console.log("");

    // --- decideIntent: seluruh korpus, dipisah positif dan negatif ---
    const positive = corpus.positive;
    const negative = corpus.negative;

    for (let pass = 0; pass < WARMUP_PASSES; pass++) {
      for (const k of positive) decideIntent(k.text, k.media);
      for (const k of negative) decideIntent(k.text, k.media);
    }

    const decidePositive = [];
    const decideNegative = [];
    for (let pass = 0; pass < TIMED_PASSES_DECIDE; pass++) {
      for (const k of positive) {
        const start = performance.now();
        decideIntent(k.text, k.media);
        decidePositive.push(performance.now() - start);
      }
      for (const k of negative) {
        const start = performance.now();
        decideIntent(k.text, k.media);
        decideNegative.push(performance.now() - start);
      }
    }

    printReport(
      "decideIntent - kasus positif (" + positive.length + " teks per putaran)",
      decidePositive,
    );
    printReport(
      "decideIntent - kasus negatif/passthrough (" + negative.length + " teks per putaran)",
      decideNegative,
    );

    // --- handleIntent: skenario integrasi yang sama dengan pengujian ---
    const scenarios = [
      { body: "ubah gambar ini jadi stiker", extra: { isImage: true } },
      { body: "cari lagu potong bebek pangkas", extra: null },
      { body: "ambil stiker kucing dari koleksi", extra: null },
      { body: "ubah gambar ini ke png", extra: { isImage: true } },
      {
        body: "ubah teks ini jadi file txt",
        extra: { quoted: { body: "Nama saya Nendi" } },
      },
      {
        body: "unduh audio dari video youtube ini",
        extra: { quoted: { body: "cek https://youtu.be/abc123 ya" } },
    },
      { body: "kompres video ini", extra: { isVideo: true } },
      { body: "bikin brat", extra: null },
    ];
    for (const k of negative) {
      scenarios.push({ body: k.text, extra: mediaFlags(k.media) });
    }

    const dispatchStub = async () => true;

    for (let pass = 0; pass < WARMUP_PASSES; pass++) {
      for (const s of scenarios) {
        await handleIntent(buatPesan(s.body, s.extra), null, dispatchStub);
      }
    }

    const handleSamples = [];
    for (let pass = 0; pass < TIMED_PASSES_HANDLE; pass++) {
      for (const s of scenarios) {
        const m = buatPesan(s.body, s.extra);
        const start = performance.now();
        await handleIntent(m, null, dispatchStub);
        handleSamples.push(performance.now() - start);
      }
    }

    printReport(
      "handleIntent - jalur penuh (" + scenarios.length + " pesan per putaran)",
        handleSamples,
    );
  } finally {
    config.features.smartTriggers = originalSmartTriggers;
    clearIntentRouterState();
  }
}
