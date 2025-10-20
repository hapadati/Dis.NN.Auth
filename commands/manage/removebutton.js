// 📂 commands/manage/removebutton.js
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../firestore.js";

export const removebuttonCommand = {
  data: new SlashCommandBuilder()
    .setName("removebutton")
    .setDescription("🗑️ 設置したロールボタンを削除します（管理者専用）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(opt =>
      opt
        .setName("messageid")
        .setDescription("削除したいボタンメッセージのIDを指定")
        .setRequired(true)
    ),

  async execute(interaction) {
    const messageId = interaction.options.getString("messageid");
    const guildId = interaction.guild.id;

    try {
      // Firestoreからデータ削除
      const ref = db
        .collection("guilds")
        .doc(guildId)
        .collection("roleButtons")
        .doc(messageId);

      const snap = await ref.get();
      if (!snap.exists) {
        await interaction.reply({
          content: "⚠️ 指定したメッセージIDのロールボタン設定が見つかりません。",
          ephemeral: true,
        });
        return;
      }

      const data = snap.data();
      const channel = await interaction.guild.channels.fetch(data.channelId);
      const msg = await channel.messages.fetch(messageId);

      // メッセージ削除
      await msg.delete().catch(() => {});
      await ref.delete();

      await interaction.reply({
        content: `🗑️ ロールボタン (ID: \`${messageId}\`) を削除しました。`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("❌ removebutton error:", err);
      await interaction.reply({
        content: "⚠️ ボタン削除中にエラーが発生しました。",
        ephemeral: true,
      });
    }
  },
};
