import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getAllLevelConfigs } from "../../utils/levelSystem.js";

export const data = new SlashCommandBuilder()
  .setName("showlevelroles")
  .setDescription("📜 サーバーのレベルアップ設定を表示します")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  await interaction.deferReply({ ephemeral: true });

  const configs = await getAllLevelConfigs(guildId);
  if (configs.length === 0) {
    return interaction.editReply("⚠️ 設定はまだありません。");
  }

  const desc = configs.map(c =>
    `**Lv.${c.level}**\n➕ 付与: ${c.add.join(", ") || "なし"}\n➖ 削除: ${c.remove.join(", ") || "なし"}`
  ).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.guild.name} のレベルロール設定`)
    .setDescription(desc)
    .setColor(0x00aaff)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
