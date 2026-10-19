import { getDatabase } from '../../src/lib/naze-database.js'
import te from '../../src/lib/naze-error.js'
const pluginConfig = {
    name: 'banchat',
    alias: ['bangroup', 'bangrup', 'unbanchat', 'unbangroup'],
    category: 'group',
    description: 'Ban grup dari penggunaan bot (hanya owner yang bisa akses)',
    usage: '.banchat',
    example: '.banchat',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const cmd = m.command.toLowerCase()
    const isUnban = ['unbanchat', 'unbangroup'].includes(cmd)
    
    try {
        const groupMeta = m.groupMetadata
        const groupName = groupMeta.subject || 'Unknown'
        const groupData = db.getGroup(m.chat) || {}
        
        if (isUnban) {
            if (!groupData.isBanned) {
                return m.reply(
                    ` *Grup Tidak Diban*\n\n` +
                    `> Grup ini tidak dalam status banned.\n` +
                    `> Semua user bisa menggunakan bot.`
                )
            }
            
            db.setGroup(m.chat, { ...groupData, isBanned: false })
            
            return sock.sendMessage(m.chat, {
                text: ` *Grup Di-Unban*\n\n` +
                    `╭┈┈「 *Detail* 」\n` +
                    `┃ Grup: *${groupName}*\n` +
                    `┃ Status: * AKTIF*\n` +
                    `┃ Unban Oleh: @${m.sender.split('@')[0]}\n` +
                    `╰┈┈\n\n` +
                    `> Semua member sekarang bisa menggunakan bot kembali.`,
                mentions: [m.sender]
            }, { quoted: m })
        }
        
        if (groupData.isBanned) {
            return m.reply(
                ` *Grup Sudah Diban*\n\n` +
                `> Grup ini sudah dalam status banned.\n` +
                `> Gunakan \`.unbanchat\` untuk membuka akses.`
            )
        }
        
        db.setGroup(m.chat, { ...groupData, isBanned: true })
        
        await m.reply(` *Grup Diban*\n\n` +
                `╭┈┈「 *Detail* 」\n` +
                `┃ Grup: *${groupName}*\n` +
                `┃ Status: * BANNED*\n` +
                `┃ Ban Oleh: @${m.sender.split('@')[0]}\n` +
                `╰┈┈\n\n` +
                `> Member biasa tidak bisa menggunakan bot di grup ini.\n` +
                `> Hanya owner yang bisa menggunakan bot.`, {  mentions: [m.sender] })
        
    } catch (error) {
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }