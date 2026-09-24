/* Первый экран: имя как нода.

   Над именем — три входа (DESIGN, RENDER, CODE) со значками софта, провода
   сходятся в порт над именем; под подписью выходит OUTPUT · ON SCREEN с
   живым роликом из Lab. Клик по выходу переключает ролик. Правее выхода —
   ещё две ноды: SHOWREEL открывает шоурил, ABOUT ME спускает к блоку
   «обо мне». Поток сверху вниз — так же, как читается страница: имя
   занимает всю колонку, и по бокам нодам места нет. Та же нодовая
   система, что в пайплайне (css/nodes.css): ноды можно таскать, по
   проводам бежит сигнал, пока экран виден. На телефоне графа нет. */

import { load } from "./store.js";

const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const BASE = "https://a0ba653b-2b38-41d5-ab30-999a5a6aa985.selstorage.ru/website%203.0/";

const INPUTS = [
  { type: "01", tool: "Design", icons: ["figma", "illustrator", "photoshop"] },
  { type: "02", tool: "Render", icons: ["houdini", "cinema-4d", "redshift"] },
  { type: "03", tool: "Code", text: "JS · WebGL · GLSL" },
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
  const about = { node: makeNode({ type: "About", tool: "me", text: "↓ who’s behind this" }), dx: 0, dy: 0 };
  ins.forEach((n) => n.node.querySelector(".node__port--in").classList.add("is-idle"));
  about.node.querySelector(".node__port--out").classList.add("is-idle");
  out.node.querySelector(".node__port--out").classList.add("is-idle");
  // Шоурил и «обо мне» подключены сбоку — порты у них слева и справа.
  [reel, about].forEach((n) => n.node.classList.add("hero-node--side"));
  // Выход и две ноды правее нажимаются, как кнопки.
  for (const [n, label] of [[out, "Next video"], [reel, "Play showreel"], [about, "About me"]]) {
    n.node.classList.add("hero-node--action");
    n.node.setAttribute("role", "button");
    n.node.setAttribute("aria-label", label);
    n.node.tabIndex = 0;
  }
  const all = [...ins, out, reel, about];
  all.forEach((n) => layer.append(n.node));

  // Порты у имени: вход сверху, выход снизу.
  const portIn = el("span", "hero__port");
  const portOut = el("span", "hero__port");
  layer.append(portIn, portOut);

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
  const aboutWire = wire();

  hero.append(layer);

  let base = null; // опорные точки, считаются на раскладке

  function layout() {
    const H = hero.getBoundingClientRect();
    const N = name.getBoundingClientRect();
    const S = (hero.querySelector(".hero__sub") || name).getBoundingClientRect();
    const u = H.width / 912;
    const cx = N.left - H.left + N.width / 2;
    // Порты — на верхнем и нижнем ребре рамки имени (.hero__frame);
    // без рамки — чуть выше имени и ниже подписи.
    const frame = hero.querySelector(".hero__frame");
    const F = frame && frame.getClientRects().length ? frame.getBoundingClientRect() : null;
    const pinY = F ? F.top - H.top : N.top - H.top - 12 * u;
    const poutY = F ? F.bottom - H.top : S.bottom - H.top + 14 * u;

    // Входы — ряд над именем, по центру; верх общий, по самой высокой.
    const w = 150 * u;
    const gap = 56 * u;
    const row = 3 * w + 2 * gap;
    ins.forEach((n) => (n.node.style.width = `${w}px`));
    const tall = Math.max(...ins.map((n) => n.node.offsetHeight));
    ins.forEach((n, i) => {
      n.node.style.left = `${cx - row / 2 + i * (w + gap) + n.dx}px`;
      n.node.style.top = `${pinY - 30 * u - tall + n.dy}px`;
    });

    // Выход — под подписью, по центру; правее — шоурил и «обо мне» на
    // одной с ним средней линии.
    const ow = 150 * u;
    const oy = poutY + 36 * u;
    out.node.style.width = `${ow}px`;
    out.node.style.left = `${cx - ow / 2 + out.dx}px`;
    out.node.style.top = `${oy + out.dy}px`;
    const mid = oy + out.node.offsetHeight / 2;
    const sw = 120 * u;
    [reel, about].forEach((n, i) => {
      n.node.style.width = `${sw}px`;
      n.node.style.left = `${cx + ow / 2 + 48 * u + i * (sw + 40 * u) + n.dx}px`;
      n.node.style.top = `${mid - n.node.offsetHeight / 2 + n.dy}px`;
    });

    base = { pin: { x: cx, y: pinY }, pout: { x: cx, y: poutY } };
    portIn.style.left = `${base.pin.x}px`;
    portIn.style.top = `${base.pin.y}px`;
    portOut.style.left = `${base.pout.x}px`;
    portOut.style.top = `${base.pout.y}px`;
    draw();
  }

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
    ins.forEach((n, i) => down({ x: box(n).cx, y: box(n).b }, base.pin, inWires[i]));
    const o = box(out);
    down(base.pout, { x: o.cx, y: o.t }, outWire);
    const r = box(reel);
    side({ x: o.r, y: o.cy }, { x: r.l, y: r.cy }, reelWire);
    const a = box(about);
    side({ x: r.r, y: r.cy }, { x: a.l, y: a.cy }, aboutWire);
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

  // Перетаскивание и клик: сдвинул больше чем на 4 px — перетащил, иначе
  // нажал. Сдвиг хранится от расчётного места и переживает пересчёт.
  for (const n of all) {
    n.node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
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
    layer.classList.toggle("is-live", on && !reduced);
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
