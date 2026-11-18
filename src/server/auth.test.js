import assert from "node:assert/strict";
import test from "node:test";
import { assertPin, pinsMatch } from "./auth.js";

test("PIN сравнивается по значению, пустой секрет выключен", async () => {
  assert.equal(await pinsMatch("1234", "1234"), true);
  assert.equal(await pinsMatch("1234", "9999"), false);
  assert.equal(await pinsMatch("", "1234"), false);

  const open = new Request("https://app.local/api/summary");
  await assertPin(open, {});
  await assertPin(open, { APP_PIN: "" });

  const locked = new Request("https://app.local/api/summary", { headers: { "X-App-Pin": "secret" } });
  await assertPin(locked, { APP_PIN: "secret" });
  await assert.rejects(assertPin(open, { APP_PIN: "secret" }), (error) => error.status === 401);
});
