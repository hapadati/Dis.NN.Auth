import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { loadGuildData } from '../utils/data-manager.js';

export const data = new SlashCommandBuilder()
    .setName('theme')
    .setDescription('レベル15以上のユーザーがカード背景を変更します')
    .addAttachmentOption(opt =>
        opt.setName('image').setDescription('背景に使いたい画像').setRequired(true)
    );

export async function execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const data = loadGuildData(guildId);
    const userData = data[userId] || { level: 1 };

    if (userData.level < 15) {
        return interaction.reply({ content: '❌ この機能はLv15以上で利用できます！', ephemeral: true });
    }

    const image = interaction.options.getAttachment('image');
    const savePath = path.resolve(`./themes/${userId}.png`);

    const response = await fetch(image.url);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(savePath, buffer);

    await interaction.reply('🎨 カード背景を更新しました！');
}
