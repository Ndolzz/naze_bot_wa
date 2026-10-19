import { stopSchedulerByName, getFullSchedulerStatus } from '../../src/lib/naze-scheduler.js'
import { getDatabase } from '../../src/lib/naze-database.js'
import te from '../../src/lib/naze-error.js'
const pluginConfig = {
    name: 'stopschedule',
    alias: ['stopscheduler', 'schedstop', 'pauseschedule'],
    category: 'owner',
    description: 'Menghentikan scheduler tertentu atau semua',
    usage: '.stopschedule <nama|all>',
    example: '.stopschedule sewa',
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
            const helpText = ` *Stop Scheduler*

*Usage:*
\`.stopschedule <nama>\`

*Available schedulers:*
• \`limitreset\` Daily Limit Reset
• \`groupschedule\` Group Schedule
• \`sewa\` Sewa Checker
• \`messages\` Scheduled Messages
• \`all\` Semua scheduler

*Example:*
\`.stopschedule sewa\`
\`.stopschedule all\``;
            
            await m.reply(helpText);
            return;
        }
        
        const result = stopSchedulerByName(target);
        
        if (result.stopped) {
            await m.reply(` *Scheduler Dihentikan*

> Scheduler: *${result.name}*
> Status: Dihentikan

_Gunakan \`.startschedule ${target}\` untuk mengaktifkan kembali_`);
        } else {
            await m.reply(` Scheduler tidak ditemukan atau sudah nonaktif

Gunakan \`.stopschedule\` untuk melihat daftar scheduler`);
        }
    } catch (error) {
        console.error('[StopSchedule Error]', error);
        await m.reply(te(m.prefix, m.command, m.pushName));
    }
}

export { pluginConfig as config, handler }