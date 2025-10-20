// 📂 events/message-xp.js
import { addXp } from "../commands/rank/xp-system.js";

export async function handleXpMessage(message) {
  if (message.author.bot || !message.guild) return;

  const result = await addXp(message.guild.id, message.author.id, 10);

  if (result.leveledUp) {
    await message.channel.send(
      `🎉 ${message.author} がレベル **${result.level}** にアップしました！`
    );

    if (result.unlocked.length > 0) {
      await message.channel.send(
        `🔓 新しい機能が解放されました！: ${result.unlocked.join(", ")}`
      );
    }
  }
}
