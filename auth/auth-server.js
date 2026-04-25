// auth/auth-server.js - ブロックサーバーをDBから取得 + ロール自動付与
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { isVpnIp } from './verify-vpn.js';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CLIENT_ID     = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI  = process.env.REDIRECT_URI;
const BOT_TOKEN     = process.env.DISCORD_TOKEN;
const GUILD_ID      = process.env.DISCORD_GUILD_ID || process.env.AUTH_GUILD_ID;

// =====================
// ユーティリティ: ブロックサーバー一覧をDBから取得
// =====================
async function getBlockedGuilds() {
  try {
    const res = await pool.query('SELECT guild_id FROM blocked_guilds');
    return res.rows.map(r => r.guild_id);
  } catch {
    return [];
  }
}

// =====================
// ユーティリティ: 認証後付与するロール一覧をDBから取得
// =====================
async function getAuthRoles(guildId) {
  try {
    const res = await pool.query(
      'SELECT role_id FROM auth_roles WHERE guild_id = $1',
      [guildId]
    );
    return res.rows.map(r => r.role_id);
  } catch {
    return [];
  }
}

// =====================
// Discord 認証ルート: ログイン開始
// =====================
router.get('/login', (req, res) => {
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20email`;
  res.redirect(redirect);
});

// =====================
// Discord OAuth コールバック
// =====================
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  const ip   = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    // VPNチェック
    const vpn = await isVpnIp(ip);
    if (vpn) {
      return res.status(403).json({ error: 'VPN_DETECTED', message: 'VPNを無効にしてから認証してください。' });
    }

    // アクセストークン取得
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).json({ error: 'TOKEN_ERROR', message: tokenData.error_description });
    }

    // ユーザー情報取得
    const [userRes, guildRes] = await Promise.all([
      fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
    ]);

    const user   = await userRes.json();
    const guilds = await guildRes.json();

    if (!user.id) {
      return res.status(401).json({ error: 'USER_FETCH_FAILED' });
    }

    // ブロックサーバーチェック（DBから動的に取得）
    const blockedIds = await getBlockedGuilds();
    const userGuildIds = Array.isArray(guilds) ? guilds.map(g => g.id) : [];
    const blockedGuild = Array.isArray(guilds) && guilds.find(g => blockedIds.includes(g.id));

    if (blockedGuild) {
      return res.status(403).json({
        error: 'BLOCKED_GUILD',
        message: `ブロックされたサーバー「${blockedGuild.name}」に参加しているため認証できません。`,
      });
    }

    // DBにユーザー情報保存
    await pool.query(
      `INSERT INTO auth_users (user_id, username, email, guilds, ip, authenticated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET username = $2, email = $3, guilds = $4, ip = $5, authenticated_at = NOW()`,
      [user.id, user.username, user.email || '', JSON.stringify(userGuildIds), ip]
    ).catch(() => {}); // テーブルがなくても続行

    // 認証ロール付与（BotトークンでAPI呼び出し）
    if (BOT_TOKEN && GUILD_ID) {
      const roleIds = await getAuthRoles(GUILD_ID);
      for (const roleId of roleIds) {
        await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${roleId}`, {
          method:  'PUT',
          headers: {
            Authorization: `Bot ${BOT_TOKEN}`,
            'X-Audit-Log-Reason': 'Auth verification completed',
          },
        }).catch(e => console.warn(`[Auth] ロール付与失敗 ${roleId}:`, e.message));
      }
    }

    // 成功レスポンス（Webサイトへリダイレクト）
    const webUrl = process.env.WEB_URL || 'https://unl-web.onrender.com';
    res.redirect(`${webUrl}/auth/success?username=${encodeURIComponent(user.username)}`);

  } catch (err) {
    console.error('[Auth] コールバックエラー:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// =====================
// 管理者API: ブロックサーバー一覧取得
// =====================
router.get('/admin/blocked-guilds', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM blocked_guilds ORDER BY created_at DESC'
    );
    res.json({ guilds: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// 管理者API: ブロックサーバー追加
// =====================
router.post('/admin/blocked-guilds', async (req, res) => {
  const { guild_id, guild_name, reason, added_by } = req.body;
  if (!guild_id) return res.status(400).json({ error: 'guild_id is required' });
  try {
    await pool.query(
      `INSERT INTO blocked_guilds (guild_id, guild_name, reason, added_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT (guild_id) DO UPDATE
       SET guild_name = $2, reason = $3, added_by = $4`,
      [guild_id, guild_name || '', reason || '', added_by || '']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// 管理者API: ブロックサーバー削除
// =====================
router.delete('/admin/blocked-guilds/:guild_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM blocked_guilds WHERE guild_id = $1', [req.params.guild_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// 管理者API: 認証ロール一覧取得
// =====================
router.get('/admin/auth-roles', async (req, res) => {
  const guildId = req.query.guild_id || GUILD_ID;
  try {
    const result = await pool.query(
      'SELECT * FROM auth_roles WHERE guild_id = $1 ORDER BY created_at DESC',
      [guildId]
    );
    res.json({ roles: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// 管理者API: 認証ロール追加
// =====================
router.post('/admin/auth-roles', async (req, res) => {
  const { guild_id, role_id, role_name, description } = req.body;
  if (!role_id) return res.status(400).json({ error: 'role_id is required' });
  const gId = guild_id || GUILD_ID;
  try {
    await pool.query(
      `INSERT INTO auth_roles (guild_id, role_id, role_name, description)
       VALUES ($1, $2, $3, $4) ON CONFLICT (guild_id, role_id) DO UPDATE
       SET role_name = $3, description = $4`,
      [gId, role_id, role_name || '', description || '']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// 管理者API: 認証ロール削除
// =====================
router.delete('/admin/auth-roles/:role_id', async (req, res) => {
  const guildId = req.query.guild_id || GUILD_ID;
  try {
    await pool.query(
      'DELETE FROM auth_roles WHERE role_id = $1 AND guild_id = $2',
      [req.params.role_id, guildId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
