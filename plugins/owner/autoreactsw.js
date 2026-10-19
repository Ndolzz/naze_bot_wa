import { getDatabase } from '../../src/lib/naze-database.js'

const pluginConfig = {
    name: 'autoreactsw',
    alias: ['autoreaksi', 'reactsw', 'autoreactstory'],
    category: 'owner',
    description: 'Auto react semua status/story WA',
    usage: '.autoreactsw on/off [emoji]',
    example: '.autoreactsw on ',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
    const db = getDatabase()
    const args = m.args || []
    const action = (args[0] || '').toLowerCase()
    const emoji = args[1] || ''

    const current = db.setting('autoReactSW') || { enabled: false, emoji: '' }

    if (!action) {
        return m.reply(
            ` *Auto React Story*\n\n` +
            `> Status: *${current.enabled ? 'ON' : 'OFF'}*\n` +
            `> Emoji: *${current.emoji}*\n\n` +
            `*Cara Pakai:*\n` +
            `> \`${m.prefix}autoreactsw on\` — Aktifkan (emoji default )\n` +
            `> \`${m.prefix}autoreactsw on \` — Aktifkan dengan emoji\n` +
            `> \`${m.prefix}autoreactsw off\` — Matikan`
        )
    }

    if (action === 'on') {
        db.setting('autoReactSW', { enabled: true, emoji })
        db.save()
        await m.react('')
        return m.reply(
            ` *Auto React Story Aktif*\n\n` +
            `> Emoji: *${emoji}*\n` +
            `> Bot akan otomatis react semua story WA`
        )
    }

    if (action === 'off') {
        db.setting('autoReactSW', { enabled: false, emoji: current.emoji })
        db.save()
        await m.react('')
        return m.reply(` *Auto React Story Dimatikan*`)
    }

    return m.reply(` Gunakan \`on\` atau \`off\``)
}

export { pluginConfig as config, handler }
