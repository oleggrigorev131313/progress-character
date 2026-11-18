import assert from "node:assert/strict";
import test from "node:test";
import { fold, namesMatch, textMatches } from "./text.js";

test("fold не меняет длину русской строки", () => {
  const text = "Ёлка и ещё Иван";
  assert.equal(fold(text).length, text.length);
  assert.equal(fold(text), "елка и еще иван");
});

test("имена в разных падежах", () => {
  assert.equal(namesMatch("Ивану", "Иван"), true);
  assert.equal(namesMatch("Маше", "Маша"), true);
  assert.equal(namesMatch("Петра", "Петр"), true);
  assert.equal(namesMatch("Олег", "Анна"), false);
});

test("названия книг", () => {
  assert.equal(textMatches("Сапиенс", "сапиенс"), true);
  assert.equal(textMatches("Атомные привычки", "атомные привычки"), true);
  assert.equal(textMatches("Атомные привычки", "атомных привычек"), true);
  assert.equal(textMatches("Сапиенс", "война и мир"), false);
});
