import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
  } from "discord.js";
  import dotenv from "dotenv";
  
  dotenv.config();
  
  export const authButtonCommand = {
    data: new SlashCommandBuilder()
      .setName("authbutton")
      .setDescription("認証ボタン付きの埋め込みを送信します。")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addRoleOption(option =>
        option
          .setName("addrole")
          .setDescription("認証成功時に付与するロール")
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName("removerole")
          .setDescription("認証成功時に削除するロール")
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName("title")
          .setDescription("埋め込みタイトル")
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName("description")
          .setDescription("埋め込み説明文")
          .setRequired(false)
      ),
  
    async execute(interaction) {
      const title = interaction.options.getString("title") || "🔑 サーバー認証";
      const description =
        interaction.options.getString("description") ||
        "以下のボタンから認証を行ってください。";
  
      const addRole = interaction.options.getRole("addrole");
      const removeRole = interaction.options.getRole("removerole");
  
      const redirectUrl = process.env.AUTH_LOGIN_URL || "https://yourapp.onrender.com/auth/login";
  
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(
          `${description}\n\n✅ 認証に成功すると **${addRole.name}** ロールが付与されます。` +
            (removeRole ? `\n❌ **${removeRole.name}** ロールが削除されます。` : "")
        )
        .setColor(0x00bfff);
  
      // 認証ページにロール情報をクエリで送る（安全な最小限の情報）
      const loginUrl = `${redirectUrl}?add=${addRole.id}${
        removeRole ? `&remove=${removeRole.id}` : ""
      }&guild=${interaction.guild.id}`;
  
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🔑 認証する")
          .setURL(loginUrl)
          .setStyle(ButtonStyle.Link)
      );
  
      await interaction.reply({
        embeds: [embed],
        components: [row],
      });
    },
  };
  