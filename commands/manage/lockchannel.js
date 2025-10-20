import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../firestore.js";

export const lockchannelCommand = {
  data: new SlashCommandBuilder()
    .setName("lockchannel")
    .setDescription("🔒 チャンネルをロックします（管理者専用）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("ロックするチャンネル").setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
      });

      await db.collection("guilds")
        .doc(interaction.guild.id)
        .collection("channelLogs")
        .add({
          action: "lock",
          channelId: channel.id,
          userId: interaction.user.id,
          timestamp: new Date().toISOString(),
        });

      await interaction.reply(`🔒 チャンネル **#${channel.name}** をロックしました。`);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "⚠️ ロックに失敗しました。", ephemeral: true });
    }
  },
};
