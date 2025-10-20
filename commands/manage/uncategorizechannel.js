import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const uncategorizechannelCommand = {
  data: new SlashCommandBuilder()
    .setName("uncategorizechannel")
    .setDescription("🗂 チャンネルをカテゴリーから外します")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("外すチャンネル").setRequired(true)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel("channel");

    try {
      await targetChannel.setParent(null);
      await interaction.reply({ content: `✅ ${targetChannel} をカテゴリーから外しました。`, ephemeral: true });
    } catch (err) {
      console.error("❌ uncategorizechannel error:", err);
      await interaction.reply({ content: "⚠️ カテゴリー解除に失敗しました。", ephemeral: true });
    }
  },
};
