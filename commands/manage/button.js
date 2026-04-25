import { SlashCommandBuilder } from '@discordjs/builders';
import pkg from 'discord.js';
const { MessageActionRow, MessageButton, MessageEmbed } = pkg;
const recruitmentMap = new Map(); // 募集ごとの状態を格納

export const recruitmentCommand = {
  data: new SlashCommandBuilder()
    .setName('recruitment')
    .setDescription('指定したロールを対象に募集を行う')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('応募を対象とするロール')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('enable_timer')
        .setDescription('終了時間を使うかどうか')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('winners')
        .setDescription('抽選する人数')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('募集の終了時間（例: 1s, 30m, 2h, 3d, 1w, 2y）') // 任意に変更
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('custom_id')
        .setDescription('この募集の一意のID（後から操作するために使用）')
        .setRequired(false)
    )

    .addStringOption(option =>
      option.setName('title')
        .setDescription('募集のタイトル（指定しなければユーザー名を使います）')
    ),

  async execute(interaction) {
const role = interaction.options.getRole('role');
const enableTimer = interaction.options.getBoolean('enable_timer');
const durationStr = interaction.options.getString('duration');
const winnersCount = interaction.options.getInteger('winners');
const title = interaction.options.getString('title') || interaction.user.username;
const customId = interaction.options.getString('custom_id') || `${interaction.user.id}-${Date.now()}`;

    let duration = null;

    if (enableTimer) {
      if (!durationStr) {
        return interaction.reply({ content: '終了時間を使用する場合は duration を指定してください。' });
      }
      duration = parseDuration(durationStr);
      if (duration === null) {
        return interaction.reply({ content: '終了時間の形式が正しくありません。例: 1s, 30m, 2h, 3d, 1w, 2y' });
      }
    }

    // 応募者リスト
    let applicants = [];

    // 募集開始の埋め込みメッセージ
    const embed = new MessageEmbed()
      .setTitle(title)
      .setDescription(`応募するには以下のボタンをクリックしてください。`)
      .setColor('#00FF00')
      .addField('応募対象', role.toString(), true)
      .addField('作成者', interaction.user.username, true)
      .setTimestamp();

    if (enableTimer) {
      embed.addField('募集期間', `終了時間: ${new Date(Date.now() + duration * 1000).toLocaleString()}`, true);
    } else {
      embed.addField('募集期間', '無制限（手動で終了）', true);
    }

    // 応募ボタン
    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId('apply_button')
          .setLabel('応募する')
          .setStyle('PRIMARY')
      );

    // 募集メッセージ送信
    const recruitmentMessage = await interaction.reply({
      content: '募集が開始されました！',
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    // 応募者・設定を Map に保存（今後 `/recruitment_end` などと連携可能）
recruitmentMap.set(customId, {
  applicants,
  winnersCount,
  role,
  recruitmentMessage,
  interaction,
});


    // 応募ボタンのフィルター
    const filter = i => i.customId === 'apply_button' && i.member.roles.cache.has(role.id);
    const collectorOptions = { filter };

    if (enableTimer) {
      collectorOptions.time = duration * 1000;
    }

    const collector = interaction.channel.createMessageComponentCollector(collectorOptions);

    collector.on('collect', async (i) => {
      const current = recruitmentMap.get(customId);
      if (!current.applicants.includes(i.user.username)) {
        current.applicants.push(i.user.username);
        await i.reply({ content: '応募が完了しました！' });
      } else {
        await i.reply({ content: 'すでに応募しています。' });
      }
    });

    collector.on('end', async () => {
      if (enableTimer) {
        const current = recruitmentMap.get(customId);
        await finalizeRecruitment(customId);
      }
    });

    if (enableTimer) {
      setTimeout(async () => {
        await finalizeRecruitment(customId);
      }, duration * 1000);
    }
  },
};

// 募集終了・抽選処理（手動/自動 共通）
async function finalizeRecruitment(customId) {
  const data = recruitmentMap.get(customId);
  if (!data) return;

  const { applicants, winnersCount, recruitmentMessage, interaction } = data;

  if (applicants.length === 0) {
    await interaction.channel.send('応募者がいませんでした。');
    recruitmentMap.delete(customId);
    return;
  }

  const winners = getRandomWinners(applicants, winnersCount);
  if (winners.length === 0) {
    await interaction.channel.send('抽選対象者が足りません。');
    recruitmentMap.delete(customId);
    return;
  }

  const resultEmbed = new MessageEmbed()
    .setTitle('抽選結果')
    .setDescription(`指定された人数（${winnersCount}人）の抽選が完了しました！`)
    .setColor('#FF0000')
    .addField('抽選結果', winners.join('\n'))
    .setTimestamp();

  await interaction.channel.send({ embeds: [resultEmbed] });

  // 募集メッセージ削除とデータクリア
  await recruitmentMessage.delete();
  recruitmentMap.delete(customId);
}

// 時間文字列（s, m, h, d, w, y）を秒数に変換する関数
function parseDuration(durationStr) {
  const regex = /^(\d+)([smhdwy])$/;
  const match = durationStr.match(regex);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];

  const units = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    y: 31536000,
  };

  return value * units[unit];
}

// 重複しないようにランダムに抽選を行う関数
function getRandomWinners(applicants, winnersCount) {
  const winners = [];
  const copyOfApplicants = [...applicants];

  for (let i = 0; i < winnersCount; i++) {
    if (copyOfApplicants.length === 0) break;
    const randomIndex = Math.floor(Math.random() * copyOfApplicants.length);
    winners.push(copyOfApplicants.splice(randomIndex, 1)[0]);
  }

  return winners;
}
