import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord.js';

export const kickCommand = {
data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('ユーザーをサーバーからキックします')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('キックするユーザー')
        .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    
    // メッセージ管理権限の確認
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: 'あなたにはこの操作を行う権限がありません。' });
    }

    try {
      const member = await interaction.guild.members.fetch(user.id);
      
      // ユーザーがキック可能かチェック
      if (member && member.kickable) {
        await member.kick('キックされました');
        return interaction.reply(`${user.tag} さんがキックされました。`);
      } else {
        return interaction.reply({ content: 'そのユーザーをキックできません。権限が不足している可能性があります。' });
      }
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: 'キック処理中にエラーが発生しました。' });
    }
  },
};
