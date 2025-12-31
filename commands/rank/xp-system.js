// utils/xp-system.js
import { db } from "../../firestore.js";
import { getNextLevelXP } from "./level-curve.js";
import { applyLevelRoles } from "./levelSystem.js";
import { checkUnlocks } from "./unlockSystem.js";

/**
 * XP加算とレベルアップ処理
 * @param {string} guildId
 * @param {string} userId
 * @param {number} gain
 * @param {GuildMember} member
 * @param {TextChannel} channel
 * @param {string} username
 * @param {string[]} ignoreChannels チャンネルIDリスト
 * @param {string[]} ignoreCategories カテゴリーIDリスト
 */
export async function addXP(
  guildId,
  userId,
  gain,
  member,
  channel,
  username,
  ignoreChannels = [],
  ignoreCategories = []
) {
  if (channel) {
    if (ignoreChannels.includes(channel.id)) return { leveledUp: false, level: 1, unlocked: [] };
    if (channel.parentId && ignoreCategories.includes(channel.parentId)) return { leveledUp: false, level: 1, unlocked: [] };
  }

  const ref = db.collection("guilds").doc(guildId).collection("users").doc(userId);
  const snap = await ref.get();
  const data = snap.exists
    ? snap.data()
    : { xp: 0, level: 1, lastMessage: 0, buffs: [] };

  const now = Date.now();
  if (now - data.lastMessage < 30000) {
    return { leveledUp: false, level: data.level, unlocked: [] };
  }

  data.lastMessage = now;

  // バフ適用
  let actualGain = gain;
  if (data.buffs?.includes("doubleXP")) actualGain *= 2;

  data.xp += actualGain;

  const nextXP = getNextLevelXP(data.level);
  let leveledUp = false;
  let unlocked = [];

  if (data.xp >= nextXP) {
    data.level++;
    leveledUp = true;

    if (channel) {
      await channel.send(
        `🎉 **${username}** が **レベル ${data.level}** にアップ！ (+${actualGain} XP)`
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
    xpAdded: actualGain,
  };
}

/**
 * バフ付与
 * @param {string} guildId
 * @param {string} userId
 * @param {string} buffName
 */
export async function addBuff(guildId, userId, buffName) {
  const ref = db.collection("guilds").doc(guildId).collection("users").doc(userId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : { xp: 0, level: 1, buffs: [] };

  if (!data.buffs) data.buffs = [];
  if (!data.buffs.includes(buffName)) data.buffs.push(buffName);

  await ref.set(data, { merge: true });
}

/**
 * バフ削除
 */
export async function removeBuff(guildId, userId, buffName) {
  const ref = db.collection("guilds").doc(guildId).collection("users").doc(userId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : { xp: 0, level: 1, buffs: [] };

  if (data.buffs?.includes(buffName)) {
    data.buffs = data.buffs.filter(b => b !== buffName);
    await ref.set(data, { merge: true });
  }
}
