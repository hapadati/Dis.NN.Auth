// main.mjs - Render対応版（Express先行起動 → Discord非同期初期化）
import { Client, GatewayIntentBits, REST, Routes, Partials, MessageFlags } from 'discord.js';
import { logToSheets } from './logger.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// Neon PostgreSQL 接続
// ==========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// DB接続確認
pool.query('SELECT NOW()').then(r => {
  console.log('✅ DB接続成功:', r.rows[0].now);
}).catch(e => {
  console.error('❌ DB接続失敗:', e.message);
});

// DBテーブル初期化（存在しなければ作成）
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_logs (
        id SERIAL PRIMARY KEY,
        guild_id TEXT,
        channel_id TEXT,
        user_id TEXT,
        user_tag TEXT,
        content TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_message_counts (
        user_id TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0
      );
    `);
    console.log('✅ DBテーブル初期化完了');
  } catch (e) {
    console.error('❌ DBテーブル初期化失敗:', e.message);
  }
}
initDB();

// ==========================
// Bot状態管理
// ==========================
const botStatus = {
  status: '🤖 Bot is starting...',
  commands: 0,
};

// ==========================
// Express Web サーバー（最優先起動）
// ==========================
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (_, res) => res.json({
  ...botStatus,
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// Healthcheck
app.get('/health', async (_, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db: 'connected', time: dbRes.rows[0].now });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

// Auth Router（dynamic importで循環依存を回避）
try {
  const { default: authRouter } = await import('./auth/auth-server.js');
  app.use('/auth', authRouter);
  console.log('✅ 認証ルーター設定完了');
} catch (e) {
  console.error('❌ 認証ルーター読み込み失敗:', e.message);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Web サーバー起動: port ${PORT}`);
  // Expressが起動してからDiscordを非同期で初期化
  initDiscord().catch(e => console.error('❌ Discord初期化エラー:', e));
});

// ==========================
// Discord 初期化（バックグラウンド）
// ==========================
async function initDiscord() {
  const { uploadImage } = await import('./utils/cloudinary.mjs');

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
  // コマンド読み込み（静的）
  // ==========================
  const staticImports = await Promise.allSettled([
    import('./commands/utils/omikuji.js'),
    import('./commands/utils/ping.js'),
    import('./commands/utils/dirdice.js'),
    import('./commands/utils/mention.js'),
    import('./commands/utils/geoquiz.js'),
    import('./commands/utils/avatar.js'),
    import('./commands/utils/password.js'),
    import('./commands/utils/shorturl.js'),
    import('./commands/utils/qr.js'),
    import('./commands/utils/report.js'),
    import('./commands/utils/remind.js'),
    import('./commands/utils/poll.js'),
    import('./commands/utils/user-info.js'),
    import('./commands/utils/role-info.js'),
    import('./commands/utils/server-invite.js'),
    import('./commands/utils/weather.js'),
    import('./commands/manage/button.js'),
    import('./commands/manage/alldelete.js'),
    import('./commands/manage/ban.js'),
    import('./commands/manage/kick.js'),
    import('./commands/manage/role.js'),
    import('./commands/manage/softban.js'),
    import('./commands/manage/timeout.js'),
    import('./commands/auth/authbutton.js'),
    import('./commands/manage/rolebutton.js'),
    import('./commands/manage/removebutton.js'),
    import('./commands/manage/createchannel.js'),
    import('./commands/manage/deletechannel.js'),
    import('./commands/manage/renamechannel.js'),
    import('./commands/manage/lockchannel.js'),
    import('./commands/manage/unlockchannel.js'),
    import('./commands/manage/pinchannel.js'),
    import('./commands/manage/unpinchannel.js'),
    import('./commands/manage/categorychannel.js'),
    import('./commands/manage/uncategorizechannel.js'),
    import('./events/message-xp.js'),
    import('./events/member-join.js'),
    import('./commands/points/item-list.js'),
  ]);

  // 各モジュールを取り出す（失敗したものはスキップ）
  const getModule = (result, name) => {
    if (result.status === 'fulfilled') return result.value;
    console.error(`❌ モジュール読み込み失敗 [${name}]:`, result.reason?.message);
    return null;
  };

  const [
    omikujiMod, pingMod, dirdice, mentionMod, geoquizMod,
    avatarMod, passwordMod, shortUrlMod, qrMod, reportMod,
    remindMod, pollMod, userInfoMod, roleInfoMod, serverInviteMod, weatherMod,
    buttonMod, allDeleteMod, banMod, kickMod, roleMod, softbanMod, timeoutMod,
    authbuttonMod, rolebuttonMod, removebuttonMod,
    createChannelMod, deleteChannelMod, renameChannelMod,
    lockChannelMod, unlockChannelMod, pinChannelMod, unpinChannelMod,
    categoryChannelMod, uncategorizeChannelMod,
    xpMod, memberJoinMod, itemListMod,
  ] = staticImports.map((r, i) => getModule(r, `static[${i}]`));

  const handleMessageRoll  = dirdice?.handleMessageRoll;
  const handleXpMessage    = xpMod?.handleXpMessage;
  const handleMemberJoin   = memberJoinMod?.handleMemberJoin;
  const handleComponent    = itemListMod?.handleComponent;

  // ==========================
  // 動的コマンド読み込み（rank / points）
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
  // コマンドMap構築
  // ==========================
  const staticCmds = [
    omikujiMod?.omikujiCommand,
    pingMod?.pingCommand,
    mentionMod?.mentionCommand,
    geoquizMod?.geoquizCommand,
    avatarMod ? { data: avatarMod.data, execute: avatarMod.execute } : null,
    passwordMod ? { data: passwordMod.data, execute: passwordMod.execute } : null,
    shortUrlMod ? { data: shortUrlMod.data, execute: shortUrlMod.execute } : null,
    qrMod ? { data: qrMod.data, execute: qrMod.execute } : null,
    reportMod ? { data: reportMod.data, execute: reportMod.execute } : null,
    remindMod ? { data: remindMod.data, execute: remindMod.execute } : null,
    pollMod ? { data: pollMod.data, execute: pollMod.execute } : null,
    userInfoMod ? { data: userInfoMod.data, execute: userInfoMod.execute } : null,
    roleInfoMod ? { data: roleInfoMod.data, execute: roleInfoMod.execute } : null,
    serverInviteMod ? { data: serverInviteMod.data, execute: serverInviteMod.execute } : null,
    weatherMod ? { data: weatherMod.data, execute: weatherMod.execute } : null,
    buttonMod?.recruitmentCommand,
    allDeleteMod?.alldeleteCommand,
    banMod?.banCommand,
    kickMod?.kickCommand,
    roleMod?.roleCommand,
    softbanMod?.softbanCommand,
    timeoutMod?.timeoutCommand,
    authbuttonMod?.authbuttonCommand,
    rolebuttonMod?.rolebuttonCommand,
    removebuttonMod?.removebuttonCommand,
    createChannelMod?.createchannelCommand,
    deleteChannelMod?.deletechannelCommand,
    renameChannelMod?.renamechannelCommand,
    lockChannelMod?.lockchannelCommand,
    unlockChannelMod?.unlockchannelCommand,
    pinChannelMod?.pinchannelCommand,
    unpinChannelMod?.unpinchannelCommand,
    categoryChannelMod?.categorychannelCommand,
    uncategorizeChannelMod?.uncategorizechannelCommand,
  ].filter(Boolean);

  const commandMap = new Map();
  const allCmds = [...staticCmds, ...rankCommands, ...pointsCommands];
  for (const cmd of allCmds) {
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
  // Slash コマンド登録
  // ==========================
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  if (process.env.CLIENT_ID) {
    try {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: Array.from(commandMap.values()).map(c => c.json) }
      );
      console.log(`✅ ${commandMap.size}個のスラッシュコマンド登録完了`);
    } catch (error) {
      console.error('❌ コマンド登録エラー:', error.message);
    }
  } else {
    console.warn('⚠️ CLIENT_ID未設定 - コマンド登録スキップ');
  }

  // ==========================
  // Interaction Handler
  // ==========================
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.user?.bot) return;

      // ボタン / セレクト / モーダル
      if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        if (handleComponent) await handleComponent(interaction);
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
        console.warn(`⚠️ 未定義コマンド: ${interaction.commandName}`);
      }
    } catch (err) {
      console.error('❌ interactionCreate error:', err.message);
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
  const dicePattern = /(dd\d+|(\d+)d(\d+))/i;

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    // XP付与
    if (handleXpMessage) handleXpMessage(message).catch(() => {});

    // ダイスコマンド
    if (handleMessageRoll && dicePattern.test(message.content)) {
      handleMessageRoll(message).catch(() => {});
    }

    // Spreadsheetログ
    logToSheets({
      serverId: message.guildId,
      userId: message.author.id,
      channelId: message.channelId,
      level: 'INFO',
      timestamp: message.createdAt.toISOString(),
      cmd: 'message',
      message: message.content.slice(0, 200),
    }).catch(() => {});

    // メッセージカウント + チャットログ保存
    pool.query(
      `INSERT INTO user_message_counts (user_id, count) VALUES ($1, 1)
       ON CONFLICT (user_id) DO UPDATE SET count = user_message_counts.count + 1`,
      [message.author.id]
    ).catch(() => {});

    (async () => {
      try {
        let imageUrl = null;
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();
          if (attachment.contentType?.startsWith('image/')) {
            imageUrl = await uploadImage(attachment.url);
          }
        }
        await pool.query(
          `INSERT INTO chat_logs (guild_id, channel_id, user_id, user_tag, content, image_url)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [message.guildId, message.channelId, message.author.id, message.author.tag, message.content, imageUrl]
        );
      } catch (err) {
        console.error('❌ DB chat_log error:', err.message);
      }
    })();
  });

  // ==========================
  // Guild Member Events
  // ==========================
  client.on('guildMemberAdd', async (member) => {
    if (handleMemberJoin) handleMemberJoin(member).catch(e => console.error('❌ MemberJoin DM:', e.message));
  });

  // ==========================
  // Ready
  // ==========================
  client.once('ready', () => {
    console.log(`✅ Discord にログイン成功: ${client.user.tag}`);
    botStatus.status = '🤖 Bot is running!';
    botStatus.commands = commandMap.size;
    console.log(`🌟 Bot ready: ${commandMap.size}個のコマンドが有効！`);

    logToSheets({
      serverId: 'system', userId: 'system', channelId: 'system',
      level: 'INFO', timestamp: new Date().toISOString(),
      cmd: 'startup', message: `${client.user.tag} が起動しました`,
    }).catch(() => {});
  });

  // エラーハンドリング
  client.on('error', e => console.error('[ERROR]', e.message));
  client.on('shardError', e => console.error('[SHARD ERROR]', e.message));
  client.on('warn', w => console.warn('[WARN]', w));

  // Discord ログイン
  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN が設定されていません');
    return;
  }
  client.login(process.env.DISCORD_TOKEN);
}

// Graceful Shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});
