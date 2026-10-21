import { resolveSosdownLink, sendSosdownMedia } from "../../src/lib/naze-sosdown.js";

export const config = {
  name: "ig",
  alias: ["instagram"],
  category: "download",
  description: "Mengunduh video atau foto Instagram (maks 64 MB per berkas)",
  usage: ".ig <tautan>",
  example: ".ig https://www.instagram.com/p/xxxx",
  cooldown: 15,
};

export async function handler(m) {
  const link = (m.text || "").trim();
  if (!link) {
    return m.reply(
      "Gunakan format: .ig <tautan>\nContoh: .ig https://www.instagram.com/reel/xxxx",
    );
  }

  await m.reply("Tautan diterima. Media Instagram sedang diproses, mohon tunggu.");

  try {
    const result = await resolveSosdownLink(link);
    if (!result.ok) {
      return m.reply(result.error?.message || "Tautan Instagram tidak dapat diproses.");
    }
    if (result.data.platform !== "instagram") {
      return m.reply("Tautan ini bukan tautan Instagram. Gunakan .tiktok untuk TikTok.");
    }

    const sent = await sendSosdownMedia(m, result.data, result.data.items);
    if (sent > 1) {
      return m.reply("Selesai. " + sent + " media terkirim.");
    }
  } catch (err) {
    return m.reply(
      "Unduhan gagal: " + (err?.message || "kesalahan tidak diketahui"),
    );
  }
}
