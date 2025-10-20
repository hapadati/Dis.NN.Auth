import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { db } from "../../firestore.js";

export const createchannelCommand = {
  data: new SlashCommandBuilder()
    .setName("createchannel")
    .setDescription("📁 新しいチャンネルを作成します（管理者専用）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt =>
      opt.setName("name").setDescription("チャンネル名").setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName("type")
        .setDescription("チャンネルタイプ")
        .addChoices(
          { name: "テキスト", value: "GUILD_TEXT" },
          { name: "ボイス", value: "GUILD_VOICE" }
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    const name = interaction.options.getString("name");
    const type = interaction.options.getString("type");
    const guild = interaction.guild;

    try {
      const channel = await guild.channels.create({
        name,
        type: type === "GUILD_TEXT" ? ChannelType.GuildText : ChannelType.GuildVoice,
        reason: `${interaction.user.tag} により作成`,
      });

      await db.collection("guilds")
        .doc(guild.id)
        .collection("channelLogs")
        .add({
          action: "create",
          channelId: channel.id,
          userId: interaction.user.id,
          name,
          timestamp: new Date().toISOString(),
        });

      await interaction.reply(`✅ チャンネル **#${name}** を作成しました！`);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "⚠️ チャンネル作成に失敗しました。", ephemeral: true });
    }
  },
};
