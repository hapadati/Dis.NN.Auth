import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import { getNextLevelXP } from './level-curve.js';

export async function generateXPCard(user, userData, themePath) {
    const width = 800;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 背景画像
    if (fs.existsSync(themePath)) {
        const bg = await loadImage(themePath);
        ctx.drawImage(bg, 0, 0, width, height);
    } else {
        ctx.fillStyle = '#1e1e2f';
        ctx.fillRect(0, 0, width, height);
    }

    // 半透明オーバーレイ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // プロフィール画像
    const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(100, 150, 80, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 20, 70, 160, 160);
    ctx.restore();

    // ユーザー名
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Sans';
    ctx.fillText(user.username, 200, 120);

    // レベル表示
    ctx.font = '24px Sans';
    ctx.fillText(`レベル: ${userData.level}`, 200, 160);
    ctx.fillText(`XP: ${userData.xp}`, 200, 200);

    // 次のレベルに必要なXP
    const nextXP = getNextLevelXP(userData.level);
    const progress = Math.min(userData.xp / nextXP, 1);

    // 円グラフ
    const centerX = 650;
    const centerY = 150;
    const radius = 80;

    ctx.beginPath();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 20;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#00ff99';
    ctx.lineWidth = 20;
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, (Math.PI * 2 * progress) - Math.PI / 2);
    ctx.stroke();

    ctx.font = '20px Sans';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.floor(progress * 100)}%`, centerX - 25, centerY + 10);

    // 下部テキスト
    ctx.font = '18px Sans';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`次のレベルまで: ${nextXP - userData.xp} XP`, 200, 240);

    return canvas.toBuffer('image/png');
}
