// XP カーブ（例: Lv^2 × 100）
export function getNextLevelXP(level) {
    return Math.floor(100 * level * level);
  }
  
  export function getXPForLevel(level) {
    if (level <= 1) return 0;
    return getNextLevelXP(level - 1);
  }
  