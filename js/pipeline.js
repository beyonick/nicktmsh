/* Пайплайн на главной: собери свой инструментарий.

   Та же нодовая логика, что на /nodes (css/nodes.css), но живая:
   INPUT · PROMPT слева — бриф (можно написать свой или взять готовый),
   в середине — ноды софта, с которым я работаю, по этапам (design → build
   → render → post), справа OUTPUT · PROMPT — что получится и в каком виде.

   Клик по ноде подключает или отключает её; провода между включёнными
   нодами соседних этапов пересобираются и прорисовываются заново, а
   выход переписывает себя. Ноды можно таскать. Готовый бриф включает свой
   набор софта по одной ноде — видно, как собирается цепочка. */

const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Софт. stage — этап; what — что он даёт в выходе. */
const TOOLS = [
  { id: "figma", name: "Figma", role: "layouts, UI", stage: 1, what: "UI" },
  { id: "illustrator", name: "Illustrator", role: "vectors", stage: 1, what: "logo and vectors" },
  { id: "photoshop", name: "Photoshop", role: "key art", stage: 1, what: "key art" },
  { id: "houdini", name: "Houdini", role: "procedural, FX", stage: 2, what: "simulations" },
  { id: "cinema-4d", name: "Cinema 4D", role: "3D scenes", stage: 2, what: "3D scenes" },
  { id: "touchdesigner", name: "TouchDesigner", role: "real-time", stage: 2, what: "live visuals", live: true },
  { id: "redshift", name: "Redshift", role: "GPU render", stage: 3, what: "GPU render" },
  { id: "karma", name: "Karma", role: "XPU render", stage: 3, what: "XPU render", from: ["houdini"] },
  { id: "after-effects", name: "After Effects", role: "motion, comp", stage: 4, what: "motion" },
  { id: "premiere", name: "Premiere", role: "edit, sound", stage: 4, what: "edit and sound" },
];

/* Раскладка в макетных пикселях (холст 912 × 400). */
const LAYOUT = {
  input: { x: 0, y: 90, w: 196 },
  output: { x: 764, y: 100, w: 148 },
  figma: { x: 236, y: 30 },
  illustrator: { x: 236, y: 140 },
  photoshop: { x: 236, y: 250 },
  houdini: { x: 368, y: 50 },
  "cinema-4d": { x: 368, y: 160 },
  touchdesigner: { x: 368, y: 300 },
  redshift: { x: 500, y: 100 },
  karma: { x: 500, y: 210 },
  "after-effects": { x: 632, y: 50 },
  premiere: { x: 632, y: 270 },
};
const TOOL_W = 116;

const PRESETS = [
  {
    key: "brand from zero",
    text: "A brand from zero for an IT company: logo, identity, site and a mascot.",
    tools: ["illustrator", "figma", "photoshop", "cinema-4d", "redshift", "after-effects"],
  },
  {
    key: "3d key visual",
    text: "A 3D key visual for a fintech product launch.",
    tools: ["cinema-4d", "redshift", "photoshop"],
  },
  {
    key: "motion film",
    text: "A 20-second product film for a phone launch.",
    tools: ["houdini", "cinema-4d", "redshift", "after-effects", "premiere"],
  },
  {
    key: "installation",
    text: "An interactive installation: image and sound driven by gesture.",
    tools: ["touchdesigner", "houdini"],
  },
  {
    key: "daily sim",
    text: "One Houdini piece a day, from prompt to render.",
    tools: ["houdini", "karma", "after-effects"],
  },
];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function mount(host) {
  const on = new Set();
  const canvas = el("div", "nodes__canvas pipe__canvas");
  canvas.style.setProperty("--h", 380);
  const wires = document.createElementNS(NS, "svg");
  wires.setAttribute("class", "nodes__wires");
  wires.setAttribute("aria-hidden", "true");
  canvas.append(wires);

  const nodes = new Map(); // id -> { node, body, pos }

  function place(id, node, pos) {
    node.style.setProperty("--x", pos.x);
    node.style.setProperty("--y", pos.y);
    node.style.setProperty("--w", pos.w || TOOL_W);
  }

  function ports(body) {
    const i = el("span", "node__port node__port--in");
    const o = el("span", "node__port node__port--out");
    body.append(i, o);
  }

  /* --- Вход ------------------------------------------------------------- */
  const input = el("figure", "node node--text pipe__io pipe__input");
  const inHead = el("figcaption", "node__head");
  inHead.append(el("span", "node__type", "Input"), el("span", "node__tool", "Prompt"));
  const inBody = el("div", "node__body");
  const brief = el("textarea", "pipe__prompt");
  brief.rows = 4;
  brief.spellcheck = false;
  brief.setAttribute("aria-label", "Brief");
  brief.placeholder = "Describe the project…";
  const chips = el("div", "pipe__chips");
  inBody.append(brief, chips);
  ports(inBody);
  input.append(inHead, inBody);
  place("input", input, LAYOUT.input);
  canvas.append(input);
  nodes.set("input", { node: input, body: inBody, pos: { ...LAYOUT.input } });

  /* --- Софт ------------------------------------------------------------- */
  for (const t of TOOLS) {
    const node = el("figure", "node pipe__tool");
    node.dataset.id = t.id;
    node.tabIndex = 0;
    node.setAttribute("role", "switch");
    node.setAttribute("aria-checked", "false");
    node.setAttribute("aria-label", `${t.name} — ${t.role}`);
    const head = el("figcaption", "node__head");
    head.append(el("span", "node__type", `0${t.stage}`), el("span", "node__tool", ["design", "build", "render", "post"][t.stage - 1]));
    const body = el("div", "node__body");
    const icon = el("img", "pipe__icon");
    icon.src = `assets/tools/${t.id}.svg`;
    icon.alt = "";
    icon.draggable = false;
    const label = el("span", "pipe__name", t.name);
    const role = el("span", "pipe__role", t.role);
    body.append(icon, label, role);
    ports(body);
    node.append(head, body);
    const pos = { ...LAYOUT[t.id], w: TOOL_W };
    place(t.id, node, pos);
    canvas.append(node);
    nodes.set(t.id, { node, body, pos, tool: t });
  }

  /* --- Выход ------------------------------------------------------------ */
  const output = el("figure", "node node--text pipe__io pipe__output");
  const outHead = el("figcaption", "node__head");
  outHead.append(el("span", "node__type", "Output"), el("span", "node__tool", "Prompt"));
  const outBody = el("div", "node__body");
  const outText = el("p", "node__text pipe__result");
  outText.setAttribute("aria-live", "polite");
  outBody.append(outText);
  ports(outBody);
  output.append(outHead, outBody);
  place("output", output, LAYOUT.output);
  canvas.append(output);
  nodes.set("output", { node: output, body: outBody, pos: { ...LAYOUT.output } });

  // Подписи этапов над колонками — вместо шапки у каждой ноды софта.
  [["01 design", 236], ["02 build", 368], ["03 render", 500], ["04 post", 632]].forEach(([t, x]) => {
    const tag = el("span", "pipe__stage", t);
    tag.style.setProperty("--x", x);
    canvas.append(tag);
  });

  host.append(canvas);

  /* --- Связи -------------------------------------------------------------
     Цепочка: вход → включённые ноды первого непустого этапа → следующего →
     … → выход. Между соседними слоями — все пары, кроме невозможных:
     Karma рендерит только Houdini, а TouchDesigner — реальное время, он
     идёт мимо рендера сразу в пост или на выход. */
  function edges() {
    const layers = [["input"]];
    for (let s = 1; s <= 4; s++) {
      const ids = TOOLS.filter((t) => t.stage === s && on.has(t.id)).map((t) => t.id);
      if (ids.length) layers.push(ids);
    }
    layers.push(["output"]);
    const out = [];
    for (let i = 0; i < layers.length - 1; i++) {
      for (const a of layers[i]) {
        const ta = nodes.get(a).tool;
        for (const b of layers[i + 1]) {
          const tb = nodes.get(b).tool;
          if (ta && ta.live && tb && tb.stage === 3) continue;
          if (tb && tb.from && !(ta && tb.from.includes(ta.id)) && ta && ta.stage === 2) continue;
          out.push([a, b]);
        }
      }
      // Живой TouchDesigner, отрезанный от рендера, идёт дальше по цепочке.
      for (const a of layers[i]) {
        const ta = nodes.get(a).tool;
        if (ta && ta.live && layers[i + 1].every((b) => nodes.get(b).tool && nodes.get(b).tool.stage === 3)) {
          for (const b of layers[i + 2] || []) out.push([a, b]);
        }
      }
    }
    // Нода без входящего провода (Karma без Houdini) — провод от всего слоя.
    for (let i = 1; i < layers.length - 1; i++) {
      for (const b of layers[i]) {
        if (!out.some(([, to]) => to === b)) for (const a of layers[i - 1]) out.push([a, b]);
      }
    }
    const seen = new Set();
    return out.filter(([a, b]) => !seen.has(`${a}>${b}`) && seen.add(`${a}>${b}`));
  }

  let links = [];
  function rewire() {
    const next = edges();
    const key = ([a, b]) => `${a}>${b}`;
    const old = new Map(links.map((l) => [key([l.from, l.to]), l]));
    const keep = new Set(next.map(key));
    for (const [k, l] of old) if (!keep.has(k)) l.g.remove();
    links = next.map(([from, to]) => {
      const was = old.get(key([from, to]));
      if (was) return was;
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "wire is-new");
      const line = document.createElementNS(NS, "path");
      line.setAttribute("class", "wire__line");
      line.setAttribute("pathLength", "1");
      const flow = document.createElementNS(NS, "path");
      flow.setAttribute("class", "wire__flow");
      g.append(line, flow);
      wires.append(g);
      setTimeout(() => g.classList.remove("is-new"), 900);
      return { from, to, g, line, flow };
    });
    // Порты горят только там, где есть провод.
    for (const [id, { body }] of nodes) {
      body.querySelector(".node__port--in").classList.toggle("is-idle", !links.some((l) => l.to === id));
      body.querySelector(".node__port--out").classList.toggle("is-idle", !links.some((l) => l.from === id));
    }
    draw();
  }

  function draw() {
    const c = canvas.getBoundingClientRect();
    wires.setAttribute("viewBox", `0 0 ${c.width} ${c.height}`);
    for (const l of links) {
      const a = nodes.get(l.from).body.getBoundingClientRect();
      const b = nodes.get(l.to).body.getBoundingClientRect();
      const x1 = a.right - c.left;
      const y1 = a.top + a.height / 2 - c.top;
      const x2 = b.left - c.left;
      const y2 = b.top + b.height / 2 - c.top;
      const dx = Math.max(30, Math.abs(x2 - x1) * 0.5);
      const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
      l.line.setAttribute("d", d);
      l.flow.setAttribute("d", d);
    }
  }

  /* --- Выход: текст ------------------------------------------------------ */
  function list(parts) {
    if (parts.length < 2) return parts.join("");
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }

  function compose() {
    const active = TOOLS.filter((t) => on.has(t.id));
    if (!active.length) return "Nothing is plugged in yet. Click a node to wire it into the pipeline.";
    const stages = new Set(active.map((t) => t.stage));
    const form = stages.has(4)
      ? "Delivered as a film"
      : on.has("touchdesigner")
        ? "Delivered as a live installation"
        : stages.has(3)
          ? "Delivered as rendered stills"
          : "Delivered as a system of files";
    // Бриф уже виден во входе — выход только отвечает: что и в каком виде.
    const what = list(active.map((t) => t.what));
    return `${what[0].toUpperCase()}${what.slice(1)}. ${form}.`;
  }

  let typing = 0;
  function writeOutput() {
    const full = compose();
    clearInterval(typing);
    output.classList.remove("is-pulse");
    void output.offsetWidth;
    output.classList.add("is-pulse");
    if (reduced) {
      outText.textContent = full;
      draw();
      return;
    }
    let i = 0;
    typing = setInterval(() => {
      i = Math.min(full.length, i + 3);
      outText.textContent = full.slice(0, i);
      outText.classList.toggle("is-typing", i < full.length);
      draw(); // текст растёт — середина ноды и порт смещаются
      if (i >= full.length) clearInterval(typing);
    }, 16);
  }

  /* --- Включение ---------------------------------------------------------- */
  function set(id, value) {
    const { node } = nodes.get(id);
    if (value) on.add(id);
    else on.delete(id);
    node.classList.toggle("is-on", value);
    node.setAttribute("aria-checked", String(value));
  }

  function toggle(id) {
    set(id, !on.has(id));
    chips.querySelectorAll(".pipe__chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    rewire();
    writeOutput();
  }

  let runId = 0;
  function preset(p, chip) {
    const run = ++runId;
    chips.querySelectorAll(".pipe__chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    brief.value = p.text;
    for (const t of TOOLS) set(t.id, false);
    rewire();
    // Ноды включаются по одной, по порядку этапов — видно, как растёт цепочка.
    const order = TOOLS.filter((t) => p.tools.includes(t.id));
    order.forEach((t, i) => {
      setTimeout(() => {
        if (run !== runId) return;
        set(t.id, true);
        rewire();
        if (i === order.length - 1) writeOutput();
      }, reduced ? 0 : 140 * (i + 1));
    });
  }

  for (const p of PRESETS) {
    const chip = el("button", "pipe__chip", p.key);
    chip.type = "button";
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => preset(p, chip));
    chips.append(chip);
  }

  let briefTimer = 0;
  brief.addEventListener("input", () => {
    clearTimeout(briefTimer);
    chips.querySelectorAll(".pipe__chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    briefTimer = setTimeout(writeOutput, 400);
  });

  /* --- Мышь: клик включает, перетаскивание двигает ------------------------- */
  for (const [id, entry] of nodes) {
    const { node, pos } = entry;
    node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("textarea, button")) return;
      const u = canvas.getBoundingClientRect().width / 912;
      const start = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
      let moved = false;
      node.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        node.classList.add("is-dragging");
        const c = canvas.getBoundingClientRect();
        pos.x = Math.round(Math.min(c.width / u - node.offsetWidth / u, Math.max(0, start.px + dx / u)));
        pos.y = Math.round(Math.min(c.height / u - node.offsetHeight / u, Math.max(0, start.py + dy / u)));
        node.style.setProperty("--x", pos.x);
        node.style.setProperty("--y", pos.y);
        draw();
      };
      const up = () => {
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerup", up);
        node.removeEventListener("pointercancel", up);
        node.classList.remove("is-dragging");
        if (!moved && nodes.get(id).tool) toggle(id);
      };
      node.addEventListener("pointermove", move);
      node.addEventListener("pointerup", up);
      node.addEventListener("pointercancel", up);
    });
    if (entry.tool) {
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(id);
        }
      });
    }
  }

  // Сигнал бежит, только пока блок на экране; при первом показе
  // собирается первый бриф.
  let started = false;
  new IntersectionObserver((entries) => {
    const vis = entries[0].isIntersecting;
    host.classList.toggle("is-live", vis && !reduced);
    if (vis && !started) {
      started = true;
      preset(PRESETS[0], chips.firstChild);
    }
  }, { threshold: 0.25 }).observe(host);

  new ResizeObserver(draw).observe(canvas);
  if (document.fonts) document.fonts.ready.then(draw);
  rewire();
  outText.textContent = compose();
}

document.querySelectorAll("[data-pipeline]").forEach(mount);
