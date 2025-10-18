import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { db } from "../../firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { generateXPCard } from "../utils/xp-card.js";
import fs from "fs";
import path from "path";

export default {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("自分または指定したユーザーのXP・レベルを表示します。")
    .addUserOption(option =>
      option.setName("ユーザー").setDescription("確認したいユーザーを指定します。")
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser("ユーザー") || interaction.user;
    const guildId = interaction.guild.id;

    const userRef = doc(db, "xp", guildId, "users", user.id);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return interaction.editReply("❌ まだXPデータがありません。メッセージを送ってXPを貯めましょう！");
    }

    const userData = userSnap.data();
    const themePath = userData.themePath || "./assets/default-theme.png";

    // XPカード画像生成
    const buffer = await generateXPCard(user, userData, themePath);

    // ファイル形式をレベルで分岐
    const fileExtension = userData.level >= 20 ? "gif" : "png";
    const fileName = `rank-${user.id}.${fileExtension}`;
    const filePath = path.join("./temp", fileName);

    if (!fs.existsSync("./temp")) fs.mkdirSync("./temp");
    fs.writeFileSync(filePath, buffer);

    const attachment = new AttachmentBuilder(filePath);

    await interaction.editReply({
      content: `🎖️ **${user.username}** のXPカード`,
      files: [attachment],
    });

    fs.unlinkSync(filePath);
  },
};
