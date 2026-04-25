import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('password')
    .setDescription('🔐 安全でランダムな強力パスワードを生成します (あなたにだけ見えます)')
    .addIntegerOption(option =>
        option.setName('length')
            .setDescription('パスワードの長さ (8〜64文字。デフォルト: 16)')
            .setMinValue(8)
            .setMaxValue(64)
            .setRequired(false))
    .addBooleanOption(option =>
        option.setName('symbols')
            .setDescription('記号 (!@#$%^&*) を含めるか (デフォルト: True)')
            .setRequired(false));

export async function execute(interaction) {
    try {
        // パスワードを他人に見られないように、自分のみ(Ephemeral)に設定
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const length = interaction.options.getInteger('length') || 16;
        const useSymbols = interaction.options.getBoolean('symbols') ?? true;

        const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
        const numberChars = '0123456789';
        const symbolChars = '!@#$%^&*()_+~|}{[]:;?><,./-=';

        let availableChars = uppercaseChars + lowercaseChars + numberChars;
        if (useSymbols) {
            availableChars += symbolChars;
        }

        let password = '';
        
        // Ensure at least one character from each required set is selected if long enough
        if (length >= 4) {
            password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
            password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
            password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
            if (useSymbols) {
                password += symbolChars.charAt(Math.floor(Math.random() * symbolChars.length));
            }
        }

        // Fill the rest randomly
        while (password.length < length) {
            password += availableChars.charAt(Math.floor(Math.random() * availableChars.length));
        }

        // Shuffle the characters in the password
        password = password.split('').sort(() => 0.5 - Math.random()).join('');

        const embed = new EmbedBuilder()
            .setTitle('🔐 ランダムパスワード生成結果')
            .setDescription(`生成されたパスワード（長さ: ${length}）:\n\n\`\`\`\n${password}\n\`\`\``)
            .setColor('#2ecc71')
            .setFooter({ text: '※このメッセージはあなたにしか見えません。コピーが終わるか、Discordを閉じると消破されます。' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[password] Error:', error);
        if (interaction.deferred) {
            await interaction.editReply({ content: '❌ パスワードの生成中にエラーが発生しました。' }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }
    }
}
