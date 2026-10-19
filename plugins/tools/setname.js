const pluginConfig = {
    name: 'setname',
    alias: ['setbotnama'],
    category: 'tools',
    description: 'Mengubah nama profil bot',
    usage: '.setname <nama baru>',
    example: '.setname NAZE',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const newName = m.text?.trim()
    
    if (!newName) {
        await m.reply(
            ` *Cara Pakai*\n\n` +
            `> \`${m.prefix}setname Nama Bot Baru\``
        )
        return
    }
    
    if (newName.length < 1 || newName.length > 25) {
        await m.reply(
            ` *Validasi*\n\n` +
            `> Nama bot harus 1-25 karakter.`
        )
        return
    }
    
    try {
        await sock.updateProfileName(newName)
        
        await m.reply(
            ` *Nama Bot Diubah*\n\n` +
            `> Nama bot sekarang: *${newName}*`
        )
    } catch (error) {
        await m.reply(
            ` *Gagal*\n\n` +
            `> Tidak dapat mengubah nama bot.\n` +
            `> _${error.message}_`
        )
    }
}

export { pluginConfig as config, handler }