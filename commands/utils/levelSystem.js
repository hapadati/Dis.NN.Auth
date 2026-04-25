import { db } from "../../firestore.js";

/**
 * Firestore: guilds/{guildId}/levelRoles/{level}
 */
export async function setLevelRoleConfig(guildId, level, add = [], remove = []) {
  const ref = db
    .collection("guilds")
    .doc(guildId)
    .collection("levelRoles")
    .doc(level.toString());

  await ref.set(
    { level, add, remove, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  console.log(`✅ Level ${level} roles saved for ${guildId}`);
}

export async function getAllLevelConfigs(guildId) {
  const ref = db.collection("guilds").doc(guildId).collection("levelRoles");
  const snap = await ref.get();
  if (snap.empty) return [];
  return snap.docs.map(d => d.data()).sort((a, b) => a.level - b.level);
}

/**
 * レベルアップ時のロール付与/削除
 */
export async function applyLevelRoles(member, newLevel) {
  const configs = await getAllLevelConfigs(member.guild.id);
  const target = configs.find(c => c.level === newLevel);
  if (!target) return;

  const { add = [], remove = [] } = target;

  for (const name of add) {
    const role = member.guild.roles.cache.find(r => r.name === name);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      console.log(`+ Added ${name} to ${member.user.tag}`);
    }
  }

  for (const name of remove) {
    const role = member.guild.roles.cache.find(r => r.name === name);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      console.log(`- Removed ${name} from ${member.user.tag}`);
    }
  }
}
