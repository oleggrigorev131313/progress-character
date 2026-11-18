import { getPin, setPin } from "../api.js";
import { XP, xpToAdvance } from "../shared/xp.js";
import { el } from "./dom.js";

export async function renderSettings() {
  const pin = el("input", { type: "password", autocomplete: "current-password", value: getPin(), "aria-label": "PIN" });
  const note = el("p", { class: "muted", text: getPin() ? "PIN сохранён в этом браузере." : "PIN не задан." });
  const form = el(
    "form",
    { class: "editor" },
    el("label", { class: "field" }, el("span", { text: "PIN" }), pin),
    note,
    el("button", { class: "btn", type: "submit" }, "Сохранить в браузере"),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setPin(pin.value.trim());
    note.textContent = pin.value.trim() ? "PIN сохранён в этом браузере." : "PIN очищен.";
  });

  return el(
    "div",
    { class: "page" },
    el("p", { class: "eyebrow", text: "Настройки" }),
    el("h1", { text: "Как это устроено" }),
    el("h2", { text: "Часовой пояс" }),
    el("p", { class: "lede", text: "Ульяновск, Europe/Samara (UTC+4). «Сегодня», «вчера» и текущий месяц считаются по этому поясу, даже если браузер в другом." }),
    el("h2", { text: "PIN" }),
    el("p", { class: "lede", text: "Если на сервере задан секрет APP_PIN, запросы к API должны приходить с заголовком X-App-Pin. Поле ниже хранится только в браузере. Пустой секрет на сервере проверку отключает." }),
    form,
    el("h2", { text: "Опыт и уровни" }),
    el(
      "ul",
      { class: "rules" },
      el("li", { text: `Активный доход: ${XP.incomeBase} XP и ещё ${XP.per10k} XP за каждые 10 000 ₽, не больше +${XP.per10kCap}.` }),
      el("li", { text: `Пассивный доход: ${XP.passiveBase} XP и та же надбавка за сумму.` }),
      el("li", { text: `Тренировка: ${XP.workoutBase} XP и ${XP.per10min} XP за каждые 10 минут, не больше +${XP.per10minCap}.` }),
      el("li", { text: `Новая книга: ${XP.bookAdded} XP. Прочитанная книга: ещё ${XP.bookFinished} XP.` }),
      el("li", { text: `Новая цель: ${XP.goalAdded} XP. Выполненная цель: ещё ${XP.goalCompleted} XP.` }),
      el("li", { text: "Бюджет и долги опыт не дают. Повторное редактирование не фармит опыт: начисление пересчитывается." }),
      el("li", { text: `С уровня L на следующий нужно 100 + (L−1)×50 XP. С 1 на 2 — ${xpToAdvance(1)}, со 2 на 3 — ${xpToAdvance(2)}.` }),
    ),
    el("h2", { text: "Голосовые команды" }),
    el("p", { class: "lede", text: "Разбор идёт в браузере, без внешних моделей. Команду можно надиктовать или написать. Перед сохранением поля можно поправить. Удаление спрашивает подтверждение." }),
    el(
      "ul",
      { class: "rules" },
      ...[
        "получил 50к за маркетинг для Ивана",
        "пассивный доход 15 тысяч аренда",
        "полтора миллиона",
        "1,5 млн",
        "двадцать пять тысяч пятьсот",
        "должен Ивану 10к",
        "Петр должен мне 20 тысяч",
        "бюджет на декабрь 80 тысяч",
        "тренировка бег 40 минут",
        "книга Сапиенс 412 страниц",
        "дочитал Атомные привычки",
        "цель накопить 300 тысяч",
        "удали последний доход",
        "удали тренировку от вчера",
      ].map((example) => el("li", { text: example })),
    ),
  );
}
