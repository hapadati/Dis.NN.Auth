import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../firebase.js";
import { collection, getDocs } from "firebase/firestore";

export const data = new SlashCommandBuilder()
  .setName("showlevelroles")
  .setDescription("📜 サーバーのレベルアップ時ロール設定を表示します（管理者専用）")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  const guild = interaction.guild;
  const guildId = guild.id;

  await interaction.deferReply({ ephemeral: true });

  const configRef = collection(db, "guilds", guildId, "levelRoles");
  const configSnap = await getDocs(configRef);

  if (configSnap.empty) {
    await interaction.editReply("⚠️ このサーバーにはまだレベルロール設定がありません。");
    return;
  }

  const levelConfigs = configSnap.docs
    .map(doc => doc.data())
    .sort((a, b) => a.level - b.level);

  const description = levelConfigs.map(cfg => {
    const addList = cfg.add?.length ? cfg.add.join(", ") : "なし";
    const removeList = cfg.remove?.length ? cfg.remove.join(", ") : "なし";
    return `**Lv.${cfg.level}**\n➕ 付与: ${addList}\n➖ 削除: ${removeList}`;
  }).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(`⚙️ ${guild.name} のレベルロール設定`)
    .setDescription(description)
    .setColor(0x00aaff)
    .setFooter({ text: "XPシステム設定一覧" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
