import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../firestore.js";

export const renamechannelCommand = {
  data: new SlashCommandBuilder()
    .setName("renamechannel")
    .setDescription("✏️ チャンネル名を変更します（管理者専用）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("変更するチャンネル").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("newname").setDescription("新しいチャンネル名").setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");
    const newName = interaction.options.getString("newname");

    try {
      const oldName = channel.name;
      await channel.setName(newName);

      await db.collection("guilds")
        .doc(interaction.guild.id)
        .collection("channelLogs")
        .add({
          action: "rename",
          channelId: channel.id,
          userId: interaction.user.id,
          oldName,
          newName,
          timestamp: new Date().toISOString(),
        });

      await interaction.reply(`✏️ **#${oldName}** → **#${newName}** に変更しました！`);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "⚠️ 名前変更に失敗しました。", ephemeral: true });
    }
  },
};
