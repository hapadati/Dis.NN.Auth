// 認証完了時にロールを付与・削除する処理を追加

router.get("/callback", async (req, res) => {
    const code = req.query.code;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const addRoleId = req.query.add;
    const removeRoleId = req.query.remove;
    const guildId = req.query.guild;
  
    if (!code) return res.status(400).send("Missing code");
  
    // --- VPNチェック ---
    const vpn = await isVpnIp(ip);
    if (vpn) return res.status(403).send("VPN detected. Please disable VPN.");
  
    // --- トークン取得 ---
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
  
    // --- ユーザー情報取得 ---
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();
  
    // --- Firebase保存 ---
    await setDoc(doc(db, "users", user.id), {
      username: user.username,
      email: user.email,
      ip,
      guildId,
      timestamp: new Date().toISOString(),
    });
  
    // --- ロール付与/削除 ---
    try {
      if (guildId && addRoleId) {
        await fetch(
          `https://discord.com/api/guilds/${guildId}/members/${user.id}/roles/${addRoleId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            },
          }
        );
      }
  
      if (guildId && removeRoleId) {
        await fetch(
          `https://discord.com/api/guilds/${guildId}/members/${user.id}/roles/${removeRoleId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            },
          }
        );
      }
    } catch (err) {
      console.error("❌ ロール付与/削除エラー:", err);
    }
  
    res.send(`✅ 認証成功: ${user.username}`);
  });
  export default router;