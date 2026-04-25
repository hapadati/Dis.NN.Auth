import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage } from "canvas";
import { db } from "../../firestore.js";
import { getNextLevelXP } from "../utils/level-curve.js";

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("📊 あなたのレベルとXPを表示します");

export async function execute(interaction) {
  let deferred = false;

  // ✅ 安全に defer
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
      deferred = true;
    }
  } catch (e) {
    console.error("❌ deferReply failed:", e);
    if (!interaction.replied) {
      await interaction.reply({
        content: "⚠️ ランク情報の取得中にエラーが発生しました（defer失敗）",
      }).catch(() => {});
    }
    return;
  }

  try {
    const { guild, user } = interaction;

    // Firestore からユーザーデータ取得
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

    // 背景
    ctx.fillStyle = "#202225";
    ctx.fillRect(0, 0, 800, 300);

    // アバター
    try {
      const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 128 }));
      ctx.drawImage(avatar, 30, 80, 128, 128);
    } catch {
      console.warn("⚠️ アバター読み込み失敗");
    }

    // ユーザー情報
    ctx.fillStyle = "#fff";
    ctx.font = "28px Sans";
    ctx.fillText(user.username, 180, 130);
    ctx.fillText(`Level: ${level}`, 180, 170);
    ctx.fillText(`XP: ${xp} / ${nextXP}`, 180, 210);

    // XPバー
    const barX = 180;
    const barY = 230;
    const barWidth = 500;
    const barHeight = 25;

    ctx.fillStyle = "#444";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const grad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    grad.addColorStop(0, "#00ff99");
    grad.addColorStop(1, "#00ccff");
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "rank.png" });

    // ✅ defer した場合は editReply、していない場合は reply
    if (deferred || interaction.deferred) {
      await interaction.editReply({ files: [attachment] }).catch(async () => {
        if (!interaction.replied) {
          await interaction.reply({ files: [attachment] }).catch(() => {});
        }
      });
    } else {
      await interaction.reply({ files: [attachment] }).catch(() => {});
    }

  } catch (err) {
    console.error("❌ rank command error:", err);
    if (!interaction.replied) {
      await interaction.reply({
        content: "⚠️ ランク情報の取得中にエラーが発生しました。",
      }).catch(() => {});
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: "⚠️ ランク情報の取得中にエラーが発生しました。",
      }).catch(() => {});
    }
  }
}
