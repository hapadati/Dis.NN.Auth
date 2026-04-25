// main.mjs
import { Client, GatewayIntentBits, REST, Routes, Partials, MessageFlags } from 'discord.js';
import { logToSheets } from './logger.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pkg from "pg";
const { Pool } = pkg;

// ESM 用 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 読み込み
dotenv.config();

// ==========================
// Neon PostgreSQL 接続
// ==========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ==========================
// Discord Client
// ==========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

// ==========================
// 静的コマンド読み込み (utils)
// ==========================
import { omikujiCommand }     from './commands/utils/omikuji.js';
import { pingCommand }        from './commands/utils/ping.js';
import { handleMessageRoll }  from './commands/utils/dirdice.js';
import { mentionCommand }     from './commands/utils/mention.js';
import { geoquizCommand }     from './commands/utils/geoquiz.js';

// utils (new)
import { data as avatarData, execute as avatarExecute }             from './commands/utils/avatar.js';
import { data as passwordData, execute as passwordExecute }         from './commands/utils/password.js';
import { data as shortUrlData, execute as shortUrlExecute }         from './commands/utils/shorturl.js';
import { data as qrData, execute as qrExecute }                     from './commands/utils/qr.js';
import { data as reportData, execute as reportExecute }             from './commands/utils/report.js';
import { data as remindData, execute as remindExecute }             from './commands/utils/remind.js';
import { data as pollData, execute as pollExecute }                 from './commands/utils/poll.js';
import { data as userInfoData, execute as userInfoExecute }         from './commands/utils/user-info.js';
import { data as roleInfoData, execute as roleInfoExecute }         from './commands/utils/role-info.js';
import { data as serverInviteData, execute as serverInviteExecute } from './commands/utils/server-invite.js';
import { data as weatherData, execute as weatherExecute }           from './commands/utils/weather.js';

// manage
import { recruitmentCommand }         from './commands/manage/button.js';
import { alldeleteCommand }           from './commands/manage/alldelete.js';
import { banCommand }                 from './commands/manage/ban.js';
import { kickCommand }                from './commands/manage/kick.js';
import { roleCommand }                from './commands/manage/role.js';
import { softbanCommand }             from './commands/manage/softban.js';
import { timeoutCommand }             from './commands/manage/timeout.js';
import { authbuttonCommand }          from './commands/auth/authbutton.js';
import { rolebuttonCommand }          from './commands/manage/rolebutton.js';
import { removebuttonCommand }        from './commands/manage/removebutton.js';
import { createchannelCommand }       from './commands/manage/createchannel.js';
import { deletechannelCommand }       from './commands/manage/deletechannel.js';
import { renamechannelCommand }       from './commands/manage/renamechannel.js';
import { lockchannelCommand }         from './commands/manage/lockchannel.js';
import { unlockchannelCommand }       from './commands/manage/unlockchannel.js';
import { pinchannelCommand }          from './commands/manage/pinchannel.js';
import { unpinchannelCommand }        from './commands/manage/unpinchannel.js';
import { categorychannelCommand }     from './commands/manage/categorychannel.js';
import { uncategorizechannelCommand } from './commands/manage/uncategorizechannel.js';

// events
import { handleXpMessage } from './events/message-xp.js';
import { handleMemberJoin } from './events/member-join.js';
import { execute as itemExecute, handleComponent } from './commands/points/item-list.js';
import authRouter from './auth/auth-server.js';

// ==========================
// 動的コマンド読み込み (rank / points)
// ==========================
async function loadCommandsFromDir(dirName) {
  const commands = [];
  const dirPath = path.join(__dirname, 'commands', dirName);
  if (!fs.existsSync(dirPath)) return commands;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(path.join(dirPath, file)).href);
      const c = mod.default ?? mod;
      if (c?.data && typeof c.execute === 'function') {
        commands.push(c);
        console.log(`✅ ${dirName}/${file}`);
      }
    } catch (err) {
      console.error(`❌ ${dirName}/${file}:`, err.message);
    }
  }
  return commands;
}

const [rankCommands, pointsCommands] = await Promise.all([
  loadCommandsFromDir('rank'),
  loadCommandsFromDir('points'),
]);

// ==========================
// 新形式ラッパー（データ+実行）
// ==========================
const newStyleCommands = [
  { data: avatarData,       execute: avatarExecute },
  { data: passwordData,     execute: passwordExecute },
  { data: shortUrlData,     execute: shortUrlExecute },
  { data: qrData,           execute: qrExecute },
  { data: reportData,       execute: reportExecute },
  { data: remindData,       execute: remindExecute },
  { data: pollData,         execute: pollExecute },
  { data: userInfoData,     execute: userInfoExecute },
  { data: roleInfoData,     execute: roleInfoExecute },
  { data: serverInviteData, execute: serverInviteExecute },
  { data: weatherData,      execute: weatherExecute },
];

// ==========================
// 全コマンド統合 → Map
// ==========================
const staticCommands = [
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
  pinchannelCommand,
  unpinchannelCommand,
  categorychannelCommand,
  uncategorizechannelCommand,
];

const commandMap = new Map();
const allCommands = [...staticCommands, ...newStyleCommands, ...rankCommands, ...pointsCommands];

for (const cmd of allCommands) {
  try {
    if (cmd?.data && typeof cmd.data.toJSON === 'function') {
      const json = cmd.data.toJSON();
      commandMap.set(json.name, { json, module: cmd });
    }
  } catch (err) {
    console.warn('[command-register] toJSON failed:', err.message);
  }
}

console.log(`[command-register] ${commandMap.size}個のコマンドを登録中...`);

// ==========================
// Slash コマンド登録 (Discord)
// ==========================
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
if (process.env.CLIENT_ID) {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: Array.from(commandMap.values()).map(c => c.json) }
    );
    console.log(`✅ ${commandMap.size}個のスラッシュコマンドを登録完了`);
  } catch (error) {
    console.error('❌ コマンド登録エラー:', error.message);
  }
} else {
  console.warn('⚠️ CLIENT_ID未設定 - コマンド登録をスキップ');
}

// ==========================
// Interaction Handler
// ==========================
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.user?.bot) return;

    // ボタン / セレクト / モーダル
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      await handleComponent(interaction);
      return;
    }

    // スラッシュコマンド
    if (interaction.isChatInputCommand()) {
      const entry = commandMap.get(interaction.commandName);
      if (entry) {
        await entry.module.execute(interaction);

        logToSheets({
          serverId: interaction.guildId,
          userId: interaction.user.id,
          channelId: interaction.channelId,
          level: 'INFO',
          timestamp: interaction.createdAt.toISOString(),
          cmd: interaction.commandName,
          message: 'Slash command executed',
        }).catch(() => {});
        return;
      }
      console.warn(`⚠️ 未定義のスラッシュコマンド: ${interaction.commandName}`);
    }
  } catch (err) {
    console.error('❌ interactionCreate error:', err);
    const errMsg = '❌ エラーが発生しました。';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg);
      } else {
        await interaction.reply({ content: errMsg, flags: [MessageFlags.Ephemeral] });
      }
    } catch {}
  }
});

// ==========================
// Message Event
// ==========================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // メッセージカウント (Neon DB)
  pool.query(
    `INSERT INTO user_message_counts (user_id, count) VALUES ($1, 1)
     ON CONFLICT (user_id) DO UPDATE SET count = user_message_counts.count + 1`,
    [message.author.id]
  ).catch(err => console.error('❌ DB count error:', err.message));

  // XP付与
  handleXpMessage(message).catch(e => console.error('❌ XP error:', e.message));

  // ダイスコマンド
  const dicePattern = /(dd\d+|(\d+)d(\d+))/i;
  if (dicePattern.test(message.content)) {
    handleMessageRoll(message).catch(() => {});
  }

  // ログ
  logToSheets({
    serverId: message.guildId,
    userId: message.author.id,
    channelId: message.channelId,
    level: 'INFO',
    timestamp: message.createdAt.toISOString(),
    cmd: 'message',
    message: message.content.slice(0, 200),
  }).catch(() => {});
});

// ==========================
// Guild Member Events
// ==========================
client.on('guildMemberAdd', async (member) => {
  handleMemberJoin(member).catch(e => console.error('❌ MemberJoin DM:', e.message));
});

// ==========================
// Ready
// ==========================
client.once('ready', () => {
  console.log(`✅ Discord にログイン成功: ${client.user.tag}`);
  console.log(`🌟 Bot ready: ${commandMap.size}個のコマンドが有効！`);

  logToSheets({
    serverId: 'system', userId: 'system', channelId: 'system',
    level: 'INFO', timestamp: new Date().toISOString(),
    cmd: 'startup', message: `${client.user.tag} が起動しました`,
  }).catch(() => {});
});

// エラーハンドリング
client.on('error', e => console.error('[ERROR]', e.message));
client.on('warn', w => console.warn('[WARN]', w));

// Discord ログイン
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN が設定されていません');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);

// ==========================
// Express Web サーバー
// ==========================
const app = express();
app.use('/auth', authRouter);

const port = process.env.PORT || 3000;

app.get('/', (_, res) => res.json({
  status: 'Bot is running! 🤖',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

app.listen(port, () => {
  console.log(`🌐 Web サーバー起動: http://localhost:${port}`);
});

// Graceful Shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
