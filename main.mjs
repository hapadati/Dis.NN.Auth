// main.mjs
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { logToSheets } from './logger.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM 用 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 読み込み
dotenv.config();

// Discord クライアント
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

// ==========================
// 📂 コマンド読み込み（静的）
// ==========================
import { omikujiCommand } from './commands/utils/omikuji.js';
import { pingCommand } from './commands/utils/ping.js';
import { handleMessageRoll } from './commands/utils/dirdice.js';
import { mentionCommand } from './commands/utils/mention.js';
import { recruitmentCommand } from './commands/manage/button.js';
import { alldeleteCommand } from './commands/manage/alldelete.js';
import { banCommand } from './commands/manage/ban.js';
import { kickCommand } from './commands/manage/kick.js';
import { roleCommand } from './commands/manage/role.js';
import { softbanCommand } from './commands/manage/softban.js';
import { timeoutCommand } from './commands/manage/timeout.js';
import { geoquizCommand } from './commands/utils/geoquiz.js';
import { execute as itemExecute, handleComponent } from "./commands/points/item-list.js"; // コンポーネント処理用に import
// main.mjs の Express 部分の直前に追加
import authRouter from './auth/auth-server.js';
app.use("/auth", authRouter);

// 基本コマンド（**コマンドモジュールのみ**を並べる）
const rawCommands = [
  omikujiCommand,
  mentionCommand,
  recruitmentCommand,
  alldeleteCommand,
  banCommand,
  kickCommand,
  roleCommand,
  softbanCommand,
  timeoutCommand,
  geoquizCommand,
];

// 📂 points コマンドの自動読み込み（安全に）
const pointsCommands = [];
const pointsPath = path.join(__dirname, 'commands', 'points');

if (fs.existsSync(pointsPath)) {
  const pointFiles = fs.readdirSync(pointsPath).filter(file => file.endsWith('.js'));
  for (const file of pointFiles) {
    const filePath = path.join(pointsPath, file);
    try {
      const imported = await import(filePath); // モジュール namespace
      // module が default export を持つケースと named export のケースに対応
      const moduleCandidate = imported.default ?? imported;
      const hasData = moduleCandidate && moduleCandidate.data && typeof moduleCandidate.execute === 'function';
      if (hasData) {
        pointsCommands.push(moduleCandidate);
        console.log(`✅ 読み込み成功: points/${file}`);
      } else {
        console.warn(`⚠️ 読み込み失敗 (not a command module): points/${file}`);
      }
    } catch (err) {
      console.error(`❌ points/${file} 読み込みエラー:`, err);
    }
  }
} else {
  console.log("[points] pointsPath not found:", pointsPath);
}

// ==========================
// 📂 スラッシュコマンド登録（安全化）
// ==========================
const allCommandModules = [
  pingCommand,
  ...rawCommands,
  ...pointsCommands,
];

// フィルタして data.toJSON が使えるモジュールだけ残す
const validCommandModules = allCommandModules.filter(mod => {
  const ok = !!(mod && mod.data && typeof mod.data.toJSON === 'function');
  if (!ok) {
    console.warn("[command-register] skipping invalid module:", mod && mod.name ? mod.name : mod);
  }
  return ok;
});

// 作成する JSON コマンド群（重複名は後から来たもので上書き）
const commandsMap = new Map();
for (const mod of validCommandModules) {
  try {
    const json = mod.data.toJSON();
    commandsMap.set(json.name, json);
  } catch (err) {
    console.warn("[command-register] toJSON failed for module:", mod, err);
  }
}
const commands = Array.from(commandsMap.values());

console.log(`[command-register] Registering ${commands.length} commands`);

// REST client
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.CLIENT_ID) {
      console.warn("⚠️ CLIENT_ID is not set. Skipping global command registration.");
      return;
    }
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('❌ コマンド登録エラー:', error);
  }
})();

// ==========================
// 📂 Interaction 処理
// ==========================
client.on('interactionCreate', async (interaction) => {
  try {
    // ログを出す（簡易）
    console.log("[interactionCreate] incoming:", interaction.id, interaction.type);

    // スラッシュコマンド（Chat Input）
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      console.log("[interactionCreate] chat command:", commandName, "by", interaction.user?.tag);

      // 固定コマンド処理（必要に応じて拡張）
      switch (commandName) {
        case 'ping':
          await pingCommand.execute(interaction);
          break;
        case 'おみくじ':
          await omikujiCommand.execute(interaction);
          break;
        case 'mention':
          await mentionCommand.execute(interaction);
          break;
        case 'recruitment':
          await recruitmentCommand.execute(interaction);
          break;
        case 'alldelete':
          await alldeleteCommand.execute(interaction);
          break;
        case 'ban':
          await banCommand.execute(interaction);
          break;
        case 'kick':
          await kickCommand.execute(interaction);
          break;
        case 'role':
          await roleCommand.execute(interaction);
          break;
        case 'softban':
          await softbanCommand.execute(interaction);
          break;
        case 'timeout':
          await timeoutCommand.execute(interaction);
          break;
        case 'geoquiz':
          await geoquizCommand.execute(interaction);
          break;
      }

      // 動的に読み込んだ points コマンド群
      const found = pointsCommands.find(cmd => cmd.data && cmd.data.name === commandName);
      if (found) {
        console.log("[interactionCreate] executing points command:", commandName);
        await found.execute(interaction);
      }

      // ログ送信
      await logToSheets({
        serverId: interaction.guildId,
        userId: interaction.user.id,
        channelId: interaction.channelId,
        level: "INFO",
        timestamp: interaction.createdAt.toISOString(),
        cmd: interaction.commandName,
        message: "Slash command executed",
      });

      return; // チャットコマンド処理はここで終える
    }

    // コンポーネント（ボタン / セレクト / モーダル）
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      console.log("[interactionCreate] Component interaction detected:", interaction.customId, "type:",
        interaction.isButton() ? "button" :
        interaction.isStringSelectMenu() ? "select" :
        interaction.isModalSubmit() ? "modal" : "unknown");
      // handleComponent は commands/points/item-list.js から import している関数
      await handleComponent(interaction);
      return;
    }
  } catch (err) {
    console.error("❌ interactionCreate error:", err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "⚠️ エラーが発生しました。", ephemeral: true });
      }
    } catch (replyErr) {
      console.error("❌ Failed to reply to interaction after error:", replyErr);
    }
  }
});

// ==========================
// 📂 メッセージイベント
// ==========================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 「ping」に反応
  if (message.content.toLowerCase() === 'ping') {
    await message.reply('🏓 Pong!');
  }

  // ( ´◔‸◔`) 顔文字反応
  const faceRegexTuna = /\(\s?´◔‸◔`\s?\)/;
  if (faceRegexTuna.test(message.content)) {
    const replies = [
      'つなしないよ、HDBotだけ見て！',
      '( ´◔‸◔`)👐まのﾎﾞﾝ',
      '( ´◔‸◔`)👐🌻',
    ];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    await message.reply(randomReply);
  }

  // ダイスコマンド
  const dicePattern = /(dd\d+|(\d+)d(\d+))/i;
  if (dicePattern.test(message.content)) {
    await handleMessageRoll(message);
  }

  // ログ送信
  await logToSheets({
    serverId: message.guildId,
    userId: message.author.id,
    channelId: message.channelId,
    level: "INFO",
    timestamp: message.createdAt.toISOString(),
    cmd: "message",
    message: message.content,
  });
});

// ==========================
// 📂 起動処理
// ==========================
client.once('ready', () => {
  console.log(`✅ Discord にログイン成功: ${client.user.tag}`);
  logToSheets({
    serverId: "system",
    userId: "system",
    channelId: "system",
    level: "INFO",
    timestamp: new Date().toISOString(),
    cmd: "startup",
    message: `${client.user.tag} が起動しました`,
  });
});

// Discord にログイン
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN が設定されていません');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);

// ==========================
// 📂 Express Web サーバー
// ==========================
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'Bot is running! 🤖',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`🌐 Web サーバー起動: http://localhost:${port}`);
});
