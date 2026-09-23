/* Карточка проекта — одна на главную и на сетку /work, строка — на
   список /work.

   Карточка текстовая: заливок-заглушек и графики в ячейке нет. Подпись
   прижата к низу, знак клиента квадратом 24 по правому краю подписи.
   Вторая строка подписи — что именно делал — раскрывается на ховере.

   Если у проекта задан цвет бренда (color в projects.json), знак уходит
   из подписи в центр ячейки, а чернила за курсором (js/spot.js) в этой
   ячейке окрашиваются цветом бренда; в остальных — акцентами шахматкой.
   Ссылка — прозрачный слой поверх всей ячейки: кликабельна вся карточка. */

import { el, yearMark } from "./store.js";

const HEX = /^#[0-9a-f]{3,8}$/i;

/* Путь в url() внутри кастомного свойства браузер разрешает относительно
   таблицы стилей, в которой это свойство подставляется, а не относительно
   документа — поэтому «assets/…» из json уезжает в «css/assets/…» и даёт
   404. Собираем абсолютный адрес заранее. */
function asUrl(path) {
  return `url("${new URL(path, document.baseURI).href}")`;
}

export function href(project) {
  return `case.html?p=${encodeURIComponent(project.slug)}`;
}

export function card(project) {
  const brand = HEX.test(project.color || "") && project.logo ? project.color : null;

  const title = el("span", { class: "card__title", text: project.title }, [
    yearMark(project.year),
  ]);

  const mark = project.logo
    ? el("span", { class: brand ? "card__logo" : "card__chip", "aria-hidden": "true" })
    : null;
  if (mark) mark.style.setProperty("--src", asUrl(project.logo));

  const cap = el("p", { class: "card__cap" }, [title, brand ? null : mark]);

  const kicker = project.kicker
    ? el("p", { class: "card__kicker", text: project.kicker })
    : null;

  const link = el("a", { class: "card__link", href: href(project), "aria-label": project.title });

  const li = el("li", { class: brand ? "card card--brand" : "card" }, [
    brand ? mark : null,
    cap,
    kicker,
    link,
  ]);
  if (brand) li.style.setProperty("--brand", brand);
  return li;
}

/* Строка списка на /work: тот же материал, другая плотность. Сетка
   показывает шесть избранных, список — всё, включая кейсы без обложки. */
export function row(project, index) {
  const num = String(index + 1).padStart(2, "0");

  // Строки входят со сдвигом по времени, но задержка упирается в потолок:
  // на пятнадцатом проекте ждать полторы секунды уже не «волна», а лаг.
  return el(
    "li",
    { class: "row rise", style: `--delay:${Math.min(index, 8) * 45}ms` },
    [
      el("a", { class: "row__link", href: href(project) }, [
        el("span", { class: "row__num", text: num }),
        el("span", { class: "row__title", text: project.title }, [yearMark(project.year)]),
        el("span", { class: "row__kicker", text: project.kicker || "" }),
        el("span", { class: "row__branch", text: project.branch || "" }),
        el("span", { class: "row__arrow", "aria-hidden": "true", text: "→" }),
      ]),
    ]
  );
}
