import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage } from "canvas";
import { getNextLevelXP } from "../utils/level-curve.js";

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("📊 あなたのレベルとXPを表示します");

export async function execute(interaction) {
  const user = interaction.user;
  const xp = Math.floor(Math.random() * 1000); // デモ用
  const level = Math.floor(Math.sqrt(xp / 100));
  const nextXP = getNextLevelXP(level);
  const progress = xp / nextXP;

  const canvas = createCanvas(800, 300);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#202225";
  ctx.fillRect(0, 0, 800, 300);

  const avatar = await loadImage(user.displayAvatarURL({ extension: "png", size: 128 }));
  ctx.drawImage(avatar, 30, 80, 128, 128);

  ctx.fillStyle = "#fff";
  ctx.font = "28px Sans";
  ctx.fillText(`${user.username}`, 180, 130);
  ctx.fillText(`Level: ${level}`, 180, 170);
  ctx.fillText(`XP: ${xp}/${nextXP}`, 180, 210);

  ctx.fillStyle = "#444";
  ctx.fillRect(180, 230, 500, 25);
  ctx.fillStyle = "#00ff99";
  ctx.fillRect(180, 230, 500 * progress, 25);

  const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "rank.png" });
  await interaction.reply({ files: [attachment] });
}
