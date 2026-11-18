const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_NOM = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

export function formatMoney(value) {
  const n = Math.round(Number(value) || 0);
  const body = new Intl.NumberFormat("ru-RU").format(n).replace(/[\u00A0\u202F]/g, " ");
  return `${body} ₽`;
}

export function formatXp(value) {
  const n = Math.round(Number(value) || 0);
  return new Intl.NumberFormat("ru-RU").format(n).replace(/[\u00A0\u202F]/g, " ");
}

export function formatDateRu(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [, month, day] = iso.split("-");
  const monthName = MONTHS_GEN[Number(month) - 1] || "";
  return `${Number(day)} ${monthName} ${iso.slice(0, 4)}`;
}

export function formatMonthRu(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return "";
  const name = MONTHS_NOM[Number(month.slice(5)) - 1] || "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}

export function formatDateTimeRu(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Samara",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function plural(n, one, few, many) {
  const abs = Math.abs(Number(n)) % 100;
  const digit = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (digit > 1 && digit < 5) return few;
  if (digit === 1) return one;
  return many;
}
