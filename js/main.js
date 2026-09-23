// Ленты, QA-оверлей сетки и панель кривых. Проявление блоков и набора
// живёт в js/motion.js — здесь его больше нет, чтобы один и тот же класс
// .rise не заводился двумя наблюдателями сразу.

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Ленты клиентов и слов: живут своей жизнью и вдобавок слушают скролл —
// не один или другой, а оба слоя разом. Строки --back едут встречно
// основным. Лента слов по умолчанию идёт влево, лента логотипов — вправо.
//
// Скорость общая: 102 макетных пикселя в секунду (--marquee-speed).
// Позиция считается в пикселях, поэтому базовую скорость домножаем на
// текущий --u — иначе на широком экране ленты ползли бы медленнее.
//
// Скролл не бьёт по позиции напрямую: его скорость сглаживается
// экспоненциальным фильтром, а разворот направления — вторым, более
// ленивым. Поэтому рывок колеса не дёргает ленту, а подталкивает её.
//
// Контент в каждой дорожке повторяется, поэтому половина scrollWidth —
// целое число циклов: по ней и оборачиваем позицию.
const tickerTracks = document.querySelectorAll(".ticker__track, .marquee__track");

if (tickerTracks.length && !reduced) {
  const tracks = Array.from(tickerTracks, (track) => ({
    track,
    half: 0,
    x: 0,
    dir:
      (track.closest(".ticker__row--back, .marquee__row--back") ? -1 : 1) *
      (track.closest(".marquee") ? -1 : 1),
  }));

  const readSpeed = () => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--marquee-speed")
      .trim();
    return Number.parseFloat(raw) || 102;
  };

  let baseSpeed = readSpeed(); // макетных px/сек
  let unit = window.innerWidth / 1200; // текущее значение --u в пикселях

  const measure = () => {
    unit = window.innerWidth / 1200;
    baseSpeed = readSpeed();
    tracks.forEach((s) => {
      s.half = s.track.scrollWidth / 2 || 1;
    });
  };
  measure();
  window.addEventListener("resize", measure);
  // Ширина ленты слов зависит от Cy: до загрузки шрифта цикл посчитан по
  // подменному гротеску, и на обороте был бы виден шов.
  if (document.fonts) document.fonts.ready.then(measure);

  const SMOOTH_VEL = 0.14; // постоянная времени фильтра скорости скролла, сек
  const SMOOTH_DIR = 0.45; // разворот направления — заметно ленивее
  const BOOST = 0.3; // доля скорости скролла, попадающая в ленту
  const MAX_BOOST = 2600; // потолок, чтобы бросок страницы не выстреливал лентой
  const FLIP_AT = 60; // порог скорости, с которого лента начинает разворот

  let scrollVel = 0; // сглаженная скорость скролла, px/сек
  let dirMix = 1; // −1..1, плавный разворот базового направления
  let pending = 0; // накопленная дельта скролла между кадрами
  let lastY = window.scrollY;
  let lastTime = performance.now();

  const tick = (time) => {
    const dt = Math.min(time - lastTime, 100) / 1000;
    lastTime = time;

    // Мгновенная скорость скролла за кадр → фильтр. Коэффициент считается
    // от dt, а не берётся константой, поэтому сглаживание не зависит от
    // частоты кадров: на 60 и 144 Гц характер одинаковый.
    const rawVel = dt > 0 ? pending / dt : 0;
    pending = 0;
    scrollVel +=
      (clamp(rawVel, -MAX_BOOST, MAX_BOOST) - scrollVel) * (1 - Math.exp(-dt / SMOOTH_VEL));
    if (Math.abs(scrollVel) < 0.5) scrollVel = 0;

    const wanted = scrollVel < -FLIP_AT ? -1 : scrollVel > FLIP_AT ? 1 : dirMix;
    dirMix += (wanted - dirMix) * (1 - Math.exp(-dt / SMOOTH_DIR));

    const speed = baseSpeed * unit * dirMix + scrollVel * BOOST;

    tracks.forEach((s) => {
      s.x += s.dir * speed * dt;
      if (s.x > 0) s.x -= s.half;
      if (s.x < -s.half) s.x += s.half;
      s.track.style.transform = `translateX(${s.x}px)`;
    });

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      pending += y - lastY;
      lastY = y;
    },
    { passive: true }
  );
}

// Толщина линии для SVG и холстов (--line-px). Рамку браузер округляет
// вниз до целых пикселей устройства, stroke и lineWidth холста — нет: на
// масштабе экрана 125% рамка в 2px выходит двумя пикселями, а линия
// пиктограммы — двумя с половиной. Здесь то же округление делается руками,
// и всё, что не рамка, получает ровно ту толщину, что у рамок.
function snapLine() {
  const root = document.documentElement;
  const w = Number.parseFloat(getComputedStyle(root).getPropertyValue("--line-w")) || 2;
  const dpr = window.devicePixelRatio || 1;
  // +0.01 — страховка от 2.9999 при делении: иначе floor срезал бы пиксель.
  const px = Math.max(1, Math.floor(w * dpr + 0.01)) / dpr;
  root.style.setProperty("--line-px", `${px}px`);
}
snapLine();
// Масштаб страницы (Ctrl +/−) меняет devicePixelRatio и присылает resize.
window.addEventListener("resize", snapLine);

// Кнопки: стрелка слева, появляется на ховере и раздвигает кнопку.
// Ставится скриптом, а не в разметке: часть кнопок собирают work.js и
// case.js, и правило обязано доходить и до них. Сама стрелка нарисована
// в CSS рамками (.arrow) — теми же, что обводка кнопки.
const ARROW = '<span class="pill__arrow arrow" aria-hidden="true"></span>';

function armPills(root) {
  root.querySelectorAll(".pill:not([data-armed])").forEach((pill) => {
    pill.setAttribute("data-armed", "");
    pill.insertAdjacentHTML("afterbegin", ARROW);
  });
}
armPills(document);
new MutationObserver((records) => {
  for (const r of records) {
    for (const n of r.addedNodes) if (n.nodeType === 1) armPills(n.parentElement || n);
  }
}).observe(document.body, { childList: true, subtree: true });

// Переключатель сетки: QA-оверлей колонок поверх страницы.
const gridSwitch = document.querySelector(".grid-switch");
if (gridSwitch) {
  gridSwitch.addEventListener("click", () => {
    const on = document.documentElement.classList.toggle("show-grid");
    gridSwitch.setAttribute("aria-pressed", String(on));
  });
}

// --- Панель кривых ----------------------------------------------------------
// Правит --ease, --dur-ui и --dur на <html>: этого достаточно, чтобы
// поменялась вся интерактивная моторика сразу — стили нигде не хардкодят
// кривую. Значения переживают перезагрузку через localStorage, но в
// разметку не попадают: это инструмент разработки, а не состояние страницы.
const easePanel = document.querySelector(".easepanel");
const easeSwitch = document.querySelector(".ease-switch");

if (easePanel && easeSwitch) {
  const PRESETS = {
    smooth: [0.22, 1, 0.36, 1], // outQuint — спокойный вход, длинный выкат
    expo: [0.16, 1, 0.3, 1],
    quart: [0.25, 1, 0.5, 1],
    circ: [0, 0.55, 0.45, 1],
    back: [0.34, 1.56, 0.64, 1], // с перелётом
    swift: [0.4, 0, 0.2, 1], // короткая, material-подобная
  };
  const STORE = "nicktmsh:ease";
  const root = document.documentElement;

  const ease = { bez: PRESETS.swift.slice(), ui: 460, rise: 600, line: 2 };

  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && Array.isArray(saved.bez) && saved.bez.length === 4) Object.assign(ease, saved);
  } catch (err) {
    // приватный режим или битое значение — работаем со значениями по умолчанию
  }

  const presetBox = easePanel.querySelector(".easepanel__presets");
  const sliders = [...easePanel.querySelectorAll("input[type=range]")];
  const curve = easePanel.querySelector(".easepanel__curve path");
  const stage = easePanel.querySelector(".easepanel__demo");
  const dot = easePanel.querySelector(".easepanel__dot");
  const code = easePanel.querySelector(".easepanel__code");

  Object.keys(PRESETS).forEach((name) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "easepanel__preset";
    b.textContent = name;
    b.dataset.preset = name;
    b.setAttribute("aria-pressed", "false");
    presetBox.append(b);
  });

  const css = () => `cubic-bezier(${ease.bez.map((n) => +n.toFixed(2)).join(", ")})`;

  const apply = () => {
    root.style.setProperty("--ease", css());
    root.style.setProperty("--dur-ui", `${ease.ui}ms`);
    root.style.setProperty("--dur", `${ease.rise}ms`);
    // Множитель к --u: сама --line собирается из него в tokens.css, поэтому
    // одним свойством меняются и рамки, и линейка шапки, и stroke стрелки.
    root.style.setProperty("--line-w", String(ease.line));
    snapLine();

    // Кривая рисуется в системе 0,0 слева внизу, поэтому y инвертируется.
    const [x1, y1, x2, y2] = ease.bez;
    curve.setAttribute(
      "d",
      `M0 100 C ${x1 * 100} ${100 - y1 * 100}, ${x2 * 100} ${100 - y2 * 100}, 100 0`
    );

    sliders.forEach((input) => {
      const i = input.dataset.bez;
      const isLine = input.dataset.line !== undefined;
      const value = i !== undefined ? ease.bez[+i] : isLine ? ease.line : ease[input.dataset.dur];
      input.value = value;
      input.nextElementSibling.textContent =
        i !== undefined ? (+value).toFixed(2) : isLine ? `${value}px` : `${value}`;
    });

    presetBox.querySelectorAll(".easepanel__preset").forEach((b) => {
      const p = PRESETS[b.dataset.preset];
      b.setAttribute(
        "aria-pressed",
        String(p.every((n, i) => Math.abs(n - ease.bez[i]) < 0.005))
      );
    });

    code.textContent = css();

    try {
      localStorage.setItem(STORE, JSON.stringify(ease));
    } catch (err) {
      // не смогли сохранить — не повод ломать панель
    }
  };

  // Предпросмотр: точка ездит той же кривой и длительностью, что уходят
  // в страницу, — характер видно, а не только цифры.
  let away = false;
  const demo = () => {
    dot.style.transition = `transform ${ease.ui}ms ${css()}`;
    away = !away;
    dot.style.transform = away ? `translateX(${stage.clientWidth - 26}px)` : "translateX(0)";
  };

  presetBox.addEventListener("click", (e) => {
    const name = e.target.dataset && e.target.dataset.preset;
    if (!name) return;
    ease.bez = PRESETS[name].slice();
    apply();
    demo();
  });

  sliders.forEach((input) => {
    input.addEventListener("input", () => {
      if (input.dataset.bez !== undefined) ease.bez[+input.dataset.bez] = +input.value;
      else if (input.dataset.line !== undefined) ease.line = +input.value;
      else ease[input.dataset.dur] = +input.value;
      apply();
    });
    if (input.dataset.line === undefined) input.addEventListener("change", demo);
  });

  code.addEventListener("click", () => {
    if (navigator.clipboard) navigator.clipboard.writeText(css());
    code.textContent = "скопировано";
    setTimeout(apply, 900);
  });

  easeSwitch.addEventListener("click", () => {
    const open = easePanel.hasAttribute("hidden");
    easePanel.toggleAttribute("hidden", !open);
    easeSwitch.setAttribute("aria-expanded", String(open));
    if (open) demo();
  });

  apply();
}
