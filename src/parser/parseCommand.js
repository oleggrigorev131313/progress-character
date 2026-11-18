/**
 * Rule-based Russian command parser. Runs in the browser; no network calls.
 * Amounts: «пятьдесят тысяч», «50к», «50 к», «50 тыс», «полтора миллиона», «1,5 млн».
 */
import { findAmounts } from "./amount.js";
import { formatDateRu, formatMoney } from "../shared/format.js";
import { addDaysISO, isValidISODate, samaraMonth, samaraToday } from "../shared/time.js";
import { fold } from "../shared/text.js";

const NAME_STOP = new Set([
  "мне", "ему", "ей", "им", "нам", "вам", "них", "него", "нее", "тебе", "себе",
  "тысяч", "тысяча", "тысячи", "рублей", "рубля", "рубль", "руб",
  "последний", "последняя", "вчера", "сегодня", "позавчера",
  "книга", "книгу", "тренировку", "тренировка", "долг", "цель",
]);

function wordRe(body, flags = "i") {
  return new RegExp(`(?<![a-zа-я0-9])(?:${body})(?![a-zа-я0-9])`, flags);
}

function hasWord(text, body) {
  return wordRe(body).test(text);
}

function blankRange(text, start, end) {
  if (start == null || end == null || end <= start) return text;
  const from = Math.max(0, start);
  const to = Math.min(text.length, end);
  return text.slice(0, from) + " ".repeat(to - from) + text.slice(to);
}

function blankWords(text, bodies) {
  let out = text;
  for (const body of bodies) {
    out = out.replace(wordRe(body, "gi"), (match) => " ".repeat(match.length));
  }
  return out;
}

function phraseFrom(original, folded, work) {
  if (original.length !== folded.length || folded.length !== work.length) {
    return work;
  }
  let out = "";
  for (let i = 0; i < work.length; i++) {
    const removed = work[i] === " " && folded[i] !== " ";
    out += removed ? " " : original[i];
  }
  return out;
}

function nicePhrase(input, { stripZa = false } = {}) {
  let text = String(input ?? "").replace(/[«»"“”.,;:!?()[\]]+/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (stripZa) text = text.replace(/^за\s+/iu, "");
  if (!text) return "";
  const alone = text.toLowerCase();
  if (["у", "от", "за", "на", "по", "в", "и", "а", "с", "к", "о"].includes(alone)) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function fail(message, hint) {
  return {
    ok: false,
    error: message,
    hint: hint || "Например: «получил 50к за проект» или «тренировка бег 40 минут».",
    warnings: [],
    needsConfirmation: false,
  };
}

function detectEntity(folded) {
  const rules = [
    { entity: "income", type: "passive", re: /пассивн[а-я]*\s+доход/ },
    { entity: "income", type: "passive", re: wordRe("дивиденд[а-я]*|роялти") },
    { entity: "budget", re: wordRe("бюджет[а-я]*") },
    { entity: "debt", re: wordRe("долг[а-я]*|должен|должна|занял|заняла|одолжил|одолжила|кредит") },
    { entity: "book", re: wordRe("книг[а-я]*|читаю|дочитал[а-я]*|прочитал[а-я]*|прочел|прочла") },
    {
      entity: "workout",
      re: wordRe("тренировк[а-я]*|потренировал[а-я]*|пробежк[а-я]*|бег(?:ом)?|йог[а-я]*|плаван[а-я]*|растяжк[а-я]*|кроссфит[а-я]*|велосипед[а-я]*|ходьб[а-я]*|спортзал[а-я]*|силов[а-я]*"),
    },
    { entity: "goal", re: wordRe("цель|цели|целью") },
    {
      entity: "income",
      type: "active",
      re: wordRe("доход[а-я]*|зарплат[а-я]*|получил|получила|заработал|заработала|пришло|пришли|пришла|премия|премию|аванс|подработк[а-я]*|фриланс[а-я]*|кешбек|кэшбек"),
    },
  ];
  for (const rule of rules) {
    if (rule.re.test(folded)) return { entity: rule.entity, incomeType: rule.type || null };
  }
  return null;
}

function detectAction(folded, entity) {
  if (hasWord(folded, "удали(?:ть)?|убери|сотри")) return "delete";
  if (entity === "goal" && hasWord(folded, "выполнил(?:а)?|завершил(?:а)?|закрыл(?:а)?|достиг(?:ла)?|достигнут[ао]")) {
    return "complete";
  }
  if (entity === "book" && hasWord(folded, "дочитал(?:а)?|прочел|прочла")) return "complete";
  if (entity === "book" && hasWord(folded, "прочитал(?:а)?") && !/стр/.test(folded)) return "complete";
  return "create";
}

function calendarDate(year, month, day) {
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : null;
}

function extractDate(work, now) {
  const found = [];
  const push = (start, end, date) => {
    if (date) found.push({ start, end, date });
  };

  for (const match of work.matchAll(/(?<![a-zа-я0-9])((?:от|за)\s+)?(позавчера|вчера|сегодня)(?![a-zа-я0-9])/g)) {
    const today = samaraToday(now);
    const word = match[2];
    const date = word === "сегодня" ? today : word === "вчера" ? addDaysISO(today, -1) : addDaysISO(today, -2);
    push(match.index, match.index + match[0].length, date);
  }

  for (const match of work.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    push(match.index, match.index + match[0].length, calendarDate(Number(match[1]), Number(match[2]), Number(match[3])));
  }

  for (const match of work.matchAll(/(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?!\d)/g)) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    push(match.index, match.index + match[0].length, calendarDate(year, Number(match[2]), Number(match[1])));
  }

  const months = {
    января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
    июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
  };
  const monthBody = Object.keys(months).join("|");
  for (const match of work.matchAll(new RegExp(`(?<![a-zа-я0-9])(\\d{1,2})\\s+(${monthBody})(?:\\s+(\\d{4}))?(?![a-zа-я0-9])`, "g"))) {
    const year = match[3] ? Number(match[3]) : Number(samaraToday(now).slice(0, 4));
    push(match.index, match.index + match[0].length, calendarDate(year, months[match[2]], Number(match[1])));
  }

  for (const match of work.matchAll(/(?<!\d)(\d{2})[./](\d{2})(?!\d|[./])/g)) {
    const year = Number(samaraToday(now).slice(0, 4));
    const date = calendarDate(year, Number(match[2]), Number(match[1]));
    if (date) push(match.index, match.index + match[0].length, date);
  }

  if (!found.length) return null;
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  return found[0];
}

const MONTH_PATTERNS = [
  [/январ[а-я]*/, 1],
  [/феврал[а-я]*/, 2],
  [/март[а-я]*/, 3],
  [/апрел[а-я]*/, 4],
  [/ма[йя]/, 5],
  [/июн[а-я]*/, 6],
  [/июл[а-я]*/, 7],
  [/август[а-я]*/, 8],
  [/сентябр[а-я]*/, 9],
  [/октябр[а-я]*/, 10],
  [/ноябр[а-я]*/, 11],
  [/декабр[а-я]*/, 12],
];

function extractMonth(work, now) {
  let best = null;
  for (const [re, month] of MONTH_PATTERNS) {
    const matcher = new RegExp(`(?<![a-zа-я0-9])${re.source}(?![a-zа-я0-9])`, "g");
    for (const match of work.matchAll(matcher)) {
      if (best && match.index >= best.start) continue;
      let end = match.index + match[0].length;
      const yearMatch = /^\s+(\d{4})/.exec(work.slice(end));
      const year = yearMatch ? Number(yearMatch[1]) : Number(samaraToday(now).slice(0, 4));
      if (yearMatch) end += yearMatch[0].length;
      best = {
        start: match.index,
        end,
        month: `${year}-${String(month).padStart(2, "0")}`,
      };
    }
  }
  return best;
}

function extractDuration(work) {
  const candidates = [];
  const add = (start, end, minutes) => {
    if (minutes > 0 && minutes <= 1440) candidates.push({ start, end, minutes });
  };

  for (const match of work.matchAll(/полтора\s+час(?:а|ов)?/g)) add(match.index, match.index + match[0].length, 90);
  for (const match of work.matchAll(/полчаса/g)) add(match.index, match.index + match[0].length, 30);
  for (const match of work.matchAll(/(\d+(?:[.,]\d+)?)\s*час(?:а|ов)?(?:\s+(\d+)\s*мин(?:ут(?:а|ы)?)?)?/g)) {
    const hours = Number(match[1].replace(",", "."));
    const extra = match[2] ? Number(match[2]) : 0;
    add(match.index, match.index + match[0].length, Math.round(hours * 60 + extra));
  }
  for (const match of work.matchAll(/(\d+)\s*мин(?:ут(?:а|ы)?)?/g)) {
    add(match.index, match.index + match[0].length, Number(match[1]));
  }

  for (const amount of findAmounts(work)) {
    const after = work.slice(amount.end);
    const unit = /^\s*(час(?:а|ов)?|мин(?:ут(?:а|ы)?)?)/.exec(after);
    if (!unit) continue;
    const minutes = unit[1].startsWith("час") ? Math.round(amount.value * 60) : Math.round(amount.value);
    add(amount.start, amount.end + unit[0].length, minutes);
  }

  if (!candidates.length && hasWord(work, "час(?:а|ов)?")) {
    const match = wordRe("час(?:а|ов)?").exec(work);
    if (match) add(match.index, match.index + match[0].length, 60);
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  return candidates[0];
}

function extractPages(work, folded) {
  const range = /(?<!\d)(\d+)\s+из\s+(\d+)/.exec(work);
  if (range) {
    return {
      pagesRead: Number(range[1]),
      pagesTotal: Number(range[2]),
      start: range.index,
      end: range.index + range[0].length,
    };
  }

  const progressVerb = /прочитал|прочел|дочитал|читаю/.test(folded);
  const hits = [];
  const push = (pages, start, end) => hits.push({ pages, start, end });

  for (const amount of findAmounts(work)) {
    const after = work.slice(amount.end);
    const unit = /^\s*стр(?:аниц[аы]?|аницы|\.)?/.exec(after);
    if (unit) push(amount.value, amount.start, amount.end + unit[0].length);
  }
  const before = /стр(?:аниц[аы]?|аница)\s+(\d+)/.exec(work);
  if (before) push(Number(before[1]), before.index, before.index + before[0].length);

  if (!hits.length) return null;
  hits.sort((a, b) => a.start - b.start);
  const hit = hits[0];
  if (progressVerb) return { pagesRead: hit.pages, pagesTotal: null, start: hit.start, end: hit.end };
  return { pagesRead: null, pagesTotal: hit.pages, start: hit.start, end: hit.end };
}

function titleName(original, start, end) {
  const raw = original.slice(start, end).trim();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function extractDebt(folded, original) {
  const patterns = [
    { direction: "owed", re: /(?<![a-zа-я0-9])([а-яё][а-яё-]{1,})(?:\s+([а-яё][а-яё-]{1,}))?\s+должен(?:а)?\s+мне(?![a-zа-я0-9])/ },
    { direction: "owed", re: /(?<![a-zа-я0-9])мне\s+должен(?:а)?\s+([а-яё][а-яё-]{1,})(?![a-zа-я0-9])/ },
    { direction: "owed", re: /(?<![a-zа-я0-9])одолжил(?:а)?\s+([а-яё][а-яё-]{1,})(?![a-zа-я0-9])/ },
    { direction: "owe", re: /(?<![a-zа-я0-9])занял(?:а)?\s+у\s+([а-яё][а-яё-]{1,})(?![a-zа-я0-9])/ },
    { direction: "owe", re: /(?<![a-zа-я0-9])(?:я\s+)?должен(?:а)?\s+([а-яё][а-яё-]{1,})(?![a-zа-я0-9])/ },
    { direction: "owe", re: /(?<![a-zа-я0-9])долг\s+([а-яё][а-яё-]{1,})(?![a-zа-я0-9])/ },
  ];

  for (const pattern of patterns) {
    const match = pattern.re.exec(folded);
    if (!match) continue;
    const groups = [match[1], match[2]].filter(Boolean);
    const nameGroup = groups.find((group) => !NAME_STOP.has(group));
    if (!nameGroup) continue;
    const local = match[0].indexOf(nameGroup);
    const start = match.index + local;
    const end = start + nameGroup.length;
    return {
      direction: pattern.direction,
      name: titleName(original, start, end),
      start,
      end,
    };
  }
  return { direction: "owe", name: "", start: null, end: null };
}

const WORKOUT_TYPES = [
  [/пробежк[а-я]*/, "Бег"],
  [/(?<![а-я])бег(?:ом)?(?![а-я])/, "Бег"],
  [/силов[а-я]*/, "Силовая"],
  [/йог[а-я]*/, "Йога"],
  [/плаван[а-я]*/, "Плавание"],
  [/растяжк[а-я]*/, "Растяжка"],
  [/кроссфит[а-я]*/, "Кроссфит"],
  [/велосипед[а-я]*|(?<![а-я])велик(?![а-я])/, "Велосипед"],
  [/ходьб[а-я]*/, "Ходьба"],
  [/бокс[а-я]*/, "Бокс"],
  [/функциональн[а-я]*/, "Функциональная"],
  [/спортзал[а-я]*|(?<![а-я])зал(?![а-я])/, "Зал"],
];

function detectWorkoutType(work) {
  for (const [re, type] of WORKOUT_TYPES) {
    const match = re.exec(work);
    if (match) return { type, start: match.index, end: match.index + match[0].length };
  }
  return null;
}

const FILLERS = [
  "удали(?:ть)?",
  "убери",
  "сотри",
  "пожалуйста",
  "добавь",
  "добавить",
  "запиши",
  "записать",
  "внеси",
  "создай",
  "поставь",
  "отметь",
  "новый",
  "новая",
  "новое",
  "новую",
  "получил(?:а)?",
  "заработал(?:а)?",
  "пришло",
  "пришли",
  "пришла",
  "пассивн(?:ый|ого|ая|ым|ом|ые)?",
  "активн(?:ый|ого|ая)?",
  "доход(?:а|у|ом|е)?",
  "зарплат(?:а|у|ы|е)?",
  "руб(?:л(?:ь|я|ей|и))?",
  "примерно",
  "около",
  "последн(?:ий|яя|ее|юю|его|ему|им|ей)",
  "перв(?:ый|ая|ое|ую|ого|ым)",
  "сегодня",
  "вчера",
  "позавчера",
  "выполнил(?:а)?",
  "завершил(?:а)?",
  "закрыл(?:а)?",
  "достиг(?:ла)?",
  "достигнута",
  "достигнуто",
];

const ENTITY_FILLERS = {
  book: ["книг(?:а|у|и|е|ой)?", "читаю", "дочитал(?:а)?", "прочитал(?:а)?", "прочел", "прочла"],
  workout: ["тренировк(?:а|у|и|е|ой)?", "потренировал(?:ся|ась)?"],
  goal: ["цель", "цели", "целью"],
  budget: ["бюджет(?:а|у|е)?"],
  debt: ["долг(?:а|у|ом|и)?", "должен(?:а)?", "занял(?:а)?", "одолжил(?:а)?", "кредит"],
  income: [],
};

function previewFor(action, entity, fields, selector) {
  if (action === "delete") {
    const names = {
      income: "доход",
      debt: "долг",
      book: "книгу",
      workout: "тренировку",
      goal: "цель",
      budget: "бюджет",
    };
    if (selector.which === "last") return `Удалить последний ${names[entity] || "запись"}?`;
    if (selector.date) return `Удалить ${names[entity] || "запись"} за ${formatDateRu(selector.date)}?`;
    if (selector.query) return `Удалить ${names[entity] || "запись"} «${selector.query}»?`;
    return `Удалить ${names[entity] || "запись"}?`;
  }
  if (entity === "income") {
    const kind = fields.type === "passive" ? "Пассивный доход" : "Доход";
    const amount = fields.amount ? formatMoney(fields.amount) : "сумма не указана";
    return fields.description ? `${kind} ${amount} · ${fields.description}` : `${kind} ${amount}`;
  }
  if (entity === "debt") {
    const who = fields.direction === "owed" ? "мне должен" : "я должен";
    const name = fields.counterparty || "без имени";
    const amount = fields.amount ? formatMoney(fields.amount) : "сумма не указана";
    return `Долг · ${who} ${name} · ${amount}`;
  }
  if (entity === "budget") {
    return `Бюджет ${fields.month || ""} · ${fields.amount ? formatMoney(fields.amount) : "сумма не указана"}`.trim();
  }
  if (entity === "workout") {
    const duration = fields.durationMin ? `${fields.durationMin} мин` : "длительность не указана";
    return `Тренировка · ${fields.type || "без типа"} · ${duration}`;
  }
  if (entity === "book") {
    if (action === "complete") return `Отметить книгу «${fields.title || "без названия"}» прочитанной?`;
    if (action === "progress") return `Прогресс книги «${fields.title || "без названия"}»`;
    return `Книга · ${fields.title || "без названия"}`;
  }
  if (entity === "goal") {
    if (action === "complete") return `Отметить цель «${fields.title || "без названия"}» выполненной?`;
    return fields.targetValue ? `Цель · ${fields.title} · ${formatMoney(fields.targetValue)}` : `Цель · ${fields.title || "без названия"}`;
  }
  return "Команда";
}

export function parseCommand(input, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const original = String(input ?? "").trim();
  if (!original) return fail("Пустая команда");

  const folded = fold(original);
  const entityInfo = detectEntity(folded);
  if (!entityInfo) {
    return fail("Не разобрал команду", "Скажите сущность: доход, долг, бюджет, книга, тренировка или цель.");
  }

  const { entity } = entityInfo;
  let incomeType = entityInfo.incomeType || "active";
  let action = detectAction(folded, entity);

  let work = folded;
  const dateHit = extractDate(work, now);
  const spokenDate = dateHit?.date || null;
  if (dateHit) work = blankRange(work, dateHit.start, dateHit.end);

  let durationMin = null;
  if (entity === "workout") {
    const duration = extractDuration(work);
    if (duration) {
      durationMin = duration.minutes;
      work = blankRange(work, duration.start, duration.end);
    }
  }

  let pagesRead = null;
  let pagesTotal = null;
  if (entity === "book") {
    const pages = extractPages(work, folded);
    if (pages) {
      pagesRead = pages.pagesRead;
      pagesTotal = pages.pagesTotal;
      work = blankRange(work, pages.start, pages.end);
    }
    if (action === "create" && pagesRead && !pagesTotal) action = "progress";
  }

  const amounts = entity === "book" || entity === "workout" ? [] : findAmounts(work);
  const amount = amounts[0]?.value ?? null;
  if (entity !== "goal" && amounts[0]) work = blankRange(work, amounts[0].start, amounts[0].end);

  let paid = null;
  if (entity === "debt" && amounts[1] && /оплат|погас|вернул/.test(folded)) {
    paid = amounts[1].value;
    work = blankRange(work, amounts[1].start, amounts[1].end);
  }

  let direction = "owe";
  let counterparty = "";
  if (entity === "debt") {
    const debt = extractDebt(folded, original);
    direction = debt.direction;
    counterparty = debt.name;
    if (debt.start != null) work = blankRange(work, debt.start, debt.end);
  }

  let month = samaraMonth(now);
  if (entity === "budget") {
    const monthHit = extractMonth(work, now);
    if (monthHit) {
      month = monthHit.month;
      work = blankRange(work, monthHit.start, monthHit.end);
    }
  }

  let workoutType = null;
  if (entity === "workout") {
    const detected = detectWorkoutType(work);
    if (detected) {
      workoutType = detected.type;
      work = blankRange(work, detected.start, detected.end);
    }
  }

  work = blankWords(work, FILLERS);
  work = blankWords(work, ENTITY_FILLERS[entity] || []);

  const loose = phraseFrom(original, folded, work);
  const phrase = nicePhrase(loose, { stripZa: entity === "income" });
  const querySource = nicePhrase(loose, { stripZa: entity === "income" }).toLowerCase();

  let which = null;
  if (hasWord(folded, "последн[а-я]*")) which = "last";
  else if (hasWord(folded, "перв(?:ый|ая|ое|ую|ого|ым)")) which = "first";

  const selector = {
    which,
    date: spokenDate,
    query: querySource || null,
    month: entity === "budget" ? month : null,
  };
  if (action === "delete" && !selector.which && !selector.date && !selector.query) selector.which = "last";

  const fieldDate = spokenDate || samaraToday(now);
  const warnings = [];
  const fields = {};

  if (entity === "income") {
    fields.amount = amount;
    fields.type = incomeType;
    fields.description = phrase;
    fields.date = fieldDate;
    if (action === "create" && !amount) warnings.push("Укажите сумму");
  } else if (entity === "debt") {
    fields.counterparty = counterparty;
    fields.direction = direction;
    fields.amount = amount;
    fields.paid = paid ?? 0;
    fields.note = phrase;
    if (action === "create" && !amount) warnings.push("Укажите сумму");
    if (action === "create" && !counterparty) warnings.push("Укажите, кому долг");
  } else if (entity === "budget") {
    fields.amount = amount;
    fields.month = month;
    if (action !== "delete" && !amount) warnings.push("Укажите сумму бюджета");
  } else if (entity === "workout") {
    fields.type = workoutType || phrase || "Тренировка";
    fields.durationMin = durationMin;
    fields.date = fieldDate;
    fields.note = workoutType ? phrase : "";
    if (action === "create" && !durationMin) warnings.push("Укажите длительность");
  } else if (entity === "book") {
    let status = "reading";
    if (action === "complete") status = "finished";
    else if (/в планах|планирую|хочу прочитать/.test(folded)) status = "planned";
    else if (pagesRead && pagesTotal && pagesRead >= pagesTotal) status = "finished";
    fields.title = phrase;
    fields.author = "";
    fields.status = status;
    fields.pagesRead = pagesRead ?? (status === "finished" && pagesTotal ? pagesTotal : 0);
    fields.pagesTotal = pagesTotal;
    if ((action === "create" || action === "progress" || action === "complete") && !phrase) {
      warnings.push("Укажите название книги");
    }
    if (phrase) selector.query = phrase.toLowerCase();
  } else if (entity === "goal") {
    fields.title = phrase;
    fields.details = "";
    fields.targetValue = amount;
    fields.currentValue = 0;
    fields.status = action === "complete" ? "completed" : "active";
    if (!phrase) warnings.push("Укажите название цели");
    if (phrase) selector.query = phrase.toLowerCase();
  }

  return {
    ok: true,
    action,
    entity,
    needsConfirmation: action === "delete",
    confidence: warnings.length ? "medium" : "high",
    warnings,
    preview: previewFor(action, entity, fields, selector),
    fields,
    selector,
    text: original,
  };
}
