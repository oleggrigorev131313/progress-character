import { fold } from "../shared/text.js";

const ONES = {
  ноль: 0,
  один: 1, одна: 1, одно: 1, одну: 1, одного: 1, одной: 1,
  два: 2, две: 2, двух: 2, двум: 2, двумя: 2,
  три: 3, трех: 3, трёх: 3, трем: 3, трём: 3,
  четыре: 4, четырех: 4, четырёх: 4,
  пять: 5, пяти: 5,
  шесть: 6, шести: 6,
  семь: 7, семи: 7,
  восемь: 8, восьми: 8,
  девять: 9, девяти: 9,
  десять: 10, десяти: 10,
  одиннадцать: 11, одиннадцати: 11,
  двенадцать: 12, двенадцати: 12,
  тринадцать: 13, тринадцати: 13,
  четырнадцать: 14, четырнадцати: 14,
  пятнадцать: 15, пятнадцати: 15,
  шестнадцать: 16, шестнадцати: 16,
  семнадцать: 17, семнадцати: 17,
  восемнадцать: 18, восемнадцати: 18,
  девятнадцать: 19, девятнадцати: 19,
};

const TENS = {
  двадцать: 20, двадцати: 20,
  тридцать: 30, тридцати: 30,
  сорок: 40, сорока: 40,
  пятьдесят: 50, пятидесяти: 50,
  шестьдесят: 60, шестидесяти: 60,
  семьдесят: 70, семидесяти: 70,
  восемьдесят: 80, восьмидесяти: 80,
  девяносто: 90, девяноста: 90,
};

const HUNDREDS = {
  сто: 100, ста: 100,
  двести: 200, двухсот: 200,
  триста: 300, трехсот: 300, трёхсот: 300,
  четыреста: 400, четырехсот: 400, четырёхсот: 400,
  пятьсот: 500, пятисот: 500,
  шестьсот: 600, шестисот: 600,
  семьсот: 700, семисот: 700,
  восемьсот: 800, восьмисот: 800,
  девятьсот: 900, девятисот: 900,
};

const HALF_WORDS = new Set(["полтора", "полторы", "полутора"]);

function normalizeToken(token) {
  return token.toLowerCase().replaceAll("ё", "е");
}

function multiplierInfo(word) {
  if (word === "ккк") return { value: 1_000_000_000, full: false };
  if (word === "кк") return { value: 1_000_000, full: false };
  if (word === "к") return { value: 1_000, full: false };
  if (word === "тыс" || word === "тыщ") return { value: 1_000, full: false };
  if (word === "млн") return { value: 1_000_000, full: false };
  if (word === "млрд") return { value: 1_000_000_000, full: false };
  if (/^(тысяча|тысячи|тысяч|тысячу|тысяче|тыща|тыщи)$/.test(word)) return { value: 1_000, full: true };
  if (/^(миллион|миллиона|миллионов|миллиону|миллионом)$/.test(word)) return { value: 1_000_000, full: true };
  if (/^(миллиард|миллиарда|миллиардов|миллиарду|миллиардом)$/.test(word)) {
    return { value: 1_000_000_000, full: true };
  }
  return null;
}

function halfCompound(word) {
  if (/^пол(?:тысячи|тысяча|тыщи|тыща)$/.test(word)) return 500;
  if (/^полмиллион/.test(word)) return 500_000;
  if (/^полмиллиард/.test(word)) return 500_000_000;
  if (word === "полтораста") return 150;
  return null;
}

function parseDigit(word) {
  const normalized = word.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function tokenize(text) {
  const re = /\d+(?:[.,]\d+)?|[a-zа-яё]+/gi;
  const tokens = [];
  let match;
  while ((match = re.exec(text))) {
    tokens.push({
      text: normalizeToken(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

function parseSequence(text, tokens, start) {
  let index = start;
  let total = 0;
  let current = 0;
  let seen = false;
  let seenHundreds = false;
  let seenTens = false;
  let seenOnes = false;
  let seenDigit = false;

  const resetGroup = () => {
    seenHundreds = false;
    seenTens = false;
    seenOnes = false;
    seenDigit = false;
  };

  while (index < tokens.length) {
    const token = tokens[index];
    const word = token.text;

    if (!seen && HALF_WORDS.has(word)) {
      const mult = index + 1 < tokens.length ? multiplierInfo(tokens[index + 1].text) : null;
      if (!mult) return null;
      total = Math.round(total + 1.5 * mult.value);
      index += 2;
      seen = true;
      current = 0;
      resetGroup();
      continue;
    }

    if (!seen && word === "пол") {
      const mult = index + 1 < tokens.length ? multiplierInfo(tokens[index + 1].text) : null;
      if (!mult?.full) return null;
      total = Math.round(total + 0.5 * mult.value);
      index += 2;
      seen = true;
      resetGroup();
      continue;
    }

    const compound = !seen ? halfCompound(word) : null;
    if (compound) {
      total = Math.round(total + compound);
      index += 1;
      seen = true;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(HUNDREDS, word)) {
      if (seenDigit || seenHundreds || seenTens || seenOnes) break;
      current += HUNDREDS[word];
      seenHundreds = true;
      seen = true;
      index += 1;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(TENS, word)) {
      if (seenDigit || seenTens || seenOnes) break;
      current += TENS[word];
      seenTens = true;
      seen = true;
      index += 1;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(ONES, word)) {
      if (seenDigit || seenOnes) break;
      if (ONES[word] === 0 && (seen || current !== 0 || total !== 0)) break;
      current += ONES[word];
      seenOnes = true;
      seen = true;
      index += 1;
      continue;
    }

    const digit = parseDigit(word);
    if (digit != null) {
      if (seenHundreds || seenTens || seenOnes || seenDigit) break;
      let num = digit;
      let cursor = index;
      let end = token.end;
      if (Number.isInteger(digit)) {
        while (cursor + 1 < tokens.length && /^\d{3}$/.test(tokens[cursor + 1].text)) {
          const gap = text.slice(end, tokens[cursor + 1].start);
          if (!/^\s*$/.test(gap)) break;
          num = num * 1000 + Number(tokens[cursor + 1].text);
          cursor += 1;
          end = tokens[cursor].end;
        }
      }
      current += num;
      seenDigit = true;
      seen = true;
      index = cursor + 1;
      continue;
    }

    const mult = multiplierInfo(word);
    if (mult) {
      const base = current === 0 ? (mult.full ? 1 : 0) : current;
      if (base === 0) break;
      total = Math.round(total + base * mult.value);
      current = 0;
      seen = true;
      resetGroup();
      index += 1;
      continue;
    }

    break;
  }

  if (!seen || index === start) return null;
  const value = Math.round(total + current);
  if (!Number.isFinite(value) || value <= 0 || value > 1e15) return null;
  const last = tokens[index - 1];
  return { value, start: tokens[start].start, end: last.end, nextToken: index };
}

/** Find money-like amounts in text. Indexes refer to the original string when fold() keeps length. */
export function findAmounts(input) {
  const folded = fold(String(input ?? ""));
  const source = folded.length === String(input ?? "").length ? folded : String(input ?? "");
  const tokens = tokenize(source);
  const amounts = [];
  let index = 0;
  while (index < tokens.length) {
    const parsed = parseSequence(source, tokens, index);
    if (parsed) {
      amounts.push({ value: parsed.value, start: parsed.start, end: parsed.end });
      index = parsed.nextToken;
    } else {
      index += 1;
    }
  }
  return amounts;
}
