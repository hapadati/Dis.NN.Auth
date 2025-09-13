import { SlashCommandBuilder } from 'discord.js';
import { db } from '../../firestore.js';

export const data = new SlashCommandBuilder()
  .setName('item-delete')
  .setDescription('アイテムを削除します（管理者専用）')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('削除するアイテム名')
      .setRequired(true))
  .addBooleanOption(option =>
    option.setName('force')
      .setDescription('在庫があっても強制削除するか (デフォルト: false)'))
  .setDefaultMemberPermissions(0);

export async function execute(interaction) {
  const name = interaction.options.getString('name');
  const force = interaction.options.getBoolean('force') || false;
  const guildId = interaction.guildId;

  try {
    // 名前で検索（ドキュメントIDに依存しない）
    const snapshot = await db
      .collection('servers')
      .doc(guildId)
      .collection('items')
      .where('name', '==', name)
      .limit(1)
      .get();

    if (snapshot.empty) {
      await interaction.reply(`❌ アイテム **${name}** は存在しません。`);
      return;
    }

    const doc = snapshot.docs[0];
    const item = doc.data();

    if (item.stock > 0 && !force) {
      await interaction.reply(
        `⚠️ **${item.name}** にはまだ在庫(${item.stock})があります。\n強制削除する場合は \`force: true\` を指定してください。`
      );
      return;
    }

    await doc.ref.delete();
    await interaction.reply(`🗑️ アイテム **${item.name}** を削除しました。`);
  } catch (error) {
    console.error('アイテム削除エラー:', error);
    await interaction.reply('❌ アイテム削除中にエラーが発生しました。');
  }
}
