import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('qr')
    .setDescription('📱 テキストやURLをQRコード画像に変換します')
    .addStringOption(option =>
        option.setName('content')
            .setDescription('QRコードにするテキストまたはURL')
            .setRequired(true));

export async function execute(interaction) {
    try {
        await interaction.deferReply();

        const content = interaction.options.getString('content');

        // URL encode the content for the API request
        const encodedContent = encodeURIComponent(content);
        
        // Use a reliable public QR code generation API
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodedContent}`;

        const embed = new EmbedBuilder()
            .setTitle('📱 QRコード生成')
            .setDescription(`以下の内容をQRコード化しました:\n\`${content}\``)
            .setImage(qrUrl)
            .setColor('#3498db')
            .setFooter({ text: 'Powered by QR Server' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[qr] Error:', error);
        if (interaction.deferred) {
            await interaction.editReply({ content: '❌ QRコードの生成中にエラーが発生しました。' }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }
    }
}
