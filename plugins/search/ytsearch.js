import yts from "yt-search";

export const config = {
  name: "ytsearch",
  alias: ["yts"],
  category: "search",
  description: "Mencari video di YouTube",
  usage: ".ytsearch <judul video>",
  example: ".yts musik lofi",
  cooldown: 10,
};

function formatViews(views) {
  if (typeof views !== "number" || !isFinite(views) || views < 0) return "-";
  if (views >= 1e9) return (views / 1e9).toFixed(1) + " M";
  if (views >= 1e6) return (views / 1e6).toFixed(1) + " jt";
  if (views >= 1e3) return (views / 1e3).toFixed(1) + " rb";
  return String(Math.round(views));
}

export async function handler(m) {
  const query = (m.text || "").trim();
  if (!query) {
    return m.reply(
      "Gunakan format: .ytsearch <judul video>\nContoh: .yts musik lofi",
    );
  }

  let result;
  try {
    result = await yts(query);
  } catch {
    return m.reply(
      "Pencarian YouTube gagal. Periksa koneksi internet lalu coba lagi.",
    );
  }

  const videos = (result?.videos || []).slice(0, 6);
  if (!videos.length) {
    return m.reply("Tidak ditemukan hasil untuk: " + query);
  }

  const lines = ["Hasil pencarian YouTube untuk: " + query, ""];
  videos.forEach((video, i) => {
    lines.push(i + 1 + ". " + (video.title || "Tanpa judul"));
    lines.push(
      "   Durasi: " +
        (video.duration?.timestamp || "-") +
        " | Dilihat: " +
        formatViews(video.views),
    );
    lines.push("   " + video.url);
  });
  return m.reply(lines.join("\n"));
}
