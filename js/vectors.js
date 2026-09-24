/* Векторная графика: техническая линия как второй материал сайта.

   У страницы уже есть один сильный приём — чернила в первом экране.
   Второй не должен с ним спорить, поэтому вся графика ниже — тонкая
   линия той же толщины, что линейка шапки и рамки ячеек (--line), и того
   же акцентного цвета. Ничего залитого, ничего растрового: страница
   остаётся чертежом, а не коллажем.

   Четыре элемента, все через один атрибут data-vg:

     corners        угловые метки по углам блока — кадрирование
     rule           линейка с тиками и номером — измерение
     solid:<имя>    проволочный объект, медленно вращается — предмет
     field          поле стрелок, смотрит на курсор — вектор

   Объекты и поле рисуются в canvas, а не в SVG. Выглядит это так же —
   та же линия той же толщины, — но шесть SVG, которым каждый кадр
   переписывают координаты тридцати рёбер, дают 180 правок DOM на кадр,
   а холст просто перерисовывается. Метки и линейки, наоборот, статичны
   и живут разметкой.

   Всё, что за пределами экрана, не считается вообще: наблюдатель снимает
   объект с очереди кадров, пока его не видно. */

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DPR = () => Math.min(devicePixelRatio || 1, 2);

/* --- Палитра ----------------------------------------------------------------
   Цвета читаются у страницы, а не дублируются числами: тема переключается
   атрибутом data-theme, и графика обязана идти за ней. */

function cssColor(prop, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  return raw || fallback;
}

let ink = "#BFFE89";
let hair = "#3a4a32";
let lineW = 2;
let unit = 1;

/* Кастомное свойство возвращается сырым токеном: --line это буквально
   «calc(2 * 1px)», и число из него не вынуть. Поэтому толщина читается из
   --line-px — её js/main.js кладёт готовым числом в пикселях и уже
   округлённой так же, как браузер округляет рамки: линия холста выходит
   ровно той же толщины, что рамки и линейка шапки. Макетная единица
   считается тем же правилом, что в tokens.css, — 1/1200 ширины окна. */
function readMetrics() {
  lineW = Number.parseFloat(cssColor("--line-px", "")) || Number.parseFloat(cssColor("--line-w", "2")) || 2;
  unit = innerWidth / 1200;
}

function readPalette() {
  ink = cssColor("--accent", "#BFFE89");
  const probe = document.createElement("span");
  probe.style.color = cssColor("--hair", "#3a4a32");
  document.body.append(probe);
  hair = getComputedStyle(probe).color;
  probe.remove();
  readMetrics();
}

/* --- Геометрия проволочных объектов -----------------------------------------
   Шесть форм, которые обязаны отличаться друг от друга: разная топология,
   разная плотность линий, разный масштаб в кадре. Шесть похожих объектов в
   одинаковых ячейках превращают самую сильную секцию сайта в обои. */

function icosahedron() {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [];
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      v.push([0, s1, s2 * t], [s1, s2 * t, 0], [s2 * t, 0, s1]);
    }
  return { v: norm(v), e: byDistance(v, 2.1) };
}

function cubes() {
  const v = [];
  const e = [];
  [1, 0.5].forEach((s, n) => {
    const base = v.length;
    for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) v.push([x, y, z]);
    // Рёбра куба: пары вершин, отличающиеся ровно одной координатой.
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const a = v[base + i];
        const b = v[base + j];
        const diff = a.reduce((k, c, idx) => k + (c !== b[idx] ? 1 : 0), 0);
        if (diff === 1) e.push([base + i, base + j]);
      }
    if (n === 1) for (let i = 0; i < 8; i++) e.push([i, base + i]); // связки между кубами
  });
  return { v: norm(v), e };
}

function torus(R = 0.72, r = 0.3, nu = 16, nv = 8) {
  const v = [];
  const e = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const u = (i / nu) * Math.PI * 2;
      const w = (j / nv) * Math.PI * 2;
      v.push([(R + r * Math.cos(w)) * Math.cos(u), (R + r * Math.cos(w)) * Math.sin(u), r * Math.sin(w)]);
      const id = i * nv + j;
      e.push([id, ((i + 1) % nu) * nv + j], [id, i * nv + ((j + 1) % nv)]);
    }
  return { v: norm(v), e };
}

function helix(turns = 3.5, n = 72) {
  const v = [];
  const e = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = k * Math.PI * 2 * turns;
    v.push([Math.cos(a) * 0.62, k * 2 - 1, Math.sin(a) * 0.62]);
    if (i) e.push([i - 1, i]);
    // Поперечины через равные шаги — иначе спираль читается плоской линией.
    if (i % 6 === 0) {
      v.push([-Math.cos(a) * 0.62, k * 2 - 1, -Math.sin(a) * 0.62]);
      e.push([v.length - 2, v.length - 1]);
    }
  }
  return { v: norm(v), e };
}

function sheet(n = 11) {
  const v = [];
  const e = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = (i / (n - 1)) * 2 - 1;
      const z = (j / (n - 1)) * 2 - 1;
      v.push([x, Math.sin(x * 3) * Math.cos(z * 3) * 0.35, z]);
      const id = i * n + j;
      if (i) e.push([id - n, id]);
      if (j) e.push([id - 1, id]);
    }
  return { v: norm(v), e };
}

function sphereSpiral(n = 150, turns = 11) {
  const v = [];
  const e = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const phi = Math.acos(1 - 2 * k);
    const th = turns * phi;
    v.push([Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)]);
    if (i) e.push([i - 1, i]);
  }
  return { v: norm(v), e };
}

/* Рёбра по расстоянию — для правильных многогранников: у них все рёбра
   одной длины, поэтому порог отделяет рёбра от диагоналей. */
function byDistance(v, max) {
  const e = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      const d = Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]);
      if (d < max) e.push([i, j]);
    }
  return e;
}

/* Нормализация в единичный радиус: объекты рисуются в одной ячейке и
   должны занимать её одинаково, независимо от того, как построены. */
function norm(v) {
  const max = Math.max(...v.map((p) => Math.hypot(p[0], p[1], p[2]))) || 1;
  return v.map((p) => p.map((c) => c / max));
}

const SOLIDS = {
  icosa: icosahedron,
  cubes: cubes,
  torus: torus,
  helix: helix,
  sheet: sheet,
  spiral: sphereSpiral,
};

export const SOLID_NAMES = Object.keys(SOLIDS);

/* --- Общий кадр --------------------------------------------------------------
   Один requestAnimationFrame на всю графику: шесть объектов и поле стрелок
   со своими циклами — шесть независимых очередей кадров и рваная картинка. */

const scenes = new Set();
let running = false;
let startedAt = performance.now();

function loop(now) {
  const t = (now - startedAt) / 1000;
  for (const s of scenes) if (s.visible) s.draw(t);
  if (scenes.size) requestAnimationFrame(loop);
  else running = false;
}

function join(scene) {
  scenes.add(scene);
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

const visibility = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const s = e.target.__scene;
    if (s) s.visible = e.isIntersecting;
  }
});

/* --- Проволочный объект ------------------------------------------------------ */

function mountSolid(host, name, seed) {
  const build = SOLIDS[name] || SOLIDS.icosa;
  const { v, e } = build();

  const canvas = document.createElement("canvas");
  canvas.className = "vg-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;

  // Цвета — у самого блока (--vg-line, --vg-dot), иначе у страницы: на
  // светлой плите подвала линия должна быть тёмной, а не лаймовой.
  let line = hair;
  let dot = ink;
  const size = () => {
    const box = host.getBoundingClientRect();
    w = Math.max(1, box.width);
    h = Math.max(1, box.height);
    canvas.width = Math.round(w * DPR());
    canvas.height = Math.round(h * DPR());
    ctx.setTransform(DPR(), 0, 0, DPR(), 0, 0);
    line = hostColor(host, "--vg-line") || hair;
    dot = hostColor(host, "--vg-dot") || ink;
  };
  size();

  // Курсор доворачивает объект: к базовому вращению прибавляется наклон
  // в сторону указателя, с инерцией — объект «смотрит» на курсор.
  const aim = { x: 0, y: 0 };
  const turn = { x: 0, y: 0 };
  if (!reduced) {
    addEventListener(
      "pointermove",
      (e) => {
        const r = canvas.getBoundingClientRect();
        aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left - r.width / 2) / innerWidth) * 2));
        aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top - r.height / 2) / innerHeight) * 2));
      },
      { passive: true }
    );
  }

  // Фаза у каждой ячейки своя: сетка из шести объектов не должна пульсировать
  // в такт — синхронное вращение читается как заставка, а не как объекты.
  const phase = seed * 1.7;
  const speed = 0.18 + (seed % 3) * 0.05;

  const pt = [0, 0, 0];

  const scene = {
    visible: false,
    draw(t) {
      turn.x += (aim.x - turn.x) * 0.05;
      turn.y += (aim.y - turn.y) * 0.05;
      const a = t * speed + phase + turn.x * 0.9;
      const b = t * speed * 0.62 + phase * 0.5 + turn.y * 0.6;
      const ca = Math.cos(a), sa = Math.sin(a);
      const cb = Math.cos(b), sb = Math.sin(b);

      const scale = Math.min(w, h) * 0.34;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = lineW;
      ctx.strokeStyle = line;
      ctx.beginPath();

      const project = (p, out) => {
        // Поворот вокруг Y, затем вокруг X. Дальше — слабая перспектива:
        // без неё проволока читается как плоский орнамент.
        const x = p[0] * ca + p[2] * sa;
        const z = -p[0] * sa + p[2] * ca;
        const y = p[1] * cb - z * sb;
        const zz = p[1] * sb + z * cb;
        const k = 1 / (2.6 - zz * 0.55);
        out[0] = cx + x * scale * k * 2.4;
        out[1] = cy + y * scale * k * 2.4;
        out[2] = zz;
      };

      const a2 = [0, 0, 0];
      for (const [i, j] of e) {
        project(v[i], pt);
        project(v[j], a2);
        ctx.moveTo(pt[0], pt[1]);
        ctx.lineTo(a2[0], a2[1]);
      }
      ctx.stroke();

      // Ближние вершины помечаются акцентом — объект получает глубину без
      // заливки и без света.
      ctx.fillStyle = dot;
      for (const p of v) {
        project(p, pt);
        if (pt[2] < 0.55) continue;
        ctx.fillRect(pt[0] - 1.5, pt[1] - 1.5, 3, 3);
      }
    },
  };

  canvas.__scene = scene;
  visibility.observe(canvas);
  join(scene);

  addEventListener("resize", size);
  if (reduced) {
    scene.visible = true;
    scene.draw(seed);
    scenes.delete(scene);
  }
  return scene;
}

/* --- Поле стрелок ------------------------------------------------------------
   Буквально вектор: в каждой узловой точке сетки — направление. В покое
   поле течёт медленной волной, под курсором разворачивается к нему.
   Шаг сетки тот же, что у миллиметровки в макете (--graph-cell, 38). */

function mountField(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "vg-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let step = 38;

  const mouse = { x: -1e4, y: -1e4, on: 0 };

  const size = () => {
    const box = host.getBoundingClientRect();
    w = Math.max(1, box.width);
    h = Math.max(1, box.height);
    canvas.width = Math.round(w * DPR());
    canvas.height = Math.round(h * DPR());
    ctx.setTransform(DPR(), 0, 0, DPR(), 0, 0);
    // Шаг поля равен клетке миллиметровки из макета (38) и тянется вместе
    // с ней: стрелки обязаны стоять в узлах сетки, а не рядом с ними.
    readMetrics();
    step = Math.max(18, 38 * unit);
  };
  size();
  addEventListener("resize", size);

  host.addEventListener(
    "pointermove",
    (ev) => {
      const box = host.getBoundingClientRect();
      mouse.x = ev.clientX - box.left;
      mouse.y = ev.clientY - box.top;
      mouse.on = 1;
    },
    { passive: true }
  );
  host.addEventListener("pointerleave", () => {
    mouse.on = 0;
  });

  const scene = {
    visible: false,
    draw(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = lineW;
      ctx.lineCap = "square";

      const reach = Math.min(w, h) * 0.55;

      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const dist = Math.hypot(dx, dy);
          const pull = mouse.on ? Math.max(0, 1 - dist / reach) : 0;

          // Базовое направление — медленная волна. Курсор перетягивает его
          // тем сильнее, чем ближе, но никогда не до конца: поле должно
          // оставаться полем, а не звездой из линий в одну точку.
          const flow = Math.sin(x * 0.012 + t * 0.5) + Math.cos(y * 0.015 - t * 0.4);
          const toMouse = Math.atan2(dy, dx);
          const angle = flow * 0.9 * (1 - pull) + toMouse * pull;

          const len = step * (0.28 + pull * 0.34);
          ctx.strokeStyle = pull > 0.35 ? ink : hair;
          ctx.globalAlpha = 0.35 + pull * 0.65;

          ctx.beginPath();
          ctx.moveTo(x - Math.cos(angle) * len * 0.5, y - Math.sin(angle) * len * 0.5);
          ctx.lineTo(x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
  };

  canvas.__scene = scene;
  visibility.observe(canvas);
  join(scene);

  if (reduced) {
    scene.visible = true;
    scene.draw(0);
    scenes.delete(scene);
  }
}

/* --- Статичная графика -------------------------------------------------------
   Метки и линейки не двигаются, поэтому это разметка, а не холст: их
   рисует браузер один раз и больше к ним не возвращается. */

function mountCorners(host) {
  const box = document.createElement("span");
  box.className = "vg-corners";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 4; i++) box.append(document.createElement("i"));
  host.prepend(box);
}

function mountGrid(host) {
  // Перспективная сетка: линии сходятся в точку схода, горизонтали
  // сгущаются к ней. Рисуется в viewBox 100×60 и тянется вместе с блоком.
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "vg-grid");
  svg.setAttribute("viewBox", "0 0 100 60");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const line = (x1, y1, x2, y2) => {
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", x1);
    l.setAttribute("y1", y1);
    l.setAttribute("x2", x2);
    l.setAttribute("y2", y2);
    svg.append(l);
  };

  for (let i = -12; i <= 12; i++) line(50 + i * 22, 60, 50, 0);
  for (let i = 1; i <= 14; i++) {
    const y = 60 - 60 * Math.pow(i / 15, 2.1);
    line(0, y, 100, y);
  }

  host.prepend(svg);
}

/* --- Роза векторов ------------------------------------------------------------
   Реф: vectors-group.com, блок «And this through all vectors». Четыре линии
   со стрелками на обоих концах через общий центр и три пунктирных круга.
   У каждой линии своя фаза: веер то собирается неровно, то встаёт ровной
   звездой через 45°. Круги медленно поворачиваются навстречу друг другу —
   пунктир течёт. SVG, а не холст: линия той же толщины, что вся графика
   сайта (--line-px через non-scaling-stroke), и чёткая на любом экране. */

function mountCompass(host) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "vg-compass");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("aria-hidden", "true");

  const mk = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.append(n);
    return n;
  };

  // Круги: радиусы и шаг пунктира сняты с рефа (доли длины стрелки).
  const rings = [
    { r: 30, dash: "6 5.2" },
    { r: 53, dash: "5.2 5.2" },
    { r: 74, dash: "5.6 5.6" },
  ].map((c) => mk("circle", { cx: 100, cy: 100, r: c.r, "stroke-dasharray": c.dash, class: "vg-compass__ring" }));

  // Линия: древко через центр и по наконечнику на каждом конце.
  const L = 92;
  const H = 7;
  const arrows = [0, 1, 2, 3].map(() => {
    const g = mk("g", { class: "vg-compass__arrow" });
    mk("line", { x1: 100 - L, y1: 100, x2: 100 + L, y2: 100 }, g);
    mk("polyline", { points: `${100 + L - H},${100 - H * 0.7} ${100 + L},100 ${100 + L - H},${100 + H * 0.7}` }, g);
    mk("polyline", { points: `${100 - L + H},${100 - H * 0.7} ${100 - L},100 ${100 - L + H},${100 + H * 0.7}` }, g);
    return g;
  });

  host.append(svg);

  const scene = {
    visible: false,
    draw(t) {
      // Базовая звезда через 45° плюс собственное покачивание каждой линии
      // и общее медленное вращение.
      arrows.forEach((g, i) => {
        const a = i * 45 + Math.sin(t * 0.9 + i * 1.7) * 22 + t * 9;
        g.setAttribute("transform", `rotate(${a.toFixed(2)} 100 100)`);
      });
      rings.forEach((c, i) => {
        const dir = i % 2 ? -1 : 1;
        c.setAttribute("transform", `rotate(${(dir * t * (6 + i * 3)).toFixed(2)} 100 100)`);
      });
    },
  };

  svg.__scene = scene;
  visibility.observe(svg);
  if (reduced) {
    scene.draw(0);
    return;
  }
  join(scene);
}

/* --- Координаты курсора ------------------------------------------------------
   Моно-строка «X 0412 · Y 0133»: где сейчас курсор внутри блока-хозяина
   (ближайший footer или section), в макетных пикселях. Приборная деталь,
   как отметки и линейки. */

function mountCoords(host) {
  const area = host.closest("footer, section") || document.body;
  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");
  const idle = () => (host.textContent = "X ---- · Y ----");
  idle();
  area.addEventListener(
    "pointermove",
    (e) => {
      const r = area.getBoundingClientRect();
      host.textContent = `X ${pad((e.clientX - r.left) / unit)} · Y ${pad((e.clientY - r.top) / unit)}`;
    },
    { passive: true }
  );
  area.addEventListener("pointerleave", idle);
}

/* Цвет из кастомного свойства блока: значение может быть color-mix(), а
   холст понимает не всякую запись — поэтому пропускаем через probe. */
function hostColor(host, prop) {
  const raw = getComputedStyle(host).getPropertyValue(prop).trim();
  if (!raw) return "";
  const probe = document.createElement("span");
  probe.style.color = raw;
  host.append(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out;
}

/* --- Монтаж ------------------------------------------------------------------ */

export function mountVectors(root = document) {
  readPalette();

  root.querySelectorAll("[data-vg]:not([data-vg-done])").forEach((host, i) => {
    host.setAttribute("data-vg-done", "");
    const spec = host.dataset.vg;

    if (spec === "corners") return mountCorners(host);
    if (spec === "grid") return mountGrid(host);
    if (spec === "field") return mountField(host);
    if (spec === "coords") return mountCoords(host);
    if (spec === "compass") return mountCompass(host);
    if (spec.startsWith("solid:")) return mountSolid(host, spec.slice(6), i);
  });
}

// Тема — атрибутом, толщина линии — свойством в style (ползунок панели).
new MutationObserver(readPalette).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme", "style"],
});

// Макетная единица нужна координатам и после изменения окна.
addEventListener("resize", readMetrics);

mountVectors();
