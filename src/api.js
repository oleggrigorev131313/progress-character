const PIN_KEY = "progress-character-pin";

export function getPin() {
  return localStorage.getItem(PIN_KEY) || "";
}

export function setPin(pin) {
  if (pin) localStorage.setItem(PIN_KEY, pin);
  else localStorage.removeItem(PIN_KEY);
}

async function request(method, path, body) {
  const headers = { accept: "application/json" };
  const pin = getPin();
  if (pin) headers["x-app-pin"] = pin;
  const init = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    document.dispatchEvent(new CustomEvent("pin-required"));
    throw new Error(data.error || "Нужен PIN");
  }
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  del: (path) => request("DELETE", path),
};
