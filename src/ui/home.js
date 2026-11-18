import { api } from "../api.js";
import { formatMoney, formatWeekday, formatXp, monthName, plural } from "../shared/format.js";
import { greetingFor } from "../shared/time.js";
import { el } from "./dom.js";
import { gem, icon } from "./icons.js";

export async function renderHome() {
  const page = el("div", { class: "page overview" });
  try {
    const data = await api.get("/api/summary");
    page.append(header(data.today), levelCard(data.level), financeCard(data), growthRow(data.growth));
  } catch (error) {
    page.append(el("p", { class: "form-error", text: error.message }));
  }
  return page;
}

function header(today) {
  const day = formatDateLabel(today);
  return el(
    "header",
    { class: "hello" },
    el(
      "div",
      {},
      el("h1", { class: "hello-title" }, `${greetingFor(new Date())}, Олег`, spark()),
      el("p", { class: "hello-sub", text: "Сегодня прекрасный день для роста и новых побед." }),
    ),
    el("div", { class: "date-pill" }, icon("calendar"), el("span", { text: day })),
  );
}

function formatDateLabel(iso) {
  const [year, month, day] = iso.split("-");
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}, ${formatWeekday(iso)}`;
}

function levelCard(level) {
  const left = Math.max(0, level.nextLevelAt - level.intoLevel);
  const width = Math.max(0, Math.min(100, Math.round(level.progress * 100)));
  return el(
    "section",
    { class: "level", "aria-label": "Уровень" },
    el(
      "div",
      { class: "level-side" },
      el("p", { class: "level-kicker", text: "Уровень" }),
      el("div", { id: "level-value", class: "level-num", text: String(level.level) }),
      el("p", { class: "level-tag", text: "Постоянное улучшение — путь к лучшей версии себя." }),
    ),
    el(
      "div",
      { class: "level-xp" },
      el("p", { class: "xp-label", text: "XP" }),
      el("div", { class: "bar", "aria-hidden": "true" }, el("div", { class: "bar-fill", style: `width:${width}%` })),
      el("p", { class: "xp-total", text: `${formatXp(level.intoLevel)} / ${formatXp(level.nextLevelAt)} XP` }),
      el("p", { class: "xp-left", text: `До уровня ${level.level + 1} осталось ${formatXp(left)} XP` }),
    ),
    gem(),
  );
}

function financeCard(data) {
  const finance = data.finance;
  const month = monthName(data.month);
  return el(
    "section",
    { class: "panel" },
    el(
      "div",
      { class: "panel-head" },
      el("h2", {}, icon("wallet"), "Финансы"),
      el("a", { class: "more", href: "/finance", "data-link": "true" }, "Смотреть все →"),
    ),
    el(
      "div",
      { class: "finance-board" },
      column(
        "Доход за месяц",
        formatMoney(finance.incomeMonth),
        delta(finance.incomeMonth, finance.incomePrev, "поступлений"),
        "income-month",
      ),
      column(
        "Пассивный доход",
        formatMoney(finance.passiveMonth),
        delta(finance.passiveMonth, finance.passivePrev, "пассивного дохода"),
      ),
      budgetColumn(finance, month),
    ),
  );
}

function column(label, value, extra, id) {
  return el(
    "div",
    { class: "finance-col" },
    el("p", { class: "card-label", text: label }),
    el("p", { class: "card-value", id, text: value }),
    extra,
  );
}

function budgetColumn(finance, month) {
  if (!finance.budgetSet) {
    return el(
      "div",
      { class: "finance-col" },
      el("p", { class: "card-label", text: `Бюджет на ${month}` }),
      el("p", { class: "card-value", text: "Не задан" }),
      el("a", { class: "more", href: "/finance#budget", "data-link": "true" }, "Задать лимит →"),
    );
  }
  const ratio = finance.budget > 0 ? Math.min(100, Math.round((finance.incomeMonth / finance.budget) * 100)) : 0;
  const left = Math.max(0, finance.budget - finance.incomeMonth);
  return el(
    "div",
    { class: "finance-col" },
    el("p", { class: "card-label", text: `Бюджет на ${month}` }),
    el("p", { class: "card-value", text: `${ratio}%` }),
    el("div", { class: "bar slim", "aria-hidden": "true" }, el("div", { class: "bar-fill", style: `width:${ratio}%` })),
    el("p", { class: "budget-left", text: `Осталось ${formatMoney(left)}` }),
  );
}

function delta(current, previous, topic) {
  if (!current && !previous) return el("p", { class: "delta flat", text: `Пока нет ${topic}` });
  if (!previous) return el("p", { class: "delta flat", text: "В прошлом месяце было 0" });
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  const up = pct >= 0;
  return el("p", { class: up ? "delta up" : "delta down", text: `${up ? "↑" : "↓"} ${Math.abs(pct)}% к прошлому месяцу` });
}

function growthRow(growth) {
  const booksTotal = growth.booksReading + growth.booksFinished + growth.booksPlanned + (growth.booksPaused || 0);
  const goalsTotal = growth.goalsActive + growth.goalsCompleted;
  const workoutRatio = growth.workoutsMonth + growth.workoutsPrev;
  return el(
    "section",
    { class: "panel" },
    el("div", { class: "panel-head" }, el("h2", {}, icon("spark"), "Саморазвитие")),
    el(
      "div",
      { class: "growth-grid" },
      growthCard({
        href: "/growth?tab=books",
        icon: "book",
        title: "Книги",
        tag: "Читай. Учись. Расти.",
        progress: booksTotal ? `Прогресс · ${growth.booksFinished} / ${booksTotal} ${plural(booksTotal, "книга", "книги", "книг")}` : "Пока нет книг",
        width: booksTotal ? Math.round((growth.booksFinished / booksTotal) * 100) : 0,
      }),
      growthCard({
        href: "/growth?tab=workouts",
        icon: "dumbbell",
        title: "Тренировки",
        tag: "Тело — твой инструмент.",
        progress: growth.workoutsMonth
          ? `Прогресс · ${growth.workoutsMonth} ${plural(growth.workoutsMonth, "тренировка", "тренировки", "тренировок")} · ${formatXp(growth.workoutMinutesMonth)} мин`
          : "Пока нет тренировок за месяц",
        width: workoutRatio ? Math.round((growth.workoutsMonth / workoutRatio) * 100) : 0,
      }),
      growthCard({
        href: "/growth?tab=goals",
        icon: "target",
        title: "Цели",
        tag: "Фокус. Дисциплина. Результат.",
        progress: goalsTotal ? `Прогресс · ${growth.goalsCompleted} / ${goalsTotal} ${plural(goalsTotal, "цель", "цели", "целей")}` : "Пока нет целей",
        width: goalsTotal ? Math.round((growth.goalsCompleted / goalsTotal) * 100) : 0,
      }),
    ),
  );
}

function growthCard({ href, icon: name, title, tag, progress, width }) {
  return el(
    "a",
    { class: "growth-card", href, "data-link": "true" },
    el("span", { class: "icon-tile" }, icon(name)),
    el("p", { class: "growth-title", text: title }),
    el("p", { class: "growth-tag", text: tag }),
    el("p", { class: "growth-progress", text: progress }),
    el("div", { class: "bar slim", "aria-hidden": "true" }, el("div", { class: "bar-fill", style: `width:${width}%` })),
    el("span", { class: "more", text: "Продолжить →" }),
  );
}

function spark() {
  return icon("sparkle");
}
