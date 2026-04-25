import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord.js';

export const banCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('指定したユーザーをサーバーからバンします')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('バンするユーザー')
        .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'あなたにはこの操作を行う権限がありません。' });
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      if (member && member.bannable) {
        await member.ban({ reason: 'ユーザーがサーバーの規則に違反したためバンされました。' });
        return interaction.reply(`${user.tag} さんがサーバーからバンされました。`);
      } else {
        return interaction.reply({ content: 'そのユーザーをバンできません。管理者権限やボットの権限が不足している場合があります。' });
      }
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: 'バン処理中にエラーが発生しました。' });
    }
  },
};
