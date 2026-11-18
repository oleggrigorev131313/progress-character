import { api } from "../api.js";
import { formatMoney, formatXp, monthName, plural } from "../shared/format.js";
import { el } from "./dom.js";

export async function renderAnalytics() {
  const page = el("div", { class: "page" });
  try {
    const data = await api.get("/api/summary");
    const month = monthName(data.month);
    const books = data.growth.booksReading + data.growth.booksFinished + data.growth.booksPlanned + (data.growth.booksPaused || 0);
    page.append(
      el("p", { class: "eyebrow", text: "Аналитика" }),
      el("h1", { text: `Факты за ${month}` }),
      el("p", { class: "lede", text: "Только то, что уже записано. Пустые месяцы не дорисовываются." }),
      el(
        "div",
        { class: "stat-list" },
        stat("Доход", formatMoney(data.finance.incomeMonth), compare(data.finance.incomeMonth, data.finance.incomePrev)),
        stat("Пассивный доход", formatMoney(data.finance.passiveMonth), compare(data.finance.passiveMonth, data.finance.passivePrev)),
        stat("Бюджет", data.finance.budgetSet ? formatMoney(data.finance.budget) : "Не задан", data.finance.budgetSet ? `План на ${month}` : "Лимит ещё не задан"),
        stat("Долги", data.finance.debtOwe || data.finance.debtOwed ? `Отдать ${formatMoney(data.finance.debtOwe)}` : "Нет", data.finance.debtOwed ? `Мне должны ${formatMoney(data.finance.debtOwed)}` : "Встречных долгов нет"),
        stat("Тренировки", `${data.growth.workoutsMonth} ${plural(data.growth.workoutsMonth, "запись", "записи", "записей")}`, `${formatXp(data.growth.workoutMinutesMonth)} мин · в прошлом месяце ${data.growth.workoutsPrev}`),
        stat("Книги", `${data.growth.booksFinished} прочитано`, books ? `Всего в списке ${books}, сейчас ${data.growth.booksReading}` : "Список пуст"),
        stat("Цели", `${data.growth.goalsCompleted} выполнено`, `${data.growth.goalsActive} ещё в работе`),
        stat("Опыт", `${formatXp(data.level.total)} XP`, `Уровень ${data.level.level}`),
      ),
    );
  } catch (error) {
    page.append(el("p", { class: "form-error", text: error.message }));
  }
  return page;
}

function stat(label, value, note) {
  return el(
    "article",
    { class: "stat" },
    el("p", { class: "card-label", text: label }),
    el("p", { class: "stat-value", text: value }),
    el("p", { class: "muted", text: note }),
  );
}

function compare(current, previous) {
  if (!current && !previous) return "За оба месяца пусто";
  if (!previous) return "В прошлом месяце было 0";
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% к прошлому месяцу`;
}
