// plugins/tools/preset.js
// Preset Instan: analisis proyek Alight Motion (XML atau ZIP), sesi
// penggantian foto berurutan, dan keluaran XML/ZIP remix.
// Kejujuran: TIDAK ada render MP4; tautan berbagi hanya menghasilkan
// metadata (bila API tersedia), bukan unduhan proyek; penggantian
// video/audio belum didukung pada versi ini.

import te from "../../src/lib/naze-error.js";
import config from "../../config.js";
import AdmZip from "adm-zip";
import {
  sniffBufferKind,
  isSafeAlightShareUrl,
  isSafeZipEntryName,
  resolvePresetLimits,
} from "../../src/lib/naze-preset-session-core.js";
import {
  getPresetSession,
  startPresetSession,
  cancelPresetSession,
  sweepExpiredPresetSessions,
  buildSummaryText,
  buildPromptText,
} from "../../src/lib/naze-preset-session.js";
import { analyzePresetText } from "../../src/lib/naze-am-preset/workflow.js";

const pluginConfig = {
  name: "preset",
  alias: ["preset-instan"],
  category: "tools",
  description: "Ganti foto pada preset Alight Motion (XML/ZIP) secara berurutan",
  usage: ".preset <kirim/reply file XML atau ZIP proyek>",
  example: ".preset (dilampirkan file .xml proyek Alight Motion)",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const AM_API = "https://api.obscuraworks.org/api/tools/amdata";

function helpText(m) {
  return (
    " *Preset Instan*\n\n" +
    "Ganti foto pada preset Alight Motion tanpa mengubah animasi.\n\n" +
    "1. Kirim atau reply berkas proyek *.xml* (atau *.zip* berisi XML) dengan caption `" +
    m.prefix +
    "preset`\n" +
    "2. Bot menganalisis slot media, lalu meminta foto pengganti satu per satu\n" +
    "3. Ketik *selesai* untuk mendapat hasil, *skip* untuk lewati slot, *batal* untuk membatalkan\n\n" +
    "Tautan berbagi alightcreative.com hanya memberi metadata (info proyek), bukan berkas proyek. Untuk penggantian media, kirim XML/ZIP proyeknya."
  );
}

function pickDocumentSource(m) {
  if (m.isDocument) return m;
  if (m.quoted?.isDocument) return m.quoted;
  return null;
}

function findShareUrl(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

async function handleShareLink(m, url) {
  const safe = isSafeAlightShareUrl(url);
  if (!safe.ok) {
    return m.reply(" *Tautan Ditolak*\n\n> " + safe.error);
  }
  const key = config.APIkey?.obscura;
  if (!key) {
    return m.reply(
      " *Metadata Tidak Tersedia*\n\n" +
        "Layanan metadata tautan berbagi belum dikonfigurasi pada bot ini.\n" +
        "Untuk penggantian media, kirim berkas proyek *.xml* atau *.zip* dengan caption `" +
        m.prefix +
        "preset`."
    );
  }
  try {
    const r = await fetch(AM_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: safe.url }),
    });
    const res = await r.json();
    const info = res?.data?.info;
    if (!res?.status || !info) {
      return m.reply(
        " *Gagal Membaca Data*\n\n> Pastikan tautan berbagi Alight Motion valid."
      );
    }
    return m.reply(
      " *Metadata Tautan Berbagi*\n\n" +
        "*Judul* → " +
        (info.title || "-") +
        "\n*Versi* → " +
        (info.amVersionString || "-") +
        "\n*Platform* → " +
        (info.amPlatform || "-") +
        "\n*Unduhan* → " +
        (info.downloads ?? 0) +
        "x\n*Likes* → " +
        (info.likes ?? 0) +
        "\n\n" +
        "Tautan berbagi hanya memberi metadata — bot TIDAK dapat mengunduh berkas proyek dari tautan.\n" +
        "Untuk penggantian media, kirim berkas proyek *.xml* atau *.zip* dengan caption `" +
        m.prefix +
        "preset`."
    );
  } catch (e) {
    return m.reply(te(m.prefix, m.command, m.pushName));
  }
}

function analyzeZipEntries(buffer, limits) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { ok: false, error: "Berkas ZIP rusak atau tidak dapat dibaca." };
  }
  const entries = zip.getEntries();
  if (entries.length === 0) {
    return { ok: false, error: "ZIP kosong: tidak ada entri yang dapat dibaca." };
  }
  let candidateCount = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (!isSafeZipEntryName(entry.entryName)) continue;
    if (!entry.entryName.toLowerCase().endsWith(".xml")) continue;
    if (entry.header.size > limits.presetMaxBytes) continue;
    candidateCount += 1;
    let xmlText;
    try {
      xmlText = entry.getData().toString("utf8");
    } catch {
      continue;
    }
    const analysis = analyzePresetText(xmlText);
    if (analysis.ok) {
      return {
        ok: true,
        error: "",
        xmlText,
        fileName: entry.entryName.split("/").pop(),
      };
    }
  }
  if (candidateCount === 0) {
    return {
      ok: false,
      error: "Tidak ada berkas .xml yang aman dibaca di dalam ZIP.",
    };
  }
  return {
    ok: false,
    error: "Berkas .xml di dalam ZIP tidak lolos analisis proyek Alight Motion.",
  };
}

async function handleDocument(m, source) {
  let buffer;
  try {
    buffer = await source.download();
  } catch {
    return m.reply(" *Gagal mengunduh berkas.* Kirim ulang berkasnya.");
  }
  if (!buffer || buffer.length === 0) {
    return m.reply(" *Berkas kosong atau gagal diunduh.*");
  }
  const limits = resolvePresetLimits(config.preset);
  if (buffer.length > limits.zipMaxBytes) {
    return m.reply(
      " *Berkas Terlalu Besar*\n\n> Ukuran melebihi batas " +
        Math.round(limits.zipMaxBytes / (1024 * 1024)) +
        " MB."
    );
  }
  const sniff = sniffBufferKind(buffer);
  let result;
  let fileName = source.fileName || source?.message?.documentMessage?.fileName || "preset.xml";
  if (sniff.kind === "xml") {
    result = { ok: true, xmlText: buffer.toString("utf8"), fileName };
  } else if (sniff.kind === "zip") {
    result = analyzeZipEntries(buffer, limits);
  } else {
    return m.reply(
      " *Format Tidak Dikenali*\n\n> Tanda tangan berkas bukan XML maupun ZIP. Ekstensi tidak dipercaya; kirim berkas proyek Alight Motion yang asli."
    );
  }
  if (!result.ok) {
    return m.reply(" *Preset Ditolak*\n\n> " + result.error);
  }
  const start = startPresetSession({
    ownerJid: m.sender,
    chatJid: m.chat,
    fileName: result.fileName,
    xmlText: result.xmlText,
    limits: config.preset,
  });
  if (!start.ok) {
    return m.reply(
      " *Analisis Gagal*\n\n> " +
        start.error +
        "\n\nKirim berkas proyek Alight Motion (.xml) yang diekspor langsung dari aplikasi."
    );
  }
  const state = start.state;
  let msg = buildSummaryText(state);
  if (state.promptSlotIndexes.length === 0) {
    msg +=
      "\n\n*Tidak ada slot foto yang dapat diganti pada proyek ini.* Ketik *batal* untuk mengakhiri sesi.";
  } else {
    msg += "\n\n" + buildPromptText(state);
  }
  return m.reply(msg);
}

async function handler(m, { sock }) {
  sweepExpiredPresetSessions();

  const source = pickDocumentSource(m);
  if (!source) {
    const url = findShareUrl(m.text);
    if (url) {
      return handleShareLink(m, url);
    }
    const existing = getPresetSession(m.sender);
    if (existing) {
      const state = existing.state;
      if (state.chatJid !== m.chat) {
        return m.reply(
          " *Sesi Preset Aktif di Chat Lain*\n\n> Selesaikan atau batalkan sesi di chat asalnya."
        );
      }
      return m.reply(
        " *Sesi Preset Masih Aktif*\n\n" +
          "Slot terkumpul: " +
          state.replacements.length +
          " dari " +
          state.promptSlotIndexes.length +
          ".\n\n" +
          buildPromptText(state)
      );
    }
    return m.reply(helpText(m));
  }
  return handleDocument(m, source);
}

export { pluginConfig as config, handler };
