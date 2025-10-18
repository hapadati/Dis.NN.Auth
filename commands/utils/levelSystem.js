import { db } from "../../firebase.js";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { getNextLevelXP } from "./level-curve.js";

/**
 * 💠 XP付与とレベルアップ処理
 */
export async function addXP(message, amount) {
  const guildId = message.guild.id;
  const userId = message.author.id;
  const userRef = doc(db, "xp", guildId, "users", userId);
  const userSnap = await getDoc(userRef);

  let data = {
    xp: 0,
    level: 1,
    totalXP: 0,
  };

  if (userSnap.exists()) data = userSnap.data();

  data.xp += amount;
  data.totalXP += amount;

  const nextXP = getNextLevelXP(data.level);

  if (data.xp >= nextXP) {
    data.level++;
    data.xp -= nextXP;

    await handleLevelUp(message, data.level);
  }

  await setDoc(userRef, data);
}

/**
 * 🎉 レベルアップ処理：サーバーごとの設定を参照
 */
async function handleLevelUp(message, level) {
  const guild = message.guild;
  const member = message.member;
  const guildId = guild.id;

  // Firestoreからロール設定を取得
  const configRef = collection(db, "guilds", guildId, "levelRoles");
  const configSnap = await getDocs(configRef);

  if (configSnap.empty) {
    console.log(`⚠️ サーバー ${guild.name} にレベルロール設定がありません`);
    return;
  }

  // 設定を配列化して該当レベルを検索
  const roleConfigs = configSnap.docs.map(doc => doc.data());
  const config = roleConfigs.find(cfg => cfg.level === level);
  if (!config) return;

  // ロール削除
  for (const roleName of config.remove || []) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      console.log(`🧹 ${member.user.tag} からロール削除: ${roleName}`);
    }
  }

  // ロール付与
  for (const roleName of config.add || []) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      console.log(`🎖️ ${member.user.tag} にロール付与: ${roleName}`);
    }
  }

  await message.channel.send(
    `🎉 ${member} が **Lv.${level}** に到達しました！`
  );
}

/**
 * ⚙️ サーバー管理者用：ロール設定を保存する関数
 */
export async function setLevelRoleConfig(guildId, level, addRoles = [], removeRoles = []) {
  const ref = doc(db, "guilds", guildId, "levelRoles", `level_${level}`);
  await setDoc(ref, {
    level,
    add: addRoles,
    remove: removeRoles,
  });
  console.log(`✅ サーバー ${guildId} のレベル設定を保存: Lv${level}`);
}
