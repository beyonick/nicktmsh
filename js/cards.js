/* Карточка проекта — одна на главную и на сетку /work, строка — на
   список /work.

   Карточка текстовая: заливок-заглушек и графики в ячейке нет. Подпись
   прижата к низу, одна строка: название, на ховере — что именно делал.

   Знак клиента стоит по центру ячейки. Если у проекта задан цвет бренда
   (color в projects.json), чернила за курсором (js/spot.js) в этой ячейке
   окрашиваются им; в остальных — акцентами шахматкой.
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
  const brand = HEX.test(project.color || "") ? project.color : null;

  // Знак — по центру ячейки у каждого проекта, у которого он есть. Ширина
  // и высота считаются от пропорции знака так, чтобы площадь была одна:
  // квадратный МТС и длинный вордмарк выглядят одного веса, а не одной
  // ширины (ratio приходит из projects.json, по умолчанию квадрат).
  const mark = project.logo ? el("span", { class: "card__logo", "aria-hidden": "true" }) : null;
  if (mark) {
    const ar = Number(project.logoRatio) || 1;
    mark.style.setProperty("--src", asUrl(project.logo));
    mark.style.width = `${Math.min(60, 25 * Math.sqrt(ar))}%`;
    mark.style.height = `${Math.min(60, 25 / Math.sqrt(ar))}%`;
  }

  // Подпись — одна строка. В покое виден заголовок; на ховере он уходит
  // вверх, а на его место проявляется вторая строка — что именно делал.
  const title = el("span", { class: "card__title", text: project.title }, [
    yearMark(project.year),
  ]);
  const kicker = project.kicker
    ? el("span", { class: "card__kicker", text: project.kicker })
    : null;
  const cap = el("p", { class: "card__cap" }, [title, kicker]);

  const link = el("a", { class: "card__link", href: href(project), "aria-label": project.title });

  const li = el("li", { class: mark ? "card card--logo" : "card" }, [mark, cap, link]);
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
