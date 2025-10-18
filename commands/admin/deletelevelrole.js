import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../firebase.js";
import { doc, deleteDoc } from "firebase/firestore";

export const data = new SlashCommandBuilder()
  .setName("deletelevelrole")
  .setDescription("🗑️ 指定したレベルのロール設定を削除します（管理者専用）")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addIntegerOption(option =>
    option
      .setName("level")
      .setDescription("削除するレベルを指定")
      .setRequired(true)
  );

export async function execute(interaction) {
  const guild = interaction.guild;
  const guildId = guild.id;
  const level = interaction.options.getInteger("level");

  await interaction.deferReply({ ephemeral: true });

  try {
    const levelDoc = doc(db, "guilds", guildId, "levelRoles", `level_${level}`);
    await deleteDoc(levelDoc);

    await interaction.editReply(`✅ レベル **${level}** のロール設定を削除しました。`);
  } catch (error) {
    console.error("❌ deletelevelrole エラー:", error);
    await interaction.editReply("⚠️ 設定の削除中にエラーが発生しました。");
  }
}
