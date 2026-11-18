import assert from "node:assert/strict";
import test from "node:test";
import { addDaysISO, samaraMonth, samaraToday, shiftMonth } from "./time.js";

test("Самара UTC+4: граница суток", () => {
  assert.equal(samaraToday(new Date("2026-11-18T19:59:00Z")), "2026-11-18");
  assert.equal(samaraToday(new Date("2026-11-18T20:00:00Z")), "2026-11-19");
  assert.equal(samaraMonth(new Date("2026-11-18T20:30:00Z")), "2026-11");
  assert.equal(samaraMonth(new Date("2026-11-30T20:30:00Z")), "2026-12");
});

test("сдвиг дат и месяцев", () => {
  assert.equal(addDaysISO("2026-11-18", -1), "2026-11-17");
  assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
