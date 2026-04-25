import { SlashCommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord.js';

export const softbanCommand = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('ユーザーをソフトバンします（メッセージ削除範囲を設定可能）')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('ソフトバンするユーザー')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('メッセージ削除の期間（例: 1d, 1h、無期限なら空欄）')
        .setRequired(false)),
  
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const durationString = interaction.options.getString('duration') || '0'; // 空欄なら無期限（0秒）

    // コマンド実行者がバンする権限を持っているか確認
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'あなたにはこの操作を行う権限がありません。' });
    }

    const member = await interaction.guild.members.fetch(user.id);
    
    // ユーザーがバン可能かチェック
    if (!member.bannable) {
      return interaction.reply({ content: 'そのユーザーをソフトバンできません。権限が不足しているか、上位にいる可能性があります。' });
    }

    let daysToDelete = 0; // デフォルトはメッセージ削除なし（無期限）

    // durationが指定された場合、単位を解析してメッセージ削除の範囲を設定
    if (durationString && /^(\d+)([smhdwy])$/.test(durationString)) {
      const match = durationString.match(/^(\d+)([smhdwy])$/);
      const amount = parseInt(match[1]);
      const unit = match[2];

      const timeUnits = {
        s: 1,    // 秒
        m: 1,    // 分
        h: 1,    // 時間
        d: 1,    // 日
        w: 7,    // 週間
        y: 365,  // 年
      };

      // 単位に応じて削除する日数を決定
      daysToDelete = amount * timeUnits[unit];
    } else if (durationString !== '0') {
      // 無効な入力があった場合の処理
      return interaction.reply({ content: '無効な期間が指定されました。正しい形式（例: 1d, 1h）で入力してください。' });
    }

    try {
      // バン（過去のメッセージを削除）
      await member.ban({ reason: 'ソフトバン', days: daysToDelete });

      // ソフトバンは即座にアンバン
      await interaction.guild.members.unban(user.id);

      return interaction.reply(`${user.tag} さんがソフトバンされました（削除範囲: 過去${daysToDelete}日分のメッセージ）。`);
    } catch (error) {
      // エラーハンドリングの強化
      console.error('ソフトバンエラー:', error);
      return interaction.reply({ content: `ソフトバンの処理中にエラーが発生しました: ${error.message}` });
    }
  },
};
