import assert from "node:assert/strict";
import test from "node:test";
import { findAmounts } from "./amount.js";

function amount(text) {
  const found = findAmounts(text);
  assert.ok(found.length, `сумма не найдена: ${text}`);
  return found[0].value;
}

test("словесные и короткие суммы", () => {
  assert.equal(amount("пятьдесят тысяч"), 50000);
  assert.equal(amount("50к"), 50000);
  assert.equal(amount("50 к"), 50000);
  assert.equal(amount("50 тыс"), 50000);
  assert.equal(amount("50тыс"), 50000);
  assert.equal(amount("50 тыс."), 50000);
  assert.equal(amount("полтора миллиона"), 1500000);
  assert.equal(amount("полторы тысячи"), 1500);
  assert.equal(amount("полутора миллионов"), 1500000);
  assert.equal(amount("полмиллиона"), 500000);
  assert.equal(amount("1,5 млн"), 1500000);
  assert.equal(amount("1.5 млн"), 1500000);
  assert.equal(amount("1,5млн"), 1500000);
  assert.equal(amount("двадцать пять тысяч пятьсот"), 25500);
  assert.equal(amount("двадцати пяти тысяч"), 25000);
  assert.equal(amount("сто двадцать три тысячи четыреста пятьдесят шесть"), 123456);
  assert.equal(amount("две тысячи"), 2000);
  assert.equal(amount("две тысячи двадцать"), 2020);
  assert.equal(amount("тысяча"), 1000);
  assert.equal(amount("миллион"), 1000000);
  assert.equal(amount("2кк"), 2000000);
  assert.equal(amount("1 500 000"), 1500000);
  assert.equal(amount("50 000"), 50000);
  assert.equal(amount("пятьсот"), 500);
  assert.equal(amount("сто одна тысяча"), 101000);
});

test("сумма внутри фразы не захватывает хвост", () => {
  const found = findAmounts("получил 50к за маркетинг для Ивана");
  assert.equal(found.length, 1);
  assert.equal(found[0].value, 50000);
  assert.equal("получил 50к за маркетинг для Ивана".slice(found[0].start, found[0].end), "50к");
});

test("две отдельные суммы", () => {
  const found = findAmounts("50к и 20к");
  assert.deepEqual(found.map((item) => item.value), [50000, 20000]);
});

test("в обычных словах суммы нет", () => {
  assert.deepEqual(findAmounts("маркетинг для Ивана"), []);
});

test("разделители тысяч и десятичные", () => {
  assert.equal(amount("40.000"), 40000);
  assert.equal(amount("40.000 руб"), 40000);
  assert.equal(amount("40,000"), 40000);
  assert.equal(amount("1.500.000"), 1500000);
  assert.equal(amount("1,500,000"), 1500000);
  assert.equal(amount("40\u00A0000"), 40000);
  assert.equal(amount("40\u202F000 рублей"), 40000);
  assert.equal(amount("1,5 млн"), 1500000);
  assert.equal(amount("1.5 млн"), 1500000);
  const found = findAmounts("добавил 40.000 руб дохода");
  assert.equal(found[0].value, 40000);
  assert.match("добавил 40.000 руб дохода".slice(found[0].start, found[0].end), /40\.000\s*руб/);
});
