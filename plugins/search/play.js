/**
 * Nama Plugin: Play
 * Pembuat Code: naze
 */

import axios from "axios";

const pluginConfig = {
  name: "play",
  alias: ["playaudio", "ytplay", "playmusic"],
  category: "search",
  description: "Putar musik dari YouTube (Nexray API)",
  usage: ".play <query>",
  example: ".play komang",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const query = m.text?.trim();
  
  if (!query) {
    return m.reply(`[EROR] Gunakan format:\n\`${m.prefix}play [judul lagu]\``);
  }

  // Memberikan reaksi loading
  m.react("");

  try {
    const url = `https://api.nexray.eu.cc/downloader/ytplay?q=${encodeURIComponent(query)}`;
    
    // Timeout API diperbesar menjadi 60.000 ms (60 detik)
    const res = await axios.get(url, { timeout: 60000 });
    
    if (res.data && res.data.status && res.data.result) {
      const ytData = res.data.result;
      const downloadUrl = ytData.download_url;
      const title = ytData.title;
      
      if (downloadUrl) {
        // Timeout download file diperbesar menjadi 300.000 ms (5 menit)
        const response = await axios.get(downloadUrl, { 
          responseType: 'arraybuffer',
          timeout: 300000 
        });
        const buffer = Buffer.from(response.data);

        // Mengirimkan audio ke chat
        await sock.sendMessage(
          m.chat, 
          { 
            audio: buffer, 
            mimetype: 'audio/mpeg', 
            fileName: `${title}.mp3`
          }, 
          { quoted: m }
        );

        // Memberikan reaksi sukses
        m.react("");
      } else {
        m.react("");
        m.reply('[EROR] Link download tidak ditemukan.');
      }
    } else {
      m.react("");
      m.reply('[EROR] Musik tidak ditemukan atau terjadi gangguan pada API.');
    }
  } catch (e) {
    console.error('Gagal memutar musik:', e);
    m.react("");
    
    // Menambahkan pesan yang lebih ramah jika terkena error timeout
    if (e.code === 'ECONNABORTED') {
      m.reply(`[EROR] Waktu tunggu habis (Timeout). Server API lambat merespons, coba lagi nanti ya.`);
    } else {
      m.reply(`[EROR] Gagal memutar musik. Terjadi kesalahan: ${e.message}`);
    }
  }
}

export { pluginConfig as config, handler };
