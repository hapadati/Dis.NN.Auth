import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const categorychannelCommand = {
  data: new SlashCommandBuilder()
    .setName("categorychannel")
    .setDescription("📂 指定チャンネルをカテゴリーに移動します")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("移動するチャンネル").setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName("category").setDescription("移動先のカテゴリー").setRequired(true)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel("channel");
    const category = interaction.options.getChannel("category");

    if (category.type !== 4) { // 4 = Category
      await interaction.reply({ content: "⚠️ 移動先はカテゴリーである必要があります。" });
      return;
    }

    try {
      await targetChannel.setParent(category.id);
      await interaction.reply({ content: `✅ ${targetChannel} を ${category.name} に移動しました。` });
    } catch (err) {
      console.error("❌ categorychannel error:", err);
      await interaction.reply({ content: "⚠️ カテゴリー移動に失敗しました。" });
    }
  },
};
