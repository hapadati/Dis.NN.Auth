import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('role-info')
    .setDescription('🎭 ロールの詳細情報を表示します')
    .addRoleOption(option =>
        option.setName('role')
            .setDescription('情報を表示するロール')
            .setRequired(true));

export async function execute(interaction) {
    try {
        const role = interaction.options.getRole('role');

        if (!role) {
            await interaction.reply({
                content: '❌ ロールが見つかりません。'
            });
            return;
        }

        await interaction.deferReply();

        const permissions = role.permissions.toArray();
        const memberCount = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
        const createdAt = role.createdAt.toLocaleString('ja-JP');
        const position = role.position;

        const embed = new EmbedBuilder()
            .setTitle(`🎭 ${role.name} の情報`)
            .setColor(role.color || 0x5865F2)
            .addFields(
                {
                    name: '📝 基本情報',
                    value: `ID: \`${role.id}\`\n` +
                        `カラー: ${role.hexColor}\n` +
                        `作成日: ${createdAt}\n` +
                        `位置: ${position}`,
                    inline: false
                },
                {
                    name: '👥 メンバー数',
                    value: `**${memberCount.toLocaleString()}人**`,
                    inline: true
                },
                {
                    name: '🏷️ メンション可能',
                    value: role.mentionable ? 'はい' : 'いいえ',
                    inline: true
                },
                {
                    name: '🎨 別途表示',
                    value: role.hoist ? 'はい' : 'いいえ',
                    inline: true
                }
            )
            .setTimestamp();

        if (permissions.length > 0) {
            const permList = permissions.slice(0, 20).map(p => `\`${p}\``).join(', ');
            const morePerms = permissions.length > 20 ? `\n他 ${permissions.length - 20}個...` : '';

            embed.addFields({
                name: `🔑 権限 (${permissions.length})`,
                value: permList + morePerms,
                inline: false
            });
        }

        if (role.managed) {
            embed.addFields({
                name: '⚠️ 管理されたロール',
                value: 'このロールはBot/連携によって管理されています',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[role-info] Error:', err);

        const errorMessage = '❌ ロール情報の取得に失敗しました。';

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(errorMessage).catch(() => { });
        } else {
            await interaction.reply({ content: errorMessage }).catch(() => { });
        }
    }
}
