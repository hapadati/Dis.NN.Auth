import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage } from "canvas";
import { db } from "../../firestore.js";
import { getNextLevelXP } from "../utils/level-curve.js";

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("📊 あなたのレベルとXPを表示します");

export async function execute(interaction) {
  // ✅ 安全に defer
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
  } catch (e) {
    console.error("❌ deferReply failed:", e);
    return;
  }

  try {
    const { guild, user } = interaction;

    const ref = db
      .collection("guilds")
      .doc(guild.id)
      .collection("users")
      .doc(user.id);

    const snap = await ref.get();
    const userData = snap.exists ? snap.data() : { xp: 0, level: 1 };

    const xp = userData.xp ?? 0;
    const level = userData.level ?? 1;
    const nextXP = getNextLevelXP(level);
    const progress = Math.min(xp / nextXP, 1);

    // ===== Canvas =====
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#202225";
    ctx.fillRect(0, 0, 800, 300);

    const avatar = await loadImage(
      user.displayAvatarURL({ extension: "png", size: 128 })
    );
    ctx.drawImage(avatar, 30, 80, 128, 128);

    ctx.fillStyle = "#fff";
    ctx.font = "28px Sans";
    ctx.fillText(user.username, 180, 130);
    ctx.fillText(`Level: ${level}`, 180, 170);
    ctx.fillText(`XP: ${xp} / ${nextXP}`, 180, 210);

    ctx.fillStyle = "#444";
    ctx.fillRect(180, 230, 500, 25);
    ctx.fillStyle = "#00ff99";
    ctx.fillRect(180, 230, 500 * progress, 25);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "rank.png",
    });

    await interaction.editReply({ files: [attachment] });

  } catch (err) {
    console.error("❌ rank command error:", err);

    // ✅ 最後の保険
    if (!interaction.replied) {
      await interaction.editReply({
        content: "⚠️ ランク情報の取得中にエラーが発生しました。",
      }).catch(() => {});
    }
  }
}
