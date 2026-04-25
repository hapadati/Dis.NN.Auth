// 📂 commands/manage/rolebutton.js
import {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    PermissionFlagsBits,
  } from "discord.js";
  import { db } from "../../firestore.js";
  
  /**
   * /rolebutton
   * 指定ロールに対応するボタンを設置して、ユーザーがクリックでロール付与/削除
   */
  export const rolebuttonCommand = {
    data: new SlashCommandBuilder()
      .setName("rolebutton")
      .setDescription("🎛️ ロールボタンを作成します（管理者専用）")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("ボタンで付与・削除したいロールを指定")
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName("label")
          .setDescription("ボタンに表示するテキスト")
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName("color")
          .setDescription("ボタンカラー (blue, green, red, gray)")
          .setRequired(false)
      ),
  
    /**
     * コマンド実行時
     */
    async execute(interaction) {
      const role = interaction.options.getRole("role");
      const label = interaction.options.getString("label") || role.name;
      const color = interaction.options.getString("color")?.toLowerCase() || "blue";
  
      const colorMap = {
        blue: ButtonStyle.Primary,
        green: ButtonStyle.Success,
        red: ButtonStyle.Danger,
        gray: ButtonStyle.Secondary,
      };
  
      const button = new ButtonBuilder()
        .setCustomId(`rolebtn_${role.id}`)
        .setLabel(label)
        .setStyle(colorMap[color] || ButtonStyle.Primary);
  
      const row = new ActionRowBuilder().addComponents(button);
  
      // メッセージ送信
      const msg = await interaction.channel.send({
        content: `🎯 このボタンで **${role.name}** を付与・削除できます！`,
        components: [row],
      });
  
      // Firestore に登録
      await db
        .collection("guilds")
        .doc(interaction.guild.id)
        .collection("roleButtons")
        .doc(msg.id)
        .set({
          roleId: role.id,
          label,
          color,
          messageId: msg.id,
          channelId: interaction.channel.id,
          guildId: interaction.guild.id,
          createdAt: new Date().toISOString(),
        });
  
      await interaction.reply({
        content: `✅ ロールボタンを作成しました！ (${label} → ${role.name})`,
      });
    },
  };
  
  /**
   * 🔘 ボタン押下イベント処理
   * → main.mjs 側の `interactionCreate` で呼ばれる想定
   */
  export async function handleRoleButton(interaction) {
    if (!interaction.customId.startsWith("rolebtn_")) return;
  
    const roleId = interaction.customId.split("_")[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const role = guild.roles.cache.get(roleId);
  
    if (!role) {
      await interaction.reply({
        content: "⚠️ 対応するロールが見つかりません。",
      });
      return;
    }
  
    const hasRole = member.roles.cache.has(role.id);
  
    try {
      if (hasRole) {
        await member.roles.remove(role);
        await interaction.reply({
          content: `➖ ロール **${role.name}** を削除しました。`,
        });
      } else {
        await member.roles.add(role);
        await interaction.reply({
          content: `➕ ロール **${role.name}** を付与しました！`,
        });
      }
  
      // Firestore に操作履歴を保存
      await db.collection("guilds")
        .doc(guild.id)
        .collection("roleButtonLogs")
        .add({
          userId: member.id,
          roleId: role.id,
          action: hasRole ? "removed" : "added",
          timestamp: new Date().toISOString(),
        });
  
    } catch (err) {
      console.error("❌ RoleButton error:", err);
      await interaction.reply({
        content: "⚠️ ロールの付与・削除に失敗しました。",
      });
    }
  }
  