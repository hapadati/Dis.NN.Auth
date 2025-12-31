import { db } from "../../firestore.js";
import { getNextLevelXP } from "../utils/level-curve.js";
import { applyLevelRoles } from "../utils/levelSystem.js";
import { checkUnlocks } from "../utils/unlockSystem.js";

/**
 * XP加算とレベルアップ処理
 */
export async function addXP(guildId, userId, gain, member, channel, username) {
  const ref = db.collection("guilds").doc(guildId).collection("users").doc(userId);

  const snap = await ref.get();
  const data = snap.exists
    ? snap.data()
    : { xp: 0, level: 1, lastMessage: 0 };

  const now = Date.now();
  if (now - data.lastMessage < 30000) {
    return { leveledUp: false, level: data.level, unlocked: [] };
  }

  data.lastMessage = now;
  data.xp += gain;

  const nextXP = getNextLevelXP(data.level);
  let leveledUp = false;
  let unlocked = [];

  if (data.xp >= nextXP) {
    data.level++;
    leveledUp = true;

    if (channel) {
      await channel.send(
        `🎉 **${username}** が **レベル ${data.level}** にアップ！ (+${gain} XP)`
      );
    }

    if (member) {
      await applyLevelRoles(member, data.level);
      unlocked = await checkUnlocks(member, data.level) ?? [];
    }
  }

  await ref.set(data, { merge: true });

  return {
    leveledUp,
    level: data.level,
    unlocked,
  };
}
