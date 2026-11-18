import assert from "node:assert/strict";
import test from "node:test";
import { levelFromXp, xpForIncome, xpForWorkout, xpToAdvance } from "./xp.js";

test("опыт за доход и тренировку", () => {
  assert.equal(xpForIncome(50000, "active"), 20);
  assert.equal(xpForIncome(50000, "passive"), 30);
  assert.equal(xpForIncome(1_000_000, "active"), 65);
  assert.equal(xpForWorkout(40), 24);
  assert.equal(xpForWorkout(400), 50);
  assert.equal(xpForWorkout(0), 0);
});

test("кривая уровней", () => {
  assert.equal(xpToAdvance(1), 100);
  assert.equal(xpToAdvance(2), 150);
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(99).level, 1);
  assert.equal(levelFromXp(99).intoLevel, 99);
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(levelFromXp(100).intoLevel, 0);
  assert.equal(levelFromXp(100).nextLevelAt, 150);
  assert.equal(levelFromXp(249).level, 2);
  assert.equal(levelFromXp(250).level, 3);
});
