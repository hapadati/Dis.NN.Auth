/**
 * 💹 次のレベルに必要なXPを返す
 * カーブ：複雑な非線形関数（段階的成長）
 */
export function getNextLevelXP(level) {
    if (level < 5) return 100 + level * 50;
    if (level < 10) return 500 + Math.pow(level, 2.2) * 20;
    if (level < 20) return 1000 + Math.pow(level, 2.4) * 30;
    return 3000 + Math.pow(level, 2.6) * 40;
  }
  