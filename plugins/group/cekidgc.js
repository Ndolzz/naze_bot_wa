import sharp from "sharp";
import config from "../../config.js";
import axios from "axios";
import { generateWAMessageFromContent, proto } from "naze";
import te from "../../src/lib/naze-error.js";

const pluginConfig = {
  name: "cekidgc",
  alias: ["idgc", "idgrup", "groupid"],
  category: "group",
  description: "Cek ID dan info lengkap grup",
  usage: ".cekidgc [link grup]",
  example: ".cekidgc https://chat.whatsapp.com/xxxxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(
    typeof timestamp === "number" && timestamp < 1e12
      ? timestamp * 1000
      : timestamp,
  );
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function handler(m, { sock }) {
  await m.react("");

  try {
    const input = m.text?.trim();
    let groupJid = null;
    let groupMeta = null;

    if (input && input.includes("chat.whatsapp.com/")) {
      const inviteCode = input
        .split("chat.whatsapp.com/")[1]
        ?.split(/[\s?]/)[0];

      if (!inviteCode) {
        m.react("");
        return m.reply(`── . ──\n\n> Link grup tidak valid .︎ ݁˖`);
      }

      try {
        groupMeta = await sock.groupGetInviteInfo(inviteCode);
        groupJid = groupMeta?.id;
      } catch {
        m.react("");
        return m.reply(
          `── . ──\n\n> Link grup tidak valid atau sudah expired .︎ ݁˖`,
        );
      }
    } else if (input && input.endsWith("@g.us")) {
      groupJid = input;
      try {
        groupMeta = await sock.groupMetadata(groupJid);
      } catch {
        m.react("");
        return m.reply(
          `── . ──\n\n> Tidak bisa mengakses grup tersebut .︎ ݁˖`,
        );
      }
    } else if (m.isGroup) {
      groupJid = m.chat;
      groupMeta = await sock.groupMetadata(groupJid);
    } else {
      return m.reply(
        `── . CEK ID GRUP . ── θৎ\n\n` +
          `> Gunakan di grup atau masukkan link grup\n\n` +
          `> \`${m.prefix}cekidgc\` — di dalam grup\n` +
          `> \`${m.prefix}cekidgc https://chat.whatsapp.com/xxx\``,
      );
    }

    if (!groupMeta || !groupJid) {
      m.react("");
      return m.reply(`── . ──\n\n> Tidak dapat menemukan info grup .︎ ݁˖`);
    }

    const groupName = groupMeta.subject || "Unknown";
    const participants = groupMeta.participants || [];
    const memberCount = participants.length || groupMeta.size || 0;
    const admins = participants.filter(
      (p) => p.admin === "admin" || p.admin === "superadmin",
    );
    const adminCount = admins.length;
    const groupOwner = groupMeta.owner || groupMeta.subjectOwner || "—";
    const createdAt = formatDate(groupMeta.creation);
    const groupDesc = groupMeta.desc || "—";
    const descPreview =
      groupDesc.length > 120 ? groupDesc.slice(0, 120) + "..." : groupDesc;
    const isRestrict = groupMeta.restrict ? "Admin Only" : "Semua Member";
    const isAnnounce = groupMeta.announce ? "Aktif" : "Nonaktif";
    const isCommunity = groupMeta.isCommunity ? " Ya" : " Tidak";
    const joinMode = groupMeta.joinApprovalMode ? "Perlu Approval" : "Bebas";

    let ppBuffer = null;
    try {
      const ppUrl = await sock.profilePictureUrl(groupJid, "image");
      if (ppUrl) {
        ppBuffer = Buffer.from(
          (
            await axios.get(ppUrl, {
              responseType: "arraybuffer",
              timeout: 10000,
            })
          ).data,
        );
      }
    } catch {}

    const saluranId = config.saluran?.id || "";
    const saluranName = config.saluran?.name || config.bot?.name || "Naze";

    const infoText =
      `── . GROUP INFO . ── θৎ\n\n` +
      `╭─〔 ${groupName} 〕───\n` +
      `│ Nama : *${groupName}*\n` +
      `│ Id : \`${groupJid}\`\n` +
      `│ Member : *${memberCount}*\n` +
      `│ Admin : *${adminCount}*\n` +
      `│ Owner : @${groupOwner.replace(/@.+/g, "")}\n` +
      `│ Dibuat : *${createdAt}*\n` +
      `│ Komunitas : *${isCommunity}*\n` +
      `│ Edit Info : *${isRestrict}*\n` +
      `│ Announce : *${isAnnounce}*\n` +
      `│ Join Mode : *${joinMode}*\n` +
      `│ Deskripsi : ${descPreview}\n` +
      `╰──────────────\n\n` +
      `.︎ ݁˖ © ${config.bot?.name || "Naze"}`;

    const buttons = [
      {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: " Copy ID Grup",
          copy_code: groupJid,
        }),
      },
    ];

    if (ppBuffer) {
      let headerMedia = null;
      try {
        const resized = await sharp(ppBuffer)
          .resize(300, 300, { fit: "cover" })
          .jpeg({ quality: 80 })
          .toBuffer();
        headerMedia = await prepareWAMessageMedia(
          { image: resized },
          { upload: sock.waUploadToServer },
        );
      } catch {}

      const msg = generateWAMessageFromContent(
        m.chat,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                body: proto.Message.InteractiveMessage.Body.fromObject({
                  text: infoText,
                }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({
                  text: `© ${config.bot?.name || "Naze"}`,
                }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                  hasMediaAttachment: !!headerMedia,
                  ...(headerMedia || {}),
                }),
                nativeFlowMessage:
                  proto.Message.InteractiveMessage.NativeFlowMessage.fromObject(
                    { buttons },
                  ),
                contextInfo: {
                  mentionedJid: [m.sender, groupOwner],
                  forwardingScore: 9999,
                  isForwarded: true,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
              }),
            },
          },
        },
        { userJid: m.sender, quoted: m },
      );

      await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    } else {
      const msg = generateWAMessageFromContent(
        m.chat,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                body: proto.Message.InteractiveMessage.Body.fromObject({
                  text: infoText,
                }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({
                  text: `© ${config.bot?.name || "Naze"}`,
                }),
                nativeFlowMessage:
                  proto.Message.InteractiveMessage.NativeFlowMessage.fromObject(
                    { buttons },
                  ),
                contextInfo: {
                  mentionedJid: [m.sender, groupOwner],
                  forwardingScore: 9999,
                  isForwarded: true,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
              }),
            },
          },
        },
        { userJid: m.sender, quoted: m },
      );

      await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    }

    await m.react("");
  } catch (error) {
    console.error("[CekIdGc] Error:", error.message);
    await m.react("");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
