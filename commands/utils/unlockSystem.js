import { db } from "../firestore.js";

/**
 * サーバーのレベル解放設定を保存
 */
export async function setUnlockLevel(guildId, command, level) {
  const ref = db
    .collection("guilds")
    .doc(guildId)
    .collection("unlocks")
    .doc(command);

  await ref.set({ command, level }, { merge: true });
  console.log(`🔓 [Unlock] ${command} requires level ${level} (guild: ${guildId})`);
}

/**
 * サーバーの全コマンド解放設定を取得
 */
export async function getUnlocks(guildId) {
  const snap = await db
    .collection("guilds")
    .doc(guildId)
    .collection("unlocks")
    .get();

  return snap.docs.map((d) => d.data());
}

/**
 * 指定コマンドが使えるか確認
 */
export async function canUseCommand(guildId, userLevel, commandName) {
  const ref = db
    .collection("guilds")
    .doc(guildId)
    .collection("unlocks")
    .doc(commandName);

  const snap = await ref.get();
  if (!snap.exists) return true; // 制限なし
  const { level } = snap.data();
  return userLevel >= level;
}

/**
 * レベルアップ時に「新機能解放」を通知
 */
export async function checkUnlocks(member, level) {
  const guildId = member.guild.id;
  const unlocks = await getUnlocks(guildId);
  const unlocked = unlocks.filter((u) => u.level === level);
  if (unlocked.length === 0) return;

  const names = unlocked.map((u) => `/${u.command}`).join(", ");
  await member.send(`🔓 新機能解放！ レベル${level}で ${names} が使用可能になりました！`);
}
