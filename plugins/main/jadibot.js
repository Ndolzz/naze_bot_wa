import { startJadibot, isJadibotActive } from '../../src/lib/naze-jadibot-manager.js'

const pluginConfig = {
    name: 'jadibot',
    alias: ['jadibotqr', 'becomebot', 'bot'],
    category: 'main',
    description: 'Jadikan nomor kamu menjadi bot (Pairing Code / QR)',
    usage: '.jadibot atau .jadibot qr',
    example: '.jadibot',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const sender = m.sender
    if (!sender) return m.reply(' Gagal mengidentifikasi nomor kamu')

    if (isJadibotActive(sender)) {
        return m.reply(
            ` *Jadibot ꜱUdah Aktif*\n\n` +
            `> Nomor kamu sudah menjadi bot\n` +
            `> Ketik \`${m.prefix}stopjadibot\` untuk menghentikan`
        )
    }

    const arg = (m.args?.[0] || '').toLowerCase()
    const useQR = arg === 'qr'

    if (useQR) {
        await m.reply(
            ` *Jadibot — Qr Mode*\n\n` +
            `> Menyiapkan koneksi...\n` +
            `> Scan QR Code yang akan dikirim`
        )
    } else {
        await m.reply(
            ` *Jadibot — Pairing Code*\n\n` +
            `> Menyiapkan koneksi...`
        )
    }

    try {
        await startJadibot(sock, m, sender, !useQR)
    } catch (e) {
        await m.reply(
            ` *Jadibot Gagal*\n\n` +
            `> ${e.message || 'Terjadi kesalahan'}\n\n` +
            `Coba lagi dalam beberapa menit.`
        )
    }
}

export { pluginConfig as config, handler }
