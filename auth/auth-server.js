// auth/auth-server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { db } from "../firebase.js";
import { doc, setDoc } from "firebase/firestore";
import { isVpnIp } from "./verify-vpn.js";
import blockedGuilds from "./blocked.json" with { type: "json" };
dotenv.config();

const router = express.Router();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI; // 例: https://yourapp.onrender.com/auth/callback

router.get("/login", (req, res) => {
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20email`;
  res.redirect(redirect);
});

router.get("/callback", async (req, res) => {
  const code = req.query.code;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!code) return res.status(400).send("Missing code");

  // VPNチェック
  const vpn = await isVpnIp(ip);
  if (vpn) return res.status(403).send("VPN detected. Please disable VPN.");

  // アクセストークン取得
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const tokenData = await tokenRes.json();

  // ユーザー情報取得
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();

  const guildRes = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const guilds = await guildRes.json();

  // ブロックサーバーチェック
  const blocked = guilds.some(g => blockedGuilds.includes(g.id));
  if (blocked) return res.status(403).send("You belong to a blocked server.");

  // Firebaseに保存
  await setDoc(doc(db, "users", user.id), {
    username: user.username,
    email: user.email,
    guilds: guilds.map(g => g.id),
    ip,
    timestamp: new Date().toISOString(),
  });

  // 自動再参加処理
  try {
    const inviteCode = process.env.DEFAULT_INVITE; // 再参加用招待リンク
    await fetch(`https://discord.com/api/invites/${inviteCode}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch (err) {
    console.error("再参加エラー:", err);
  }

  res.send(`✅ 認証成功: ${user.username}`);
});

export default router;
