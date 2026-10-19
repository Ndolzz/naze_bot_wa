import te from '../../src/lib/naze-error.js'
const pluginConfig = {
    name: 'inspect',
    alias: ['cekgrup', 'ceksaluran'],
    category: 'utility',
    description: 'Inspect info grup atau saluran WhatsApp via link',
    usage: '.inspect <link grup/saluran>',
    example: '.inspect https://chat.whatsapp.com/xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    if (!text) {
        return m.reply(
            ` *Inspect*\n\n` +
            `> Cek info grup atau saluran via link\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}inspect https://chat.whatsapp.com/xxx\`\n` +
            `> \`${m.prefix}inspect https://whatsapp.com/channel/xxx\``
        )
    }

    const grupPattern = /chat\.whatsapp\.com\/([\w\d]*)/
    const saluranPattern = /whatsapp\.com\/channel\/([\w\d]*)/

    m.react('')

    try {
        if (grupPattern.test(text)) {
            const inviteCode = text.match(grupPattern)[1]
            
            const groupInfo = await sock.groupGetInviteInfo(inviteCode)
            
            let teks = 
                ` *Information Group*\n\n` +
                `╭┈┈「 *Detail* 」\n` +
                `┃ Name: *${groupInfo.subject}*\n` +
                `┃ Id: \`${groupInfo.id}\`\n` +
                `┃ Created: ${new Date(groupInfo.creation * 1000).toLocaleString('id-ID')}\n`

            if (groupInfo.owner) {
                teks += `┃ Creator: @${groupInfo.owner.split('@')[0]}\n`
            }

            teks += 
                `┃ Linked Parent: ${groupInfo.linkedParent || 'None'}\n` +
                `┃ Restrict: \n` +
                `┃ Announce: \n` +
                `┃ Is Community: \n` +
                `┃ Community Announce: \n` +
                `┃ Join Approval: \n` +
                `┃ Member Add Mode: \n` +
                `┃ Participants: ${groupInfo.participants?.length || 0}\n` +
                `╰┈┈\n\n`

            if (groupInfo.desc) {
                teks += ` *Description:*\n${groupInfo.desc}\n\n`
            }

            if (groupInfo.participants?.length > 0) {
                const admins = groupInfo.participants.filter(p => p.admin)
                if (admins.length > 0) {
                    teks += ` *Admins:*\n`
                    admins.forEach(a => {
                        teks += `├ @${a.id.split('@')[0]} [${a.admin}]\n`
                    })
                    teks += `╰┈┈`
                }
            }

            const mentions = []
            if (groupInfo.owner) mentions.push(groupInfo.owner)
            if (groupInfo.participants) {
                groupInfo.participants.filter(p => p.admin).forEach(a => mentions.push(a.id))
            }

            m.react('')
            return sock.sendMessage(m.chat, { text: teks, mentions }, { quoted: m })

        } else if (saluranPattern.test(text) || text.endsWith('@newsletter') || !isNaN(text)) {
            const channelId = saluranPattern.test(text) ? text.match(saluranPattern)[1] : text
            
            const channelInfo = await sock.newsletterMsg(channelId)
            
            const teks = 
                ` *Information Channel*\n\n` +
                `╭┈┈「 *Detail* 」\n` +
                `┃ Id: \`${channelInfo.id}\`\n` +
                `┃ State: ${channelInfo.state?.type || '-'}\n` +
                `┃ Name: *${channelInfo.thread_metadata?.name?.text || '-'}*\n` +
                `┃ Created: ${new Date((channelInfo.thread_metadata?.creation_time || 0) * 1000).toLocaleString('id-ID')}\n` +
                `┃ Subscribers: ${channelInfo.thread_metadata?.subscribers_count || 0}\n` +
                `┃ Verification: ${channelInfo.thread_metadata?.verification || '-'}\n` +
                `╰┈┈\n\n` +
                ` *Description:*\n${channelInfo.thread_metadata?.description?.text || 'No description'}`

            m.react('')
            return m.reply(teks)

        } else {
            return m.reply(' Hanya support URL Grup atau Saluran WhatsApp!')
        }

    } catch (error) {
        m.react('')
        
        if (error.data) {
            if ([400, 406].includes(error.data)) {
                return m.reply(' Grup/Saluran tidak ditemukan!')
            }
            if (error.data === 401) {
                return m.reply(' Bot di-kick dari grup tersebut!')
            }
            if (error.data === 410) {
                return m.reply(' URL grup telah di-reset!')
            }
        }
        
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }