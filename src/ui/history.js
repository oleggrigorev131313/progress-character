import { api } from "../api.js";
import { formatDateTimeRu, formatXp } from "../shared/format.js";
import { el, emptyState } from "./dom.js";

export async function renderHistory() {
  const page = el("div", { class: "page" });
  try {
    const data = await api.get("/api/xp?limit=80");
    page.append(
      el("p", { class: "eyebrow", text: "История" }),
      el("h1", { text: "Откуда опыт" }),
      el("p", { class: "lede", text: "Здесь только начисления по текущим записям. Если удалить доход, книгу или тренировку, опыт за них снимается." }),
      data.items.length
        ? el(
            "ul",
            { class: "rows" },
            data.items.map((item) =>
              el(
                "li",
                { class: "row" },
                el("div", {}, el("p", { class: "row-title", text: item.reason }), el("p", { class: "muted", text: formatDateTimeRu(item.createdAt) })),
                el("strong", { class: item.amount < 0 ? "neg" : "pos", text: `${item.amount > 0 ? "+" : "−"}${formatXp(Math.abs(item.amount))} XP` }),
              ),
            ),
          )
        : emptyState("Пока нет начислений. Запишите доход, тренировку или закройте цель."),
    );
  } catch (error) {
    page.append(el("p", { class: "form-error", text: error.message }));
  }
  return page;
}
