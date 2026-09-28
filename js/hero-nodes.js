/* Первый экран: имя как нода.

   Над именем — три входа (DESIGN, RENDER, VIBECODE) со значками софта;
   у рамки имени три порта сверху, каждый провод приходит в свой; под
   подписью выходит OUTPUT · ON SCREEN с живым роликом из Lab. Клик по выходу переключает ролик. Правее выхода —
   SHOWREEL, он открывает шоурил; от него ветка делится надвое: WORK
   ведёт на /work, под ним ABOUT ME спускает к блоку «обо мне». Поток
   сверху вниз — так же, как читается страница: имя занимает всю колонку,
   и по бокам нодам места нет. Та же нодовая система, что в пайплайне
   (css/nodes.css): ноды можно таскать, по проводам бежит сигнал, пока
   экран виден. На телефоне третья колонка не помещается: WORK и ABOUT
   встают рядом вторым рядом, и провода к ним идут вниз от шоурила. */

import { load } from "./store.js";

const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const BASE = "https://7b969cfb-7fef-4b50-a362-6bebbf7ab72f.selstorage.ru/nicktmsh/";

const INPUTS = [
  { type: "01", tool: "Design", icons: ["figma", "illustrator", "photoshop", "after-effects", "premiere"] },
  { type: "02", tool: "Render", icons: ["houdini", "cinema-4d", "redshift"] },
  { type: "03", tool: "Vibecode", icons: ["claude", "codex", "weavy", "higgsfield"] },
];
// Ролики выхода; первый — стилистически ближе всего к первому экрану.
const VIDEOS = [
  "lab/alien-alloy/alien-alloy-growth-se.webm",
  "lab/grass/grass-flow-se.webm",
  "lab/avgust/avgust-se.webm",
  "lab/damaged/day17-damaged-1-se.webm",
  "lab/volumetric/day29-volumetric-se.webm",
  "lab/motion-blur/day30-motion-blur-se.webm",
];
const pad = (n) => String(n).padStart(2, "0");
const phone = matchMedia("(max-width: 760px)");

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function makeNode(spec) {
  const node = el("figure", `node hero-node${spec.video ? "" : " node--text"}`);
  const head = el("figcaption", "node__head");
  head.append(el("span", "node__type", spec.type), el("span", "node__tool", spec.tool));
  const body = el("div", "node__body");
  if (spec.icons) {
    const row = el("span", "hero-node__icons");
    for (const id of spec.icons) {
      const img = el("img", "hero-node__icon");
      img.src = `assets/tools/${id}.svg`;
      img.alt = "";
      img.draggable = false;
      row.append(img);
    }
    body.append(row);
  }
  if (spec.text) body.append(el("p", "node__text", spec.text));
  if (spec.video) {
    const v = el("video", "node__media");
    v.src = BASE + spec.video;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "metadata";
    body.append(v);
  }
  body.append(el("span", "node__port node__port--in"), el("span", "node__port node__port--out"));
  node.append(head, body);
  return node;
}

/* Шоурил: то же окно, что на /work (стили .reel-box — в home.css). */
function reelBox(src) {
  const box = el("dialog", "reel-box");
  box.setAttribute("aria-label", "Showreel");
  const close = el("button", "pill reel-box__close", "close");
  close.type = "button";
  const video = el("video", "reel-box__video");
  video.controls = true;
  video.playsInline = true;
  video.preload = "none";
  box.append(close, video);
  close.addEventListener("click", () => box.close());
  box.addEventListener("click", (e) => {
    if (e.target === box) box.close();
  });
  box.addEventListener("close", () => video.pause());
  document.body.append(box);
  return () => {
    if (video.getAttribute("src") !== src) video.src = src;
    box.showModal();
    video.play().catch(() => {});
  };
}

function mount(hero) {
  const name = hero.querySelector(".hero__name");
  if (!name) return;

  const layer = el("div", "hero__graph");
  const wires = document.createElementNS(NS, "svg");
  wires.setAttribute("class", "nodes__wires");
  wires.setAttribute("aria-hidden", "true");
  layer.append(wires);

  const ins = INPUTS.map((s) => ({ node: makeNode(s), dx: 0, dy: 0 }));
  const out = {
    node: makeNode({ type: "Output", tool: `On screen · 01/${pad(VIDEOS.length)}`, video: VIDEOS[0] }),
    dx: 0,
    dy: 0,
  };
  const reel = { node: makeNode({ type: "Showreel", tool: "2025", text: "▶ play the reel" }), dx: 0, dy: 0 };
  const work = { node: makeNode({ type: "Work", tool: "cases", text: "→ see the projects" }), dx: 0, dy: 0 };
  const about = { node: makeNode({ type: "About", tool: "me", text: "↓ who’s behind this" }), dx: 0, dy: 0 };
  ins.forEach((n) => n.node.querySelector(".node__port--in").classList.add("is-idle"));
  [work, about].forEach((n) => n.node.querySelector(".node__port--out").classList.add("is-idle"));
  out.node.querySelector(".node__port--out").classList.add("is-idle");
  // Ноды правее выхода подключены сбоку — порты у них слева и справа
  // (на телефоне WORK и ABOUT переключаются на верх, см. layoutPhone).
  [reel, work, about].forEach((n) => n.node.classList.add("hero-node--side"));
  // Выход и ноды правее нажимаются, как кнопки.
  for (const [n, label] of [[out, "Next video"], [reel, "Play showreel"], [work, "Work"], [about, "About me"]]) {
    n.node.classList.add("hero-node--action");
    n.node.setAttribute("role", "button");
    n.node.setAttribute("aria-label", label);
    n.node.tabIndex = 0;
  }
  const all = [...ins, out, reel, work, about];
  all.forEach((n) => layer.append(n.node));

  // Порты у имени: три входа сверху, по одному на ноду, и выход снизу.
  const portsIn = ins.map(() => el("span", "hero__port"));
  const portOut = el("span", "hero__port");
  layer.append(...portsIn, portOut);

  const wire = () => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "wire");
    const line = document.createElementNS(NS, "path");
    line.setAttribute("class", "wire__line");
    const flow = document.createElementNS(NS, "path");
    flow.setAttribute("class", "wire__flow");
    g.append(line, flow);
    wires.append(g);
    return { line, flow };
  };
  const inWires = ins.map(wire);
  const outWire = wire();
  const reelWire = wire();
  const workWire = wire();
  const aboutWire = wire();

  hero.append(layer);

  let base = false; // раскладка посчитана, можно ставить порты и провода

  const title = name.closest(".hero__title") || name;
  const frame = hero.querySelector(".hero__frame");

  /* Имя с рамкой наклоняется за курсором (js/tilt.js) и сжимается при
     наведении. Поэтому раскладка нод считается по геометрии без
     трансформа (offset*), а точки портов живут внутри самой рамки —
     невидимые якоря на её рёбрах, — и порты графа каждый кадр встают
     туда, где якоря видны сейчас. Так порты не отрываются от пунктира,
     а ноды не прыгают вслед за наклоном. */
  const host = frame || title;
  const anchorsIn = ins.map(() => el("span", "hero__anchor"));
  const anchorOut = el("span", "hero__anchor");
  host.append(...anchorsIn, anchorOut);
  anchorOut.style.cssText = "left: 50%; top: 100%";
  // Входы на верхнем ребре: средний по центру, крайние — на шаг в
  // стороны, в том же порядке, что и ноды над ними.
  const spread = (step) =>
    anchorsIn.forEach((a, i) => (a.style.cssText = `left: calc(50% + ${(i - 1) * step}px); top: 0`));

  // Прямоугольник элемента в координатах первого экрана без трансформов.
  function rest(node) {
    let x = 0;
    let y = 0;
    for (let n = node; n && n !== hero; n = n.offsetParent) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return { l: x, t: y, r: x + node.offsetWidth, b: y + node.offsetHeight, w: node.offsetWidth };
  }

  function layout() {
    if (phone.matches) return layoutPhone();
    reel.node.classList.remove("hero-node--fork");
    [work, about].forEach((n) => n.node.classList.add("hero-node--side"));
    const u = hero.clientWidth / 912;
    const N = rest(name);
    const T = rest(title);
    const cx = N.l + N.w / 2;
    // Рёбра рамки имени в покое (отступы — как у .hero__frame в
    // css/nodes.css). Ноды стоят от них и не двигаются, когда рамка
    // сжимается при наведении.
    const top = T.t - 26 * u;
    const bottom = T.b + 24 * u;

    // Входы — ряд над именем, по центру; верх общий, по самой высокой.
    const w = 150 * u;
    const gap = 56 * u;
    const row = 3 * w + 2 * gap;
    ins.forEach((n) => (n.node.style.width = `${w}px`));
    const tall = Math.max(...ins.map((n) => n.node.offsetHeight));
    ins.forEach((n, i) => {
      n.node.style.left = `${cx - row / 2 + i * (w + gap) + n.dx}px`;
      n.node.style.top = `${top - 30 * u - tall + n.dy}px`;
    });

    // Выход — под подписью, по центру; правее на его средней линии —
    // шоурил, ещё правее — столбик WORK над ABOUT.
    const ow = 150 * u;
    const oy = bottom + 36 * u;
    out.node.style.width = `${ow}px`;
    out.node.style.left = `${cx - ow / 2 + out.dx}px`;
    out.node.style.top = `${oy + out.dy}px`;
    const mid = oy + out.node.offsetHeight / 2;
    const sw = 120 * u;
    [reel, work, about].forEach((n) => (n.node.style.width = `${sw}px`));
    const rx = cx + ow / 2 + 48 * u;
    reel.node.style.left = `${rx + reel.dx}px`;
    reel.node.style.top = `${mid - reel.node.offsetHeight / 2 + reel.dy}px`;
    const vgap = 16 * u;
    const stack = work.node.offsetHeight + vgap + about.node.offsetHeight;
    const fx = rx + sw + 40 * u;
    work.node.style.left = `${fx + work.dx}px`;
    work.node.style.top = `${mid - stack / 2 + work.dy}px`;
    about.node.style.left = `${fx + about.dx}px`;
    about.node.style.top = `${mid - stack / 2 + work.node.offsetHeight + vgap + about.dy}px`;

    spread(110 * u);
    base = true;
    ports();
  }

  // Телефон: колонка 309 макетных единиц (css/base.css, .wrap), наведения
  // нет — рамка имени стоит на месте, и ноды считаются прямо от неё.
  function layoutPhone() {
    const W = hero.clientWidth;
    const u = W / 309;
    const F = rest(host);
    const top = F.t;
    const bottom = F.b;

    const gap = 10 * u;
    const w = (W - 2 * gap) / 3;
    ins.forEach((n) => (n.node.style.width = `${w}px`));
    const tall = Math.max(...ins.map((n) => n.node.offsetHeight));
    ins.forEach((n, i) => {
      n.node.style.left = `${i * (w + gap) + n.dx}px`;
      n.node.style.top = `${top - 40 * u - tall + n.dy}px`;
    });

    const ow = 172 * u;
    const oy = bottom + 40 * u;
    out.node.style.width = `${ow}px`;
    out.node.style.left = `${out.dx}px`;
    out.node.style.top = `${oy + out.dy}px`;
    const mid = oy + out.node.offsetHeight / 2;
    const sx = ow + 30 * u;
    const sw = W - sx;
    // Шоурил справа от выхода; выход у него снизу — к WORK и ABOUT,
    // которые стоят рядом вторым рядом.
    reel.node.classList.add("hero-node--fork");
    [work, about].forEach((n) => n.node.classList.remove("hero-node--side"));
    reel.node.style.width = `${sw}px`;
    reel.node.style.left = `${sx + reel.dx}px`;
    reel.node.style.top = `${mid - reel.node.offsetHeight / 2 + reel.dy}px`;
    const hgap = 14 * u;
    const bw = (W - hgap) / 2;
    [work, about].forEach((n) => (n.node.style.width = `${bw}px`));
    const low = Math.max(oy + out.node.offsetHeight, mid + reel.node.offsetHeight / 2);
    const by = low + 34 * u;
    [work, about].forEach((n, i) => {
      n.node.style.left = `${i * (bw + hgap) + n.dx}px`;
      n.node.style.top = `${by + n.dy}px`;
    });

    spread(70 * u);
    base = true;
    ports();
  }

  // Порты — там, где якоря на рёбрах рамки видны сейчас, с наклоном и
  // сжатием. Возвращает, сдвинулось ли что-нибудь.
  let pins = [];
  let pout = { x: 0, y: 0 };
  let seen = "";
  function ports(force = true) {
    if (!base) return;
    const H = hero.getBoundingClientRect();
    const at = (a) => {
      const r = a.getBoundingClientRect();
      return { x: r.left - H.left, y: r.top - H.top };
    };
    const next = anchorsIn.map(at);
    const o = at(anchorOut);
    const key = [...next, o].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    if (!force && key === seen) return;
    seen = key;
    pins = next;
    pout = o;
    portsIn.forEach((port, i) => {
      port.style.left = `${pins[i].x}px`;
      port.style.top = `${pins[i].y}px`;
    });
    portOut.style.left = `${pout.x}px`;
    portOut.style.top = `${pout.y}px`;
    draw();
  }

  // Пока первый экран виден, порты сверяются с рамкой каждый кадр: наклон
  // и сжатие идут своими циклами, а провода должны идти за ними без
  // задержки. Перерисовка — только когда рамка сдвинулась.
  let track = 0;
  const follow = () => {
    ports(false);
    track = requestAnimationFrame(follow);
  };

  // Провода: сверху вниз — касательные вертикальные, вбок — горизонтальные.
  const set = (l, d) => {
    l.line.setAttribute("d", d);
    l.flow.setAttribute("d", d);
  };
  const down = (a, b, l) => {
    const dy = Math.max(20, Math.abs(b.y - a.y) * 0.5);
    set(l, `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`);
  };
  const side = (a, b, l) => {
    const dx = Math.max(20, Math.abs(b.x - a.x) * 0.5);
    set(l, `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`);
  };

  function draw() {
    if (!base) return;
    const H = hero.getBoundingClientRect();
    wires.setAttribute("viewBox", `0 0 ${H.width} ${H.height}`);
    const box = (n) => {
      const r = n.node.querySelector(".node__body").getBoundingClientRect();
      return {
        l: r.left - H.left,
        r: r.right - H.left,
        t: r.top - H.top,
        b: r.bottom - H.top,
        cx: r.left + r.width / 2 - H.left,
        cy: r.top + r.height / 2 - H.top,
      };
    };
    ins.forEach((n, i) => down({ x: box(n).cx, y: box(n).b }, pins[i], inWires[i]));
    const o = box(out);
    down(pout, { x: o.cx, y: o.t }, outWire);
    const r = box(reel);
    side({ x: o.r, y: o.cy }, { x: r.l, y: r.cy }, reelWire);
    // От шоурила ветка делится: на телефоне — вниз, к верху нод, иначе —
    // вбок, к левому краю.
    [[work, workWire], [about, aboutWire]].forEach(([n, l]) => {
      const b = box(n);
      if (phone.matches) down({ x: r.cx, y: r.b }, { x: b.cx, y: b.t }, l);
      else side({ x: r.r, y: r.cy }, { x: b.l, y: b.cy }, l);
    });
  }

  /* Действия нод справа. */
  const video = out.node.querySelector("video");
  const tool = out.node.querySelector(".node__tool");
  let clip = 0;
  function nextVideo() {
    clip = (clip + 1) % VIDEOS.length;
    out.node.classList.add("is-swap");
    setTimeout(() => {
      video.src = BASE + VIDEOS[clip];
      tool.textContent = `On screen · ${pad(clip + 1)}/${pad(VIDEOS.length)}`;
      video.play().catch(() => {});
    }, reduced ? 0 : 180);
  }
  video.addEventListener("loadeddata", () => out.node.classList.remove("is-swap"));

  let playReel = null;
  load("projects")
    .then((data) => {
      const v = data.showreel && data.showreel.video;
      if (v) playReel = reelBox(/^https?:/.test(v) ? v : (data.mediaBase || "") + v);
    })
    .catch(() => {});

  const actions = new Map([
    [out.node, nextVideo],
    [reel.node, () => playReel && playReel()],
    [work.node, () => (location.href = "/work")],
    [
      about.node,
      () => {
        // К началу блока «05/ Lets talk», с запасом под фиксированную шапку, —
        // а не к центру фото: иначе страница проезжает метку и заголовок.
        const talk = document.querySelector("#talk");
        if (!talk) return;
        const nav = document.querySelector(".nav");
        const top = talk.getBoundingClientRect().top + scrollY - (nav ? nav.offsetHeight : 0) - 24;
        scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      },
    ],
  ]);

  /* Подсказка, что ноды таскаются: через пару секунд после загрузки
     призрак кольца-курсора берёт случайную нижнюю ноду и чуть относит её.
     Один раз за загрузку; если ноду уже взяли руками — не показываем, а
     начатый показ обрывается там, где его застали. Без движения
     (reduced motion) подсказки нет. */
  const ghost = el("span", "hero__hint");
  ghost.setAttribute("aria-hidden", "true");
  ghost.innerHTML = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" pathLength="96"/></svg>';
  layer.append(ghost);
  let touched = false;
  let hintTimer = 0;
  let hintRaf = 0;
  let hintNode = null;

  function stopHint() {
    clearTimeout(hintTimer);
    cancelAnimationFrame(hintRaf);
    hintRaf = 0;
    ghost.classList.remove("is-shown", "is-down");
    if (hintNode) hintNode.node.classList.remove("is-dragging");
    hintNode = null;
  }

  function hint() {
    if (touched || reduced || !base) return;
    touched = true;
    const n = [out, reel, work, about][Math.floor(Math.random() * 4)];
    hintNode = n;
    const H = hero.getBoundingClientRect();
    const u = H.width / (phone.matches ? 309 : 912);
    // Куда отнести: вниз или вбок, но не вверх, к имени; и не за колонку.
    const ang = -0.3 + Math.random() * (Math.PI + 0.6);
    const dist = (28 + Math.random() * 18) * u;
    const left = n.node.offsetLeft;
    let vx = Math.cos(ang) * dist;
    const vy = Math.sin(ang) * dist;
    vx = Math.min(Math.max(vx, -left), H.width - n.node.offsetWidth - left);
    const from = { dx: n.dx, dy: n.dy };
    const grab = () => {
      const R = hero.getBoundingClientRect();
      const r = n.node.querySelector(".node__body").getBoundingClientRect();
      return { x: r.left - R.left + r.width * 0.5, y: r.top - R.top + r.height * 0.55 };
    };
    const put = (p) => (ghost.style.translate = `${p.x}px ${p.y}px`);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    // Кольцо подлетает к ноде из-за правого нижнего угла.
    const approach = { x: 46 * u, y: 38 * u };
    const t0 = performance.now();
    const step = (now) => {
      const t = now - t0;
      const g = grab();
      if (t < 600) {
        const k = 1 - ease(t / 600);
        put({ x: g.x + approach.x * k, y: g.y + approach.y * k });
        ghost.classList.add("is-shown");
      } else if (t < 850) {
        put(g);
        ghost.classList.add("is-down");
        n.node.classList.add("is-dragging");
      } else if (t < 1750) {
        const k = ease((t - 850) / 900);
        n.dx = from.dx + vx * k;
        n.dy = from.dy + vy * k;
        layout();
        put(grab());
      } else if (t < 2050) {
        n.dx = from.dx + vx;
        n.dy = from.dy + vy;
        ghost.classList.remove("is-down");
        n.node.classList.remove("is-dragging");
      } else {
        ghost.classList.remove("is-shown");
        hintNode = null;
        hintRaf = 0;
        return;
      }
      hintRaf = requestAnimationFrame(step);
    };
    hintRaf = requestAnimationFrame(step);
  }

  // Перетаскивание и клик: сдвинул больше чем на 4 px — перетащил, иначе
  // нажал. Сдвиг хранится от расчётного места и переживает пересчёт.
  for (const n of all) {
    n.node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      touched = true;
      stopHint();
      n.node.setPointerCapture(e.pointerId);
      const start = { x: e.clientX, y: e.clientY, dx: n.dx, dy: n.dy };
      let moved = false;
      const move = (ev) => {
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
        moved = true;
        n.node.classList.add("is-dragging");
        n.dx = start.dx + ev.clientX - start.x;
        n.dy = start.dy + ev.clientY - start.y;
        layout();
      };
      const up = () => {
        n.node.classList.remove("is-dragging");
        n.node.removeEventListener("pointermove", move);
        n.node.removeEventListener("pointerup", up);
        n.node.removeEventListener("pointercancel", up);
        if (!moved && actions.has(n.node)) actions.get(n.node)();
      };
      n.node.addEventListener("pointermove", move);
      n.node.addEventListener("pointerup", up);
      n.node.addEventListener("pointercancel", up);
    });
    if (actions.has(n.node)) {
      n.node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          actions.get(n.node)();
        }
      });
    }
  }

  video.addEventListener("loadedmetadata", layout);
  new IntersectionObserver((entries) => {
    const on = entries[0].isIntersecting;
    // Подсказку ждём, пока первый экран на виду; ушёл — откладываем.
    clearTimeout(hintTimer);
    if (on && !touched) hintTimer = setTimeout(hint, 2200);
    layer.classList.toggle("is-live", on && !reduced);
    cancelAnimationFrame(track);
    track = on ? requestAnimationFrame(follow) : 0;
    if (on && !reduced) video.play().catch(() => {});
    else video.pause();
  }).observe(hero);

  new ResizeObserver(layout).observe(hero);
  if (document.fonts) document.fonts.ready.then(layout);
  layout();
}

// Монтируем всегда: на узком экране граф прячет CSS, а окно могут
// расширить уже после загрузки.
document.querySelectorAll(".hero").forEach(mount);
