import { XP, levelFromXp, xpForIncome, xpForWorkout, xpToAdvance } from "../src/shared/xp.js";
import { addDaysISO, samaraMonth, samaraToday } from "../src/shared/time.js";

const base = process.env.BASE_URL || "http://127.0.0.1:8787";
const today = samaraToday();
const month = samaraMonth();

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function put(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function dayInMonth(offset) {
  const iso = addDaysISO(today, -offset);
  return iso.startsWith(month) ? iso : today;
}

let expected = 0;
const finishedBooks = [
  "Мастер и Маргарита",
  "1984",
  "Маленький принц",
  "Чистый код",
  "Думай медленно… решай быстро",
  "Алхимик",
  "Сто лет одиночества",
  "Преступление и наказание",
  "Сила привычки",
  "Богатый папа, бедный папа",
  "Гарри Поттер и философский камень",
  "Над пропастью во ржи",
];
for (const title of finishedBooks) {
  await post("/api/books", { title, status: "finished" });
  expected += XP.bookAdded + XP.bookFinished;
}
await post("/api/books", { title: "Сапиенс", author: "Юваль Ной Харари", status: "reading", pagesTotal: 470, pagesRead: 180 });
await post("/api/books", { title: "Атомные привычки", author: "Джеймс Клир", status: "reading", pagesTotal: 320, pagesRead: 90 });
expected += XP.bookAdded * 2;

const doneGoals = ["Закрыть кредитку", "Пробежать 5 км", "Месяц без сладкого", "Отложить 100 тысяч", "Утренняя зарядка", "Курс по SQL"];
for (const title of doneGoals) {
  await post("/api/goals", { title, status: "completed" });
  expected += XP.goalAdded + XP.goalCompleted;
}
await post("/api/goals", { title: "Подушка безопасности", targetValue: 300000, currentValue: 120000, status: "active" });
await post("/api/goals", { title: "Пробежать 10 км", targetValue: 10, currentValue: 4, status: "active" });
await post("/api/goals", { title: "Курс английского", targetValue: 100, currentValue: 35, status: "active" });
expected += XP.goalAdded * 3;

const incomes = [
  [120000, "active", "Маркетинг для Ивана", 0],
  [85000, "active", "Проект для студии", 2],
  [40000, "passive", "Дивиденды", 1],
  [22000, "passive", "Аренда", 4],
];
for (const [amount, type, description, offset] of incomes) {
  await post("/api/income", { amount, type, description, date: dayInMonth(offset) });
  expected += xpForIncome(amount, type);
}

await put("/api/budget", { month, amount: 180000 });
await post("/api/debts", { counterparty: "Иван", direction: "owe", amount: 50000, paid: 20000, note: "за ремонт" });
await post("/api/debts", { counterparty: "Маша", direction: "owed", amount: 15000, paid: 0, note: "должна за курс" });

const monthWorkouts = [
  ["Бег", 42, 0],
  ["Силовая", 55, 1],
  ["Йога", 30, 2],
  ["Плавание", 45, 3],
  ["Ходьба", 35, 5],
  ["Растяжка", 20, 6],
];
for (const [type, durationMin, offset] of monthWorkouts) {
  await post("/api/workouts", { type, durationMin, date: dayInMonth(offset), note: "" });
  expected += xpForWorkout(durationMin);
}

function targetXp(level, progress) {
  let spent = 0;
  for (let current = 1; current < level; current += 1) spent += xpToAdvance(current);
  return spent + Math.round(xpToAdvance(level) * progress);
}

const target = targetXp(12, 0.62);
let guard = 0;
while (expected + xpForWorkout(45) <= target && guard < 400) {
  const date = addDaysISO(today, -40 - guard);
  await post("/api/workouts", { type: guard % 2 ? "Силовая" : "Бег", durationMin: 45, date, note: "" });
  expected += xpForWorkout(45);
  guard += 1;
}

const summary = await (await fetch(`${base}/api/summary`)).json();
const level = levelFromXp(expected);
console.log(`seed ok: level ${summary.level.level}, xp ${summary.level.total}, expected ${expected} (level ${level.level})`);
