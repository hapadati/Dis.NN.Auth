import { SlashCommandBuilder } from "discord.js";
import { db } from "../../firestore.js";

export const data = new SlashCommandBuilder()
  .setName("top")
  .setDescription("サーバーのXPランキングを表示");

export async function execute(interaction) {
  const guildId = interaction.guildId;

  try {
    const usersRef = db.collection("servers").doc(guildId).collection("users");
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
      return interaction.reply("📭 このサーバーにはまだデータがありません。");
    }

    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    users.sort((a, b) => b.xp - a.xp);
    const top = users.slice(0, 10);

    let text = `🏆 **${interaction.guild.name} XPランキング TOP10** 🏆\n\n`;
    for (let i = 0; i < top.length; i++) {
      text += `**${i + 1}.** <@${top[i].id}> — Lv.${top[i].level ?? 1} (${top[i].xp ?? 0} XP)\n`;
    }

    await interaction.reply({ content: text });
  } catch (err) {
    console.error("❌ Firestore 読み込みエラー:", err);
    await interaction.reply({ content: "⚠️ データ取得中にエラーが発生しました。", ephemeral: true });
  }
}
