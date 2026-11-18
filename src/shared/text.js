/** Case-fold Russian text without changing length for BMP characters. */
export function fold(input) {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "ё" || ch === "Ё") out += "е";
    else out += ch.toLowerCase();
  }
  return out;
}

/** Loose comparison key for declined Russian names: Ивану ≈ Иван, Маше ≈ Маша. */
export function looseName(input) {
  let f = fold(String(input ?? "")).replace(/[^a-zа-я0-9]+/gi, "");
  if (f.length >= 3) f = f.replace(/[аеиоуыэюя]$/u, "");
  return f;
}

export function namesMatch(a, b) {
  const left = looseName(a);
  const right = looseName(b);
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

/** Substring / light-stem match for titles («атомные привычки» ≈ «Атомных привычек»). */
export function textMatches(haystack, query) {
  const h = fold(String(haystack ?? ""));
  const q = fold(String(query ?? "")).trim();
  if (!q) return false;
  if (h.includes(q)) return true;
  const words = q.split(/[^a-zа-я0-9]+/i).filter((word) => word.length > 2);
  if (!words.length) return false;
  return words.every((word) => {
    if (h.includes(word)) return true;
    const stem = word.length > 4 ? word.slice(0, -2) : word;
    return stem.length >= 3 && h.includes(stem);
  });
}
