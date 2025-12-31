// utils/xp-system.js
import { db } from "../../firestore.js";
import { getNextLevelXP } from "../utils/level-curve.js";
import { applyLevelRoles } from "../utils/levelSystem.js";
import { checkUnlocks } from "../utils/unlockSystem.js";

/**
 * XP加算とレベルアップ処理（トランザクションで二重送信防止）
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

  const result = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists
      ? snap.data()
      : { xp: 0, level: 1, lastMessage: 0, lastLevelUpSent: 0, buffs: [] };

    const now = Date.now();

    // 30秒以内は XP 加算スキップ
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

    // レベルアップ判定
    if (data.xp >= nextXP) {
      data.level++;
      leveledUp = true;

      // 二重送信防止（1秒以内に送信済みならスキップ）
      if (channel && now - (data.lastLevelUpSent || 0) > 1000) {
        data.lastLevelUpSent = now;

        // メッセージ送信はトランザクション外で行う
        setTimeout(async () => {
          try {
            await channel.send(
              `🎉 **${username}** が **レベル ${data.level}** にアップ！ (+${actualGain} XP)`
            );
          } catch {}
        }, 0);
      }

      // レベルアップ時の処理
      if (member) {
        applyLevelRoles(member, data.level).catch(console.error);
        unlocked = await checkUnlocks(member, data.level) ?? [];
      }
    }

    transaction.set(ref, data, { merge: true });

    return { leveledUp, level: data.level, unlocked, xpAdded: actualGain };
  });

  return result;
}

/**
 * バフ付与
 */
export async function addBuff(guildId, userId, buffName) {
  const ref = db.collection("guilds").doc(guildId).collection("users").doc(userId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() : { xp: 0, level: 1, buffs: [] };

    if (!data.buffs) data.buffs = [];
    if (!data.buffs.includes(buffName)) data.buffs.push(buffName);

    transaction.set(ref, data, { merge: true });
  });
}

/**
 * バフ削除
 */
export async function removeBuff(guildId, userId, buffName) {
  const ref = db.collection("guilds").doc(guildId).collection("users").doc(userId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() : { xp: 0, level: 1, buffs: [] };

    if (data.buffs?.includes(buffName)) {
      data.buffs = data.buffs.filter(b => b !== buffName);
      transaction.set(ref, data, { merge: true });
    }
  });
}
