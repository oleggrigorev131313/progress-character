import { api } from "../api.js";
import { parseCommand } from "../parser/parseCommand.js";
import { samaraMonth, samaraToday } from "../shared/time.js";
import { dateInput, el, errorLine, field, numInput, selectInput, showError, textInput, xpNote } from "./dom.js";
import { icon } from "./icons.js";

const PATHS = {
  income: "/api/income",
  debt: "/api/debts",
  goal: "/api/goals",
  book: "/api/books",
  workout: "/api/workouts",
  budget: "/api/budget",
};

export function mountVoice(dock) {
  const preview = el("div", { id: "voice-preview", class: "preview" });
  preview.hidden = true;
  const input = el("input", {
    id: "voice-input",
    class: "voice-input",
    type: "text",
    placeholder: "Получил 50к за проект или тренировка бег 40 минут",
    autocomplete: "off",
    "aria-label": "Команда",
  });
  const mic = el("button", { class: "mic", type: "button", "aria-label": "Голосовой ввод", "aria-pressed": "false" });
  mic.append(icon("mic"));
  const bar = el("div", { class: "voice-bar" }, input, mic);
  dock.append(preview, bar);

  let recognition = null;
  let listening = false;
  let heard = "";

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openPreview(input.value);
    } else if (event.key === "Escape") {
      closePreview();
    }
  });

  mic.addEventListener("click", () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      showNote("Голосовой ввод недоступен в этом браузере. Напишите команду текстом.");
      return;
    }
    if (!recognition) {
      recognition = new Ctor();
      recognition.lang = "ru-RU";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        heard = "";
        for (let i = 0; i < event.results.length; i++) heard += event.results[i][0].transcript;
        input.value = heard;
      };
      recognition.onerror = () => {
        listening = false;
        paintMic();
      };
      recognition.onend = () => {
        listening = false;
        paintMic();
        if (heard.trim()) openPreview(heard.trim());
      };
    }
    if (listening) {
      recognition.stop();
      return;
    }
    heard = "";
    listening = true;
    paintMic();
    recognition.start();
  });

  function paintMic() {
    mic.classList.toggle("is-live", listening);
    mic.setAttribute("aria-pressed", listening ? "true" : "false");
  }

  function closePreview() {
    preview.hidden = true;
    preview.replaceChildren();
  }

  function showNote(text) {
    preview.hidden = false;
    preview.replaceChildren(el("p", { class: "preview-title", text }), el("button", { class: "btn ghost", type: "button", onClick: closePreview }, "Закрыть"));
  }

  async function openPreview(text) {
    const parsed = parseCommand(text, { now: new Date() });
    preview.hidden = false;
    preview.replaceChildren();
    if (!parsed.ok) {
      preview.append(
        el("p", { class: "preview-title", text: parsed.error }),
        parsed.hint ? el("p", { class: "muted", text: parsed.hint }) : null,
        el("button", { class: "btn ghost", type: "button", onClick: closePreview }, "Закрыть"),
      );
      return;
    }
    preview.append(el("p", { class: "preview-kicker", text: "Проверьте запись" }), el("p", { class: "preview-title", text: parsed.preview }));
    for (const warning of parsed.warnings) preview.append(el("p", { class: "warn", text: warning }));

    if (parsed.action === "delete") {
      preview.append(el("p", { class: "muted", text: "Ищу запись…" }));
      try {
        const { matches } = await api.post("/api/match", { entity: parsed.entity, selector: parsed.selector });
        preview.lastElementChild.remove();
        if (!matches.length) {
          preview.append(el("p", { class: "muted", text: "Ничего не найдено." }));
          preview.append(el("button", { class: "btn ghost", type: "button", onClick: closePreview }, "Закрыть"));
          return;
        }
        const list = el("ul", { class: "match-list" });
        for (const match of matches) list.append(el("li", { text: match.label }));
        const error = errorLine();
        const confirm = el("button", { class: "btn danger", type: "button" }, matches.length > 1 ? `Удалить все (${matches.length})` : "Удалить");
        confirm.addEventListener("click", async () => {
          confirm.disabled = true;
          try {
            let removed = 0;
            for (const match of matches) {
              const result = parsed.entity === "budget"
                ? await api.del(`/api/budget?month=${encodeURIComponent(match.item.month)}`)
                : await api.del(`${PATHS[parsed.entity]}/${match.id}`);
              removed += result.xpRemoved || 0;
            }
            xpNote("Удалено", removed ? -removed : 0);
            input.value = "";
            closePreview();
            document.dispatchEvent(new CustomEvent("data-changed"));
          } catch (errorValue) {
            showError(error, errorValue.message);
            confirm.disabled = false;
          }
        });
        preview.append(
          list,
          el("p", { class: "muted", text: "Опыт за эти записи будет снят." }),
          error,
          el("div", { class: "row-actions" }, confirm, el("button", { class: "btn ghost", type: "button", onClick: closePreview }, "Отмена")),
        );
      } catch (errorValue) {
        preview.append(el("p", { class: "form-error", text: errorValue.message }));
      }
      return;
    }

    if (parsed.action === "complete" || parsed.action === "progress") {
      try {
        const { matches } = await api.post("/api/match", { entity: parsed.entity, selector: parsed.selector });
        if (matches.length) {
          const chosen = { id: matches[0].id };
          const list = el("div", { class: "match-list" });
          matches.forEach((match, index) => {
            const radio = el("input", { type: "radio", name: "match", value: String(match.id) });
            if (index === 0) radio.checked = true;
            radio.addEventListener("change", () => {
              chosen.id = match.id;
            });
            list.append(el("label", { class: "check" }, radio, match.label));
          });
          const error = errorLine();
          const label = parsed.action === "complete"
            ? (parsed.entity === "book" ? "Отметить прочитанной" : "Отметить выполненной")
            : "Обновить прогресс";
          const confirm = el("button", { id: "voice-save", class: "btn", type: "button" }, label);
          confirm.addEventListener("click", async () => {
            confirm.disabled = true;
            try {
              const patch = parsed.entity === "book"
                ? (parsed.action === "complete"
                  ? { status: "finished" }
                  : { pagesRead: Number(parsed.fields.pagesRead) || 0, ...(parsed.fields.pagesTotal ? { pagesTotal: parsed.fields.pagesTotal } : {}) })
                : { status: "completed" };
              const result = await api.patch(`${PATHS[parsed.entity]}/${chosen.id}`, patch);
              xpNote("Сохранено", result.xpDelta || 0);
              input.value = "";
              closePreview();
              document.dispatchEvent(new CustomEvent("data-changed"));
            } catch (errorValue) {
              showError(error, errorValue.message);
              confirm.disabled = false;
            }
          });
          preview.append(list, error, el("div", { class: "row-actions" }, confirm, el("button", { class: "btn ghost", type: "button", onClick: closePreview }, "Отмена")));
          return;
        }
      } catch (errorValue) {
        preview.append(el("p", { class: "form-error", text: errorValue.message }));
        return;
      }
    }

    preview.append(buildCreateForm(parsed, () => {
      input.value = "";
      closePreview();
    }, closePreview));
  }
}

function buildCreateForm(parsed, onSaved, onCancel) {
  const fields = parsed.fields || {};
  const error = errorLine();
  const controls = [];
  const bag = {};

  const add = (name, node) => {
    bag[name] = node;
    return node;
  };

  if (parsed.entity === "income") {
    controls.push(
      field("Сумма, ₽", add("amount", numInput({ value: fields.amount ?? "" }))),
      field("Тип", add("type", selectInput({}, [["active", "Активный"], ["passive", "Пассивный"]], fields.type || "active"))),
      field("Описание", add("description", textInput({ value: fields.description || "" }))),
      field("Дата", add("date", dateInput({ value: fields.date || samaraToday() }))),
    );
  } else if (parsed.entity === "debt") {
    controls.push(
      field("Кто", add("counterparty", textInput({ value: fields.counterparty || "" }))),
      field("Направление", add("direction", selectInput({}, [["owe", "Я должен"], ["owed", "Мне должны"]], fields.direction || "owe"))),
      field("Сумма, ₽", add("amount", numInput({ value: fields.amount ?? "" }))),
      field("Уже оплачено", add("paid", numInput({ value: fields.paid ?? 0 }))),
      field("Заметка", add("note", textInput({ value: fields.note || "" }))),
    );
  } else if (parsed.entity === "budget") {
    controls.push(
      field("Месяц", add("month", el("input", { type: "month", value: fields.month || samaraMonth() }))),
      field("Бюджет, ₽", add("amount", numInput({ value: fields.amount ?? "" }))),
    );
  } else if (parsed.entity === "workout") {
    controls.push(
      field("Тип", add("type", textInput({ value: fields.type || "" }))),
      field("Минуты", add("durationMin", numInput({ value: fields.durationMin ?? "" }))),
      field("Дата", add("date", dateInput({ value: fields.date || samaraToday() }))),
      field("Заметка", add("note", textInput({ value: fields.note || "" }))),
    );
  } else if (parsed.entity === "book") {
    controls.push(
      field("Название", add("title", textInput({ value: fields.title || "" }))),
      field("Статус", add("status", selectInput({}, [["planned", "В планах"], ["reading", "Читаю"], ["finished", "Прочитана"], ["paused", "Пауза"]], fields.status || "reading"))),
      field("Прочитано страниц", add("pagesRead", numInput({ value: fields.pagesRead ?? 0 }))),
      field("Всего страниц", add("pagesTotal", numInput({ value: fields.pagesTotal ?? "" }))),
    );
  } else if (parsed.entity === "goal") {
    controls.push(
      field("Название", add("title", textInput({ value: fields.title || "" }))),
      field("Цель, число", add("targetValue", numInput({ value: fields.targetValue ?? "" }))),
      field("Сейчас", add("currentValue", numInput({ value: fields.currentValue ?? 0 }))),
      field("Статус", add("status", selectInput({}, [["active", "Активна"], ["completed", "Выполнена"], ["paused", "Пауза"]], fields.status || "active"))),
    );
  }

  const save = el("button", { id: "voice-save", class: "btn", type: "submit" }, "Сохранить");
  const form = el("form", { class: "preview-form" }, controls, error, el("div", { class: "row-actions" }, save, el("button", { class: "btn ghost", type: "button", onClick: () => onCancel() }, "Отмена")));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(error, "");
    save.disabled = true;
    try {
      const payload = readPayload(parsed.entity, bag);
      const result = parsed.entity === "budget"
        ? await api.put("/api/budget", payload)
        : await api.post(PATHS[parsed.entity], payload);
      xpNote("Записано", result.xpGained || 0);
      onSaved();
      document.dispatchEvent(new CustomEvent("data-changed"));
    } catch (errorValue) {
      showError(error, errorValue.message);
      save.disabled = false;
    }
  });
  return form;
}

function valueOf(node) {
  return node ? node.value.trim() : "";
}

function readPayload(entity, bag) {
  if (entity === "income") {
    return {
      amount: Number(valueOf(bag.amount)),
      type: bag.type.value,
      description: valueOf(bag.description),
      date: valueOf(bag.date),
    };
  }
  if (entity === "debt") {
    return {
      counterparty: valueOf(bag.counterparty),
      direction: bag.direction.value,
      amount: Number(valueOf(bag.amount)),
      paid: Number(valueOf(bag.paid) || 0),
      note: valueOf(bag.note),
    };
  }
  if (entity === "budget") return { month: valueOf(bag.month), amount: Number(valueOf(bag.amount)) };
  if (entity === "workout") {
    return {
      type: valueOf(bag.type),
      durationMin: Number(valueOf(bag.durationMin)),
      date: valueOf(bag.date),
      note: valueOf(bag.note),
    };
  }
  if (entity === "book") {
    const pagesTotal = valueOf(bag.pagesTotal);
    return {
      title: valueOf(bag.title),
      status: bag.status.value,
      pagesRead: Number(valueOf(bag.pagesRead) || 0),
      pagesTotal: pagesTotal === "" ? null : Number(pagesTotal),
    };
  }
  const target = valueOf(bag.targetValue);
  return {
    title: valueOf(bag.title),
    targetValue: target === "" ? null : Number(target),
    currentValue: Number(valueOf(bag.currentValue) || 0),
    status: bag.status.value,
  };
}
