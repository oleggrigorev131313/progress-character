export async function pinsMatch(provided, expected) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(provided))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(expected))),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(left, right);
  }
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function assertPin(request, env) {
  const expected = env?.APP_PIN;
  if (typeof expected !== "string" || expected.length === 0) return;
  const provided = request.headers.get("X-App-Pin") || "";
  if (!(await pinsMatch(provided, expected))) {
    const error = new Error("Неверный PIN");
    error.status = 401;
    throw error;
  }
}
