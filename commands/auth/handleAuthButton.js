import { db } from "../../firestore.js";

/**
 * 認証ボタン押下処理
 * @param {import('discord.js').Interaction} interaction
 */
export async function handleAuthButton(interaction) {
  if (!interaction.customId.startsWith("auth_button_")) return;

  const roleId = interaction.customId.replace("auth_button_", "");
  const member = interaction.member;

  try {
    if (member.roles.cache.has(roleId)) {
      await interaction.reply({ content: "✅ すでに認証済みです！", ephemeral: true });
      return;
    }

    await member.roles.add(roleId);

    // 🔥 Firestore 永久保存
    await db.collection("guilds")
      .doc(interaction.guild.id)
      .collection("authLogs")
      .add({
        userId: member.id,
        roleId,
        action: "granted",
        timestamp: new Date().toISOString(),
      });

    await interaction.reply({ content: "🎉 認証が完了しました！", ephemeral: true });
  } catch (err) {
    console.error("❌ 認証ボタン処理エラー:", err);
    await interaction.reply({ content: "⚠️ 認証中にエラーが発生しました。", ephemeral: true });
  }
}
