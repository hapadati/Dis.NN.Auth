import { SlashCommandBuilder } from 'discord.js';
import { db } from '../../firestore.js';

export const data = new SlashCommandBuilder()
  .setName('points-add')
  .setDescription('ユーザーにポイントを追加します（管理者専用）')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('対象ユーザー')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('追加するポイント数 (0以上の整数)')
      .setMinValue(0)
      .setRequired(true))
  .setDefaultMemberPermissions(0); // 管理者専用

export async function execute(interaction) {
  // すぐに応答を延期してタイムアウト防止
  await interaction.deferReply();

  const target = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.editReply("❌ このコマンドはサーバー内でのみ使用できます。");
  }

  try {
    const ref = db.collection('servers').doc(guildId).collection('points').doc(target.id);
    const doc = await ref.get();
    const current = doc.exists ? doc.data().points : 0;

    await ref.set(
      { points: current + amount },
      { merge: true }
    );

    await interaction.editReply(
      `✅ ${target.username} に **${amount}pt** 追加しました！（合計: ${current + amount}pt）`
    );
  } catch (err) {
    console.error("Firestore error:", err);
    await interaction.editReply("❌ データベース処理中にエラーが発生しました。");
  }
}
