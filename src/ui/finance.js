import { api } from "../api.js";
import { formatDateRu, formatMoney, formatMonthRu } from "../shared/format.js";
import { samaraMonth, samaraToday, shiftMonth } from "../shared/time.js";
import { dateInput, el, emptyState, errorLine, field, numInput, selectInput, showError, textInput, xpNote } from "./dom.js";

export async function renderFinance() {
  const page = el("div", { class: "page" });
  const month = new URLSearchParams(location.search).get("month") || samaraMonth();
  try {
    const [incomes, debts, budget] = await Promise.all([
      api.get(`/api/income?month=${month}`),
      api.get("/api/debts"),
      api.get(`/api/budget?month=${month}`),
    ]);
    page.append(
      head(month),
      budgetBlock(budget, month),
      incomeBlock(incomes.items, month),
      debtBlock(debts.items),
    );
  } catch (error) {
    page.append(el("p", { class: "form-error", text: error.message }));
  }
  return page;
}

function head(month) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return el(
    "div",
    { class: "page-head" },
    el("div", {}, el("p", { class: "eyebrow", text: "Финансы" }), el("h1", { text: formatMonthRu(month) })),
    el(
      "div",
      { class: "month-nav" },
      el("a", { class: "btn ghost", href: `/finance?month=${prev}`, "data-link": "true" }, "←"),
      el("a", { class: "btn ghost", href: `/finance?month=${next}`, "data-link": "true" }, "→"),
    ),
  );
}

function budgetBlock(budget, month) {
  const input = numInput({ value: budget.amount || "", required: true });
  const error = errorLine();
    const form = el(
      "form",
      { class: "editor" },
    field("Сумма на месяц, ₽", input),
    error,
    el("button", { class: "btn", type: "submit" }, budget.set ? "Обновить бюджет" : "Задать бюджет"),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(error, "");
    try {
      await api.put("/api/budget", { month, amount: Number(input.value) });
      xpNote("Бюджет сохранён", 0);
      document.dispatchEvent(new CustomEvent("data-changed"));
    } catch (errorValue) {
      showError(error, errorValue.message);
    }
  });
  const remove = el("button", { class: "text-btn danger", type: "button" }, "Удалить бюджет месяца");
  remove.addEventListener("click", async () => {
    if (remove.dataset.armed !== "1") {
      remove.dataset.armed = "1";
      remove.textContent = "Точно удалить бюджет";
      return;
    }
    await api.del(`/api/budget?month=${month}`);
    document.dispatchEvent(new CustomEvent("data-changed"));
  });
  const section = el("section", { id: "budget", class: "block" }, el("h2", { text: "Бюджет" }), form, budget.set ? remove : null);
  return section;
}

function incomeBlock(items, month) {
  let editing = null;
  const host = el("div");
  const section = el("section", { id: "income", class: "block" }, el("h2", { text: "Доходы" }), host);

  const draw = () => {
    host.replaceChildren(incomeForm(), list());
  };

  function incomeForm() {
    const amount = numInput({ value: editing?.amount ?? "" });
    const type = selectInput({}, [["active", "Активный"], ["passive", "Пассивный"]], editing?.type || "active");
    const description = textInput({ value: editing?.description || "" });
    const date = dateInput({ value: editing?.date || samaraToday() });
    const error = errorLine();
    const form = el(
      "form",
      { class: "editor" },
      el("div", { class: "grid-form" }, field("Сумма, ₽", amount), field("Тип", type), field("Дата", date), field("Описание", description)),
      error,
      el(
        "div",
        { class: "row-actions" },
        el("button", { class: "btn", type: "submit" }, editing ? "Сохранить" : "Добавить доход"),
        editing ? el("button", { class: "btn ghost", type: "button", onClick: () => { editing = null; draw(); } }, "Отмена") : null,
      ),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError(error, "");
      const payload = { amount: Number(amount.value), type: type.value, description: description.value.trim(), date: date.value };
      try {
        const result = editing ? await api.patch(`/api/income/${editing.id}`, payload) : await api.post("/api/income", payload);
        xpNote(editing ? "Сохранено" : "Доход записан", editing ? result.xpDelta : result.xpGained);
        document.dispatchEvent(new CustomEvent("data-changed"));
      } catch (errorValue) {
        showError(error, errorValue.message);
      }
    });
    return form;
  }

  function list() {
    if (!items.length) return emptyState("Пока нет доходов за этот месяц.");
    return el(
      "ul",
      { class: "rows" },
      items.map((item) => {
        const remove = el("button", { class: "text-btn danger", type: "button" }, "Удалить");
        remove.addEventListener("click", async () => {
          if (remove.dataset.armed !== "1") {
            remove.dataset.armed = "1";
            remove.textContent = "Точно удалить";
            return;
          }
          const result = await api.del(`/api/income/${item.id}`);
          xpNote("Удалено", result.xpRemoved ? -result.xpRemoved : 0);
          document.dispatchEvent(new CustomEvent("data-changed"));
        });
        return el(
          "li",
          { class: "row" },
          el(
            "div",
            {},
            el("p", { class: "row-title", text: item.description || "Без описания" }),
            el("p", { class: "muted", text: `${item.type === "passive" ? "Пассивный" : "Активный"} · ${formatDateRu(item.date)}` }),
          ),
          el("div", { class: "row-side" }, el("strong", { text: formatMoney(item.amount) }), el("div", { class: "row-actions" }, el("button", { class: "text-btn", type: "button", onClick: () => { editing = item; draw(); section.scrollIntoView({ block: "start" }); } }, "Изменить"), remove)),
        );
      }),
    );
  }

  draw();
  return section;
}

function debtBlock(items) {
  let editing = null;
  const host = el("div");
  const section = el("section", { id: "debts", class: "block" }, el("h2", { text: "Долги" }), host);

  const draw = () => host.replaceChildren(form(), list());

  function form() {
    const counterparty = textInput({ value: editing?.counterparty || "" });
    const direction = selectInput({}, [["owe", "Я должен"], ["owed", "Мне должны"]], editing?.direction || "owe");
    const amount = numInput({ value: editing?.amount ?? "" });
    const paid = numInput({ value: editing?.paid ?? 0 });
    const note = textInput({ value: editing?.note || "" });
    const error = errorLine();
    const node = el(
      "form",
      { class: "editor" },
      el("div", { class: "grid-form" }, field("Кто", counterparty), field("Направление", direction), field("Сумма, ₽", amount), field("Оплачено, ₽", paid), field("Заметка", note)),
      error,
      el(
        "div",
        { class: "row-actions" },
        el("button", { class: "btn", type: "submit" }, editing ? "Сохранить" : "Добавить долг"),
        editing ? el("button", { class: "btn ghost", type: "button", onClick: () => { editing = null; draw(); } }, "Отмена") : null,
      ),
    );
    node.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError(error, "");
      const payload = {
        counterparty: counterparty.value.trim(),
        direction: direction.value,
        amount: Number(amount.value),
        paid: Number(paid.value || 0),
        note: note.value.trim(),
      };
      try {
        if (editing) await api.patch(`/api/debts/${editing.id}`, payload);
        else await api.post("/api/debts", payload);
        xpNote(editing ? "Сохранено" : "Долг записан", 0);
        document.dispatchEvent(new CustomEvent("data-changed"));
      } catch (errorValue) {
        showError(error, errorValue.message);
      }
    });
    return node;
  }

  function list() {
    if (!items.length) return emptyState("Долгов нет.");
    return el(
      "ul",
      { class: "rows" },
      items.map((item) => {
        const remove = el("button", { class: "text-btn danger", type: "button" }, "Удалить");
        remove.addEventListener("click", async () => {
          if (remove.dataset.armed !== "1") {
            remove.dataset.armed = "1";
            remove.textContent = "Точно удалить";
            return;
          }
          await api.del(`/api/debts/${item.id}`);
          document.dispatchEvent(new CustomEvent("data-changed"));
        });
        return el(
          "li",
          { class: "row" },
          el(
            "div",
            {},
            el("p", { class: "row-title", text: item.counterparty }),
            el("p", { class: "muted", text: `${item.direction === "owed" ? "Мне должны" : "Я должен"} · остаток ${formatMoney(item.remaining)}${item.note ? ` · ${item.note}` : ""}` }),
          ),
          el("div", { class: "row-side" }, el("strong", { text: formatMoney(item.amount) }), el("div", { class: "row-actions" }, el("button", { class: "text-btn", type: "button", onClick: () => { editing = item; draw(); } }, "Изменить"), remove)),
        );
      }),
    );
  }

  draw();
  return section;
}
