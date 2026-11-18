import assert from "node:assert/strict";
import test from "node:test";
import { parseCommand } from "./parseCommand.js";
import { addDaysISO, samaraToday } from "../shared/time.js";

const NOW = new Date("2026-11-18T08:00:00Z");

function parse(text, now = NOW) {
  return parseCommand(text, { now });
}

test("доход с описанием", () => {
  const result = parse("получил 50к за маркетинг для Ивана");
  assert.equal(result.ok, true);
  assert.equal(result.action, "create");
  assert.equal(result.entity, "income");
  assert.equal(result.needsConfirmation, false);
  assert.equal(result.fields.amount, 50000);
  assert.equal(result.fields.type, "active");
  assert.equal(result.fields.description, "Маркетинг для Ивана");
  assert.equal(result.fields.date, "2026-11-18");
  assert.match(result.preview, /50 000 ₽/);
  assert.match(result.preview, /Маркетинг для Ивана/);
});

test("пассивный доход и дивиденды", () => {
  const rent = parse("пассивный доход 15 тысяч аренда квартиры");
  assert.equal(rent.fields.type, "passive");
  assert.equal(rent.fields.amount, 15000);
  assert.equal(rent.fields.description, "Аренда квартиры");

  const div = parse("дивиденды 3к");
  assert.equal(div.entity, "income");
  assert.equal(div.fields.type, "passive");
  assert.equal(div.fields.amount, 3000);
  assert.equal(div.fields.description, "Дивиденды");
});

test("полтора миллиона и 1,5 млн в команде", () => {
  assert.equal(parse("получил полтора миллиона за продажу").fields.amount, 1500000);
  assert.equal(parse("доход 1,5 млн").fields.amount, 1500000);
  assert.equal(parse("заработал двадцать пять тысяч пятьсот").fields.amount, 25500);
});

test("долги: направление и имя", () => {
  const owe = parse("должен Ивану 10к");
  assert.equal(owe.entity, "debt");
  assert.equal(owe.fields.direction, "owe");
  assert.equal(owe.fields.counterparty, "Ивану");
  assert.equal(owe.fields.amount, 10000);

  const owe2 = parse("я должен Маше 5000");
  assert.equal(owe2.fields.direction, "owe");
  assert.equal(owe2.fields.counterparty, "Маше");
  assert.equal(owe2.fields.amount, 5000);

  const owed = parse("Петр должен мне 20 тысяч");
  assert.equal(owed.fields.direction, "owed");
  assert.equal(owed.fields.counterparty, "Петр");
  assert.equal(owed.fields.amount, 20000);

  const lent = parse("одолжил Ивану 3000");
  assert.equal(lent.fields.direction, "owed");
  assert.equal(lent.fields.counterparty, "Ивану");

  const borrowed = parse("занял у Петра 1500");
  assert.equal(borrowed.fields.direction, "owe");
  assert.equal(borrowed.fields.counterparty, "Петра");
  assert.equal(borrowed.fields.amount, 1500);
});

test("удаление просит подтверждение", () => {
  const last = parse("удали последний доход");
  assert.equal(last.action, "delete");
  assert.equal(last.entity, "income");
  assert.equal(last.needsConfirmation, true);
  assert.equal(last.selector.which, "last");
  assert.equal(last.selector.date, null);

  const evening = new Date("2026-11-18T21:00:00Z");
  assert.equal(samaraToday(evening), "2026-11-19");
  const yesterday = parse("удали тренировку от вчера", evening);
  assert.equal(yesterday.action, "delete");
  assert.equal(yesterday.entity, "workout");
  assert.equal(yesterday.needsConfirmation, true);
  assert.equal(yesterday.selector.date, "2026-11-18");

  const book = parse("удали книгу сапиенс");
  assert.equal(book.action, "delete");
  assert.equal(book.entity, "book");
  assert.equal(book.selector.query, "сапиенс");
});

test("сегодня и вчера считаются по Самаре", () => {
  const late = new Date("2026-11-18T20:30:00Z");
  assert.equal(samaraToday(late), "2026-11-19");
  const result = parse("тренировка бег 40 минут сегодня", late);
  assert.equal(result.fields.date, "2026-11-19");
  const prev = parse("тренировка бег 30 минут вчера", late);
  assert.equal(prev.fields.date, addDaysISO("2026-11-19", -1));
});

test("тренировки: тип и длительность", () => {
  const run = parse("тренировка бег 40 минут");
  assert.equal(run.entity, "workout");
  assert.equal(run.fields.type, "Бег");
  assert.equal(run.fields.durationMin, 40);
  assert.equal(run.fields.date, "2026-11-18");

  assert.equal(parse("пробежка полчаса").fields.durationMin, 30);
  assert.equal(parse("пробежка полчаса").fields.type, "Бег");
  assert.equal(parse("силовая 1 час 20 минут").fields.durationMin, 80);
  assert.equal(parse("силовая 1 час 20 минут").fields.type, "Силовая");
  assert.equal(parse("йога сорок пять минут").fields.durationMin, 45);
  assert.equal(parse("йога сорок пять минут").fields.type, "Йога");
});

test("книги: страницы, прогресс и прочитано", () => {
  const book = parse("книга Сапиенс 412 страниц");
  assert.equal(book.action, "create");
  assert.equal(book.fields.title, "Сапиенс");
  assert.equal(book.fields.pagesTotal, 412);
  assert.equal(book.fields.status, "reading");

  const done = parse("дочитал книгу Атомные привычки");
  assert.equal(done.action, "complete");
  assert.equal(done.fields.title, "Атомные привычки");
  assert.equal(done.fields.status, "finished");

  const progress = parse("прочитал 30 страниц атомные привычки");
  assert.equal(progress.action, "progress");
  assert.equal(progress.fields.pagesRead, 30);
  assert.match(progress.fields.title, /Атомные привычки/i);
});

test("цели и бюджет", () => {
  const goal = parse("цель накопить 300 тысяч");
  assert.equal(goal.entity, "goal");
  assert.equal(goal.fields.targetValue, 300000);
  assert.match(goal.fields.title, /Накопить/);
  assert.match(goal.fields.title, /300/);

  const done = parse("выполнил цель марафон");
  assert.equal(done.action, "complete");
  assert.equal(done.fields.status, "completed");
  assert.equal(done.selector.query, "марафон");

  const budget = parse("бюджет 80к");
  assert.equal(budget.entity, "budget");
  assert.equal(budget.fields.amount, 80000);
  assert.equal(budget.fields.month, "2026-11");

  const december = parse("бюджет на декабрь 80 тысяч");
  assert.equal(december.fields.month, "2026-12");
  assert.equal(december.fields.amount, 80000);
});

test("непонятная команда", () => {
  const result = parse("привет как дела");
  assert.equal(result.ok, false);
  assert.match(result.error, /Не разобрал/);
});

test("дату не путаем с суммой", () => {
  const result = parse("доход 5000 2026-11-02");
  assert.equal(result.fields.amount, 5000);
  assert.equal(result.fields.date, "2026-11-02");
});
