import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { setLevelRoleConfig } from "../utils/levelSystem.js";

export const data = new SlashCommandBuilder()
  .setName("setlevelrole")
  .setDescription("🎛️ レベルアップ時のロール設定を追加・変更します（管理者専用）")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addIntegerOption(opt =>
    opt.setName("level")
      .setDescription("対象レベル")
      .setRequired(true))
  .addStringOption(opt =>
    opt.setName("add")
      .setDescription("レベル到達時に付与するロール名（カンマ区切り可）"))
  .addStringOption(opt =>
    opt.setName("remove")
      .setDescription("レベル到達時に削除するロール名（カンマ区切り可）"));

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  const level = interaction.options.getInteger("level");
  const add = interaction.options.getString("add")?.split(",").map(r => r.trim()) || [];
  const remove = interaction.options.getString("remove")?.split(",").map(r => r.trim()) || [];

  await setLevelRoleConfig(guildId, level, add, remove);

  await interaction.reply({
    content: `✅ Lv.${level} の設定を更新しました。\n**追加:** ${add.join(", ") || "なし"}\n**削除:** ${remove.join(", ") || "なし"}`,
    ephemeral: true
  });
}
