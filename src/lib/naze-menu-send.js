// Pengiriman tampilan menu interaktif NAZE (Tahap 2).
// Murni tanpa import: socket dan banner disuntikkan sebagai argumen sehingga
// perilaku pengiriman dan fallback dapat diuji tanpa koneksi WhatsApp
// (tests/menu-interactive.test.js). Pesan interaktif memakai format List
// Message WhatsApp ({ text, buttonText, sections }); respons pengguna tiba
// kembali sebagai selectedRowId (lihat src/lib/naze-serialize.js) dan
// diproses ulang oleh dispatcher sebagai perintah ".menu <target>".

/**
 * Mengirim satu tampilan menu interaktif.
 * Banner dikirim lebih dulu sebagai gambar dengan caption; bila banner tidak
 * tersedia, caption digabungkan ke teks list. Bila payload list dikirim
 * sebagai teks biasa (fork tanpa dukungan list message), pengiriman dianggap
 * gagal agar pemanggil dapat menjalankan fallback teks.
 * @param {Object|null} sock - Socket WhatsApp (fungsi sendMessage).
 * @param {string} chat - JID tujuan.
 * @param {Object} view - Tampilan dari src/lib/naze-menu.js.
 * @param {Buffer|null} banner - Buffer gambar banner, atau null.
 * @param {Object} [options] - { quoted: pesan yang dikutip }.
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
export async function sendInteractiveView(sock, chat, view, banner = null, options = {}) {
  if (!view || !Array.isArray(view.sections) || view.sections.length === 0) {
    return { sent: false, error: "tampilan menu interaktif tidak lengkap" };
  }
  if (!sock || typeof sock.sendMessage !== "function") {
    return { sent: false, error: "socket WhatsApp tidak tersedia" };
  }

  const quoted = options.quoted ? { quoted: options.quoted } : {};
  try {
    if (banner) {
      await sock.sendMessage(chat, { image: banner, caption: view.caption || "" }, quoted);
    }
    const listText = banner
      ? view.listText
      : [view.caption, view.listText].filter(Boolean).join("\n\n");
    const sent = await sock.sendMessage(
      chat,
      { text: listText, buttonText: view.buttonText, sections: view.sections },
      quoted
    );
    if (sent && sent.message && !sent.message.listMessage) {
      return { sent: false, error: "pesan list terkirim sebagai teks biasa; list message tidak didukung" };
    }
    return { sent: true, error: null };
  } catch (error) {
    return { sent: false, error: (error && error.message) || "gagal mengirim pesan interaktif" };
  }
}
