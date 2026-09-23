/* Моторика: проявление блоков и набора.

   Одна кривая и одна длительность на весь сайт — они живут в --ease-out и
   --dur и правятся панелью «ease» справа внизу. Здесь их читают, а не
   задают заново: иначе моторика разъедется между CSS и JS.

   Текст
   -----
   Слова оборачиваются в маску и выезжают из-под неё со сдвигом по времени.
   Оборачивается ровно текстовый узел, поэтому <em>, <br> и ссылки внутри
   абзаца остаются на месте — разметка не переписывается, только текст
   внутри неё. Это важнее, чем кажется: построчная разбивка с переносом
   узлов ломает и выделение курсором, и копирование.

   Маска — overflow: hidden на inline-block. Сама по себе она срезает
   выносные элементы (g, y, р), поэтому слово получает вертикальный
   внутренний отступ и равный ему отрицательный внешний: маска шире
   строки, а в потоке слово занимает прежнее место.

   Всё выключается при prefers-reduced-motion: тогда страница просто
   стоит на месте, а не проигрывает то же самое быстрее. */

import { watchTilt } from "./tilt.js";
import { watchSpots } from "./spot.js";
import "./smooth.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --- Разбивка на слова ------------------------------------------------------ */

function wrapWords(root) {
  const words = [];

  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) continue;

        const frag = document.createDocumentFragment();
        // Разделители сохраняем как есть: схлопнуть их в один пробел —
        // значит потерять неразрывные пробелы, которые расставлены руками.
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (!part.trim()) {
            frag.append(part);
            continue;
          }
          const mask = document.createElement("span");
          mask.className = "w";
          const inner = document.createElement("span");
          inner.className = "w__in";
          inner.textContent = part;
          mask.append(inner);
          frag.append(mask);
          words.push(inner);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
        walk(child);
      }
    }
  };

  walk(root);
  return words;
}

/* --- Проявление ------------------------------------------------------------- */

function readMotion() {
  const cs = getComputedStyle(document.documentElement);
  return {
    ease: cs.getPropertyValue("--ease-out").trim() || "cubic-bezier(0.16, 1, 0.3, 1)",
    dur: Number.parseFloat(cs.getPropertyValue("--dur")) || 600,
  };
}

function playWords(words, base) {
  const { ease, dur } = readMotion();

  words.forEach((w, i) => {
    w.animate(
      [
        { transform: "translateY(105%)", opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      {
        duration: dur * 1.4,
        // Шаг между словами заметно короче длительности: слова должны
        // догонять друг друга, а не выстраиваться в очередь.
        delay: base + i * 42,
        easing: ease,
        fill: "both",
      }
    );
  });
}

const io =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io.unobserve(e.target);
            e.target.classList.add("is-in");
            if (e.target.__words) playWords(e.target.__words, Number(e.target.dataset.delay) || 0);
          }
        },
        { rootMargin: "0px 0px -10% 0px" }
      )
    : null;

/* Блок целиком: то, что не разбивается на слова — сетки, ленты, картинки. */
export function watchRise(root = document) {
  const list = root.querySelectorAll(".rise:not(.is-in)");
  if (reduced || !io) {
    list.forEach((n) => n.classList.add("is-in"));
    return;
  }
  list.forEach((n) => io.observe(n));
}

/* Набор: разбивается на слова и выезжает из-под маски. */
export function watchSplit(root = document) {
  const list = root.querySelectorAll("[data-split]:not([data-split-done])");

  list.forEach((n) => {
    n.setAttribute("data-split-done", "");
    if (reduced || !io) return;

    n.__words = wrapWords(n);
    n.classList.add("is-split");
    io.observe(n);
  });
}

/* --- Заливка по скроллу -----------------------------------------------------
   Дисплейный набор стоит на месте приглушённым, а цвет наливается по
   буквам вслед за скроллом (реф: vectors-group.com). Букв на экране
   сотня, поэтому каждую не красим: на блоке меняется одно число --p
   (сколько букв залито), цвет буквы считает CSS по её номеру --i. Слово
   целиком лежит в nowrap-обёртке, иначе строка могла бы порваться между
   буквами. */

const fills = [];

function wrapChars(root) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) continue;
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (!part.trim()) {
            frag.append(part);
            continue;
          }
          const word = document.createElement("span");
          word.className = "fw";
          for (const ch of part) {
            const c = document.createElement("span");
            c.className = "fc";
            c.style.setProperty("--i", String(i++));
            c.textContent = ch;
            word.append(c);
          }
          frag.append(word);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
        walk(child);
      }
    }
  };
  walk(root);
  return i;
}

export function watchFill(root = document) {
  root.querySelectorAll("[data-fill]:not([data-fill-done])").forEach((n) => {
    n.setAttribute("data-fill-done", "");
    if (reduced) return;
    const total = wrapChars(n);
    n.classList.add("is-fill");
    fills.push({ node: n, total });
  });
}

// Заливка начинается, когда верх блока на 88% высоты окна, и заканчивается,
// когда низ блока поднялся до 45%: текст успевает налиться, пока его читают.
function fillFrame() {
  const h = innerHeight;
  for (const f of fills) {
    const box = f.node.getBoundingClientRect();
    if (box.bottom < -100 || box.top > h + 100) continue;
    const span = h * 0.88 - h * 0.45 + box.height;
    const p = Math.min(1, Math.max(0, (h * 0.88 - box.top) / span));
    // Запас в шесть букв на мягкий край: при p = 1 залит и хвост.
    f.node.style.setProperty("--p", (p * (f.total + 6)).toFixed(2));
  }
}

/* --- Числа ------------------------------------------------------------------
   Счётчик добегает до значения из data-count-to. Ширина не скачет: цифры
   моноширинные, и у контейнера стоит font-variant-numeric: tabular-nums. */

export function watchCounters(root = document) {
  const list = root.querySelectorAll("[data-count-to]:not([data-count-done])");

  list.forEach((n) => {
    n.setAttribute("data-count-done", "");
    const to = Number(n.dataset.countTo) || 0;

    if (reduced || !io) {
      n.textContent = String(to);
      return;
    }

    n.textContent = "0";
    const run = () => {
      const started = performance.now();
      const span = 1100;
      const step = (now) => {
        const k = Math.min((now - started) / span, 1);
        // Выкат по той же кривой, что и всё остальное: резкий старт,
        // длинное торможение.
        const eased = 1 - Math.pow(1 - k, 4);
        n.textContent = String(Math.round(to * eased));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const once = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      once.disconnect();
      run();
    });
    once.observe(n);
  });
}

/* --- Параллакс ---------------------------------------------------------------
   Сдвиг по скроллу для декоративной графики. Считается в одном общем
   кадре: отдельный обработчик скролла на каждый элемент — верный способ
   получить дёрганый скролл на слабой машине. */

const parallax = [];

export function watchParallax(root = document) {
  if (reduced) return;
  root.querySelectorAll("[data-para]:not([data-para-done])").forEach((n) => {
    n.setAttribute("data-para-done", "");
    parallax.push({ node: n, k: Number(n.dataset.para) || 0.1 });
  });
}

let ticking = false;
function frame() {
  ticking = false;
  fillFrame();
  const h = innerHeight;
  for (const p of parallax) {
    const box = p.node.getBoundingClientRect();
    if (box.bottom < -200 || box.top > h + 200) continue;
    // 0 в центре экрана, ±1 у краёв — сдвиг симметричен относительно
    // момента, когда блок стоит по центру.
    const t = (box.top + box.height / 2 - h / 2) / h;
    p.node.style.setProperty("--shift", `${(-t * p.k * 100).toFixed(2)}px`);
  }
}

addEventListener(
  "scroll",
  () => {
    if (ticking || (!parallax.length && !fills.length)) return;
    ticking = true;
    requestAnimationFrame(frame);
  },
  { passive: true }
);
addEventListener("resize", () => frame());

/* --- Запуск ------------------------------------------------------------------ */

export function boot(root = document) {
  watchRise(root);
  watchSplit(root);
  watchCounters(root);
  watchParallax(root);
  watchFill(root);
  watchTilt(root);
  watchSpots(root);
  frame();
}

boot();
