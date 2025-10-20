import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";
import { db } from "../../firestore.js";

export const authbuttonCommand = {
  data: new SlashCommandBuilder()
    .setName("authbutton")
    .setDescription("🔐 認証ボタンを送信します（管理者専用）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(opt =>
      opt
        .setName("rolename")
        .setDescription("認証時に付与するロール名")
        .setRequired(true)
    ),

  async execute(interaction) {
    const roleName = interaction.options.getString("rolename");
    const guild = interaction.guild;

    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      role = await guild.roles.create({
        name: roleName,
        color: "Green",
        reason: "認証ロール自動作成",
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`auth_button_${role.id}`)
        .setLabel("✅ 認証する")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      content: `以下のボタンを押すとロール **${role.name}** が付与されます！`,
      components: [row],
    });

    console.log(`✅ 認証ボタン送信: ${role.name}`);
  },
};
