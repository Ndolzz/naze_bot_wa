import axios from "axios";
import FormData from "form-data";
import config from "../../config.js";
import { downloadMediaMessage } from "naze";
import te from "../../src/lib/naze-error.js";
import nazeApi from "../../src/lib/naze-apimanager.js";
import { saluranCtx } from "../../src/lib/naze-context.js";

const pluginConfig = {
  name: "musikapaini",
  alias: ["whatmusic", "shazam", "recognizemusic", "mai"],
  category: "tools",
  description: "Identifikasi lagu dari audio",
  usage: ".musikapaini (reply audio)",
  example: ".musikapaini",
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};

async function uploadTo0x0(buffer, filename) {
  const form = new FormData();
  form.append("file", buffer, {
    filename,
    contentType: "application/octet-stream",
  });

  const res = await axios.post(
    "https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk",
    form,
    {
      headers: form.getHeaders(),
      timeout: 60000,
    },
  );

  if (!res.data?.status ? res.data.path : "") throw new Error("Upload gagal");
  return res.data;
}

async function handler(m, { sock }) {
  let audioBuffer = null;
  let filename = "audio.mp3";

  if (m.quoted?.message) {
    const quotedMsg = m.quoted.message;
    const audioMsg = quotedMsg.audioMessage || quotedMsg.documentMessage;

    if (audioMsg) {
      try {
        audioBuffer = await downloadMediaMessage(
          { key: m.quoted.key, message: quotedMsg },
          "buffer",
          {},
        );
        filename = audioMsg.fileName || "audio.mp3";
      } catch {}
    }
  }

  if (!audioBuffer && m.message) {
    const audioMsg = m.message.audioMessage || m.message.documentMessage;
    if (audioMsg) {
      try {
        audioBuffer = await m.download();
        filename = audioMsg.fileName || "audio.mp3";
      } catch {}
    }
  }

  if (!audioBuffer) {
    return m.reply(
      ` *Musik Apa Ini?*\n\n` +
        `> Identifikasi lagu dari audio\n\n` +
        `*Cara pakai:*\n` +
        `> Reply audio dengan \`${m.prefix}musikapaini\`\n` +
        `> Atau kirim audio + caption command`,
    );
  }

  m.react("");

  try {
    await m.reply(" *Mengupload...*\n\n> Mengupload audio...");

    const audioUrl = await uploadTo0x0(audioBuffer, filename);

    await m.reply(" *Mengidentifikasi...*\n\n> Mencari info lagu...");

    const data = await nazeApi.neoxr.whatMusic(
      {
        url: audioUrl,
        apikey: config.APIkey?.neoxr,
      },
      {
        timeout: 60000,
      },
    );

    if (!data?.status || !data?.data) {
      m.react("");
      return m.reply(" *Gagal*\n\n> Lagu tidak dikenali atau API error");
    }

    const music = data.data;
    const links = music.links || {};

    let text = ` *Lagu Ditemukan!*\n\n`;
    text += `╭┈┈「 *Info* 」\n`;
    text += `┃ Title: ${music.title || "-"}\n`;
    text += `┃ Artist: ${music.artist || "-"}\n`;
    text += `┃ Album: ${music.album || "-"}\n`;
    text += `┃ Release: ${music.release || "-"}\n`;
    text += `╰┈┈┈┈┈┈┈┈\n\n`;

    const buttons = [];

    if (links.spotify?.track?.id) {
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: " Spotify",
          url: `https://open.spotify.com/track/${links.spotify.track.id}`,
        }),
      });
    }

    if (links.youtube?.vid) {
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "▶ YouTube",
          url: `https://youtube.com/watch?v=${links.youtube.vid}`,
        }),
      });
    }

    if (links.deezer?.track?.id) {
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: " Deezer",
          url: `https://deezer.com/track/${links.deezer.track.id}`,
        }),
      });
    }

    const msgContent = {
      text,
      footer: " Music Recognition",
      contextInfo: saluranCtx(),
    };

    if (buttons.length > 0) {
      msgContent.interactiveButtons = buttons;
    }

    await sock.sendMessage(m.chat, msgContent, { quoted: m });

    m.react("");
  } catch (error) {
    m.react("");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
