import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { api } from '../../utils/api.js';

export const data = new SlashCommandBuilder()
    .setName('report')
    .setDescription('🚨 ユーザーを通報します')
    .addUserOption(opt =>
        opt.setName('user').setDescription('通報するユーザー').setRequired(true))
    .addStringOption(opt =>
        opt.setName('reason').setDescription('通報理由').setRequired(true)
            .addChoices(
                { name: 'スパム・荒らし', value: 'spam' },
                { name: 'ハラスメント', value: 'harassment' },
                { name: '不適切なコンテンツ', value: 'inappropriate_content' },
                { name: 'ルール違反', value: 'rule_violation' },
                { name: 'その他', value: 'other' },
            ))
    .addStringOption(opt =>
        opt.setName('detail').setDescription('詳細（省略可能）'));

export async function execute(interaction) {
    try {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const detail = interaction.options.getString('detail') ?? '';

        if (target.id === interaction.user.id) {
            await interaction.editReply({ content: '❌ 自分自身を通報することはできません。' });
            return;
        }
        if (target.bot) {
            await interaction.editReply({ content: '❌ Botを通報することはできません。' });
            return;
        }

    const res = await api.post('/reports', {
        reportedUserId: target.id,
        reportedBy: interaction.user.id,
        type: reason,
        description: detail || reason,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        source: 'discord_command',
    });

    if (!res) {
        await interaction.editReply('❌ 通報の送信に失敗しました。後ほど再試行してください。');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('✅ 通報を受け付けました')
        .setColor(0xef4444)
        .setDescription('ご報告ありがとうございます。管理チームが確認します。')
        .addFields(
            { name: '通報対象', value: `<@${target.id}>`, inline: true },
            { name: '理由', value: reason, inline: true },
        )
        .setFooter({ text: '虚偽の通報はペナルティの対象となります' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[report] Error:', err);
        const errorMessage = '❌ エラーが発生しました。';
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: errorMessage }).catch(() => { });
        } else {
            await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] }).catch(() => { });
        }
    }
}
