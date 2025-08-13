import { EmbedBuilder } from 'discord.js';

// サイコロを振る関数
export function rollDice(count, max) {
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * max) + 1);
    }
    return rolls;
}

// dd形式や通常のd形式のダイス処理
export function rollNormalDice(dice) {
    let count, max;
    if (dice.startsWith('dd')) {
        count = 1;
        max = parseInt(dice.slice(2));
    } else if (dice.includes('d')) {
        [count, max] = dice.split('d').map(Number);
    }
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * max) + 1);
    }
    return rolls;
}

// dd形式ダイスの判定処理
export function handleDdDice(dice, rolls, modifier = 0) {
    let target = parseInt(dice.slice(2));
    target = eval(`${target} ${modifier >= 0 ? '+' : ''}${modifier}`);

    const randomRoll = Math.floor(Math.random() * 100) + 1;
    let resultMessage = '';
    let embedColor = 0x000000;

    if (randomRoll <= target) {
        if (randomRoll <= 5) {
            resultMessage = `圧倒的成功！出目: ${randomRoll} / 目標: ${target}`;
            embedColor = 0x00ff00;
        } else {
            resultMessage = `成功！出目: ${randomRoll} / 目標: ${target}`;
            embedColor = 0x0077ff;
        }
    } else {
        if (randomRoll >= 96) {
            resultMessage = `圧倒的失敗！出目: ${randomRoll} / 目標: ${target}`;
            embedColor = 0xff0000;
        } else {
            resultMessage = `失敗！出目: ${randomRoll} / 目標: ${target}`;
            embedColor = 0xff0000;
        }
    }
    return { resultMessage, embedColor };
}

// 通常のダイスの処理
export function handleNormalDice(dice, rolls, modifier = 0) {
    const total = rolls.reduce((a, b) => a + b, 0);
    const modifiedTotal = eval(`${total} ${modifier >= 0 ? '+' : ''}${modifier}`);
    const resultDescription = rolls.join(', ') + ` (合計: ${total}${modifier ? ` → 修正後: ${modifiedTotal}` : ''})`;
    let resultMessage = `出目: ${resultDescription}`;
    let embedColor = 0x000000;

    if (dice === '1d100') {
        const roll = modifiedTotal;
        if (roll === 1) {
            resultMessage += ' (1クリティカル！)';
            embedColor = 0x00ff00;
        } else if (roll <= 5) {
            resultMessage += ' (クリティカル！)';
            embedColor = 0x00ff00;
        } else if (roll <= 10) {
            resultMessage += ' (スペシャル)';
            embedColor = 0x0000ff;
        } else if (roll >= 96 && roll <= 99) {
            resultMessage += ' (ファンブル)';
            embedColor = 0xff0000;
        } else if (roll === 100) {
            resultMessage += ' (100ファンブル)';
            embedColor = 0xff0000;
        }
    }
    return { resultMessage, embedColor };
}

// 特別ダイス：接待/虐待
export function applySpecialDice(diceType) {
    let roll;
    if (diceType === 'settai') {
        roll = Math.floor(Math.random() * 5) + 1;
    } else if (diceType === 'gyakutai') {
        roll = Math.floor(Math.random() * 5) + 96;
    }
    return roll;
}

export function getSettaiGyakutaiResult(diceType) {
    let resultMessage = '';
    let embedColor = 0x000000;

    const roll = applySpecialDice(diceType);

    if (diceType === 'settai') {
        resultMessage = `接待ダイス！出目: ${roll}（プレイヤーに優しい！）`;
        embedColor = 0x00ff00;
    } else if (diceType === 'gyakutai') {
        resultMessage = `虐待ダイス！出目: ${roll}（あまりにも過酷！）`;
        embedColor = 0xff0000;
    }

    return { resultMessage, embedColor };
}

// ダイス式のパース関数（+ - * / 対応）
function parseDiceExpression(dice) {
    const match = dice.match(/^(\d*d\d+|dd\d+)([+\-*/]\d+)?$/);
    if (!match) return null;

    const baseDice = match[1];
    const modifierStr = match[2] || '';
    const modifier = modifierStr ? Number(eval(modifierStr)) : 0;

    return { baseDice, modifier };
}

// ダイスアニメーションの表示関数
async function showRollingEmbed(message, diceResultCallback, originalDiceText) {
    const rollingEmbed = new EmbedBuilder()
        .setTitle(`${message.author.username} のサイコロ振り中...`)
        .setColor(0xffff00)
        .setDescription(`振っています... ${originalDiceText}`);

    const rollingMessage = await message.reply({ embeds: [rollingEmbed] });

    const maxRoll = 100;  // 表示用に汎用的に
    const rollingStages = 15;

    for (let i = 0; i < rollingStages; i++) {
        const randomRoll = Math.floor(Math.random() * maxRoll) + 1;
        rollingEmbed.setDescription(`振っています... ${originalDiceText} ${randomRoll}`);
        await rollingMessage.edit({ embeds: [rollingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const { resultMessage, embedColor } = await diceResultCallback();
    const finalEmbed = new EmbedBuilder()
        .setTitle(`${message.author.username} のサイコロ結果`)
        .setDescription(resultMessage)
        .setColor(embedColor)
        .setFooter({ text: 'サイコロ結果' })
        .setTimestamp();

    await rollingMessage.edit({ embeds: [finalEmbed] });
}

// ダイスコマンドのメイン処理
export async function handleMessageRoll(message) {
    const input = message.content.trim();
    let rolls = [];
    let resultMessage = '';
    let embedColor = 0x000000;

    if (input === 'settai' || input === 'gyakutai') {
        const { resultMessage: specialResult, embedColor: specialColor } = getSettaiGyakutaiResult(input);
        resultMessage = specialResult;
        embedColor = specialColor;
        await message.reply({ embeds: [new EmbedBuilder().setDescription(resultMessage).setColor(embedColor)] });
        return;
    }

    const parsed = parseDiceExpression(input);
    if (!parsed) {
        await message.reply('❌ 無効なダイスの書式です。例: `2d6`, `1d100+10`, `dd20-5`');
        return;
    }

    const { baseDice, modifier } = parsed;

    if (/^(\d*d\d+|dd\d+)$/.test(baseDice)) {
        try {
            rolls = rollNormalDice(baseDice);

            const diceResultCallback = async () => {
                if (baseDice.startsWith('dd')) {
                    return handleDdDice(baseDice, rolls, modifier);
                } else {
                    return handleNormalDice(baseDice, rolls, modifier);
                }
            };

            await showRollingEmbed(message, diceResultCallback, input);

        } catch (error) {
            console.error('❌ サイコロエラー:', error);
            await message.reply(`❌ エラーが発生しました: ${error.message}`);
        }
    } else {
        await message.reply('❌ 無効なダイスの書式です。例: `2d6`, `dd20`, `1d100+10`');
    }
}