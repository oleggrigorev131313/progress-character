import { formatDateRu, formatMoney } from "../shared/format.js";
import { namesMatch, textMatches } from "../shared/text.js";
import { monthBounds, samaraMonth, samaraToday, TIMEZONE } from "../shared/time.js";
import { levelFromXp, XP, xpForIncome, xpForWorkout } from "../shared/xp.js";
import { assertPin } from "./auth.js";
import { httpError, json, nowIso, readJson } from "./http.js";
import {
  cleanAmount,
  cleanDate,
  cleanEnum,
  cleanId,
  cleanMonth,
  cleanOptionalInt,
  cleanText,
  has,
} from "./validate.js";

const INCOME_TYPES = ["active", "passive"];
const DIRECTIONS = ["owe", "owed"];
const GOAL_STATUS = ["active", "completed", "paused"];
const BOOK_STATUS = ["planned", "reading", "finished", "paused"];

function dbOf(env) {
  if (!env?.DB) throw httpError(500, "База не подключена");
  return env.DB;
}

function num(value) {
  return Number(value || 0);
}

async function xpSum(db, sourceType, sourceId) {
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events WHERE source_type = ? AND source_id = ?")
    .bind(sourceType, sourceId)
    .first();
  return num(row?.total);
}

async function addXp(db, sourceType, sourceId, code, amount, reason) {
  if (!amount) return;
  await db
    .prepare(
      "INSERT INTO xp_events (source_type, source_id, code, amount, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(sourceType, sourceId, code, amount, reason, nowIso())
    .run();
}

async function clearXp(db, sourceType, sourceId) {
  await db.prepare("DELETE FROM xp_events WHERE source_type = ? AND source_id = ?").bind(sourceType, sourceId).run();
}

async function aroundXp(db, sourceType, sourceId, run) {
  const before = await xpSum(db, sourceType, sourceId);
  await run();
  const after = await xpSum(db, sourceType, sourceId);
  return after - before;
}

async function grantIncome(db, id, amount, type) {
  await clearXp(db, "income", id);
  const xp = xpForIncome(amount, type);
  const reason = type === "passive" ? `Пассивный доход ${formatMoney(amount)}` : `Доход ${formatMoney(amount)}`;
  await addXp(db, "income", id, "income", xp, reason);
}

async function grantWorkout(db, id, duration) {
  await clearXp(db, "workout", id);
  await addXp(db, "workout", id, "workout", xpForWorkout(duration), `Тренировка ${duration} мин`);
}

async function syncBook(db, book) {
  const existing = await db
    .prepare("SELECT code FROM xp_events WHERE source_type = ? AND source_id = ?")
    .bind("book", book.id)
    .all();
  const codes = new Set(existing.results.map((row) => row.code));
  if (!codes.has("book_added")) await addXp(db, "book", book.id, "book_added", XP.bookAdded, "Книга добавлена");
  if (book.status === "finished" && !codes.has("book_finished")) {
    await addXp(db, "book", book.id, "book_finished", XP.bookFinished, `Книга прочитана: ${book.title}`);
  }
  if (book.status !== "finished" && codes.has("book_finished")) {
    await db
      .prepare("DELETE FROM xp_events WHERE source_type = ? AND source_id = ? AND code = ?")
      .bind("book", book.id, "book_finished")
      .run();
  }
}

async function syncGoal(db, goal) {
  const existing = await db
    .prepare("SELECT code FROM xp_events WHERE source_type = ? AND source_id = ?")
    .bind("goal", goal.id)
    .all();
  const codes = new Set(existing.results.map((row) => row.code));
  if (!codes.has("goal_added")) await addXp(db, "goal", goal.id, "goal_added", XP.goalAdded, "Цель создана");
  if (goal.status === "completed" && !codes.has("goal_completed")) {
    await addXp(db, "goal", goal.id, "goal_completed", XP.goalCompleted, `Цель выполнена: ${goal.title}`);
  }
  if (goal.status !== "completed" && codes.has("goal_completed")) {
    await db
      .prepare("DELETE FROM xp_events WHERE source_type = ? AND source_id = ? AND code = ?")
      .bind("goal", goal.id, "goal_completed")
      .run();
  }
}

async function removeEntity(db, table, sourceType, id) {
  const xpRemoved = await xpSum(db, sourceType, id);
  const deleted = await db.batch([
    db.prepare("DELETE FROM xp_events WHERE source_type = ? AND source_id = ?").bind(sourceType, id),
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id),
  ]);
  if (!num(deleted[1]?.meta?.changes)) throw httpError(404, "Не найдено");
  return xpRemoved;
}

function incomeItem(row) {
  return {
    id: row.id,
    amount: num(row.amount),
    type: row.type,
    description: row.description,
    date: row.occurred_on,
    createdAt: row.created_at,
  };
}

function debtItem(row) {
  const amount = num(row.amount);
  const paid = num(row.paid);
  return {
    id: row.id,
    counterparty: row.counterparty,
    direction: row.direction,
    amount,
    paid,
    remaining: Math.max(0, amount - paid),
    note: row.note,
    createdAt: row.created_at,
  };
}

function goalItem(row) {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    targetValue: row.target_value == null ? null : num(row.target_value),
    currentValue: num(row.current_value),
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function bookItem(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    status: row.status,
    pagesTotal: row.pages_total == null ? null : num(row.pages_total),
    pagesRead: num(row.pages_read),
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function workoutItem(row) {
  return {
    id: row.id,
    type: row.type,
    durationMin: num(row.duration_min),
    date: row.occurred_on,
    note: row.note,
    createdAt: row.created_at,
  };
}

function incomeLabel(row) {
  const item = incomeItem(row);
  const kind = item.type === "passive" ? "Пассивный доход" : "Доход";
  const desc = item.description ? ` · ${item.description}` : "";
  return `${kind} ${formatMoney(item.amount)} · ${formatDateRu(item.date)}${desc}`;
}

function debtLabel(row) {
  const item = debtItem(row);
  const who = item.direction === "owed" ? "мне должны" : "я должен";
  return `${item.counterparty} · ${who} · остаток ${formatMoney(item.remaining)}`;
}

function bookLabel(row) {
  const item = bookItem(row);
  const status = { planned: "в планах", reading: "читаю", finished: "прочитана", paused: "пауза" }[item.status];
  return `${item.title} · ${status}`;
}

function goalLabel(row) {
  const item = goalItem(row);
  const status = { active: "активна", completed: "выполнена", paused: "пауза" }[item.status];
  return `${item.title} · ${status}`;
}

function workoutLabel(row) {
  const item = workoutItem(row);
  return `${item.type} · ${item.durationMin} мин · ${formatDateRu(item.date)}`;
}

function applyWhich(rows, which) {
  if (which === "last") return rows.slice(0, 1);
  if (which === "first") return rows.slice(-1);
  return rows;
}

async function listByDate(db, table, date) {
  const sql = date
    ? `SELECT * FROM ${table} WHERE occurred_on = ? ORDER BY occurred_on DESC, id DESC`
    : `SELECT * FROM ${table} ORDER BY occurred_on DESC, id DESC LIMIT 300`;
  const query = db.prepare(sql);
  const result = date ? await query.bind(date).all() : await query.all();
  return result.results;
}

async function matchEntity(db, entity, selector) {
  const which = selector.which || null;
  const date = selector.date || null;
  const query = String(selector.query || "").trim();
  let rows = [];

  if (entity === "income") {
    rows = await listByDate(db, "income", date);
    if (query) rows = rows.filter((row) => textMatches(row.description, query));
    return applyWhich(rows, which).slice(0, 20).map((row) => ({ id: row.id, label: incomeLabel(row), item: incomeItem(row) }));
  }
  if (entity === "workout") {
    rows = await listByDate(db, "workouts", date);
    if (query) rows = rows.filter((row) => textMatches(`${row.type} ${row.note}`, query));
    return applyWhich(rows, which).slice(0, 20).map((row) => ({ id: row.id, label: workoutLabel(row), item: workoutItem(row) }));
  }
  if (entity === "debt") {
    rows = (await db.prepare("SELECT * FROM debts ORDER BY id DESC").all()).results;
    if (query) {
      rows = rows.filter(
        (row) => namesMatch(row.counterparty, query) || textMatches(row.counterparty, query) || textMatches(row.note, query),
      );
    }
    return applyWhich(rows, which).slice(0, 20).map((row) => ({ id: row.id, label: debtLabel(row), item: debtItem(row) }));
  }
  if (entity === "book") {
    rows = (await db.prepare("SELECT * FROM books ORDER BY id DESC").all()).results;
    if (query) rows = rows.filter((row) => textMatches(`${row.title} ${row.author}`, query));
    return applyWhich(rows, which).slice(0, 20).map((row) => ({ id: row.id, label: bookLabel(row), item: bookItem(row) }));
  }
  if (entity === "goal") {
    rows = (await db.prepare("SELECT * FROM goals ORDER BY id DESC").all()).results;
    if (query) rows = rows.filter((row) => textMatches(row.title, query));
    return applyWhich(rows, which).slice(0, 20).map((row) => ({ id: row.id, label: goalLabel(row), item: goalItem(row) }));
  }
  if (entity === "budget") {
    const month = selector.month || (date ? date.slice(0, 7) : samaraMonth());
    const row = await db.prepare("SELECT * FROM budgets WHERE month = ?").bind(cleanMonth(month)).first();
    if (!row) return [];
    return [{
      id: row.id,
      label: `Бюджет ${row.month} · ${formatMoney(row.amount)}`,
      item: { id: row.id, month: row.month, amount: num(row.amount) },
    }];
  }
  throw httpError(400, "Неизвестная сущность");
}

async function summary(db) {
  const today = samaraToday();
  const month = samaraMonth();
  const bounds = monthBounds(month);
  const [income, budget, debts, xp, books, goals, workouts] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total,
                COALESCE(SUM(CASE WHEN type = 'passive' THEN amount ELSE 0 END), 0) AS passive
         FROM income WHERE occurred_on >= ? AND occurred_on < ?`,
      )
      .bind(bounds.start, bounds.end)
      .first(),
    db.prepare("SELECT amount FROM budgets WHERE month = ?").bind(month).first(),
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN direction = 'owe' THEN amount - paid ELSE 0 END), 0) AS owe,
                COALESCE(SUM(CASE WHEN direction = 'owed' THEN amount - paid ELSE 0 END), 0) AS owed
         FROM debts`,
      )
      .first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events").first(),
    db.prepare("SELECT status, COUNT(*) AS n FROM books GROUP BY status").all(),
    db.prepare("SELECT status, COUNT(*) AS n FROM goals GROUP BY status").all(),
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(duration_min), 0) AS minutes
         FROM workouts WHERE occurred_on >= ? AND occurred_on < ?`,
      )
      .bind(bounds.start, bounds.end)
      .first(),
  ]);

  const bookCounts = { planned: 0, reading: 0, finished: 0, paused: 0 };
  for (const row of books.results) bookCounts[row.status] = num(row.n);
  const goalCounts = { active: 0, completed: 0, paused: 0 };
  for (const row of goals.results) goalCounts[row.status] = num(row.n);

  return {
    timezone: TIMEZONE,
    today,
    month,
    level: levelFromXp(num(xp?.total)),
    finance: {
      incomeMonth: num(income?.total),
      passiveMonth: num(income?.passive),
      budget: budget ? num(budget.amount) : 0,
      budgetSet: Boolean(budget),
      debtOwe: num(debts?.owe),
      debtOwed: num(debts?.owed),
    },
    growth: {
      booksReading: bookCounts.reading,
      booksFinished: bookCounts.finished,
      booksPlanned: bookCounts.planned,
      workoutsMonth: num(workouts?.n),
      workoutMinutesMonth: num(workouts?.minutes),
      goalsActive: goalCounts.active,
      goalsCompleted: goalCounts.completed,
    },
  };
}

function readIncome(body, fallbackDate) {
  return {
    amount: cleanAmount(body.amount),
    type: cleanEnum(body.type || "active", INCOME_TYPES),
    description: cleanText(body.description, 300),
    date: cleanDate(body.date, fallbackDate),
  };
}

function readDebt(body, current = null) {
  const amount = has(body, "amount") || !current ? cleanAmount(body.amount) : num(current.amount);
  const paid = has(body, "paid") ? cleanAmount(body.paid, { allowZero: true }) : num(current?.paid);
  if (paid > amount) throw httpError(400, "Оплачено больше суммы долга");
  return {
    counterparty: has(body, "counterparty") || !current ? cleanText(body.counterparty, 120, true) : current.counterparty,
    direction: cleanEnum(body.direction || current?.direction || "owe", DIRECTIONS),
    amount,
    paid,
    note: has(body, "note") || !current ? cleanText(body.note, 300) : current.note,
  };
}

function readGoal(body, current, now) {
  const status = cleanEnum(body.status || current?.status || "active", GOAL_STATUS);
  const targetValue = has(body, "targetValue")
    ? cleanOptionalInt(body.targetValue)
    : current
      ? current.target_value
      : null;
  const currentValue = has(body, "currentValue")
    ? cleanAmount(body.currentValue ?? 0, { allowZero: true })
    : num(current?.current_value);
  let completedAt = current?.completed_at || null;
  if (status === "completed") completedAt = completedAt || now;
  else completedAt = null;
  return {
    title: has(body, "title") || !current ? cleanText(body.title, 200, true) : current.title,
    details: has(body, "details") || !current ? cleanText(body.details, 500) : current.details,
    targetValue,
    currentValue,
    status,
    completedAt,
  };
}

function readBook(body, current, now) {
  let status = cleanEnum(body.status || current?.status || "reading", BOOK_STATUS);
  let pagesTotal = has(body, "pagesTotal")
    ? cleanOptionalInt(body.pagesTotal)
    : current
      ? current.pages_total
      : null;
  let pagesRead = has(body, "pagesRead")
    ? cleanAmount(body.pagesRead ?? 0, { allowZero: true })
    : num(current?.pages_read);
  if (status === "finished" && pagesTotal && pagesRead < pagesTotal) pagesRead = pagesTotal;
  if (pagesTotal != null && pagesRead > pagesTotal) throw httpError(400, "Прочитано больше объёма книги");
  let finishedAt = current?.finished_at || null;
  if (status === "finished") finishedAt = finishedAt || now;
  else finishedAt = null;
  return {
    title: has(body, "title") || !current ? cleanText(body.title, 200, true) : current.title,
    author: has(body, "author") || !current ? cleanText(body.author, 120) : current.author,
    status,
    pagesTotal,
    pagesRead,
    finishedAt,
  };
}

function readWorkout(body, fallbackDate) {
  const duration = cleanAmount(body.durationMin, { allowZero: false });
  if (duration > 1440) throw httpError(400, "Слишком длинная тренировка");
  return {
    type: cleanText(body.type, 80, true),
    durationMin: duration,
    date: cleanDate(body.date, fallbackDate),
    note: cleanText(body.note, 300),
  };
}

async function requireRow(db, table, id) {
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) throw httpError(404, "Не найдено");
  return row;
}

export async function handleApi(request, env) {
  try {
    await assertPin(request, env);
    return await route(request, env);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error(JSON.stringify({ level: "error", message: error?.message || "error" }));
    }
    return json({ error: status >= 500 ? "Внутренняя ошибка" : error.message }, status);
  }
}

async function route(request, env) {
  const db = dbOf(env);
  const url = new URL(request.url);
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const method = request.method.toUpperCase();
  const today = samaraToday();

  if (path === "/api/health" && method === "GET") {
    await db.prepare("SELECT 1 AS ok").first();
    return json({ ok: true, timezone: TIMEZONE });
  }
  if (path === "/api/summary" && method === "GET") return json(await summary(db));
  if (path === "/api/xp" && method === "GET") {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 80));
    const rows = await db
      .prepare("SELECT id, source_type, source_id, code, amount, reason, created_at FROM xp_events ORDER BY created_at DESC, id DESC LIMIT ?")
      .bind(limit)
      .all();
    return json({
      items: rows.results.map((row) => ({
        id: row.id,
        sourceType: row.source_type,
        sourceId: row.source_id,
        code: row.code,
        amount: num(row.amount),
        reason: row.reason,
        createdAt: row.created_at,
      })),
    });
  }
  if (path === "/api/match" && method === "POST") {
    const body = await readJson(request);
    const matches = await matchEntity(db, body.entity, body.selector || {});
    return json({ matches });
  }

  if (path === "/api/budget") {
    const month = cleanMonth(url.searchParams.get("month") || (method === "GET" ? samaraMonth() : null), samaraMonth());
    if (method === "GET") {
      const row = await db.prepare("SELECT * FROM budgets WHERE month = ?").bind(month).first();
      return json({ month, amount: row ? num(row.amount) : 0, set: Boolean(row) });
    }
    if (method === "PUT") {
      const body = await readJson(request);
      const target = cleanMonth(body.month, month);
      const amount = cleanAmount(body.amount, { allowZero: true });
      const stamp = nowIso();
      await db
        .prepare(
          `INSERT INTO budgets (month, amount, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(month) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
        )
        .bind(target, amount, stamp)
        .run();
      return json({ month: target, amount, set: true });
    }
    if (method === "DELETE") {
      await db.prepare("DELETE FROM budgets WHERE month = ?").bind(month).run();
      return json({ ok: true, xpRemoved: 0 });
    }
  }

  const resource = path.match(/^\/api\/(income|debts|goals|books|workouts)(?:\/(\d+))?$/);
  if (!resource) return json({ error: "Не найдено" }, 404);
  const [, name, rawId] = resource;
  const id = rawId ? cleanId(rawId) : null;

  if (name === "income") {
    if (method === "GET" && !id) {
      const month = url.searchParams.get("month");
      let rows;
      if (month) {
        const bounds = monthBounds(cleanMonth(month));
        rows = await db
          .prepare("SELECT * FROM income WHERE occurred_on >= ? AND occurred_on < ? ORDER BY occurred_on DESC, id DESC LIMIT 300")
          .bind(bounds.start, bounds.end)
          .all();
      } else {
        rows = await db.prepare("SELECT * FROM income ORDER BY occurred_on DESC, id DESC LIMIT 300").all();
      }
      return json({ items: rows.results.map(incomeItem) });
    }
    if (method === "POST" && !id) {
      const data = readIncome(await readJson(request), today);
      const inserted = await db
        .prepare("INSERT INTO income (amount, type, description, occurred_on, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(data.amount, data.type, data.description, data.date, nowIso())
        .run();
      const newId = num(inserted.meta?.last_row_id);
      const xpGained = await aroundXp(db, "income", newId, () => grantIncome(db, newId, data.amount, data.type));
      const row = await requireRow(db, "income", newId);
      return json({ item: incomeItem(row), xpGained }, 201);
    }
    if (id && method === "PATCH") {
      const current = await requireRow(db, "income", id);
      const body = await readJson(request);
      const data = readIncome(
        {
          amount: has(body, "amount") ? body.amount : current.amount,
          type: has(body, "type") ? body.type : current.type,
          description: has(body, "description") ? body.description : current.description,
          date: has(body, "date") ? body.date : current.occurred_on,
        },
        today,
      );
      await db
        .prepare("UPDATE income SET amount = ?, type = ?, description = ?, occurred_on = ? WHERE id = ?")
        .bind(data.amount, data.type, data.description, data.date, id)
        .run();
      let xpDelta = 0;
      if (data.amount !== num(current.amount) || data.type !== current.type) {
        xpDelta = await aroundXp(db, "income", id, () => grantIncome(db, id, data.amount, data.type));
      }
      return json({ item: incomeItem(await requireRow(db, "income", id)), xpDelta });
    }
    if (id && method === "DELETE") {
      await requireRow(db, "income", id);
      const xpRemoved = await removeEntity(db, "income", "income", id);
      return json({ ok: true, xpRemoved });
    }
  }

  if (name === "debts") {
    if (method === "GET" && !id) {
      const rows = await db.prepare("SELECT * FROM debts ORDER BY id DESC").all();
      const items = rows.results.map(debtItem).sort((a, b) => Number(b.remaining > 0) - Number(a.remaining > 0) || b.id - a.id);
      return json({ items });
    }
    if (method === "POST" && !id) {
      const data = readDebt(await readJson(request));
      const inserted = await db
        .prepare("INSERT INTO debts (counterparty, direction, amount, paid, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(data.counterparty, data.direction, data.amount, data.paid, data.note, nowIso())
        .run();
      const row = await requireRow(db, "debts", num(inserted.meta?.last_row_id));
      return json({ item: debtItem(row), xpGained: 0 }, 201);
    }
    if (id && method === "PATCH") {
      const current = await requireRow(db, "debts", id);
      const data = readDebt(await readJson(request), current);
      await db
        .prepare("UPDATE debts SET counterparty = ?, direction = ?, amount = ?, paid = ?, note = ? WHERE id = ?")
        .bind(data.counterparty, data.direction, data.amount, data.paid, data.note, id)
        .run();
      return json({ item: debtItem(await requireRow(db, "debts", id)), xpDelta: 0 });
    }
    if (id && method === "DELETE") {
      await requireRow(db, "debts", id);
      const xpRemoved = await removeEntity(db, "debts", "debt", id);
      return json({ ok: true, xpRemoved });
    }
  }

  if (name === "goals") {
    if (method === "GET" && !id) {
      const rows = await db
        .prepare(
          `SELECT * FROM goals ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, id DESC`,
        )
        .all();
      return json({ items: rows.results.map(goalItem) });
    }
    if (method === "POST" && !id) {
      const data = readGoal(await readJson(request), null, nowIso());
      const inserted = await db
        .prepare(
          `INSERT INTO goals (title, details, target_value, current_value, status, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(data.title, data.details, data.targetValue, data.currentValue, data.status, nowIso(), data.completedAt)
        .run();
      const newId = num(inserted.meta?.last_row_id);
      const row = await requireRow(db, "goals", newId);
      const xpGained = await aroundXp(db, "goal", newId, () => syncGoal(db, row));
      return json({ item: goalItem(await requireRow(db, "goals", newId)), xpGained }, 201);
    }
    if (id && method === "PATCH") {
      const current = await requireRow(db, "goals", id);
      const data = readGoal(await readJson(request), current, nowIso());
      await db
        .prepare(
          `UPDATE goals SET title = ?, details = ?, target_value = ?, current_value = ?, status = ?, completed_at = ? WHERE id = ?`,
        )
        .bind(data.title, data.details, data.targetValue, data.currentValue, data.status, data.completedAt, id)
        .run();
      const xpDelta = await aroundXp(db, "goal", id, async () => syncGoal(db, await requireRow(db, "goals", id)));
      return json({ item: goalItem(await requireRow(db, "goals", id)), xpDelta });
    }
    if (id && method === "DELETE") {
      await requireRow(db, "goals", id);
      const xpRemoved = await removeEntity(db, "goals", "goal", id);
      return json({ ok: true, xpRemoved });
    }
  }

  if (name === "books") {
    if (method === "GET" && !id) {
      const rows = await db
        .prepare(
          `SELECT * FROM books ORDER BY CASE status WHEN 'reading' THEN 0 WHEN 'planned' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, id DESC`,
        )
        .all();
      return json({ items: rows.results.map(bookItem) });
    }
    if (method === "POST" && !id) {
      const data = readBook(await readJson(request), null, nowIso());
      const inserted = await db
        .prepare(
          `INSERT INTO books (title, author, status, pages_total, pages_read, created_at, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(data.title, data.author, data.status, data.pagesTotal, data.pagesRead, nowIso(), data.finishedAt)
        .run();
      const newId = num(inserted.meta?.last_row_id);
      const xpGained = await aroundXp(db, "book", newId, async () => syncBook(db, await requireRow(db, "books", newId)));
      return json({ item: bookItem(await requireRow(db, "books", newId)), xpGained }, 201);
    }
    if (id && method === "PATCH") {
      const current = await requireRow(db, "books", id);
      const data = readBook(await readJson(request), current, nowIso());
      await db
        .prepare(
          `UPDATE books SET title = ?, author = ?, status = ?, pages_total = ?, pages_read = ?, finished_at = ? WHERE id = ?`,
        )
        .bind(data.title, data.author, data.status, data.pagesTotal, data.pagesRead, data.finishedAt, id)
        .run();
      const xpDelta = await aroundXp(db, "book", id, async () => syncBook(db, await requireRow(db, "books", id)));
      return json({ item: bookItem(await requireRow(db, "books", id)), xpDelta });
    }
    if (id && method === "DELETE") {
      await requireRow(db, "books", id);
      const xpRemoved = await removeEntity(db, "books", "book", id);
      return json({ ok: true, xpRemoved });
    }
  }

  if (name === "workouts") {
    if (method === "GET" && !id) {
      const month = url.searchParams.get("month");
      let rows;
      if (month) {
        const bounds = monthBounds(cleanMonth(month));
        rows = await db
          .prepare("SELECT * FROM workouts WHERE occurred_on >= ? AND occurred_on < ? ORDER BY occurred_on DESC, id DESC LIMIT 300")
          .bind(bounds.start, bounds.end)
          .all();
      } else {
        rows = await db.prepare("SELECT * FROM workouts ORDER BY occurred_on DESC, id DESC LIMIT 300").all();
      }
      return json({ items: rows.results.map(workoutItem) });
    }
    if (method === "POST" && !id) {
      const data = readWorkout(await readJson(request), today);
      const inserted = await db
        .prepare("INSERT INTO workouts (type, duration_min, occurred_on, note, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(data.type, data.durationMin, data.date, data.note, nowIso())
        .run();
      const newId = num(inserted.meta?.last_row_id);
      const xpGained = await aroundXp(db, "workout", newId, () => grantWorkout(db, newId, data.durationMin));
      return json({ item: workoutItem(await requireRow(db, "workouts", newId)), xpGained }, 201);
    }
    if (id && method === "PATCH") {
      const current = await requireRow(db, "workouts", id);
      const body = await readJson(request);
      const data = readWorkout(
        {
          type: has(body, "type") ? body.type : current.type,
          durationMin: has(body, "durationMin") ? body.durationMin : current.duration_min,
          date: has(body, "date") ? body.date : current.occurred_on,
          note: has(body, "note") ? body.note : current.note,
        },
        today,
      );
      await db
        .prepare("UPDATE workouts SET type = ?, duration_min = ?, occurred_on = ?, note = ? WHERE id = ?")
        .bind(data.type, data.durationMin, data.date, data.note, id)
        .run();
      let xpDelta = 0;
      if (data.durationMin !== num(current.duration_min)) {
        xpDelta = await aroundXp(db, "workout", id, () => grantWorkout(db, id, data.durationMin));
      }
      return json({ item: workoutItem(await requireRow(db, "workouts", id)), xpDelta });
    }
    if (id && method === "DELETE") {
      await requireRow(db, "workouts", id);
      const xpRemoved = await removeEntity(db, "workouts", "workout", id);
      return json({ ok: true, xpRemoved });
    }
  }

  return json({ error: "Метод не поддерживается" }, 405);
}
