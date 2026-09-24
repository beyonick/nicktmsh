/* Первый экран: имя как нода.

   Над именем — три входа (DESIGN, RENDER, CODE) со значками софта, провода
   сходятся в порт над именем; под подписью выходит OUTPUT · ON SCREEN с
   живым роликом из Lab. Поток сверху вниз — так же, как читается страница:
   имя занимает всю колонку, и по бокам нодам места нет. Та же нодовая
   система, что в пайплайне (css/nodes.css): ноды можно таскать, по
   проводам бежит сигнал, пока экран виден. На телефоне графа нет. */

const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const BASE = "https://a0ba653b-2b38-41d5-ab30-999a5a6aa985.selstorage.ru/website%203.0/";

const INPUTS = [
  { type: "01", tool: "Design", icons: ["figma", "illustrator", "photoshop"] },
  { type: "02", tool: "Render", icons: ["houdini", "cinema-4d", "redshift"] },
  { type: "03", tool: "Code", text: "JS · WebGL · GLSL" },
];
const OUTPUT = { type: "Output", tool: "On screen", video: "lab/alien-alloy/alien-alloy-growth-se.webm" };

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

function mount(hero) {
  const name = hero.querySelector(".hero__name");
  if (!name) return;

  const layer = el("div", "hero__graph");
  layer.setAttribute("aria-hidden", "true");
  const wires = document.createElementNS(NS, "svg");
  wires.setAttribute("class", "nodes__wires");
  layer.append(wires);

  const ins = INPUTS.map((s) => ({ node: makeNode(s), dx: 0, dy: 0 }));
  const out = { node: makeNode(OUTPUT), dx: 0, dy: 0 };
  ins.forEach((n) => n.node.querySelector(".node__port--in").classList.add("is-idle"));
  out.node.querySelector(".node__port--out").classList.add("is-idle");
  [...ins, out].forEach((n) => layer.append(n.node));

  // Порты у имени: вход слева, выход справа.
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

  hero.append(layer);

  let base = null; // опорные точки, считаются на раскладке

  function layout() {
    const H = hero.getBoundingClientRect();
    const N = name.getBoundingClientRect();
    const S = (hero.querySelector(".hero__sub") || name).getBoundingClientRect();
    const u = H.width / 912;
    const cx = N.left - H.left + N.width / 2;
    const nameTop = N.top - H.top;
    const subBottom = S.bottom - H.top;

    // Входы — ряд над именем, по центру.
    const w = 150 * u;
    const gap = 56 * u;
    const row = 3 * w + 2 * gap;
    // Верх у всех входов общий — по самой высокой ноде.
    ins.forEach((n) => (n.node.style.width = `${w}px`));
    const tall = Math.max(...ins.map((n) => n.node.offsetHeight));
    ins.forEach((n, i) => {
      n.node.style.left = `${cx - row / 2 + i * (w + gap) + n.dx}px`;
      n.node.style.top = `${nameTop - 34 * u - tall + n.dy}px`;
    });
    // Выход — под подписью.
    const ow = 150 * u;
    out.node.style.width = `${ow}px`;
    out.node.style.left = `${cx - ow / 2 + out.dx}px`;
    out.node.style.top = `${subBottom + 44 * u + out.dy}px`;

    base = { pin: { x: cx, y: nameTop - 12 * u }, pout: { x: cx, y: subBottom + 14 * u } };
    portIn.style.left = `${base.pin.x}px`;
    portIn.style.top = `${base.pin.y}px`;
    portOut.style.left = `${base.pout.x}px`;
    portOut.style.top = `${base.pout.y}px`;
    draw();
  }

  // Провод сверху вниз: касательные вертикальные.
  function curve(a, b, l) {
    const dy = Math.max(20, Math.abs(b.y - a.y) * 0.5);
    const d = `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`;
    l.line.setAttribute("d", d);
    l.flow.setAttribute("d", d);
  }

  function draw() {
    if (!base) return;
    const H = hero.getBoundingClientRect();
    wires.setAttribute("viewBox", `0 0 ${H.width} ${H.height}`);
    ins.forEach((n, i) => {
      const b = n.node.querySelector(".node__body").getBoundingClientRect();
      curve({ x: b.left + b.width / 2 - H.left, y: b.bottom - H.top }, base.pin, inWires[i]);
    });
    const b = out.node.querySelector(".node__body").getBoundingClientRect();
    curve(base.pout, { x: b.left + b.width / 2 - H.left, y: b.top - H.top }, outWire);
  }

  // Перетаскивание: сдвиг хранится от расчётного места, поэтому переживает
  // пересчёт раскладки.
  for (const n of [...ins, out]) {
    n.node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      n.node.setPointerCapture(e.pointerId);
      n.node.classList.add("is-dragging");
      const start = { x: e.clientX, y: e.clientY, dx: n.dx, dy: n.dy };
      const move = (ev) => {
        n.dx = start.dx + ev.clientX - start.x;
        n.dy = start.dy + ev.clientY - start.y;
        layout();
      };
      const up = () => {
        n.node.classList.remove("is-dragging");
        n.node.removeEventListener("pointermove", move);
        n.node.removeEventListener("pointerup", up);
        n.node.removeEventListener("pointercancel", up);
      };
      n.node.addEventListener("pointermove", move);
      n.node.addEventListener("pointerup", up);
      n.node.addEventListener("pointercancel", up);
    });
  }

  const video = out.node.querySelector("video");
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

if (matchMedia("(min-width: 761px)").matches) {
  document.querySelectorAll(".hero").forEach(mount);
}
