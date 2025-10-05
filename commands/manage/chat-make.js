import { Client, GatewayIntentBits } from "discord.js";
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

// ------------------------
// ヘルパー関数
// ------------------------
function chunkArray(array, size) {
  const results = [];
  for (let i = 0; i < array.length; i += size) results.push(array.slice(i, i + size));
  return results;
}

// ------------------------
// Discordクライアント
// ------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// ------------------------
// コマンド登録用
// ------------------------
const commands = [
  new SlashCommandBuilder()
    .setName("createchannel")
    .setDescription("📂 チャンネル作成・管理パネル（完全管理版）")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON()
];

// ------------------------
// インタラクション処理
// ------------------------
client.on("interactionCreate", async (interaction) => {
  const guild = interaction.guild;
  if (!guild) return;

  // ------------------------
  // 1. スラッシュコマンド
  // ------------------------
  if (interaction.isChatInputCommand() && interaction.commandName === "createchannel") {
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("createChannelFullUI")
        .setLabel("📂 チャンネル作成（完全管理）")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      content: "📂 チャンネル作成・管理パネル",
      components: [buttonRow],
      ephemeral: false,
    });
  }

  // ------------------------
  // 2. チャンネル作成ボタン押下 → モーダル
  // ------------------------
  if (interaction.isButton() && interaction.customId === "createChannelFullUI") {
    const modal = new ModalBuilder()
      .setCustomId("channelCreateModalFull")
      .setTitle("チャンネル作成")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("channelName")
            .setLabel("チャンネル名")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("例: 新規チャンネル")
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("expiryMinutes")
            .setLabel("閲覧可能期間（分、Noneで削除しない）")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("例: 60 または None")
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }

  // ------------------------
  // 3. モーダル送信 → チャンネル作成
  // ------------------------
  if (interaction.isModalSubmit() && interaction.customId === "channelCreateModalFull") {
    const channelName = interaction.fields.getTextInputValue("channelName");
    const expiryInput = interaction.fields.getTextInputValue("expiryMinutes");

    const newChannel = await guild.channels.create({
      name: channelName,
      type: 0, // GUILD_TEXT
      permissionOverwrites: [
        { id: guild.roles.everyone.id, allow: ["ViewChannel"] },
      ],
    });

    await interaction.reply({
      content: `✅ チャンネル "${newChannel.name}" を作成しました！`,
      ephemeral: false,
    });

    // ------------------------
    // チャンネル管理ボタン
    // ------------------------
    const manageButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deleteChannel_${newChannel.id}`)
        .setLabel("🗑 チャンネル削除")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`extendExpiry_${newChannel.id}`)
        .setLabel("⏱ 期限延長")
        .setStyle(ButtonStyle.Primary)
    );

    await newChannel.send({ content: "🔧 このチャンネルを管理", components: [manageButtons] });

    // ------------------------
    // ページング付きロール選択
    // ------------------------
    const roles = guild.roles.cache.filter(r => r.id !== guild.roles.everyone.id)
      .map(r => ({ label: r.name, value: r.id }));
    const rolePages = chunkArray(roles, 25);
    const rolePage = 0;

    const roleSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`roleSelect_page_${rolePage}_${newChannel.id}`)
        .setPlaceholder(`ロール権限を付与/削除（ページ ${rolePage + 1}）`)
        .addOptions(rolePages[rolePage])
    );

    await newChannel.send({ content: "🔹 ロールの権限管理", components: [roleSelect] });

    // ------------------------
    // ページング付きユーザー選択
    // ------------------------
    const members = guild.members.cache.map(m => ({ label: m.user.username, value: m.id }));
    const memberPages = chunkArray(members, 25);
    const memberPage = 0;

    const userSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`userSelect_page_${memberPage}_${newChannel.id}`)
        .setPlaceholder(`ユーザー権限を付与/削除（ページ ${memberPage + 1}）`)
        .addOptions(memberPages[memberPage])
    );

    await newChannel.send({ content: "🔹 ユーザーの権限管理", components: [userSelect] });

    // ------------------------
    // 期限付き閲覧権限
    // ------------------------
    if (expiryInput.toLowerCase() !== "none") {
      const minutes = parseInt(expiryInput, 10);
      if (!isNaN(minutes) && minutes > 0) {
        setTimeout(async () => {
          try {
            await newChannel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false });
            await newChannel.send(`⏰ 閲覧期限が終了しました。@everyone の閲覧権限を削除しました`);
          } catch (err) { console.error(err); }
        }, minutes * 60 * 1000);
        await newChannel.send(`⏱ このチャンネルは ${minutes} 分後に閲覧期限が切れます`);
      }
    }
  }

  // ------------------------
  // 4. セレクトメニュー操作（権限付与/削除）
  // ------------------------
  if (interaction.isStringSelectMenu()) {
    const values = interaction.values;
    const channelId = interaction.customId.split("_").pop();
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    for (const id of values) {
      if (id.toLowerCase() === "none") continue;

      if (interaction.customId.startsWith("roleSelect")) {
        const role = await guild.roles.fetch(id);
        if (!role) continue;

        const perms = channel.permissionOverwrites.cache.get(role.id);
        if (perms && perms.allow.has("ViewChannel")) {
          // すでに閲覧権限ある場合は削除
          await channel.permissionOverwrites.edit(role, { ViewChannel: false });
          await channel.send(`❌ ロール ${role.name} の閲覧権限を削除しました`);
        } else {
          await channel.permissionOverwrites.edit(role, { ViewChannel: true });
          await channel.send(`✅ ロール ${role.name} に閲覧権限を付与しました`);
        }
      }

      if (interaction.customId.startsWith("userSelect")) {
        const member = await guild.members.fetch(id);
        if (!member) continue;

        const perms = channel.permissionOverwrites.cache.get(member.id);
        if (perms && perms.allow.has("ViewChannel")) {
          await channel.permissionOverwrites.edit(member, { ViewChannel: false });
          await channel.send(`❌ ユーザー ${member.user.tag} の閲覧権限を削除しました`);
        } else {
          await channel.permissionOverwrites.edit(member, { ViewChannel: true });
          await channel.send(`✅ ユーザー ${member.user.tag} に閲覧権限を付与しました`);
        }
      }
    }
  }

  // ------------------------
  // 5. チャンネル削除ボタン
  // ------------------------
  if (interaction.isButton() && interaction.customId.startsWith("deleteChannel_")) {
    const channelId = interaction.customId.split("_")[1];
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    await channel.delete();
  }

  // ------------------------
  // 6. 期限延長ボタン（仮に＋10分）
  // ------------------------
  if (interaction.isButton() && interaction.customId.startsWith("extendExpiry_")) {
    const channelId = interaction.customId.split("_")[1];
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    // 簡易例として10分延長
    setTimeout(async () => {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false });
        await channel.send(`⏰ 閲覧期限が終了しました。@everyone の閲覧権限を削除しました`);
      } catch (err) { console.error(err); }
    }, 10 * 60 * 1000);
    await channel.send(`⏱ @everyone の閲覧期限を10分延長しました`);
  }
});

// ------------------------
// BOTログイン
// ------------------------
client.login("YOUR_BOT_TOKEN"); // ← BOTトークンを入力
