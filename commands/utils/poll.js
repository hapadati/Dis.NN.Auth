import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('poll')
    .setDescription('📊 リアルタイムで結果が更新される投票を作成します')
    .addStringOption(option =>
        option.setName('question')
            .setDescription('質問内容')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('choice1')
            .setDescription('選択肢 1')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('choice2')
            .setDescription('選択肢 2')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('choice3')
            .setDescription('選択肢 3 (任意)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('choice4')
            .setDescription('選択肢 4 (任意)')
            .setRequired(false));

export async function execute(interaction) {
    try {
        const question = interaction.options.getString('question');
        const choices = [
            interaction.options.getString('choice1'),
            interaction.options.getString('choice2'),
            interaction.options.getString('choice3'),
            interaction.options.getString('choice4')
        ].filter(Boolean); // undefined や null を除外

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

        let description = '';
        const row = new ActionRowBuilder();

        choices.forEach((choice, index) => {
            // Embedの文章作成
            description += `${emojis[index]} **${choice}**\n👉 0 票\n\n`;

            // ボタン生成
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_${index}`)
                    .setLabel(choice.substring(0, 80)) // ボタンラベルの最大長制限
                    .setEmoji(emojis[index])
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        const embed = new EmbedBuilder()
            .setTitle(`📊 投票: ${question}`)
            .setDescription(description)
            .setColor('#3498db')
            .setFooter({ text: `作成者: ${interaction.user.tag}` })
            .setTimestamp();

        // 投票メッセージは全員に見えるように送信
        await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('[poll] Setup Error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ 投票の作成中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] });
        }
    }
}

// 投票ボタン押下時の処理 (Stateless Approach)
export async function handlePollButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('poll_')) return;

    try {
        // 先に応答を遅延させてタイムアウトを防ぐ（他の人が押してエラーになるのを防ぐ）
        // 投票システムの場合、直接メッセージを更新するため、update を利用
        await interaction.deferUpdate();

        const message = interaction.message;
        const embed = message.embeds[0];
        if (!embed) return;

        const choiceIndex = parseInt(interaction.customId.split('_')[1]);
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

        // 現在のEmbedのDescriptionを行ごとに分割してパース
        const lines = embed.description.split('\n');
        
        let newDescription = '';
        let currentIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 選択肢のタイトル行を見つけたらインデックスを更新
            let foundChoice = false;
            for (let e = 0; e < emojis.length; e++) {
                if (line.startsWith(emojis[e])) {
                    currentIndex = e;
                    foundChoice = true;
                    break;
                }
            }

            if (!foundChoice && line.startsWith('👉')) {
                // 票数の行の場合
                if (currentIndex === choiceIndex) {
                    // 対象の選択肢の場合、票数をインクリメント
                    const currentVotes = parseInt(line.replace(/[^0-9]/g, '')) || 0;
                    newDescription += `👉 ${currentVotes + 1} 票\n`;
                } else {
                    newDescription += line + '\n';
                }
            } else {
                newDescription += line + '\n';
            }
        }

        // Embedを再構築して更新
        const newEmbed = EmbedBuilder.from(embed).setDescription(newDescription.trim());

        await message.edit({ embeds: [newEmbed] });

    } catch (error) {
        console.error('[poll] Button Update Error:', error);
        // deferUpdate済なので、追加のエラーメッセージをこっそり出す
        await interaction.followUp({ content: '❌ 投票の集計中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] }).catch(() => {});
    }
}
