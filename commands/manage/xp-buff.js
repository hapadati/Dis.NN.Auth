import { SlashCommandBuilder } from "discord.js";
import { addBuff, removeBuff } from "../../utils/xp-system.js";

export const data = new SlashCommandBuilder()
  .setName("xp-buff")
  .setDescription("💪 XPバフを付与・削除します")
  .addUserOption(opt => opt.setName("user").setDescription("対象ユーザー").setRequired(true))
  .addStringOption(opt => opt
    .setName("buff")
    .setDescription("バフ名")
    .setRequired(true)
    .addChoices(
      { name: "doubleXP", value: "doubleXP" }
    ))
  .addStringOption(opt => opt
    .setName("action")
    .setDescription("add または remove")
    .setRequired(true)
    .addChoices(
      { name: "add", value: "add" },
      { name: "remove", value: "remove" }
    ));

export async function execute(interaction) {
  const user = interaction.options.getUser("user");
  const buff = interaction.options.getString("buff");
  const action = interaction.options.getString("action");

  if (action === "add") await addBuff(interaction.guildId, user.id, buff);
  else if (action === "remove") await removeBuff(interaction.guildId, user.id, buff);

  await interaction.reply(`✅ ${user.username} に対してバフ **${buff}** を ${action} しました`);
}
