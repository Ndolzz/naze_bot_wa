import { getFullSchedulerStatus, formatTimeRemaining, getMsUntilTime } from '../../src/lib/naze-scheduler.js'
import te from '../../src/lib/naze-error.js'
const pluginConfig = {
    name: 'cekschedule',
    alias: ['cekscheduler', 'schedulerstatus', 'schedstatus'],
    category: 'owner',
    description: 'Melihat status semua scheduler bot',
    usage: '.cekschedule',
    example: '.cekschedule',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock }) {
    try {
        const status = getFullSchedulerStatus();

        let text = ` *Scheduler Status*\n\n`;

        for (const sched of status.schedulers) {
            const statusIcon = sched.running ? '' : '';
            text += `${statusIcon} *${sched.name}*\n`;
            text += ` └ Key: \`${sched.key}\`\n`;
            text += ` └ ${sched.description}\n`;

            if (sched.lastRun && sched.lastRun !== '-' && sched.lastRun !== 'Never') {
                text += ` └ Last: ${sched.lastRun}\n`;
            }

            if (sched.stats) {
                if (sched.stats.totalResets) {
                    text += ` └ Total Resets: ${sched.stats.totalResets}\n`;
                }
                if (sched.stats.activeMessages !== undefined) {
                    text += ` └ Active: ${sched.stats.activeMessages} | Sent: ${sched.stats.totalSent}\n`;
                }
            }
            text += `\n`;
        }

        text += `\n`;
        text += `━━━━━━━━━━━━━━━━━━━\n`;
        text += ` Aktif: ${status.summary.totalActive}\n`;
        text += ` Nonaktif: ${status.summary.totalInactive}\n\n`;

        text += `> Gunakan \`.stopschedule <key>\` untuk stop\n`;
        text += `> Gunakan \`.startschedule <key>\` untuk start`;

        await m.reply(text);
    } catch (error) {
        console.error('[CekSchedule Error]', error);
        await m.reply(te(m.prefix, m.command, m.pushName));
    }
}

export { pluginConfig as config, handler }