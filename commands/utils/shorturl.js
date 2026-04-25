import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
    .setName('shorturl')
    .setDescription('🔗 長いURLを短縮します (is.gd を使用)')
    .addStringOption(option =>
        option.setName('url')
            .setDescription('短縮したいURL')
            .setRequired(true));

export async function execute(interaction) {
    try {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        let targetUrl = interaction.options.getString('url');

        // 簡単なURLバリデーション
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

        try {
            new URL(targetUrl); // これでエラーが出れば無効なURL
        } catch {
            return await interaction.editReply({ content: '❌ 無効なURL形式です。(http:// または https:// から始まる必要があります)' });
        }

        // is.gd パブリックAPIへのリクエスト
        const response = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(targetUrl)}`);

        if (response.data && typeof response.data === 'string' && response.data.startsWith('http')) {
            const shortUrl = response.data;

            const embed = new EmbedBuilder()
                .setTitle('🔗 URLを短縮しました')
                .addFields(
                    { name: '元のURL', value: targetUrl },
                    { name: '短縮URL', value: shortUrl }
                )
                .setColor('#2ecc71');

            await interaction.editReply({ embeds: [embed] });
        } else {
            throw new Error('APIから無効なレスポンスが返されました');
        }

    } catch (error) {
        console.error('[shorturl] Error:', error);
        if (interaction.deferred) {
            await interaction.editReply({ content: '❌ URLの短縮中にエラーが発生しました。外部サービスが混雑している可能性があります。' }).catch(() => {});
        }
    }
}
