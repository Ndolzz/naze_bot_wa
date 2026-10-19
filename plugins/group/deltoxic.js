import { getDatabase } from '../../src/lib/naze-database.js'
const pluginConfig = {
    name: 'deltoxic',
    alias: ['hapustoxic', 'remtoxic', 'removetoxic'],
    category: 'group',
    description: 'Hapus kata toxic dari daftar',
    usage: '.deltoxic <kata>',
    example: '.deltoxic kata_kasar',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const word = m.args.join(' ').trim().toLowerCase()
    
    if (!word) {
        return m.reply(
            ` *Del Toxic*\n\n` +
            `> Gunakan: \`.deltoxic <kata>\`\n\n` +
            `\`Contoh: ${m.prefix}deltoxic katakasar\``
        )
    }
    
    const groupData = db.getGroup(m.chat) || {}
    const toxicWords = groupData.toxicWords || []
    
    const index = toxicWords.indexOf(word)
    
    if (index === -1) {
        return m.reply(` *Gagal*\n\n> Kata \`${word}\` tidak ada di daftar`)
    }
    
    toxicWords.splice(index, 1)
    db.setGroup(m.chat, { toxicWords })
    
    m.react('')
    
    await m.reply(
        ` *Kata Toxic Dihapus*\n\n` +
        `╭┈┈「 *Detail* 」\n` +
        `┃ Kata: \`${word}\`\n` +
        `┃ Sisa: \`${toxicWords.length}\` kata\n` +
        `╰┈┈`
    )
}

export { pluginConfig as config, handler }