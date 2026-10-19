// src/lib/naze-preset-session-core.js
// Inti MURNI (tanpa fs, tanpa dependensi) dari sesi Preset Instan:
// state machine pengumpulan media berurutan, validasi masukan (signature
// berkas, URL tautan berbagi, nama entri ZIP), batas ukuran/TTL, dan
// perakitan daftar penggantian untuk remixer. Bagian fs (penyimpanan,
// pembuatan ZIP, hook pesan) berada di naze-preset-session.js agar logika
// inti dapat diuji otomatis tanpa lingkungan WhatsApp.
// Kejujuran: bot TIDAK merender MP4 dan TIDAK menjamin keberhasilan impor
// di Alight Motion. URI label naze-preset:// hanyalah penanda slot untuk
// re-link manual "Ganti Media", bukan media aktif.

import { analyzePresetText } from './naze-am-preset/workflow.js';

export const DEFAULT_PRESET_LIMITS = {
  presetMaxBytes: 15 * 1024 * 1024,
  zipMaxBytes: 20 * 1024 * 1024,
  mediaMaxBytes: 10 * 1024 * 1024,
  sessionTtlMs: 30 * 60 * 1000,
};

export function resolvePresetLimits(overrides) {
  const merged = { ...DEFAULT_PRESET_LIMITS };
  if (overrides && typeof overrides === 'object') {
    for (const key of Object.keys(DEFAULT_PRESET_LIMITS)) {
      const value = Number(overrides[key]);
      if (Number.isFinite(value) && value > 0) merged[key] = value;
    }
  }
  return merged;
}

/* ---------- Validasi masukan (pure) ---------- */

// Deteksi jenis berkas dari signature/magic bytes, bukan dari ekstensi.
export function sniffBufferKind(buffer) {
  if (!buffer || typeof buffer.length !== 'number' || buffer.length < 4) {
    return { kind: 'unknown', ext: null, mime: null };
  }
  const b = buffer;
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) && (b[3] === 0x04 || b[3] === 0x06 || b[3] === 0x08)) {
    return { kind: 'zip', ext: 'zip', mime: 'application/zip' };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { kind: 'jpeg', ext: 'jpg', mime: 'image/jpeg' };
  }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { kind: 'png', ext: 'png', mime: 'image/png' };
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { kind: 'webp', ext: 'webp', mime: 'image/webp' };
  }
  // XML tidak punya magic number: tanda tangan tekstual.
  const head = String(buffer.slice(0, 512)).replace(/^(\uFEFF|\uFFFE)/, '').trimStart();
  if (head.startsWith('<?xml') || head.startsWith('<!--') || head.startsWith('<scene')) {
    return { kind: 'xml', ext: 'xml', mime: 'application/xml' };
  }
  return { kind: 'unknown', ext: null, mime: null };
}

// Validasi ketat URL tautan berbagi Alight Motion (anti-SSRF):
// hanya https + hostname allowlist; menolak skema lain, userinfo, dan host
// di luar allowlist (termasuk alamat IP dan localhost).
const ALIGHT_SHARE_HOSTS = new Set(['alightcreative.com', 'www.alightcreative.com']);

export function isSafeAlightShareUrl(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'URL kosong.' };
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'URL tidak valid.' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Hanya URL https:// yang diizinkan.' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'URL dengan userinfo ditolak.' };
  }
  if (!ALIGHT_SHARE_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: 'Hostname tidak diizinkan. Hanya tautan berbagi alightcreative.com yang didukung.' };
  }
  return { ok: true, error: '', url: url.toString() };
}

// Cegah path traversal pada nama entri ZIP: tolak segmen "..", jalur
// absolut, backslash, karakter kontrol, dan nama kosong/terlalu panjang.
export function isSafeZipEntryName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) return false;
  if (/[\x00-\x1f]/.test(name)) return false;
  if (name.includes('\\')) return false;
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false;
  const parts = name.split('/');
  if (parts.some((p) => p === '..')) return false;
  return true;
}

// Sanitasi nama berkas untuk penyimpanan sesi dan entri ZIP keluaran.
// Titik di awal dibuang agar hasil sanitasi tidak dapat menjadi segmen
// ".." pada jalur berkas (pencegahan path traversal).
export function sanitizeName(text) {
  const cleaned = String(text || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || 'file';
}

// URI label penanda slot. Bukan path server, bukan URI perangkat, dan tidak
// dianggap dapat memuat media di perangkat lain — hanya penanda untuk
// pencocokan manual "Ganti Media". Nomor slot menjamin keunikan antar-slot.
export function buildSlotLabelUri(slotNumber, fileName) {
  return 'naze-preset://slot/' + Number(slotNumber) + '/' + sanitizeName(fileName);
}

/* ---------- State machine sesi (pure) ---------- */

export function createPresetSessionState({ id, ownerJid, chatJid, fileName, xmlText, limits, now }) {
  if (typeof xmlText !== 'string' || xmlText.length === 0) {
    return { ok: false, error: 'Teks proyek kosong.' };
  }
  const analysis = analyzePresetText(xmlText);
  if (!analysis.ok) {
    return { ok: false, error: analysis.error };
  }
  const resolvedLimits = resolvePresetLimits(limits);
  const slots = analysis.slots;
  const promptSlotIndexes = [];
  slots.forEach((slot, index) => {
    // Hanya slot foto terverifikasi yang dapat diganti pada versi ini:
    // slot video/audio belum terverifikasi strukturnya (belum pernah
    // diamati pada fixture), slot tanpa deklarasi media ditolak remixer.
    if (slot.kind === 'image' && slot.declared) promptSlotIndexes.push(index);
  });
  const state = {
    id: String(id),
    ownerJid: String(ownerJid),
    chatJid: String(chatJid),
    fileName: String(fileName || 'preset.xml'),
    xmlText,
    limits: resolvedLimits,
    createdAt: now,
    updatedAt: now,
    summary: analysis.summary,
    slots,
    unsupported: analysis.unsupported,
    promptSlotIndexes,
    cursor: 0,
    replacements: [],
    status: promptSlotIndexes.length === 0 ? 'ready' : 'collecting',
  };
  return { ok: true, error: '', state };
}

export function currentPrompt(state) {
  if (!state || state.status !== 'collecting') return null;
  if (state.cursor >= state.promptSlotIndexes.length) return null;
  const slotIndex = state.promptSlotIndexes[state.cursor];
  return { slotIndex, slotNumber: slotIndex + 1, slot: state.slots[slotIndex] };
}

export function isSessionExpired(state, now) {
  if (!state) return true;
  return now - state.updatedAt > state.limits.sessionTtlMs;
}

// Validasi media terhadap slot aktif: signature harus foto (jpeg/png/webp),
// ukuran dalam batas. Mengembalikan info media valid tanpa mengubah state.
export function validateMediaForPrompt(state, buffer, fileName, now) {
  const prompt = currentPrompt(state);
  if (!prompt) {
    return { ok: false, error: 'Tidak ada slot yang menunggu media.' };
  }
  const sniff = sniffBufferKind(buffer);
  if (!['jpeg', 'png', 'webp'].includes(sniff.kind)) {
    return { ok: false, error: 'Berkas bukan foto JPEG/PNG/WebP yang dikenali (terdeteksi: ' + (sniff.kind === 'unknown' ? 'tidak dikenal' : sniff.kind) + '). Slot ini memerlukan foto.' };
  }
  if (buffer.length > state.limits.mediaMaxBytes) {
    return { ok: false, error: 'Ukuran foto melebihi batas ' + Math.round(state.limits.mediaMaxBytes / (1024 * 1024)) + ' MB.' };
  }
  return {
    ok: true,
    error: '',
    slotIndex: prompt.slotIndex,
    slotNumber: prompt.slotNumber,
    kind: sniff.kind,
    ext: sniff.ext,
    mime: sniff.mime,
    size: buffer.length,
    fileName: fileName || 'foto.' + sniff.ext,
  };
}

// Catat media untuk slot aktif lalu maju ke slot berikutnya.
export function recordSlotMedia(state, mediaInfo, savedFile, now) {
  const prompt = currentPrompt(state);
  if (!prompt) {
    return { ok: false, error: 'Tidak ada slot yang menunggu media.' };
  }
  const labelUri = buildSlotLabelUri(prompt.slotNumber, mediaInfo.fileName);
  state.replacements.push({
    slotIndex: prompt.slotIndex,
    slotNumber: prompt.slotNumber,
    fromUri: prompt.slot.uri,
    toUri: labelUri,
    fileName: mediaInfo.fileName,
    size: mediaInfo.size,
    width: mediaInfo.width || null,
    height: mediaInfo.height || null,
    savedFile: savedFile || null,
  });
  state.cursor += 1;
  state.updatedAt = now;
  if (state.cursor >= state.promptSlotIndexes.length) {
    state.status = 'ready';
  }
  return { ok: true, error: '' };
}

export function skipCurrentPrompt(state, now) {
  const prompt = currentPrompt(state);
  if (!prompt) {
    return { ok: false, error: 'Tidak ada slot aktif untuk dilewati.' };
  }
  state.cursor += 1;
  state.updatedAt = now;
  if (state.cursor >= state.promptSlotIndexes.length) {
    state.status = 'ready';
  }
  return { ok: true, error: '' };
}

export function cancelPresetSessionState(state, now) {
  state.status = 'cancelled';
  state.updatedAt = now;
  return { ok: true, error: '' };
}

// Selesai lebih awal: slot tersisa dianggap dipertahankan apa adanya.
export function finishPresetSessionState(state, now) {
  state.status = 'ready';
  state.updatedAt = now;
  return { ok: true, error: '' };
}

// Daftar penggantian untuk replaceAssets: hanya slot yang benar-benar
// terisi media. Slot tanpa media tidak dimasukkan (dipertahankan asli).
export function buildFinalReplacements(state) {
  return state.replacements.map((rep) => {
    const out = { fromUri: rep.fromUri, toUri: rep.toUri, filename: rep.fileName };
    if (Number.isFinite(rep.size)) out.size = rep.size;
    if (Number.isFinite(rep.width)) out.width = rep.width;
    if (Number.isFinite(rep.height)) out.height = rep.height;
    return out;
  });
}

/* ---------- Teks WhatsApp (pure) ---------- */

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function slotKindLabel(kind) {
  if (kind === 'image') return 'Foto';
  if (kind === 'media') return 'Video/Audio';
  return 'Lainnya';
}

export function buildSummaryText(state) {
  const s = state.summary;
  const lines = [];
  lines.push(' *Preset Diterima*');
  lines.push('');
  lines.push('*Judul* → ' + (s.title || '-'));
  lines.push('*Berkas* → ' + state.fileName);
  lines.push('*Kanvas* → ' + (s.width || '-') + 'x' + (s.height || '-'));
  lines.push('*FPS* → ' + (s.fps || '-'));
  lines.push('*Durasi* → ' + (s.totalTime ? (s.totalTime / 1000).toFixed(2) + ' detik' : '-'));
  lines.push('*Layer* → ' + s.layerCount + ' (' + s.keyframeCount + ' keyframe)');
  lines.push('*Media* → ' + s.mediaCount + ' deklarasi');
  lines.push('');
  lines.push(' *Slot Media (' + state.slots.length + ')*');
  state.slots.forEach((slot, i) => {
    const label = slotKindLabel(slot.kind);
    const status = slot.declared ? (slot.kind === 'image' ? 'bisa diganti' : 'belum didukung penggantian') : 'tanpa deklarasi media';
    lines.push((i + 1) + '. *' + label + '* — ' + (slot.filename || slot.uri) + ' (' + slot.layerCount + ' layer, ' + status + ')');
  });
  if (state.unsupported.length > 0) {
    const counts = {};
    for (const item of state.unsupported) counts[item.kind] = (counts[item.kind] || 0) + 1;
    const order = ['effect', 'blending', 'pathStroke', 'border', 'shadow', 'group', 'textLayer', 'undeclaredAsset', 'missingSceneAttr', 'unknownElement'];
    const names = { effect: 'efek', blending: 'blending', pathStroke: 'path-stroke', border: 'border', shadow: 'shadow', group: 'grup', textLayer: 'layer teks', undeclaredAsset: 'aset tanpa deklarasi', missingSceneAttr: 'atribut scene hilang', unknownElement: 'elemen tidak dikenal' };
    lines.push('');
    lines.push(' *Struktur dipertahankan apa adanya* → ' + order.filter((k) => counts[k]).map((k) => names[k] + ': ' + counts[k]).join(', '));
  }
  return lines.join('\n');
}

export function buildPromptText(state) {
  const prompt = currentPrompt(state);
  if (!prompt) {
    if (state.status === 'ready') {
      return 'Semua slot foto sudah diproses.\n\nKetik *selesai* untuk memproses, atau *batal* untuk membatalkan.';
    }
    return 'Sesi preset tidak aktif.';
  }
  const total = state.promptSlotIndexes.length;
  const done = state.cursor;
  const slot = prompt.slot;
  const lines = [];
  lines.push(' *Foto ' + prompt.slotNumber + '* (' + (done + 1) + ' dari ' + total + ' slot foto)');
  lines.push('');
  lines.push('Slot: ' + (slot.filename || slot.uri));
  if (slot.layerCount > 1) lines.push('Digunakan oleh ' + slot.layerCount + ' layer — satu foto akan mengisi seluruhnya.');
  lines.push('');
  lines.push('Kirim foto pengganti sekarang (JPEG/PNG/WebP, maksimal ' + Math.round(state.limits.mediaMaxBytes / (1024 * 1024)) + ' MB).');
  lines.push('');
  lines.push('- *skip* → lewati slot ini');
  lines.push('- *selesai* → proses dengan media yang sudah terkumpul');
  lines.push('- *batal* → batalkan sesi');
  return lines.join('\n');
}

export function buildInstructionsText(state, outputXmlName, mediaFileNames) {
  const lines = [];
  lines.push('CARA MEMAKAI HASIL PRESET INSTAN');
  lines.push('');
  lines.push('1. Impor berkas ' + outputXmlName + ' ke Alight Motion: tombol + lalu Impor/Import, pilih berkas XML tersebut. Impor penuh didukung di Android; iOS terbatas.');
  lines.push('2. URI naze-preset://slot/... pada XML adalah PENANDA slot, bukan media aktif. Setelah impor, pilih layer foto lalu gunakan Ganti Media (Replace Media) untuk memilih berkas pengganti yang sesuai:');
  mediaFileNames.forEach((name) => lines.push('   - ' + name));
  lines.push('3. Keyframe, durasi, urutan layer, efek, dan transisi asli dipertahankan apa adanya.');
  lines.push('4. Batasan jujur: hasil sudah lolos validasi struktur, tetapi validasi struktur BUKAN jaminan berhasil impor atau tampil identik. Fitur ini belum diuji pada aplikasi Alight Motion asli.');
  lines.push('5. Penggantian video/audio belum didukung pada versi ini.');
  return lines.join('\n');
}
