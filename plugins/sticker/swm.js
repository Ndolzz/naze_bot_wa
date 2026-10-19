import config from '../../config.js'
import te from '../../src/lib/naze-error.js'
import { addExifToWebp, isAnimatedWebp, DEFAULT_METADATA } from '../../src/lib/naze-exif.js'

const pluginConfig = {
    name: 'swm',
    alias: ['wm', 'stickerwm', 'stickermark', 'colong'],
    category: 'sticker',
    description: 'Mengganti packname dan author pada sticker',
    usage: '.swm <packname> atau .swm <packname>|<author>',
    example: '.swm BotName',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock, config: botConfig }) {
    const quoted = m.quoted
    
    if (!quoted) {
        return m.reply(
            ` *Sticker Watermark*\n\n` +
            `> Reply sticker dengan caption:\n` +
            `> \`${m.prefix}swm packname\`\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}swm Naze\`\n` +
            `> \`${m.prefix}swm Naze|Nendi\` _(packname + author)_`
        )
    }
    
    const isSticker = quoted.type === 'stickerMessage' || quoted.isSticker
    if (!isSticker) {
        return m.reply(` *Gagal*\n\n> Reply pesan sticker, bukan ${quoted.type?.replace('Message', '') || 'media lain'}`)
    }
    
    const input = m.text?.trim()
    if (!input) {
        return m.reply(
            ` *Gagal*\n\n` +
            `> Masukkan packname\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}swm Naze\`\n` +
            `> \`${m.prefix}swm Naze|Nendi\` _(+ author)_`
        )
    }
    
    let packname, author
    
    if (input.includes('|')) {
        const parts = input.split('|')
        packname = parts[0]?.trim() || ''
        author = parts[1]?.trim() || ''
    } else {
        packname = input
        author = ''
    }
    
    m.react('')
    
    try {
        const buffer = await quoted.download()
        
        if (!buffer || buffer.length === 0) {
            m.react('')
            return m.reply(` *Gagal*\n\n> Gagal mendownload sticker`)
        }
        
        const exifOpts = { packname, author, emojis: [''] }
        const riff = buffer.slice(0, 4).toString('ascii')
        const webpSig = buffer.length >= 12 ? buffer.slice(8, 12).toString('ascii') : ''
        const isWebp = riff === 'RIFF' && webpSig === 'WEBP'
        
        if (isWebp) {
            const stickerBuffer = await addExifToWebp(buffer, exifOpts)
            await sock.sendMessage(m.chat, {
                sticker: stickerBuffer,
                contextInfo: { isForwarded: true, forwardingScore: 1 }
            }, { quoted: m })
        } else {
            const isVideo = buffer.slice(0, 3).toString('hex') === '000000' ||
                            buffer.slice(4, 8).toString('ascii') === 'ftyp'
            
            if (isVideo) {
                await sock.sendVideoAsSticker(m.chat, buffer, m, exifOpts)
            } else {
                await sock.sendImageAsSticker(m.chat, buffer, m, exifOpts)
            }
        }
        
        m.react('')
        
    } catch (error) {
        console.error('[SWM] Error:', error.message)
        m.react('')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }