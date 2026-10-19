import { getDatabase } from '../../src/lib/naze-database.js'

const pluginConfig = {
    name: 'autoreadsw',
    alias: ['autoreadstory', 'readstory', 'bacasw'],
    category: 'owner',
    description: 'Auto read semua status/story WA',
    usage: '.autoreadsw on/off',
    example: '.autoreadsw on',
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
    const action = (m.args?.[0] || '').toLowerCase()
    const current = db.setting('autoReadSW') || { enabled: false }

    if (!action) {
        return m.reply(
            ` *Auto Read Story*\n\n` +
            `> Status: *${current.enabled ? 'ON' : 'OFF'}*\n\n` +
            `*Cara Pakai:*\n` +
            `> \`${m.prefix}autoreadsw on\` — Aktifkan\n` +
            `> \`${m.prefix}autoreadsw off\` — Matikan`
        )
    }

    if (action === 'on') {
        db.setting('autoReadSW', { enabled: true })
        db.save()
        await m.react('')
        return m.reply(
            ` *Auto Read Story Aktif*\n\n` +
            `> Bot akan otomatis membaca semua story WA`
        )
    }

    if (action === 'off') {
        db.setting('autoReadSW', { enabled: false })
        db.save()
        await m.react('')
        return m.reply(` *Auto Read Story Dimatikan*`)
    }

    return m.reply(` Gunakan \`on\` atau \`off\``)
}

export { pluginConfig as config, handler }
