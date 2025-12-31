// main.mjs
import { Client, GatewayIntentBits, REST, Routes, Partials } from 'discord.js';
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
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
import { execute as itemExecute, handleComponent } from "./commands/points/item-list.js";
import authRouter from './auth/auth-server.js';
import { authbuttonCommand } from './commands/auth/authbutton.js';
import { rolebuttonCommand } from './commands/manage/rolebutton.js';
import { removebuttonCommand } from './commands/manage/removebutton.js';
import { createchannelCommand } from './commands/manage/createchannel.js';
import { deletechannelCommand } from './commands/manage/deletechannel.js';
import { renamechannelCommand } from './commands/manage/renamechannel.js';
import { lockchannelCommand } from './commands/manage/lockchannel.js';
import { unlockchannelCommand } from './commands/manage/unlockchannel.js';
import { pinchannelCommand } from './commands/manage/pinchannel.js';
import { unpinchannelCommand } from './commands/manage/unpinchannel.js';
import { categorychannelCommand } from './commands/manage/categorychannel.js';
import { uncategorizechannelCommand } from './commands/manage/uncategorizechannel.js';
import { handleXpMessage } from './events/message-xp.js';

// ==========================
// 📂 rank コマンドの自動読み込み
// ==========================
const rankCommands = [];
const rankPath = path.join(__dirname, 'commands', 'rank');

if (fs.existsSync(rankPath)) {
  const rankFiles = fs.readdirSync(rankPath).filter(f => f.endsWith('.js'));
  for (const file of rankFiles) {
    const filePath = path.join(rankPath, file);
    try {
      const imported = await import(filePath);
      const moduleCandidate = imported.default ?? imported;
      const hasData = moduleCandidate?.data && typeof moduleCandidate.execute === "function";
      if (hasData) {
        rankCommands.push(moduleCandidate);
        console.log(`✅ 読み込み成功: rank/${file}`);
      } else {
        console.warn(`⚠️ 読み込み失敗 (not a command module): rank/${file}`);
      }
    } catch (err) {
      console.error(`❌ rank/${file} 読み込みエラー:`, err);
    }
  }
} else {
  console.log("[rank] rankPath not found:", rankPath);
}
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
// 📂 スラッシュコマンド登録
// ==========================
const allCommandModules = [
  pingCommand,
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
  authbuttonCommand,
  rolebuttonCommand,
  removebuttonCommand,
  createchannelCommand,
  deletechannelCommand,
  renamechannelCommand,
  lockchannelCommand,
  unlockchannelCommand,
  ...pointsCommands,
  ...rankCommands, // ← XP/レベル関連コマンド群を追加
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
  if (interaction.replied || interaction.deferred) return;
  try {
    if (interaction.user?.bot) return;

    // ==========================
    // 🔘 コンポーネント（ボタン / セレクト / モーダル）
    // ==========================
    if (
      interaction.isButton() ||
      interaction.isStringSelectMenu() ||
      interaction.isModalSubmit()
    ) {
      console.log(
        "[interactionCreate] component:",
        interaction.customId,
        interaction.isButton() ? "button" :
        interaction.isStringSelectMenu() ? "select" :
        interaction.isModalSubmit() ? "modal" : "unknown"
      );

      await handleComponent(interaction);
      return;
    }

    // ==========================
    // 💬 スラッシュコマンド
    // ==========================
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      console.log(`[interactionCreate] slash command: ${commandName}`);

      // 動的コマンド（rank / points）
      const dynamicCommands = [...pointsCommands, ...rankCommands];
      const found = dynamicCommands.find(
        cmd => cmd.data?.name === commandName
      );

      if (found) {
        await found.execute(interaction);
        return;
      }

      // 固定コマンド（保険）
      switch (commandName) {
        case 'ping': return await pingCommand.execute(interaction);
        case 'おみくじ': return await omikujiCommand.execute(interaction);
        case 'mention': return await mentionCommand.execute(interaction);
        case 'recruitment': return await recruitmentCommand.execute(interaction);
        case 'alldelete': return await alldeleteCommand.execute(interaction);
        case 'ban': return await banCommand.execute(interaction);
        case 'kick': return await kickCommand.execute(interaction);
        case 'role': return await roleCommand.execute(interaction);
        case 'softban': return await softbanCommand.execute(interaction);
        case 'timeout': return await timeoutCommand.execute(interaction);
        case 'geoquiz': return await geoquizCommand.execute(interaction);
        case 'authbutton': return await authbuttonCommand.execute(interaction);
        case 'rolebutton': return await rolebuttonCommand.execute(interaction);
        case 'removebutton': return await removebuttonCommand.execute(interaction);
        case 'createchannel': return await createchannelCommand.execute(interaction);
        case 'deletechannel': return await deletechannelCommand.execute(interaction);
        case 'renamechannel': return await renamechannelCommand.execute(interaction);
        case 'lockchannel': return await lockchannelCommand.execute(interaction);
        case 'unlockchannel': return await unlockchannelCommand.execute(interaction);
        case 'pinchannel': return await pinchannelCommand.execute(interaction);
        case 'unpinchannel': return await unpinchannelCommand.execute(interaction);
        case 'categorychannel': return await categorychannelCommand.execute(interaction);
        case 'uncategorizechannel': return await uncategorizechannelCommand.execute(interaction);
      }

      console.warn("⚠️ 未定義のスラッシュコマンド:", commandName);
    }
    } catch (err) {
    console.error("❌ interactionCreate error:", err);
  }
});

// ==========================
// 📂 メッセージイベント
// ==========================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
    // XP加算（ここだけ）
  try {
    await handleXpMessage(message);
  } catch (err) {
    console.error("❌ XP処理エラー:", err);
  }

  // 「ping」に反応
  if (message.content.toLowerCase() === 'ping') {
    await message.reply('🏓 Pong!');
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
client.on('debug', d => console.log('[DEBUG]', d));
client.on('warn', w => console.warn('[WARN]', w));
client.on('error', e => console.error('[ERROR]', e));
client.on('shardError', e => console.error('[SHARD ERROR]', e));

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
console.log("TOKEN CHECK:", process.env.DISCORD_TOKEN?.slice(0, 10));

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
app.use("/auth", authRouter);
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

client.on("error", console.error);
client.on("shardError", console.error);
client.on("shardDisconnect", (event) => {
  console.warn("Shard disconnected:", event);
});
