import { resolveSosdownLink, sendSosdownMedia } from "../../src/lib/naze-sosdown.js";

export const config = {
  name: "tiktok",
  alias: ["tt"],
  category: "download",
  description: "Mengunduh video atau foto TikTok (maks 64 MB per berkas)",
  usage: ".tiktok <tautan> [hd|sd|wm]",
  example: ".tiktok https://vt.tiktok.com/xxxx",
  cooldown: 15,
};

function parseInput(input) {
  const parts = input.split(/\s+/);
  let quality = "hd";
  if (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase();
    if (last === "hd" || last === "sd" || last === "wm") {
      quality = last;
      parts.pop();
    }
  }
  return { link: parts.join(" ").trim(), quality };
}

function selectItems(data, quality) {
  if (data.type === "photo") {
    return data.items;
  }

  if (quality === "wm") {
    const watermark = data.items.filter((item) => item.hasWatermark);
    if (watermark.length > 0) return watermark.slice(0, 1);
  }

  if (quality === "sd") {
    const sd = data.items.filter((item) => item.label === "sd");
    if (sd.length > 0) return sd.slice(0, 1);
  } else {
    const hd = data.items.filter(
      (item) => item.label === "hd" && !item.hasWatermark,
    );
    if (hd.length > 0) return hd.slice(0, 1);
  }

  const plain = data.items.filter((item) => !item.hasWatermark);
  if (plain.length > 0) return plain.slice(0, 1);

  return data.items.slice(0, 1);
}

export async function handler(m) {
  const input = (m.text || "").trim();
  if (!input) {
    return m.reply(
      "Gunakan format: .tiktok <tautan> [hd|sd|wm]\nContoh: .tiktok https://vt.tiktok.com/xxxx\nOpsi kualitas: hd (bawaan, tanpa watermark), sd (lebih kecil), wm (versi dengan watermark).",
    );
  }

  const { link, quality } = parseInput(input);
  if (!link) {
    return m.reply(
      "Gunakan format: .tiktok <tautan> [hd|sd|wm]\nContoh: .tiktok https://vt.tiktok.com/xxxx",
    );
  }

  await m.reply("Tautan diterima. Media TikTok sedang diproses, mohon tunggu.");

  try {
    const result = await resolveSosdownLink(link);
    if (!result.ok) {
      return m.reply(result.error?.message || "Tautan TikTok tidak dapat diproses.");
    }
    if (result.data.platform !== "tiktok") {
      return m.reply("Tautan ini bukan tautan TikTok. Gunakan .ig untuk Instagram.");
    }

    const items = selectItems(result.data, quality);
    const sent = await sendSosdownMedia(m, result.data, items);
    if (sent > 1) {
      return m.reply("Selesai. " + sent + " media terkirim.");
    }
  } catch (err) {
    return m.reply(
      "Unduhan gagal: " + (err?.message || "kesalahan tidak diketahui"),
    );
  }
}
