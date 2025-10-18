import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadGuildData } from '../../utils/data-manager.js';

export const data = new SlashCommandBuilder()
    .setName('top')
    .setDescription('サーバー内のXPランキングを表示します');

export async function execute(interaction) {
    const guildId = interaction.guild.id;
    const data = loadGuildData(guildId);

    const sorted = Object.entries(data)
        .sort(([, a], [, b]) => (b.level * 10000 + b.xp) - (a.level * 10000 + a.xp))
        .slice(0, 10);

    const embed = new EmbedBuilder()
        .setTitle('🏆 XPランキング')
        .setColor('#00b0f4');

    for (let i = 0; i < sorted.length; i++) {
        const [userId, user] = sorted[i];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        embed.addFields({
            name: `${i + 1}位 — ${member ? member.user.username : '不明ユーザー'}`,
            value: `Lv.${user.level}（${user.xp} XP）`,
        });
    }

    await interaction.reply({ embeds: [embed] });
}
