/* Раздел Work: полный список кейсов с фильтром по веткам и двумя видами —
   сетка квадратами (как на главной) и список строками.

   Ветка и вид держатся в адресе (?branch=web&view=list), а не только в
   состоянии страницы: ссылка «Web» из секции Expertise на главной должна
   открывать отфильтрованный раздел напрямую, и этой же ссылкой можно
   поделиться. Переключение внутри страницы идёт через
   history.replaceState — в истории браузера не должно оставаться по
   записи на каждый клик. */

import { load, published, el, fail } from "./store.js";
import { card, row } from "./cards.js";
import { boot } from "./motion.js";

const host = document.querySelector("[data-rows]");
const filtersHost = document.querySelector("[data-filters]");
const viewsHost = document.querySelector("[data-views]");
const countHost = document.querySelector("[data-count]");
const reelButton = document.querySelector("[data-reel]");
const reelBox = document.querySelector("[data-reel-box]");
const reelVideo = reelBox && reelBox.querySelector("video");
let reelSrc = "";

const VIEWS = ["grid", "list"];

let all = [];
let branches = {};
const params = new URL(location.href).searchParams;
let current = params.get("branch") || "";
let view = VIEWS.includes(params.get("view")) ? params.get("view") : "grid";

function render() {
  const list = current ? all.filter((p) => p.branch === current) : all;
  const grid = view === "grid";

  host.className = grid ? "work" : "rows";
  host.replaceChildren(...(grid ? list.map((p) => card(p)) : list.map(row)));
  host.removeAttribute("aria-busy");
  boot(host);

  if (!list.length) {
    host.append(el("li", { class: "empty", text: "Nothing here yet." }));
  }

  countHost.textContent = current
    ? `${list.length} of ${all.length} projects · ${branches[current] || current}`
    : `${all.length} projects. Case pages are being filled in — ping me for anything missing.`;

  const mark = (hostEl, attr, value) =>
    hostEl.querySelectorAll(`[${attr}]`).forEach((b) => {
      const on = (b.getAttribute(attr) || "") === value;
      b.classList.toggle("is-current", on);
      b.setAttribute("aria-pressed", String(on));
    });
  mark(filtersHost, "data-branch", current);
  // Кнопка шоурила живёт только в ветке Motion и только если ролик задан.
  if (reelButton) reelButton.hidden = !(reelSrc && current === "motion");
  mark(viewsHost, "data-view", view);
}

function sync(key, value, fallback) {
  const url = new URL(location.href);
  if (value && value !== fallback) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  history.replaceState(null, "", url);
  render();
}

function buildFilters() {
  const entries = [["", "All"], ...Object.entries(branches)];
  filtersHost.replaceChildren(
    ...entries.map(([value, label]) =>
      el("button", {
        type: "button",
        class: "pill",
        "data-branch": value,
        "aria-pressed": "false",
        text: label,
        onclick: () => {
          current = value;
          sync("branch", value, "");
        },
      })
    )
  );
}

viewsHost.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (!b) return;
  view = b.dataset.view;
  sync("view", view, "grid");
});

load("projects")
  .then((data) => {
    all = published(data.projects);
    branches = data.branches || {};
    if (data.showreel && data.showreel.video) {
      const v = data.showreel.video;
      reelSrc = /^https?:/.test(v) ? v : (data.mediaBase || "") + v;
    }
    // Ветка из адреса может не существовать — тогда показываем всё,
    // а не пустой список с активным фильтром-призраком.
    if (current && !branches[current]) current = "";
    buildFilters();
    render();
  })
  .catch((err) => {
    host.removeAttribute("aria-busy");
    fail(host, err);
  });

/* Шоурил: ролик грузится только по нажатию — preload="none" и src
   ставится при открытии, чтобы тридцать секунд видео не тянулись с
   каждой загрузкой /work. Закрытие останавливает звук. */
if (reelButton && reelBox) {
  reelButton.addEventListener("click", () => {
    if (reelVideo.getAttribute("src") !== reelSrc) reelVideo.src = reelSrc;
    reelBox.showModal();
    reelVideo.play().catch(() => {});
  });
  reelBox.querySelector("[data-reel-close]").addEventListener("click", () => reelBox.close());
  reelBox.addEventListener("click", (e) => {
    if (e.target === reelBox) reelBox.close();
  });
  reelBox.addEventListener("close", () => reelVideo.pause());
}
