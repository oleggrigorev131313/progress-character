import { formatXp } from "../shared/format.js";

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "value") node.value = value;
    else if (key === "checked") node.checked = Boolean(value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function field(label, control) {
  return el("label", { class: "field" }, el("span", { text: label }), control);
}

export function textInput(props = {}) {
  return el("input", { type: "text", ...props });
}

export function numInput(props = {}) {
  return el("input", { type: "number", inputmode: "numeric", min: "0", step: "1", ...props });
}

export function dateInput(props = {}) {
  return el("input", { type: "date", ...props });
}

export function selectInput(props, options, value) {
  const node = el(
    "select",
    props,
    options.map(([optionValue, label]) => el("option", { value: optionValue }, label)),
  );
  if (value != null) node.value = value;
  return node;
}

export function errorLine() {
  const node = el("p", { class: "form-error" });
  node.hidden = true;
  return node;
}

export function showError(node, message) {
  node.hidden = !message;
  node.textContent = message || "";
}

export function emptyState(text) {
  return el("p", { class: "empty" }, text);
}

let toastTimer = 0;

export function toast(message) {
  let node = document.querySelector(".toast");
  if (!node) {
    node = el("div", { class: "toast", role: "status" });
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("is-on"), 2800);
}

export function xpNote(prefix, delta) {
  if (!delta) {
    toast(prefix);
    return;
  }
  const sign = delta > 0 ? "+" : "−";
  toast(`${prefix} · ${sign}${formatXp(Math.abs(delta))} XP`);
}

export function refresh() {
  document.dispatchEvent(new CustomEvent("data-changed"));
}
