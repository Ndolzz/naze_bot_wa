import config from '../../config.js'
import { getDatabase } from '../../src/lib/naze-database.js'
const pluginConfig = {
    name: 'listban',
    alias: ['listbanned', 'banlist'],
    category: 'owner',
    description: 'Melihat daftar banned user',
    usage: '.listban',
    example: '.listban',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const bannedUsers = config.bannedUsers && config.bannedUsers.length > 0 ? config.bannedUsers : (db.setting('bannedUsers') || [])
    
    if (bannedUsers.length === 0) {
        return m.reply(` *List Banned*\n\n> Tidak ada user yang dibanned\n\n\`Gunakan: ${m.prefix}ban <nomor>\``)
    }
    
    let caption = ` *List Banned*\n\n`
    caption += `╭┈┈「 *Users* 」\n`
    
    for (let i = 0; i < bannedUsers.length; i++) {
        caption += `┃ ${i + 1}. \`${bannedUsers[i]}\`\n`
    }
    
    caption += `╰┈┈\n\n`
    caption += `> Total: \`${bannedUsers.length}\` Banned User`
    
    await m.reply(caption)
}

export { pluginConfig as config, handler }