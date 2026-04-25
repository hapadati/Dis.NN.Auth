import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('🖼️ 指定したユーザーのプロフィール画像（アバター）を拡大表示します')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('アバターを見たいユーザー (指定しない場合は自分のアバター)')
            .setRequired(false));

export async function execute(interaction) {
    try {
        await interaction.deferReply();

        let user = interaction.options.getUser('user');
        
        // ユーザーが指定されなかった場合は実行者自身とする
        if (!user) {
            user = interaction.user;
        }

        const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 1024 });

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ ${user.tag} のアバター`)
            .setImage(avatarUrl)
            .setColor('#9b59b6');

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[avatar] Error:', error);
        if (interaction.deferred) {
            await interaction.editReply({ content: '❌ アバターの取得中にエラーが発生しました。' }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }
    }
}
