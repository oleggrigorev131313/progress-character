import "./styles.css";
import { getPin, setPin } from "./api.js";
import { renderAnalytics } from "./ui/analytics.js";
import { renderFinance } from "./ui/finance.js";
import { renderGrowth } from "./ui/growth.js";
import { renderHistory } from "./ui/history.js";
import { renderHome } from "./ui/home.js";
import { renderSettings } from "./ui/settings.js";
import { el } from "./ui/dom.js";
import { icon } from "./ui/icons.js";
import { mountVoice } from "./ui/voice.js";

const routes = {
  "/": renderHome,
  "/finance": renderFinance,
  "/growth": renderGrowth,
  "/history": renderHistory,
  "/analytics": renderAnalytics,
  "/settings": renderSettings,
};

const titles = {
  "/": "Обзор",
  "/finance": "Финансы",
  "/growth": "Саморазвитие",
  "/history": "Прогресс",
  "/analytics": "Аналитика",
  "/settings": "Настройки",
};

const nav = [
  ["/", "Обзор", "home"],
  ["/history", "Прогресс", "chart"],
  ["/finance", "Финансы", "wallet"],
  ["/growth?tab=goals", "Цели", "target"],
  ["/growth?tab=books", "Книги", "book"],
  ["/growth?tab=workouts", "Тренировки", "dumbbell"],
  ["/analytics", "Аналитика", "chart"],
  ["/settings", "Настройки", "gear"],
];

const app = document.querySelector("#app");
const backdrop = el("button", { class: "backdrop", type: "button", "aria-label": "Закрыть меню" });
const links = nav.map(([href, label, name]) => {
  const link = el("a", { href, "data-link": "true", "data-nav": href }, icon(name), el("span", { text: label }));
  return link;
});
const sidebar = el(
  "aside",
  { class: "sidebar" },
  el(
    "div",
    { class: "brand" },
    el("span", { class: "logo-mark", "aria-hidden": "true" }),
    el("p", { class: "brand-mark", text: "Прокачка" }),
  ),
  el("nav", { class: "nav", "aria-label": "Разделы" }, links),
  el(
    "div",
    { class: "user-card" },
    el("span", { class: "avatar", text: "О" }),
    el("span", {}, el("span", { class: "user-name", text: "Олег" }), el("span", { class: "user-meta", text: "Ульяновск" })),
  ),
);
const menu = el("button", { class: "menu", type: "button", "aria-label": "Меню" }, icon("home"));
menu.replaceChildren(svgMenu());
const topbar = el("header", { class: "topbar" }, menu, el("p", { class: "topbar-title", text: "Прокачка" }));
const outlet = el("div", { id: "outlet" });
const voice = el("section", { class: "voice-card", "aria-label": "Голосовой ввод" });
const column = el("div", { class: "column" }, topbar, outlet, voice);
app.className = "shell";
app.append(backdrop, sidebar, column);
mountVoice(voice);

let renderToken = 0;

async function render() {
  const token = ++renderToken;
  const path = location.pathname;
  const here = path === "/growth" && !location.search ? "/growth?tab=books" : `${path}${location.search}`;
  closeNav();
  for (const link of links) {
    const active = link.dataset.nav === here || (link.dataset.nav === path && !path.startsWith("/growth"));
    link.classList.toggle("is-on", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.title = `${titles[path] || "Прокачка"} — Прокачка персонажа`;
  outlet.replaceChildren(el("p", { class: "loading", text: "Загрузка…" }));
  const page = routes[path];
  const node = page ? await page() : notFound();
  if (token !== renderToken) return;
  outlet.replaceChildren(node);
  const hash = location.hash.slice(1);
  if (hash) document.getElementById(hash)?.scrollIntoView({ block: "start" });
}

function notFound() {
  return el(
    "div",
    { class: "page" },
    el("h1", { text: "Страница не найдена" }),
    el("a", { class: "btn", href: "/", "data-link": "true" }, "На главную"),
  );
}

function closeNav() {
  sidebar.classList.remove("is-open");
  backdrop.classList.remove("is-open");
}

menu.addEventListener("click", () => {
  sidebar.classList.toggle("is-open");
  backdrop.classList.toggle("is-open");
});
backdrop.addEventListener("click", closeNav);

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) return;
  const url = new URL(link.href, location.origin);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (next !== current) history.pushState({}, "", next);
  render();
});

window.addEventListener("popstate", () => render());
document.addEventListener("data-changed", () => render());

const pinInput = el("input", { type: "password", autocomplete: "current-password" });
const pinBox = el(
  "form",
  { class: "pin-box" },
  el("p", { class: "preview-title", text: "Нужен PIN" }),
  el("p", { class: "muted", text: "Сервер ожидает секрет APP_PIN. Он останется только в этом браузере." }),
  pinInput,
  el("button", { class: "btn", type: "submit" }, "Продолжить"),
);
const pinLayer = el("div", { class: "pin-layer" }, pinBox);
pinLayer.hidden = true;
document.body.append(pinLayer);
pinBox.addEventListener("submit", (event) => {
  event.preventDefault();
  setPin(pinInput.value.trim());
  pinLayer.hidden = true;
  render();
});
document.addEventListener("pin-required", () => {
  pinInput.value = getPin();
  pinLayer.hidden = false;
  pinInput.focus();
});

function svgMenu() {
  const template = document.createElement("template");
  template.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M5 8h14M5 12h14M5 16h14"/></svg>`;
  return template.content.firstElementChild;
}

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#voice-input")?.focus();
  }
});

render();
