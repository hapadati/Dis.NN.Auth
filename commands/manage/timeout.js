import { SlashCommandBuilder } from '@discordjs/builders';
import pkg from 'discord.js';
const { MessageActionRow, MessageButton, MessageEmbed, PermissionFlagsBits, DiscordAPIError } = pkg;

// 時間の単位とそのミリ秒変換を定義
const timeUnits = {
  s: 1000,    // 秒
  m: 60 * 1000, // 分
  h: 60 * 60 * 1000, // 時間
  d: 24 * 60 * 60 * 1000, // 日
  w: 7 * 24 * 60 * 60 * 1000, // 週間
  y: 365 * 24 * 60 * 60 * 1000, // 年
};

export const timeoutCommand = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('ユーザーをタイムアウトします')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('タイムアウトするユーザー')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('duration')
        .setDescription('タイムアウトの時間（秒、分、時間、日、週、年）')
        .setRequired(true)),
  
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const durationString = interaction.options.getString('duration');
    
    // 正規表現で時間の単位と数値を取得
    const regex = /^(\d+)([smhdwy])$/;
    const match = durationString.match(regex);

    if (!match) {
      return interaction.reply({ content: '無効な時間形式です。正しい形式で指定してください（例: 30s, 1m, 2h）。' });
    }

    const amount = parseInt(match[1]); // 数字部分
    const unit = match[2]; // 単位（秒、分、時間、日など）

    // 単位をミリ秒に変換
    const timeoutDuration = amount * timeUnits[unit];

    // コマンド実行者がタイムアウト権限を持っているか確認
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: 'あなたにはこの操作を行う権限がありません。' });
    }

    const member = await interaction.guild.members.fetch(user.id);
    if (member && member.moderatable) {
      try {
        await member.timeout(timeoutDuration, 'タイムアウトされました');
        return interaction.reply(`${user.tag} さんがタイムアウトされました。`);
      } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 50013) {
          return interaction.reply({ content: 'そのユーザーをタイムアウトできません。権限が不足しているか、上位にいる可能性があります。' });
        }
        return interaction.reply({ content: 'タイムアウトの処理中にエラーが発生しました。' });
      }
    } else {
      return interaction.reply({ content: 'そのユーザーにタイムアウトを適用できません。' });
    }
  },
};
