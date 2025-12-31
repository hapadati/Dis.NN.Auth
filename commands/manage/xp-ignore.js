import { SlashCommandBuilder } from "discord.js";
import { db } from "../../firestore.js";

export const xpignoreCommand = {
  data: new SlashCommandBuilder()
    .setName("xpignore")
    .setDescription("⚠️ XPを加算しないチャンネルやカテゴリーを設定します")
    .addStringOption(opt => opt
      .setName("type")
      .setDescription("channel or category")
      .setRequired(true)
      .addChoices(
        { name: "channel", value: "channel" },
        { name: "category", value: "category" }
      ))
    .addChannelOption(opt => opt
      .setName("target")
      .setDescription("対象のチャンネルまたはカテゴリー")
      .setRequired(true))
    .addStringOption(opt => opt
      .setName("action")
      .setDescription("add: 追加, remove: 削除")
      .setRequired(true)
      .addChoices(
        { name: "add", value: "add" },
        { name: "remove", value: "remove" }
      )),
  execute: async function(interaction) {
    const { guild } = interaction;
    const type = interaction.options.getString("type");
    const target = interaction.options.getChannel("target");
    const action = interaction.options.getString("action");

    const ref = db.collection("guilds").doc(guild.id).collection("settings").doc("xp");
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : { ignoreChannels: [], ignoreCategories: [] };

    const listKey = type === "channel" ? "ignoreChannels" : "ignoreCategories";

    if (action === "add") {
      if (!data[listKey].includes(target.id)) data[listKey].push(target.id);
      await ref.set(data, { merge: true });
      await interaction.reply(`✅ ${type} **${target.name}** をXP無効リストに追加しました`);
    } else if (action === "remove") {
      data[listKey] = data[listKey].filter(id => id !== target.id);
      await ref.set(data, { merge: true });
      await interaction.reply(`✅ ${type} **${target.name}** をXP無効リストから削除しました`);
    }
  }
};
