import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const pinchannelCommand = {
  data: new SlashCommandBuilder()
    .setName("pinchannel")
    .setDescription("📌 指定したメッセージをピン留めします")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt.setName("messageid").setDescription("ピン留めするメッセージのID").setRequired(true)
    ),

  async execute(interaction) {
    const messageId = interaction.options.getString("messageid");
    const channel = interaction.channel;

    try {
      const message = await channel.messages.fetch(messageId);
      await message.pin();
      await interaction.reply({ content: `✅ メッセージをピン留めしました。` });
    } catch (err) {
      console.error("❌ pinchannel error:", err);
      await interaction.reply({ content: "⚠️ ピン留めに失敗しました。メッセージIDを確認してください。" });
    }
  },
};
