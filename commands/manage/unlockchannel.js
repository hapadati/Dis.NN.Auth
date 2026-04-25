import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../firestore.js";

export const unlockchannelCommand = {
  data: new SlashCommandBuilder()
    .setName("unlockchannel")
    .setDescription("🔓 チャンネルのロックを解除します（管理者専用）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("ロック解除するチャンネル").setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: true,
      });

      await db.collection("guilds")
        .doc(interaction.guild.id)
        .collection("channelLogs")
        .add({
          action: "unlock",
          channelId: channel.id,
          userId: interaction.user.id,
          timestamp: new Date().toISOString(),
        });

      await interaction.reply(`🔓 チャンネル **#${channel.name}** のロックを解除しました。`);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "⚠️ ロック解除に失敗しました。" });
    }
  },
};
