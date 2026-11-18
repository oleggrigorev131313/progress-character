import { isValidISODate } from "../shared/time.js";
import { httpError } from "./http.js";

export function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj ?? {}, key);
}

export function cleanText(value, max, required = false) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (required && !text) throw httpError(400, "Заполните обязательное поле");
  if (text.length > max) throw httpError(400, "Слишком длинный текст");
  return text;
}

export function cleanAmount(value, { allowZero = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw httpError(400, "Некорректное число");
  const rounded = Math.round(n);
  if (rounded < 0 || rounded > 1_000_000_000_000) throw httpError(400, "Некорректное число");
  if (!allowZero && rounded === 0) throw httpError(400, "Число должно быть больше нуля");
  return rounded;
}

export function cleanOptionalInt(value) {
  if (value == null || value === "") return null;
  return cleanAmount(value, { allowZero: true });
}

export function cleanEnum(value, allowed) {
  if (!allowed.includes(value)) throw httpError(400, "Некорректное значение");
  return value;
}

export function cleanDate(value, fallback) {
  const date = value || fallback;
  if (!isValidISODate(date)) throw httpError(400, "Некорректная дата");
  return date;
}

export function cleanMonth(value, fallback) {
  const month = value || fallback;
  if (!/^\d{4}-\d{2}$/.test(month || "")) throw httpError(400, "Некорректный месяц");
  const part = Number(month.slice(5));
  if (part < 1 || part > 12) throw httpError(400, "Некорректный месяц");
  return month;
}

export function cleanId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, "Не найдено");
  return id;
}
