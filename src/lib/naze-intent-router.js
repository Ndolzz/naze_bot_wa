// Naze Intent Router.
//
// Mengenali permintaan berbahasa Indonesia sehari-hari pada pesan tanpa
// prefix, memilih plugin yang sesuai, lalu mengeksekusinya melalui
// dispatcher plugin yang sudah ada. Router aktif hanya jika
// config.features.smartTrigger bernilai true; seluruh perintah eksplisit,
// sesi pengumpulan berkas, dan perilaku bot lainnya tidak berubah.
//
// Keputusan diambil dari aturan deterministik pada registri kemampuan
// (naze-intent-registry.js): skor minimal "threshold", selisih skor kandidat
// minimal "minMargin", klarifikasi saat ambigu atau media kurang, penolakan
// multi langkah, dan penjelasan untuk fitur yang belum didukung.

import config from "../../config.js";
import { getPlugin } from "./naze-plugins.js";
import { dispatchPlugin, replySafe } from "./naze-plugin-dispatch.js";
import {
  getActiveCapabilities,
  getAllDeclarations,
  getUnsupportedMatchers,
  mediaLabel,
  scoreDeclaration,
} from "./naze-intent-registry.js";

const DEFAULT_SETTINGS = {
  threshold: 6,
  minMargin: 2,
  maxTextLength: 500,
  clarifyTtlMs: 60000,
};

const MULTI_STEP_PATTERN = /\s(lalu|kemudian|trus|setelah itu)\s/i;
const MULTI_STEP_MESSAGE =
  "Maaf, beberapa langkah berurutan dalam satu pesan belum didukung. Jalankan satu langkah dulu, tunggu hasilnya, lalu lanjutkan langkah berikutnya.";

const URL_PATTERNS = [
  [/youtu\.be|youtube\.com/i, "url-yt"],
  [/tiktok\.com/i, "url-tt"],
  [/instagram\.com/i, "url-ig"],
];

const FILLER_PAYLOAD_PATTERN = /^(teks|pesan|catatan|link|tulisan)\s(ini|itu|tadi)$/i;
const PAYLOAD_PREFIX_PATTERN = /^(dari|tentang)\s/i;

// Klarifikasi tertunda per (pengirim, chat) dan tanda pesan yang sudah
// diproses untuk mencegah eksekusi ganda.
const pendingClarifications = new Map();
const seenMessageIds = new Map();

function clearIntentRouterState() {
  pendingClarifications.clear();
  seenMessageIds.clear();
}

function resolveSettings() {
  const block = config.intentRouter || {};
  const pick = (value, fallback) => (Number.isFinite(value) ? value : fallback);
  return {
    threshold: pick(Number(block.threshold), DEFAULT_SETTINGS.threshold),
    minMargin: pick(Number(block.minMargin), DEFAULT_SETTINGS.minMargin),
    maxTextLength: pick(Number(block.maxTextLength), DEFAULT_SETTINGS.maxTextLength),
    clarifyTtlMs: pick(Number(block.clarifyTtlMs), DEFAULT_SETTINGS.clarifyTtlMs),
  };
}

function normalizeText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function continuationKey(m) {
  return String(m.sender || "") + ":" + String(m.chat || "");
}

function isDuplicateMessage(m) {
  const id = m?.raw?.key?.id || m?.id || null;
  if (!id) return false;
  if (seenMessageIds.has(id)) return true;
  seenMessageIds.set(id, Date.now());
  if (seenMessageIds.size > 500) {
    const now = Date.now();
    for (const [key, time] of seenMessageIds) {
      if (now - time > 300000) seenMessageIds.delete(key);
    }
  }
  return false;
}

function detectMediaKind(m) {
  if (m.isImage) return "image";
  if (m.isVideo) return "video";
  if (m.isAudio) return "audio";
  if (m.isSticker) return "sticker";
  if (m.isDocument) return "document";
  const quoted = m.quoted || null;
  if (quoted) {
    if (quoted.isImage) return "image";
    if (quoted.isVideo) return "video";
    if (quoted.isAudio) return "audio";
    if (quoted.isSticker) return "sticker";
    if (quoted.isDocument) return "document";
  }
  const bodies = [
    typeof m.body === "string" ? m.body : "",
    quoted && typeof quoted.body === "string" ? quoted.body : "",
  ];
  for (const body of bodies) {
    if (!body) continue;
    for (const [pattern, kind] of URL_PATTERNS) {
      if (pattern.test(body)) return kind;
    }
  }
  if (bodies[0].trim()) return "text";
  return "none";
}

function matchUnsupported(text) {
  for (const matcher of getUnsupportedMatchers()) {
    if (matcher.patterns.every((pattern) => pattern.test(text))) {
      return matcher;
    }
  }
  return null;
}

function decideIntent(text, mediaKind, settings, capabilities) {
  const resolved = settings || resolveSettings();
  const declarations = capabilities || getActiveCapabilities();
  const normalized = normalizeText(text);
  if (!normalized) return { type: "passthrough" };

  const scored = [];
  for (const declaration of declarations) {
    const score = scoreDeclaration(declaration, normalized, mediaKind);
    if (score > 0) scored.push({ declaration, score });
  }
  scored.sort((a, b) => b.score - a.score);

  if (MULTI_STEP_PATTERN.test(normalized)) {
    const eligible = scored.filter((entry) => entry.score >= resolved.threshold);
    if (eligible.length >= 2) return { type: "multi-step-rejected" };
  }

  if (!scored.length || scored[0].score < resolved.threshold) {
    const matcher = matchUnsupported(normalized);
    if (matcher) return { type: "unsupported", matcher };
    return { type: "passthrough" };
  }

  const top = scored[0];
  const second = scored[1];
  if (second && second.score > 0 && top.score - second.score < resolved.minMargin) {
    const candidates = scored
      .filter((entry) => top.score - entry.score < resolved.minMargin)
      .map((entry) => entry.declaration);
    return { type: "clarify-ambiguous", candidates };
  }

  if (
    top.declaration.requires &&
    top.declaration.requires.length &&
    !top.declaration.requires.includes(mediaKind)
  ) {
    return { type: "clarify-media", capability: top.declaration };
  }

  return { type: "execute", capability: top.declaration };
}

function selectClarifiedCapability(text, candidateIds) {
  const byId = new Map(getAllDeclarations().map((d) => [d.id, d]));
  const numeric = text.match(/^([1-9])$/);
  if (numeric) {
    const index = parseInt(numeric[1], 10) - 1;
    if (index >= 0 && index < candidateIds.length) {
      return byId.get(candidateIds[index]) || null;
    }
    return null;
  }
  const lower = text.toLowerCase();
  for (const id of candidateIds) {
    const declaration = byId.get(id);
    if (
      declaration &&
      (lower.includes(declaration.id) || lower.includes(declaration.plugin))
    ) {
      return declaration;
    }
  }
  return null;
}

function matchArgPatterns(patterns, text) {
  if (!patterns || !patterns.length) return null;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim()) return match[1].trim();
  }
  return null;
}

function extractPayload(declaration, text, m) {
  let payload = matchArgPatterns(declaration.argPatterns, text);
  if (payload === null) {
    const quotedBody =
      m && m.quoted && typeof m.quoted.body === "string"
        ? m.quoted.body.trim()
        : "";
    if (quotedBody) {
      if (declaration.quotedPayload === "pattern") {
        payload = matchArgPatterns(declaration.argPatterns, quotedBody);
      } else if (
        declaration.quotedPayload === "raw" &&
        declaration.quotedRefPattern &&
        declaration.quotedRefPattern.test(text)
      ) {
        payload = quotedBody;
      }
    }
  }
  if (payload === null) payload = "";
  for (const pattern of declaration.cleanup || []) {
    payload = payload.replace(pattern, "");
  }
  payload = payload.replace(PAYLOAD_PREFIX_PATTERN, "").trim();
  if (FILLER_PAYLOAD_PATTERN.test(payload)) payload = "";
  return payload.trim();
}

function buildInvocationMessage(m, declaration, payload, text) {
  let invocationText = "";
  if (declaration.passText === "original") {
    invocationText = text;
  } else if (declaration.passText === "payload") {
    invocationText = payload;
  }
  const args = invocationText ? invocationText.split(/\s+/) : [];
  // Pesan asli tidak diubah; plugin menerima salinan dangkal dengan teks
  // dan argumen yang sudah disesuaikan, media dan pesan kutipan tetap utuh.
  return { ...m, text: invocationText, args };
}

function mediaRequiredMessage(declaration) {
  const labels = declaration.requires.map(mediaLabel).join(" atau ");
  return (
    'Untuk fitur "' +
    declaration.plugin +
    '", kirim atau balas pesan berisi ' +
    labels +
    " terlebih dahulu."
  );
}

async function executeCapability(declaration, m, sock, dispatch, settings) {
  const plugin = getPlugin(declaration.plugin);
  if (!plugin) {
    await replySafe(m, 'Fitur "' + declaration.plugin + '" tidak tersedia saat ini.');
    return true;
  }

  const mediaKind = detectMediaKind(m);
  if (
    declaration.requires &&
    declaration.requires.length &&
    !declaration.requires.includes(mediaKind)
  ) {
    await replySafe(m, mediaRequiredMessage(declaration));
    return true;
  }

  const text = normalizeText(m.body);
  const payload = extractPayload(declaration, text, m);
  if (declaration.requiresArg && !payload) {
    await replySafe(
      m,
      declaration.argHint ||
        'Sebutkan keterangan tambahan untuk fitur "' + declaration.plugin + '".',
    );
    return true;
  }

  const invocation = buildInvocationMessage(m, declaration, payload, text);
  return Boolean(await dispatch(invocation, sock, plugin));
}

async function handleIntent(m, sock, dispatch = dispatchPlugin) {
  if (!config.features?.smartTriggers) return false;
  if (!m || m.isCommand || m.isNewsletter) return false;
  if (m.isBot && config.mode !== "self") return false;
  if (m.isBanned) return false;

  const rawText = typeof m.body === "string" ? m.body : "";
  if (!rawText.trim()) return false;

  const settings = resolveSettings();
  const text = normalizeText(rawText);
  if (!text || text.length > settings.maxTextLength) return false;
  if (isDuplicateMessage(m)) return false;

  // Lanjutan klarifikasi: pilihan bernomor atau nama fitur dari daftar yang
  // sebelumnya dikirim. Selain itu, pesan diproses sebagai permintaan baru.
  const key = continuationKey(m);
  const pending = pendingClarifications.get(key);
  if (pending) {
    pendingClarifications.delete(key);
    if (Date.now() - pending.at <= settings.clarifyTtlMs) {
      const selected = selectClarifiedCapability(text, pending.candidates);
      if (selected) {
        return executeCapability(selected, m, sock, dispatch, settings);
      }
    }
  }

  const mediaKind = detectMediaKind(m);
  const decision = decideIntent(text, mediaKind, settings);
  switch (decision.type) {
    case "execute":
      return executeCapability(decision.capability, m, sock, dispatch, settings);
    case "clarify-ambiguous": {
      pendingClarifications.set(key, {
        candidates: decision.candidates.map((declaration) => declaration.id),
        at: Date.now(),
      });
      const lines = ["Maksud permintaanmu belum jelas. Pilih salah satu:"];
      decision.candidates.forEach((declaration, index) => {
        lines.push(
          index +
            1 +
            ". " +
            declaration.plugin +
            " - " +
            declaration.description,
        );
      });
      lines.push("Balas dengan nomor pilihan atau nama fiturnya.");
      await replySafe(m, lines.join("\n"));
      return true;
    }
    case "clarify-media":
      await replySafe(m, mediaRequiredMessage(decision.capability));
      return true;
    case "unsupported":
      await replySafe(m, decision.matcher.message);
      return true;
    case "multi-step-rejected":
      await replySafe(m, MULTI_STEP_MESSAGE);
      return true;
    default:
      return false;
  }
}

export {
  decideIntent,
  handleIntent,
  detectMediaKind,
  clearIntentRouterState,
};
