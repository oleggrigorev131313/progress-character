import { addDaysISO } from "../src/shared/time.js";

const base = process.env.BASE_URL || "http://127.0.0.1:8787";

async function req(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${data.error || ""}`);
  return data;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const created = [];

try {
  const health = await req("GET", "/api/health");
  assert(health.ok && health.timezone === "Europe/Samara", "health");

  const empty = await req("GET", "/api/summary");
  assert(empty.level.level === 1, "пустая база — уровень 1");
  const today = empty.today;
  const month = empty.month;

  const income = await req("POST", "/api/income", {
    amount: 50000,
    type: "active",
    description: "Маркетинг для Ивана",
    date: today,
  });
  created.push(["income", income.item.id]);
  assert(income.xpGained === 20, `опыт дохода ${income.xpGained}`);

  const passive = await req("POST", "/api/income", {
    amount: 30000,
    type: "passive",
    description: "Дивиденды",
    date: today,
  });
  created.push(["income", passive.item.id]);
  assert(passive.xpGained === 28, `опыт пассивного ${passive.xpGained}`);

  const debt = await req("POST", "/api/debts", {
    counterparty: "Ивану",
    direction: "owe",
    amount: 10000,
    paid: 2000,
  });
  created.push(["debts", debt.item.id]);
  assert(debt.item.remaining === 8000, "остаток долга");

  await req("PUT", "/api/budget", { month, amount: 80000 });
  const budget = await req("GET", `/api/budget?month=${month}`);
  assert(budget.amount === 80000 && budget.set, "бюджет");

  const book = await req("POST", "/api/books", { title: "Сапиенс", status: "reading", pagesTotal: 400, pagesRead: 10 });
  created.push(["books", book.item.id]);
  assert(book.xpGained === 5, `книга ${book.xpGained}`);
  const finished = await req("PATCH", `/api/books/${book.item.id}`, { status: "finished" });
  assert(finished.xpDelta === 100, `книга прочитана ${finished.xpDelta}`);
  assert(finished.item.pagesRead === 400, "страницы добиваются при завершении");

  const goal = await req("POST", "/api/goals", { title: "Марафон", status: "active" });
  created.push(["goals", goal.item.id]);
  assert(goal.xpGained === 10, `цель ${goal.xpGained}`);
  const done = await req("PATCH", `/api/goals/${goal.item.id}`, { status: "completed" });
  assert(done.xpDelta === 80, `цель выполнена ${done.xpDelta}`);

  const workoutDay = addDaysISO(today, -1);
  const workout = await req("POST", "/api/workouts", { type: "Бег", durationMin: 40, date: workoutDay, note: "" });
  created.push(["workouts", workout.item.id]);
  assert(workout.xpGained === 24, `тренировка ${workout.xpGained}`);

  const matched = await req("POST", "/api/match", { entity: "income", selector: { which: "last" } });
  assert(matched.matches[0].item.description === "Дивиденды", "последний доход");

  const yesterday = await req("POST", "/api/match", { entity: "workout", selector: { date: workoutDay } });
  assert(yesterday.matches.some((item) => item.id === workout.item.id), "тренировка за дату");

  const removed = await req("DELETE", `/api/income/${income.item.id}`);
  assert(removed.xpRemoved === 20, "снятие опыта");

  const summary = await req("GET", "/api/summary");
  assert(summary.level.total === 28 + 5 + 100 + 10 + 80 + 24, `сумма опыта ${summary.level.total}`);
  assert(summary.finance.passiveMonth === 30000, "пассивный доход месяца");

  await req("DELETE", `/api/budget?month=${month}`);
  console.log("smoke ok");
} finally {
  for (const [name, id] of created.reverse()) {
    await fetch(`${base}/api/${name}/${id}`, { method: "DELETE" }).catch(() => {});
  }
}
