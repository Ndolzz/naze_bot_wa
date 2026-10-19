// Kirim HTML sebagai widget yang tampil langsung di dalam chat WhatsApp
// (pesan rich response dengan primitive HTML, sama seperti yang dipakai builder AIRich).
import crypto from "crypto";

const BOT_JID = "867051314767696@bot";

export async function sendInlineHtml(sock, jid, html, title = "Game") {
  const data = Buffer.from(
    JSON.stringify({
      response_id: crypto.randomUUID(),
      sections: [
        {
          view_model: {
            primitive: {
              __typename: "GenAIaeacdsnwHtmlPrimitive",
              payload: html,
              trusted_sources: [],
            },
            __typename: "GenAISingleLayoutViewModel",
          },
        },
      ],
    }),
  ).toString("base64");

  return sock.relayMessage(
    jid,
    {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {},
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [{ messageType: 2, messageText: title }],
            unifiedResponse: { data },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: { botJid: BOT_JID },
              forwardOrigin: 4,
            },
          },
        },
      },
    },
    {},
  );
}
