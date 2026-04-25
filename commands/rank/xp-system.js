import { db } from "../firestore.js";
import { getNextLevelXP } from "../utils/level-curve.js";
import { applyLevelRoles } from "../utils/levelSystem.js";
import { checkUnlocks } from "../utils/unlockSystem.js";

/**
 * XP加算とレベルアップ処理
 */
export async function addXP(message) {
  const { guild, author, member } = message;
  if (!guild || author.bot) return;

  const guildId = guild.id;
  const userId = author.id;
  const ref = db.collection("guilds").doc(guildId).collection("users").doc(userId);

  const snap = await ref.get();
  const data = snap.exists
    ? snap.data()
    : { xp: 0, level: 1, lastMessage: 0 };

  const now = Date.now();
  if (now - data.lastMessage < 30000) return; // 30秒制限

  const gain = Math.floor(Math.random() * 20) + 10;
  data.lastMessage = now;
  data.xp += gain;

  const nextXP = getNextLevelXP(data.level);
  let leveledUp = false;

  if (data.xp >= nextXP) {
    data.level++;
    leveledUp = true;

    await message.channel.send(
      `🎉 **${author.username}** が **レベル ${data.level}** にアップ！ (+${gain} XP)`
    );

    await applyLevelRoles(member, data.level);
    await checkUnlocks(member, data.level);
  }

  await ref.set(data, { merge: true });
}
