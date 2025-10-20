import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const unpinchannelCommand = {
  data: new SlashCommandBuilder()
    .setName("unpinchannel")
    .setDescription("📍 指定したメッセージのピン留めを解除します")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt.setName("messageid").setDescription("ピン留め解除するメッセージのID").setRequired(true)
    ),

  async execute(interaction) {
    const messageId = interaction.options.getString("messageid");
    const channel = interaction.channel;

    try {
      const message = await channel.messages.fetch(messageId);
      await message.unpin();
      await interaction.reply({ content: `✅ ピン留めを解除しました。`, ephemeral: true });
    } catch (err) {
      console.error("❌ unpinchannel error:", err);
      await interaction.reply({ content: "⚠️ ピン留め解除に失敗しました。メッセージIDを確認してください。", ephemeral: true });
    }
  },
};
