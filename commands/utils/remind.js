import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('remind')
    .setDescription('⏰ 指定した時間の後にリマインド通知を送ります')
    .addStringOption(option =>
        option.setName('time')
            .setDescription('時間 (例: 10s, 5m, 1h)')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('message')
            .setDescription('リマインドする内容')
            .setRequired(true));

export async function execute(interaction) {
    try {
        await interaction.deferReply();

        const timeStr = interaction.options.getString('time');
        const message = interaction.options.getString('message');

        const regex = /^(\d+)([smh])$/;
        const match = timeStr.match(regex);

        if (!match) {
            return await interaction.editReply({ content: '❌ 時間の形式が正しくありません。(例: 10s=10秒, 5m=5分, 1h=1時間)' });
        }

        const amount = parseInt(match[1]);
        const unit = match[2];

        if (amount <= 0) {
            return await interaction.editReply({ content: '❌ 時間は1以上にしてください。' });
        }

        // Limit maximum reminder time to 24 hours to prevent extreme memory retention scaling
        if (unit === 'h' && amount > 24) {
            return await interaction.editReply({ content: '❌ リマインダーは最大24時間まで設定可能です。' });
        }

        let ms = 0;
        let unitJp = '';
        if (unit === 's') { ms = amount * 1000; unitJp = '秒'; }
        if (unit === 'm') { ms = amount * 60 * 1000; unitJp = '分'; }
        if (unit === 'h') { ms = amount * 60 * 60 * 1000; unitJp = '時間'; }

        await interaction.editReply({ content: `✅ **${amount}${unitJp}後**に「${message}」とリマインドします！` });

        const userId = interaction.user.id;
        const channelId = interaction.channelId;

        // In-memory timeout (Clears if bot restarts, but very fast and perfectly stable for short duration)
        setTimeout(async () => {
            try {
                // Try to fetch the channel again incase it was deleted or uncached
                const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
                if (channel && channel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('⏰ リマインダー！')
                        .setDescription(`**内容**: ${message}`)
                        .setColor('#f1c40f')
                        .setTimestamp();
                    
                    await channel.send({ content: `<@${userId}> 時間です！`, embeds: [embed] });
                }
            } catch (err) {
                console.error('[remind] setTimeout trigger error:', err);
            }
        }, ms);

    } catch (error) {
        console.error('[remind] Request error:', error);
        if (interaction.deferred) {
            await interaction.editReply({ content: '❌ リマインダーの登録中にエラーが発生しました。' }).catch(() => {});
        }
    }
}
