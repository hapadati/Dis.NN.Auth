import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { setUnlockLevel } from "../utils/unlockSystem.js";

export const data = new SlashCommandBuilder()
  .setName("setunlock")
  .setDescription("🔓 コマンドの解放レベルを設定します（管理者専用）")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(opt =>
    opt.setName("command").setDescription("対象のコマンド名（例: rank）").setRequired(true))
  .addIntegerOption(opt =>
    opt.setName("level").setDescription("使用可能にする最低レベル").setRequired(true));

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  const command = interaction.options.getString("command");
  const level = interaction.options.getInteger("level");

  await setUnlockLevel(guildId, command, level);
  await interaction.reply({
    content: `✅ コマンド「/${command}」はLv.${level}から使用可能になりました。`,
  });
}
