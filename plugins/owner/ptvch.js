import config from '../../config.js'
import te from '../../src/lib/naze-error.js'
const pluginConfig = {
    name: 'ptvch',
    alias: ['ptvchanel', 'ptvstory'],
    category: 'owner',
    description: 'Kirim video sebagai PTV ke channel',
    usage: '.ptvch (reply video)',
    example: '.ptvch',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    let video = null
    
    if (m.quoted && m.quoted.isVideo) {
        try {
            video = await m.quoted.download()
        } catch (e) {
            return m.reply(` Gagal download video dari quoted.`)
        }
    } else if (m.isVideo) {
        try {
            video = await m.download()
        } catch (e) {
            return m.reply(` Gagal download video.`)
        }
    }
    
    if (!video) {
        return m.reply(
            ` *Cara Pakai*\n\n` +
            `> Kirim *video* atau *balas video* lalu ketik:\n` +
            `> \`${m.prefix}ptvch\``
        )
    }
    
    const channelId = config.saluran?.id || ""
    if (!channelId) {
        return m.reply("ID saluran belum diatur. Isi config.saluran.id terlebih dahulu.")
    }
    
    await m.reply(` *Mengirim Ptv Ke Channel...*`)
    
    try {
        await sock.sendMessage(channelId, {
            video: video,
            mimetype: 'video/mp4',
            gifPlayback: true,
            ptv: true
        })
        
        await m.react('')
        return m.reply(` *Sukses*\n\n> Video berhasil dikirim ke channel sebagai PTV.`)
        
    } catch (err) {
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }