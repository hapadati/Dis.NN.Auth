import pkg from 'discord.js';  // discord.jsをdefaultインポート
const { MessageActionRow, MessageButton, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = pkg;  // 必要なコンポーネントを取り出す

// rolebuttonコマンド
export const roleCommand = {
  data: new SlashCommandBuilder()
    .setName('rolebutton')
    .setDescription('指定したロールを付与/削除するボタンを送信')
    .addRoleOption(option => 
      option.setName('role')
        .setDescription('付与/削除するロール')
        .setRequired(true))  // ロール指定を必須に変更
    .addStringOption(option =>
      option.setName('message')
        .setDescription('このコマンドに関する説明メッセージ')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('color')
        .setDescription('RGBカラーコード（例: 16711680）')
        .setRequired(true)),

  async execute(interaction) {
    // コマンド実行者が管理者権限を持っているか確認
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: 'このコマンドを実行するには管理権限が必要です。' });
    }

    const role = interaction.options.getRole('role');
    const message = interaction.options.getString('message');
    const color = interaction.options.getInteger('color');
    
    // 埋め込みメッセージ作成
    const embed = new EmbedBuilder()
      .setTitle(role.name)
      .setDescription(`ユーザーのメッセージ: ${message}`)
      .setColor(color)
      .setTimestamp();

    // ユニークなボタンIDを作成
    const buttonId = `rolebutton_${role.id}_${Date.now()}`;

    // ボタン作成
    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId(buttonId + '_add_role')  // ユニークなID
          .setLabel(`ロールを付与`)
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId(buttonId + '_remove_role')  // ユニークなID
          .setLabel(`ロールを削除`)
          .setStyle('DANGER')
      );

    // メッセージを送信
    const sentMessage = await interaction.reply({
      content: '以下のボタンからロールを付与または削除できます。',
      embeds: [embed],
      components: [row],
      fetchReply: true,  // 送信したメッセージを取得
    });

    // メッセージIDを保存（後で削除するため）
    sentMessage.messageId = buttonId;

    // ボタンのインタラクションを待つ
    const filter = (i) => i.user.roles.cache.has(role.id);

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    collector.on('collect', async (i) => {
      const userId = i.user.id;
      if (i.customId === buttonId + '_add_role') {
        // ロールを付与
        await i.member.roles.add(role);
        await i.reply({ content: `${role.name} ロールがあなたに付与されました！` });
      } else if (i.customId === buttonId + '_remove_role') {
        // ロールを削除
        await i.member.roles.remove(role);
        await i.reply({ content: `${role.name} ロールがあなたから削除されました！` });
      }

      // ボタンを無効化して再び操作できないようにする
      await i.update({ components: [] });
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({ content: 'ボタンの操作時間が終了しました。', components: [] });
      }
    });
  },
};

// /removebutton コマンドの実装
export const removebutton = {
  data: new SlashCommandBuilder()
    .setName('removebutton')
    .setDescription('指定したボタンIDのメッセージを削除')
    .addStringOption(option =>
      option.setName('button_id')
        .setDescription('削除するボタンID')
        .setRequired(true)),

  async execute(interaction) {
    // コマンド実行者が管理者権限を持っているか確認
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'このコマンドを実行するにはメッセージ管理権限が必要です。' });
    }

    const buttonId = interaction.options.getString('button_id');

    try {
      // 対象のメッセージを取得
      const message = await interaction.channel.messages.fetch(buttonId);

      if (message) {
        // メッセージの埋め込みを解析して、役職名と送信日を表示
        const embed = message.embeds[0];
        const roleName = embed.title;
        const timestamp = embed.timestamp;

        // 送信日をフォーマット
        const sendDate = new Date(timestamp).toLocaleString();

        // 結果をユーザーに通知
        await interaction.reply({
          content: `**ボタンID:** ${buttonId}\n` +
                   `**関連ロール:** ${roleName}\n` +
                   `**送信日:** ${sendDate}\n` +
                   'このメッセージを削除しますか？'
        });

        // メッセージ削除
        await message.delete();
      } else {
        return interaction.reply({ content: '指定されたボタンIDのメッセージが見つかりませんでした。' });
      }
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: '指定されたボタンIDのメッセージを削除できませんでした。' });
    }
  },
};
