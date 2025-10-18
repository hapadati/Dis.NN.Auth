import { loadGuildData, saveGuildData } from './data-manager.js';
import { getXPForLevel, getNextLevelXP } from './level-curve.js';

export async function addXP(message) {
    const guild = message.guild;
    const user = message.author;
    if (user.bot) return;

    const guildId = guild.id;
    const userId = user.id;

    const data = loadGuildData(guildId);
    if (!data[userId]) {
        data[userId] = { xp: 0, level: 1, lastMessage: 0 };
    }

    const userData = data[userId];
    const now = Date.now();

    // ⏱️ クールダウン（例: 30秒以内の連投は無効）
    if (now - userData.lastMessage < 30000) return;

    const xpGain = Math.floor(Math.random() * 20) + 10; // 10〜30XP
    userData.xp += xpGain;
    userData.lastMessage = now;

    const nextLevelXP = getNextLevelXP(userData.level);
    if (userData.xp >= nextLevelXP) {
        userData.level += 1;

        // 🎉 レベルアップ時メッセージ
        await message.channel.send({
            content: `🎉 **${user.username}** がレベル **${userData.level}** に到達！ (${xpGain} XP 獲得)`
        });

        // 🏅 レベルに応じたロール付与
        await handleLevelRoles(message.member, userData.level);
    }

    saveGuildData(guildId, data);
}

// 🎖️ ロール付与システム
async function handleLevelRoles(member, level) {
    const guild = member.guild;
    const roleRewards = [
        { level: 5, name: "🌱 Beginner" },
        { level: 10, name: "🔥 Intermediate" },
        { level: 15, name: "💎 Advanced" },
        { level: 20, name: "🏆 Master" }
    ];

    for (const reward of roleRewards) {
        let role = guild.roles.cache.find(r => r.name === reward.name);
        if (!role && level >= reward.level) {
            role = await guild.roles.create({
                name: reward.name,
                color: 'Random',
                reason: `XPシステム自動ロール (${reward.level})`
            });
        }

        if (level >= reward.level && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }
    }
}
