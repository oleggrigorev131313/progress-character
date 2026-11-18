export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function readJson(request) {
  const text = await request.text();
  if (text.length > 20_000) throw httpError(413, "Слишком большой запрос");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, "Некорректный JSON");
  }
}

export function nowIso() {
  return new Date().toISOString();
}
