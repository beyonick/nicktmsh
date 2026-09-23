/* Наклон набора за курсором — фирменный жест сайта (реф: buttermax.net).

   Заголовок ведёт себя как плоскость: доворачивается к курсору в
   перспективе и отступает от него. Замер по записи рефа: курсор справа —
   правый край уходит вглубь, текст отъезжает влево.

   Два режима на группу:
   - screen  — одна камера на весь экран: курсор считается от центра окна,
               и все элементы группы наклоняются согласованно, как сцена;
   - element — курсор считается от центра самого элемента: каждое слово
               смотрит на курсор своей плоскостью. У элемента есть зона
               влияния: наклон растёт, пока курсор подходит, и гаснет за
               двойной зоной — дальние слова стоят спокойно.

   Параметры группы:
   - amount — влияние: чувствительность к курсору. 1 — полный наклон,
              когда курсор в полуэкране от точки отсчёта, 2 — вдвое ближе
              (и зона элемента вдвое меньше);
   - rot    — наклон, градусы по горизонтали (по вертикали — 0.8 от него);
   - shift  — перемещение, пиксели макета 1200.

   Значения по умолчанию — GROUPS ниже. Панель «tilt» (js/tilt-panel.js)
   правит их вживую и хранит в localStorage; это настройка разработчика,
   на посетителей действуют только значения из кода.

   Метки секций, абзац About, слово Lab и футер стоят на месте намеренно.

   transform на целях принадлежит только этому модулю. Проявление .rise
   поэтому сделано свойством translate, а не transform: иначе наклон и
   проявление перетирали бы друг друга. */

export const GROUPS = {
  hero: { label: "Имя и подпись", sel: ".hero__title", mode: "screen", amount: 1, rot: 5, shift: 24 },
  branch: { label: "Web / Branding / 3D & Motion", sel: ".branch", mode: "element", amount: 4, rot: 15, shift: 10 },
  display: { label: "Have a project…", sel: ".display", mode: "screen", amount: 1, rot: 5, shift: 24 },
  logo: { label: "Знак бренда в ячейке", sel: ".card__logo", mode: "element", amount: 4, rot: 18, shift: 0 },
  title: { label: "Заголовок раздела", sel: ".page-title:not(.page-title--lab)", mode: "screen", amount: 1, rot: 5, shift: 24 },
  next: { label: "Следующий кейс", sel: ".case-next__link", mode: "screen", amount: 1, rot: 5, shift: 24 },
};

export const PARAMS = ["mode", "amount", "rot", "shift"];

const STORE = "nicktmsh:tilt";
const PERSPECTIVE = 900; // px, потолок: у мелких элементов перспектива ближе
const EASE = 0.06; // как быстро плоскость догоняет курсор

const enabled =
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

const defaults = JSON.parse(JSON.stringify(GROUPS));

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if (saved) {
    for (const [key, values] of Object.entries(saved)) {
      if (!GROUPS[key]) continue;
      for (const p of PARAMS) if (p in values) GROUPS[key][p] = values[p];
    }
  }
} catch {
  // приватный режим или битое значение — работаем с кодом
}

const groupOf = new WeakMap();
const state = new WeakMap();
const visible = new Set();

const pointer = { x: 0, y: 0, active: false };
let raf = 0;

const clamp = (v) => Math.max(-1, Math.min(1, v));

/* Центр по раскладке, а не по getBoundingClientRect: прямоугольник
   повёрнутой плоскости несимметричен, и центр по нему уезжал бы к
   ближнему краю — наклон начал бы сам себя раскачивать. */
function center(el) {
  let x = 0;
  let y = 0;
  for (let n = el; n; n = n.offsetParent) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return {
    x: x - scrollX + el.offsetWidth / 2,
    y: y - scrollY + el.offsetHeight / 2,
  };
}

function frame() {
  raf = 0;
  const vw = innerWidth;
  const vh = innerHeight;
  const u = vw / 1200;
  let moving = false;

  for (const el of visible) {
    const g = GROUPS[groupOf.get(el)];
    const s = state.get(el);

    let tx = 0;
    let ty = 0;
    if (pointer.active && g.mode === "element") {
      const c = center(el);
      const dx = ((pointer.x - c.x) / (vw / 2)) * g.amount;
      const dy = ((pointer.y - c.y) / (vw / 2)) * g.amount;
      const q = Math.hypot(dx, dy);
      if (q > 0) {
        const m = q <= 1 ? q : Math.max(0, 2 - q);
        tx = (dx / q) * m;
        ty = (dy / q) * m;
      }
    } else if (pointer.active) {
      tx = clamp(((pointer.x - vw / 2) / (vw / 2)) * g.amount);
      ty = clamp(((pointer.y - vh / 2) / (vh / 2)) * g.amount);
    }

    s.x += (tx - s.x) * EASE;
    s.y += (ty - s.y) * EASE;
    if (Math.abs(tx - s.x) > 1e-4 || Math.abs(ty - s.y) > 1e-4) moving = true;

    // Перспектива ближе у мелких элементов: на знаке в 80px та же, что у
    // строки в 900px, превратила бы наклон в едва заметное сжатие.
    const persp = Math.max(260, Math.min(PERSPECTIVE, el.offsetWidth * 2.5));

    // Курсор справа — правый край уходит вглубь: плоскость смотрит на
    // курсор и отступает от него.
    el.style.transform =
      `perspective(${persp.toFixed(0)}px) ` +
      `translate3d(${(-s.x * g.shift * u).toFixed(2)}px, ${(-s.y * g.shift * u * 0.6).toFixed(2)}px, 0) ` +
      `rotateX(${(-s.y * g.rot * 0.8).toFixed(3)}deg) rotateY(${(s.x * g.rot).toFixed(3)}deg)`;
  }

  if (moving) raf = requestAnimationFrame(frame);
}

function kick() {
  if (!raf) raf = requestAnimationFrame(frame);
}

const io = enabled
  ? new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        kick();
      },
      { rootMargin: "120px 0px" }
    )
  : null;

export function watchTilt(root = document) {
  if (!enabled) return;
  for (const [key, g] of Object.entries(GROUPS)) {
    root.querySelectorAll(g.sel).forEach((el) => {
      if (groupOf.has(el)) return;
      groupOf.set(el, key);
      state.set(el, { x: 0, y: 0 });
      io.observe(el);
    });
  }
}

/* --- API панели --------------------------------------------------------------- */

export function tiltGroupOf(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (groupOf.has(n)) return groupOf.get(n);
  }
  return null;
}

export function setTilt(key, param, value) {
  GROUPS[key][param] = value;
  const diff = {};
  for (const [k, g] of Object.entries(GROUPS)) {
    const d = {};
    for (const p of PARAMS) if (g[p] !== defaults[k][p]) d[p] = g[p];
    if (Object.keys(d).length) diff[k] = d;
  }
  try {
    localStorage.setItem(STORE, JSON.stringify(diff));
  } catch {
    // не смогли сохранить — правка всё равно действует до перезагрузки
  }
  kick();
}

export function resetTilt(key) {
  for (const p of PARAMS) setTilt(key, p, defaults[key][p]);
}

if (enabled) {
  addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      kick();
    },
    { passive: true }
  );
  // В режиме element точка отсчёта едет вместе со страницей.
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", kick);
}
