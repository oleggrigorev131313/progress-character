import { api } from "../api.js";
import { formatDateRu, formatMoney, formatXp } from "../shared/format.js";
import { el } from "./dom.js";
import { gem } from "./icons.js";

export async function renderHome() {
  const page = el("div", { class: "page" });
  try {
    const data = await api.get("/api/summary");
    const day = formatDateRu(data.today).replace(/ \d{4}$/, "");
    const level = data.level;
    const left = Math.max(0, level.nextLevelAt - level.intoLevel);
    const width = Math.max(0, Math.min(100, Math.round(level.progress * 100)));
    const finance = data.finance;
    const growth = data.growth;

    page.append(
      el("p", { class: "eyebrow", text: `Сегодня, ${day}` }),
      el(
        "section",
        { class: "level", "aria-label": "Уровень" },
        el(
          "div",
          {},
          el("p", { class: "eyebrow", text: "Уровень" }),
          el("div", { id: "level-value", class: "level-num", text: String(level.level) }),
          el("div", { class: "bar", "aria-hidden": "true" }, el("div", { class: "bar-fill", style: `width:${width}%` })),
          el(
            "p",
            { class: "level-meta" },
            el("span", { text: `${formatXp(level.intoLevel)} / ${formatXp(level.nextLevelAt)} XP` }),
            el("span", { text: `ещё ${formatXp(left)} до ${level.level + 1}` }),
          ),
        ),
        gem(),
      ),
      el("h2", { text: "Финансы" }),
      el(
        "div",
        { class: "cards" },
        card("/finance#income", "Доход за месяц", formatMoney(finance.incomeMonth), "все поступления", "income-month"),
        card("/finance#income", "Пассивный доход", formatMoney(finance.passiveMonth), "за этот месяц"),
        card("/finance#budget", "Бюджет", finance.budgetSet ? formatMoney(finance.budget) : "Не задан", "лимит на месяц"),
      ),
      finance.debtOwe || finance.debtOwed
        ? el(
            "a",
            { class: "quiet-link", href: "/finance#debts", "data-link": "true" },
            `Отдать ${formatMoney(finance.debtOwe)} · мне должны ${formatMoney(finance.debtOwed)}`,
          )
        : null,
      el("h2", { text: "Саморазвитие" }),
      el(
        "div",
        { class: "cards" },
        card("/growth?tab=books", "Книги", String(growth.booksReading), `сейчас читаю · ${growth.booksFinished} прочитано`),
        card("/growth?tab=workouts", "Тренировки", String(growth.workoutsMonth), `${formatXp(growth.workoutMinutesMonth)} мин за месяц`),
        card("/growth?tab=goals", "Цели", String(growth.goalsActive), `${growth.goalsCompleted} выполнено`),
      ),
    );
  } catch (error) {
    page.append(el("p", { class: "form-error", text: error.message }));
  }
  return page;
}

function card(href, label, value, sub, id) {
  return el(
    "a",
    { class: "card", href, "data-link": "true" },
    el("p", { class: "card-label", text: label }),
    el("p", { class: "card-value", id, text: value }),
    el("p", { class: "card-sub", text: sub }),
  );
}
