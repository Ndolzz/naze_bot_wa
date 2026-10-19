import { startSchedulerByName, getFullSchedulerStatus } from '../../src/lib/naze-scheduler.js'
import { getDatabase } from '../../src/lib/naze-database.js'
import te from '../../src/lib/naze-error.js'
const pluginConfig = {
    name: 'startschedule',
    alias: ['startscheduler', 'schedstart', 'resumeschedule'],
    category: 'owner',
    description: 'Memulai ulang scheduler tertentu atau semua',
    usage: '.startschedule <nama|all>',
    example: '.startschedule sewa',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock, args }) {
    try {
        const target = args[0]?.toLowerCase();
        
        if (!target) {
            const helpText = `▶ *Start Scheduler*

*Usage:*
\`.startschedule <nama>\`

*Available schedulers:*
• \`limitreset\` Daily Limit Reset
• \`groupschedule\` Group Schedule
• \`sewa\` Sewa Checker
• \`messages\` Scheduled Messages
• \`all\` Semua scheduler

*Example:*
\`.startschedule sewa\`
\`.startschedule all\``;
            
            await m.reply(helpText);
            return;
        }
        
        const result = startSchedulerByName(target, sock);
        
        if (result.started) {
            await m.reply(`▶ *Scheduler Dimulai*

> Scheduler: *${result.name}*
> Status: Aktif

_Scheduler telah dimulai kembali_`);
        } else {
            await m.reply(` Scheduler tidak ditemukan atau sudah aktif

Gunakan \`.startschedule\` untuk melihat daftar scheduler`);
        }
    } catch (error) {
        console.error('[StartSchedule Error]', error);
        await m.reply(te(m.prefix, m.command, m.pushName));
    }
}

export { pluginConfig as config, handler }