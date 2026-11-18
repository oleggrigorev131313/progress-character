import { api } from "../api.js";
import { formatDateRu } from "../shared/format.js";
import { samaraToday } from "../shared/time.js";
import { dateInput, el, emptyState, errorLine, field, numInput, selectInput, showError, textInput, xpNote } from "./dom.js";

const TABS = [
  ["books", "Книги"],
  ["workouts", "Тренировки"],
  ["goals", "Цели"],
];

export async function renderGrowth() {
  const page = el("div", { class: "page" });
  const tab = new URLSearchParams(location.search).get("tab") || "books";
  const active = TABS.some(([id]) => id === tab) ? tab : "books";
  try {
    const [books, workouts, goals] = await Promise.all([
      api.get("/api/books"),
      api.get("/api/workouts"),
      api.get("/api/goals"),
    ]);
    page.append(
      el("p", { class: "eyebrow", text: "Саморазвитие" }),
      el("h1", { text: "Книги, тренировки, цели" }),
      el(
        "div",
        { class: "tabs", role: "tablist" },
        TABS.map(([id, label]) =>
          el("a", { class: `tab${id === active ? " is-on" : ""}`, href: `/growth?tab=${id}`, "data-link": "true", role: "tab" }, label),
        ),
      ),
      active === "books" ? booksBlock(books.items) : null,
      active === "workouts" ? workoutsBlock(workouts.items) : null,
      active === "goals" ? goalsBlock(goals.items) : null,
    );
  } catch (error) {
    page.append(el("p", { class: "form-error", text: error.message }));
  }
  return page;
}

function booksBlock(items) {
  return entitySection({
    id: "books",
    addLabel: "Добавить книгу",
    empty: "Пока нет книг.",
    items,
    blank: () => ({ title: "", author: "", status: "reading", pagesRead: 0, pagesTotal: "" }),
    fields: (draft) => {
      const title = textInput({ value: draft.title });
      const author = textInput({ value: draft.author || "" });
      const status = selectInput({}, [["planned", "В планах"], ["reading", "Читаю"], ["finished", "Прочитана"], ["paused", "Пауза"]], draft.status);
      const pagesRead = numInput({ value: draft.pagesRead ?? 0 });
      const pagesTotal = numInput({ value: draft.pagesTotal ?? "" });
      return {
        nodes: [field("Название", title), field("Автор", author), field("Статус", status), field("Прочитано", pagesRead), field("Всего страниц", pagesTotal)],
        read: () => ({
          title: title.value.trim(),
          author: author.value.trim(),
          status: status.value,
          pagesRead: Number(pagesRead.value || 0),
          pagesTotal: pagesTotal.value === "" ? null : Number(pagesTotal.value),
        }),
      };
    },
    path: "/api/books",
    row: (item) => ({
      title: item.title,
      meta: `${statusBook(item.status)}${item.author ? ` · ${item.author}` : ""}${item.pagesTotal ? ` · ${item.pagesRead}/${item.pagesTotal}` : ""}`,
      extra: item.pagesTotal ? bar(item.pagesRead, item.pagesTotal) : null,
    }),
    toDraft: (item) => ({ ...item, pagesTotal: item.pagesTotal ?? "" }),
  });
}

function workoutsBlock(items) {
  return entitySection({
    id: "workouts",
    addLabel: "Добавить тренировку",
    empty: "Тренировок пока нет.",
    items,
    blank: () => ({ type: "", durationMin: "", date: samaraToday(), note: "" }),
    fields: (draft) => {
      const type = textInput({ value: draft.type, list: "workout-types" });
      const durationMin = numInput({ value: draft.durationMin });
      const date = dateInput({ value: draft.date || samaraToday() });
      const note = textInput({ value: draft.note || "" });
      const list = el("datalist", { id: "workout-types" }, ["Бег", "Силовая", "Йога", "Плавание", "Растяжка", "Велосипед", "Ходьба", "Зал"].map((name) => el("option", { value: name })));
      return {
        nodes: [field("Тип", type), field("Минуты", durationMin), field("Дата", date), field("Заметка", note), list],
        read: () => ({ type: type.value.trim(), durationMin: Number(durationMin.value), date: date.value, note: note.value.trim() }),
      };
    },
    path: "/api/workouts",
    row: (item) => ({
      title: item.type,
      meta: `${item.durationMin} мин · ${formatDateRu(item.date)}${item.note ? ` · ${item.note}` : ""}`,
    }),
    toDraft: (item) => item,
  });
}

function goalsBlock(items) {
  return entitySection({
    id: "goals",
    addLabel: "Добавить цель",
    empty: "Целей пока нет.",
    items,
    blank: () => ({ title: "", targetValue: "", currentValue: 0, status: "active", details: "" }),
    fields: (draft) => {
      const title = textInput({ value: draft.title });
      const targetValue = numInput({ value: draft.targetValue ?? "" });
      const currentValue = numInput({ value: draft.currentValue ?? 0 });
      const status = selectInput({}, [["active", "Активна"], ["completed", "Выполнена"], ["paused", "Пауза"]], draft.status);
      const details = textInput({ value: draft.details || "" });
      return {
        nodes: [field("Название", title), field("Цель", targetValue), field("Сейчас", currentValue), field("Статус", status), field("Детали", details)],
        read: () => ({
          title: title.value.trim(),
          targetValue: targetValue.value === "" ? null : Number(targetValue.value),
          currentValue: Number(currentValue.value || 0),
          status: status.value,
          details: details.value.trim(),
        }),
      };
    },
    path: "/api/goals",
    row: (item) => ({
      title: item.title,
      meta: `${statusGoal(item.status)}${item.targetValue ? ` · ${item.currentValue} из ${item.targetValue}` : ""}`,
      extra: item.targetValue ? bar(item.currentValue, item.targetValue) : null,
    }),
    toDraft: (item) => ({ ...item, targetValue: item.targetValue ?? "" }),
  });
}

function entitySection({ id, addLabel, empty, items, blank, fields, path, row, toDraft }) {
  let editing = null;
  const host = el("div");
  const section = el("section", { id, class: "block" }, host);
  const draw = () => host.replaceChildren(editor(), items.length ? rows() : emptyState(empty));

  function editor() {
    const draft = editing ? toDraft(editing) : blank();
    const built = fields(draft);
    const error = errorLine();
    const form = el(
      "form",
      { class: "editor" },
      el("div", { class: "grid-form" }, built.nodes),
      error,
      el(
        "div",
        { class: "row-actions" },
        el("button", { class: "btn", type: "submit" }, editing ? "Сохранить" : addLabel),
        editing ? el("button", { class: "btn ghost", type: "button", onClick: () => { editing = null; draw(); } }, "Отмена") : null,
      ),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      showError(error, "");
      try {
        const payload = built.read();
        const result = editing ? await api.patch(`${path}/${editing.id}`, payload) : await api.post(path, payload);
        xpNote(editing ? "Сохранено" : "Записано", editing ? result.xpDelta || 0 : result.xpGained || 0);
        document.dispatchEvent(new CustomEvent("data-changed"));
      } catch (errorValue) {
        showError(error, errorValue.message);
      }
    });
    return form;
  }

  function rows() {
    return el(
      "ul",
      { class: "rows" },
      items.map((item) => {
        const view = row(item);
        const remove = el("button", { class: "text-btn danger", type: "button" }, "Удалить");
        remove.addEventListener("click", async () => {
          if (remove.dataset.armed !== "1") {
            remove.dataset.armed = "1";
            remove.textContent = "Точно удалить";
            return;
          }
          const result = await api.del(`${path}/${item.id}`);
          xpNote("Удалено", result.xpRemoved ? -result.xpRemoved : 0);
          document.dispatchEvent(new CustomEvent("data-changed"));
        });
        return el(
          "li",
          { class: "row" },
          el("div", { class: "row-main" }, el("p", { class: "row-title", text: view.title }), el("p", { class: "muted", text: view.meta }), view.extra || null),
          el("div", { class: "row-actions" }, el("button", { class: "text-btn", type: "button", onClick: () => { editing = item; draw(); } }, "Изменить"), remove),
        );
      }),
    );
  }

  draw();
  return section;
}

function bar(current, total) {
  const width = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
  return el("div", { class: "mini-bar" }, el("div", { style: `width:${width}%` }));
}

function statusBook(status) {
  return { planned: "В планах", reading: "Читаю", finished: "Прочитана", paused: "Пауза" }[status] || status;
}

function statusGoal(status) {
  return { active: "Активна", completed: "Выполнена", paused: "Пауза" }[status] || status;
}
