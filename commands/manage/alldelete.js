import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord.js';

export const alldeleteCommand = {
  data: new SlashCommandBuilder()
    .setName('alldelete')
    .setDescription('指定したユーザーまたはボットのメッセージを削除します')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('メッセージを削除するユーザーまたはボット')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('削除するメッセージの数（最大100件）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)),
  
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const limit = interaction.options.getInteger('limit') || 100;  // デフォルトで100件のメッセージを削除

    // コマンド実行者がメッセージ管理権限を持っているか確認
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'あなたにはこの操作を行う権限がありません。' });
    }

    try {
      // メッセージ履歴を取得
      const messages = await interaction.channel.messages.fetch({ limit: 100 });  // 最大100件を取得

      // 指定したユーザーまたはボットのメッセージだけをフィルタリング
      const userMessages = messages.filter(msg => msg.author.id === user.id || msg.author.bot);

      // 削除するメッセージの数を制限
      const messagesToDelete = userMessages.slice(0, limit);

      if (messagesToDelete.size === 0) {
        return interaction.reply({ content: `${user.tag} さんまたはボットのメッセージは見つかりませんでした。` });
      }

      // メッセージを一括削除
      await interaction.channel.bulkDelete(messagesToDelete, true);  // `true` は削除済みメッセージも対象にするオプション

      return interaction.reply({ content: `${user.tag} さんまたはボットのメッセージ ${messagesToDelete.size} 件が削除されました。` });

    } catch (error) {
      console.error(error);
      return interaction.reply({ content: 'メッセージ削除中にエラーが発生しました。' });
    }
  },
};
