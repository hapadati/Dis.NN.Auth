import { db } from "../../firestore.js"; // ← firebase.js ではなく firestore.js を使う（admin SDK）

/**
 * サーバーごとのレベルロール設定を保存
 * @param {string} guildId - サーバーID
 * @param {number} level - 対象レベル
 * @param {string[]} add - 付与するロール名の配列
 * @param {string[]} remove - 削除するロール名の配列
 */
export async function setLevelRoleConfig(guildId, level, add = [], remove = []) {
  try {
    const docRef = db
      .collection("guilds")
      .doc(guildId)
      .collection("levelRoles")
      .doc(level.toString());

    await docRef.set(
      {
        level,
        add,
        remove,
        updatedAt: new Date().toISOString(),
      },
      { merge: true } // 既存設定を上書き保存
    );

    console.log(`✅ [Firestore] Level ${level} role config saved for guild ${guildId}`);
  } catch (err) {
    console.error("❌ Firestore setLevelRoleConfig error:", err);
    throw err;
  }
}

/**
 * 指定サーバーの全レベル設定を取得
 * @param {string} guildId
 * @returns {Promise<Array<{ level:number, add:string[], remove:string[] }>>}
 */
export async function getAllLevelConfigs(guildId) {
  try {
    const snapshot = await db
      .collection("guilds")
      .doc(guildId)
      .collection("levelRoles")
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => a.level - b.level);
  } catch (err) {
    console.error("❌ Firestore getAllLevelConfigs error:", err);
    return [];
  }
}
