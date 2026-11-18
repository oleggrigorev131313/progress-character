/** XP awards. Whole rubles and whole minutes. See README for the same rules in Russian. */
export const XP = {
  incomeBase: 15,
  passiveBase: 25,
  per10k: 1,
  per10kCap: 50,
  workoutBase: 20,
  per10min: 1,
  per10minCap: 30,
  bookAdded: 5,
  bookFinished: 100,
  goalAdded: 10,
  goalCompleted: 80,
};

/** XP required to advance from `level` to the next one: 100, 150, 200, … */
export function xpToAdvance(level) {
  return 100 + (level - 1) * 50;
}

export function xpForIncome(amount, type) {
  const base = type === "passive" ? XP.passiveBase : XP.incomeBase;
  const bonus = Math.min(XP.per10kCap, Math.floor(Number(amount) / 10000) * XP.per10k);
  return base + Math.max(0, bonus);
}

export function xpForWorkout(durationMin) {
  const minutes = Math.max(0, Math.round(Number(durationMin) || 0));
  if (!minutes) return 0;
  const bonus = Math.min(XP.per10minCap, Math.floor(minutes / 10) * XP.per10min);
  return XP.workoutBase + bonus;
}

export function levelFromXp(total) {
  const xp = Math.max(0, Math.round(Number(total) || 0));
  let level = 1;
  let spent = 0;
  while (level < 500) {
    const need = xpToAdvance(level);
    if (spent + need > xp) {
      const intoLevel = xp - spent;
      return {
        level,
        total: xp,
        intoLevel,
        nextLevelAt: need,
        progress: need === 0 ? 0 : intoLevel / need,
      };
    }
    spent += need;
    level += 1;
  }
  return { level, total: xp, intoLevel: 0, nextLevelAt: xpToAdvance(level), progress: 0 };
}
