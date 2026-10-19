const pluginConfig = {
    name: 'setbio',
    alias: ['setbiobot', 'setstatus', 'setabout'],
    category: 'tools',
    description: 'Mengubah bio/status bot',
    usage: '.setbio <bio baru>',
    example: '.setbio Bot WhatsApp NAZE',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const newBio = m.text?.trim()
    
    if (!newBio && m.args?.length === 0) {
        await m.reply(
            ` *Cara Pakai*\n\n` +
            `> \`${m.prefix}setbio Bio bot baru\`\n` +
            `> \`${m.prefix}setbio clear\` Hapus bio`
        )
        return
    }
    
    const bioToSet = newBio?.toLowerCase() === 'clear' ? '' : (newBio || '')
    
    if (bioToSet.length > 139) {
        await m.reply(
            ` *Validasi*\n\n` +
            `> Bio maksimal 139 karakter.`
        )
        return
    }
    
    try {
        await sock.updateProfileStatus(bioToSet)
        
        if (bioToSet) {
            await m.reply(
                ` *Bio Bot Diubah*\n\n` +
                `> Bio bot sekarang:\n` +
                `> _${bioToSet}_`
            )
        } else {
            await m.reply(
                ` *Bio Bot Dihapus*\n\n` +
                `> Bio bot berhasil dihapus!`
            )
        }
    } catch (error) {
        await m.reply(
            ` *Gagal*\n\n` +
            `> Tidak dapat mengubah bio bot.\n` +
            `> _${error.message}_`
        )
    }
}

export { pluginConfig as config, handler }