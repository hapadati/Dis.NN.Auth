import { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { createCanvas, loadImage } from "canvas";
import { db } from "../../firestore.js";

export const data = new SlashCommandBuilder()
  .setName("rankboard")
  .setDescription("📊 サーバー内のXPランキングを表示します")
  .addIntegerOption(option =>
    option.setName("perpage")
      .setDescription("1ページあたりの人数")
      .setMinValue(1)
      .setMaxValue(20)
      .setRequired(false)
  );

const PAGE_TIMEOUT = 5 * 60 * 1000; // 5分

async function generateCanvas(guild, users, page, perPage, currentUserId) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const pageUsers = users.slice(start, end);

  const canvasWidth = 800;
  const canvasHeight = 50 + pageUsers.length * 70;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  // 背景
  ctx.fillStyle = "#202225";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // タイトル
  ctx.fillStyle = "#fff";
  ctx.font = "32px Sans";
  ctx.fillText(`🏆 サーバーXPランキング (ページ ${page})`, 20, 40);

  let y = 90;
  for (let i = 0; i < pageUsers.length; i++) {
    const userData = pageUsers[i];
    let member;
    try {
      member = await guild.members.fetch(userData.id);
    } catch {
      member = { user: { username: "Unknown", displayAvatarURL: () => null } };
    }

    const isCurrentUser = userData.id === currentUserId;
    ctx.fillStyle = isCurrentUser ? "#00ff99" : "#ffcc00";
    ctx.font = isCurrentUser ? "28px Sans" : "24px Sans";

    // 順位
    ctx.fillText(`#${start + i + 1}`, 20, y + 30);

    // アバター
    if (member.user.displayAvatarURL) {
      try {
        const avatar = await loadImage(member.user.displayAvatarURL({ extension: "png", size: 64 }));
        ctx.drawImage(avatar, 70, y, 64, 64);
      } catch {}
    }

    ctx.fillStyle = isCurrentUser ? "#00ff99" : "#fff";
    ctx.fillText(member.user.username, 150, y + 35);
    ctx.fillText(`Level: ${userData.level} / XP: ${userData.xp}`, 400, y + 35);

    y += 70;
  }

  return new AttachmentBuilder(canvas.toBuffer(), { name: "rankboard.png" });
}

export async function execute(interaction) {
  try {
    const { guild, user } = interaction;
    const perPage = interaction.options.getInteger("perpage") ?? 10;

    const usersSnap = await db
      .collection("guilds")
      .doc(guild.id)
      .collection("users")
      .orderBy("xp", "desc")
      .get();

    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (users.length === 0) {
      await interaction.reply({ content: "⚠️ ランキングデータがありません。" });
      return;
    }

    let currentPage = 1;
    const totalPages = Math.ceil(users.length / perPage);

    const attachment = await generateCanvas(guild, users, currentPage, perPage, user.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("⬅️ 前のページ")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage <= 1),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("次のページ ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage >= totalPages)
    );

    const message = await interaction.reply({ files: [attachment], components: [row], fetchReply: true });

    const collector = message.createMessageComponentCollector({
      componentType: 2,
      time: PAGE_TIMEOUT
    });

    collector.on("collect", async i => {
      if (i.user.id !== user.id) {
        await i.reply({ content: "⚠️ このボタンはあなた専用です。" });
        return;
      }

      if (i.customId === "prev") currentPage--;
      else if (i.customId === "next") currentPage++;

      const newAttachment = await generateCanvas(guild, users, currentPage, perPage, user.id);

      const newRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("⬅️ 前のページ")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage <= 1),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("次のページ ➡️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage >= totalPages)
      );

      await i.update({ files: [newAttachment], components: [newRow] });
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("⬅️ 前のページ")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("次のページ ➡️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );
      await message.edit({ components: [disabledRow] }).catch(() => {});
    });

  } catch (err) {
    console.error("❌ rankboard interactive error:", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "⚠️ ランキング取得中にエラーが発生しました。" }).catch(() => {});
    }
  }
}
