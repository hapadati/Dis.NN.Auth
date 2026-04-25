import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../firestore.js";

export const deletechannelCommand = {
  data: new SlashCommandBuilder()
    .setName("deletechannel")
    .setDescription("🗑️ チャンネルを削除します（管理者専用）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("削除するチャンネル").setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");

    try {
      const name = channel.name;
      await channel.delete(`${interaction.user.tag} により削除`);

      await db.collection("guilds")
        .doc(interaction.guild.id)
        .collection("channelLogs")
        .add({
          action: "delete",
          channelId: channel.id,
          userId: interaction.user.id,
          name,
          timestamp: new Date().toISOString(),
        });

      await interaction.reply(`🗑️ チャンネル **#${name}** を削除しました。`);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "⚠️ チャンネル削除に失敗しました。" });
    }
  },
};
