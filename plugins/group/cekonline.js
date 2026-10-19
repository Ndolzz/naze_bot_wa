import te from '../../src/lib/naze-error.js'
const pluginConfig = {
    name: 'cekonline',
    alias: ['checkonline', 'online', 'siapayangonline', 'whosonline'],
    category: 'group',
    description: 'Cek member yang online di grup',
    usage: '.cekonline',
    example: '.cekonline',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 60,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    m.react('')
    
    try {
        const groupMetadata = m.groupMetadata
        const participants = m.groupMembers
        
        if (participants.length === 0) {
            m.react('')
            return m.reply(` *Gagal*\n\n> Tidak bisa mendapatkan data member grup`)
        }
        
        await m.reply(` *Mencari Member Online...*\n\n> Menunggu response dari ${participants.length} member\n> Estimasi: 5-10 detik`)
        
        const presences = {}
        
        const presenceHandler = (update) => {
            if (update.id === m.chat && update.presences) {
                for (const [jid, presence] of Object.entries(update.presences)) {
                    if (presence.lastKnownPresence === 'available' || 
                        presence.lastKnownPresence === 'composing' || 
                        presence.lastKnownPresence === 'recording') {
                        presences[jid] = presence.lastKnownPresence
                    }
                }
            }
        }
        
        sock.ev.on('presence.update', presenceHandler)
        
        const batchSize = 10
        for (let i = 0; i < participants.length; i += batchSize) {
            const batch = participants.slice(i, i + batchSize)
            await Promise.all(batch.map(p => 
                sock.presenceSubscribe(p.id).catch(() => {})
            ))
            await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        sock.ev.off('presence.update', presenceHandler)
        
        const onlineMembers = Object.keys(presences)
        const mentions = onlineMembers
        
        let text = ` *Cek Online*\n\n`
        text += `╭┈┈「 *Info Grup* 」\n`
        text += `┃ Nama: *${groupMetadata.subject}*\n`
        text += `┃ Total: \`${participants.length}\` member\n`
        text += `┃ Online: \`${onlineMembers.length}\` member\n`
        text += `╰┈┈\n\n`
        
        if (onlineMembers.length === 0) {
            text += `> _Tidak ada member yang terdeteksi online_\n`
            text += `> _Pastikan member telah membuka WA_`
        } else {
            text += `╭┈┈「 *Member Online* 」\n`
            
            let count = 0
            for (const jid of onlineMembers) {
                if (count >= 50) {
                    text += `┃ ... dan ${onlineMembers.length - 50} member lainnya\n`
                    break
                }
                const number = jid.split('@')[0]
                const participant = participants.find(p => p.id === jid)
                const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin'
                const adminBadge = isAdmin ? ' ' : ''
                
                let statusIcon = ''
                if (presences[jid] === 'composing') statusIcon = ''
                if (presences[jid] === 'recording') statusIcon = ''
                
                text += `┃ ${statusIcon} @${number}${adminBadge}\n`
                count++
            }
            
            text += `╰┈┈\n\n`
            text += `> Online | Mengetik | Rekam Audio`
        }
        
        m.react('')
        await m.reply(text, { mentions: mentions })
        
    } catch (error) {
        m.react('')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }