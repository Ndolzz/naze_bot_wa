import { getDatabase } from '../../src/lib/naze-database.js'
import { isLid, lidToJid } from '../../src/lib/naze-lid.js'

const pluginConfig = {
    name: 'unmutemember',
    alias: ['unmutmember', 'unsilentmember', 'unbisukanmember', 'listmutemember', 'listmute'],
    category: 'group',
    description: 'Membuka mute member tertentu',
    usage: '.unmutemember <@tag/reply/nomor>',
    example: '.unmutemember @user',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    isBotAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function resolveTarget(m) {
    let raw = ''

    if (m.quoted) {
        raw = m.quoted.sender || ''
    } else if (m.mentionedJid?.length) {
        raw = m.mentionedJid[0] || ''
    } else if (m.args[0]) {
        raw = m.args[0]
    }

    if (!raw) return ''

    if (isLid(raw)) raw = lidToJid(raw)
    if (!raw.includes('@')) raw = raw.replace(/[^0-9]/g, '') + '@s.whatsapp.net'

    return raw
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const groupData = db.getGroup(m.chat) || {}
    const mutedMembers = groupData.mutedMembers || []

    if (m.command === 'listmutemember' || m.command === 'listmute') {
        if (mutedMembers.length === 0) {
            return m.reply(` *LIST MUTED MEMBERS*\n\n> Tidak ada member yang dimute di grup ini`)
        }

        let txt = ` *LIST MUTED MEMBERS*\n\n╭┈┈「 *Daftar* 」\n`
        mutedMembers.forEach((jid, i) => {
            const num = jid.replace(/@.+/g, '')
            txt += `┃ ${i + 1}. @${num}\n`
        })
        txt += `╰┈┈\n\n> Total: \`${mutedMembers.length}\` member dimute`

        return m.reply(txt, { mentions: mutedMembers })
    }

    const targetJid = resolveTarget(m)

    if (!targetJid) {
        return m.reply(
            ` *UNMUTE MEMBER*\n\n` +
            `> Membuka mute member tertentu\n\n` +
            `\`Contoh:\`\n` +
            `> ${m.prefix}unmutemember @user\n` +
            `> ${m.prefix}unmutemember 6281234567890\n` +
            `> Reply pesan member + ${m.prefix}unmutemember`
        )
    }

    const targetNumber = targetJid.replace(/@.+/g, '')

    const index = mutedMembers.findIndex(jid => {
        const c = jid.replace(/@.+/g, '')
        return c === targetNumber || c.endsWith(targetNumber) || targetNumber.endsWith(c)
    })

    if (index === -1) {
        return m.reply(` *Gagal*\n\n> Member @${targetNumber} tidak sedang dimute`, { mentions: [targetJid] })
    }

    mutedMembers.splice(index, 1)
    db.setGroup(m.chat, { ...groupData, mutedMembers })

    m.react('')
    await m.reply(
        ` *MEMBER DIUNMUTE*\n\n` +
        `╭┈┈「 *Detail* 」\n` +
        `┃ Member: @${targetNumber}\n` +
        `┃ Status: \`Unmuted\`\n` +
        `┃ Sisa Mute: \`${mutedMembers.length}\` Member\n` +
        `╰┈┈`,
        { mentions: [targetJid] }
    )
}

export { pluginConfig as config, handler }
