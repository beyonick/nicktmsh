/* 404: нодовый граф, в который можно играть.

   Слева — входы: этот адрес (страницы нет — вход не подключён, от выхода
   к нему висит оборванный провод) и живые страницы сайта. Справа — выход:
   без сигнала на нём «404». Подключить страницу — протянуть от неё провод
   на выход или просто нажать на ноду; выход показывает, что пришло, и по
   нажатию ведёт туда. Провод можно снять с порта выхода и перекинуть.
   Битый вход не подключается: провод отскакивает, нода вздрагивает.
   На телефоне поток идёт сверху вниз. */

const host = document.querySelector("[data-lost]");
const NS = "http://www.w3.org/2000/svg";
const ARROW = '<span class="pill__arrow arrow" aria-hidden="true"></span>';
const narrow = matchMedia("(max-width: 760px)");

const path = decodeURI(location.pathname);
const INPUTS = [
  { type: "Request", tool: path, text: "not found", broken: true },
  { type: "Page", tool: "/", text: "home", href: "/" },
  { type: "Page", tool: "/work", text: "work", href: "/work" },
  { type: "Page", tool: "/lab", text: "lab", href: "/lab" },
  { type: "Contact", tool: "mail · telegram", text: "talk", href: "mailto:n27tomash@gmail.com", contact: true },
];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function svg(tag, cls) {
  const n = document.createElementNS(NS, tag);
  if (cls) n.setAttribute("class", cls);
  return n;
}
function wire() {
  const g = svg("g", "wire");
  const line = svg("path", "wire__line");
  const flow = svg("path", "wire__flow");
  g.append(line, flow);
  return { g, line, flow, set: (d) => (line.setAttribute("d", d), flow.setAttribute("d", d)) };
}

if (host) {
  host.classList.add("lost-graph");
  const wires = svg("svg", "nodes__wires");
  wires.setAttribute("aria-hidden", "true");
  host.append(wires);

  // Входы.
  const ins = INPUTS.map((spec, i) => {
    const n = el("div", `node node--text lost-node${spec.broken ? " is-broken" : ""}`);
    const head = el("div", "node__head");
    head.append(el("span", "node__type", spec.type), el("span", "node__tool", spec.tool));
    const body = el("div", "node__body");
    const port = el("span", "node__port node__port--out");
    body.append(el("p", "node__text", spec.text), port);
    n.append(head, body);
    n.tabIndex = 0;
    n.setAttribute("role", "button");
    n.setAttribute("aria-pressed", "false");
    n.setAttribute("aria-label", spec.broken ? `${spec.tool} — not found` : `Connect ${spec.text} to the output`);
    host.append(n);
    return { n, port, spec, i };
  });

  // Выход.
  const out = el("div", "node lost-out");
  const oHead = el("div", "node__head");
  oHead.append(el("span", "node__type", "Output"), el("span", "node__tool", "screen"));
  const oBody = el("div", "node__body");
  const view = el("div", "lost-out__view graph");
  const big = el("span", "lost-out__big", "404");
  view.append(big);
  const foot = el("div", "lost-out__foot");
  const hint = el("span", "lost-out__hint", "no signal");
  const go = el("a", "pill lost-out__go");
  go.hidden = true;
  foot.append(hint, go);
  const inPort = el("span", "node__port node__port--in");
  oBody.append(view, foot, inPort);
  out.append(oHead, oBody);
  host.append(out);

  // Провода: подключённый, тянущийся за курсором и оборванный — к этому адресу.
  const main = wire();
  main.line.setAttribute("pathLength", "1");
  const live = wire();
  const stub = svg("path", "lost-stub");
  const plug = svg("circle", "lost-plug");
  plug.setAttribute("r", "4");
  wires.append(stub, plug, main.g, live.g);

  let current = -1; // какой вход подключён к выходу
  let drag = null; // { from, id, sx, sy, moved, x, y }
  let vertical = narrow.matches;

  const rel = (r, H) => ({ x: r.left - H.left + r.width / 2, y: r.top - H.top + r.height / 2 });
  function curve(a, b) {
    if (vertical) {
      const dy = Math.max(30, Math.abs(b.y - a.y) * 0.5);
      return `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`;
    }
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  }

  function draw() {
    const H = host.getBoundingClientRect();
    wires.setAttribute("viewBox", `0 0 ${H.width} ${H.height}`);
    const pin = rel(inPort.getBoundingClientRect(), H);
    main.g.style.display = current >= 0 ? "" : "none";
    if (current >= 0) main.set(curve(rel(ins[current].port.getBoundingClientRect(), H), pin));
    live.g.style.display = drag && drag.moved ? "" : "none";
    if (drag && drag.moved) live.set(curve(rel(ins[drag.from].port.getBoundingClientRect(), H), { x: drag.x, y: drag.y }));
    // Оборванный провод: от выхода к этому адресу, до середины пути.
    const idle = current < 0 && !(drag && drag.moved);
    stub.style.display = plug.style.display = idle ? "" : "none";
    if (idle) {
      const src = rel(ins[0].port.getBoundingClientRect(), H);
      const end = { x: pin.x + (src.x - pin.x) * 0.45, y: pin.y + (src.y - pin.y) * 0.45 };
      stub.setAttribute("d", curve(end, pin));
      plug.setAttribute("cx", end.x);
      plug.setAttribute("cy", end.y);
    }
  }

  function render() {
    ins.forEach((x) => {
      x.n.classList.toggle("is-hot", x.i === current);
      x.n.setAttribute("aria-pressed", String(x.i === current));
    });
    const spec = INPUTS[current];
    host.classList.toggle("is-live", !!spec);
    out.classList.toggle("is-live", !!spec);
    big.textContent = spec ? spec.text : "404";
    hint.hidden = !!spec;
    hint.classList.remove("is-nope");
    hint.textContent = "no signal";
    go.hidden = !spec;
    if (spec) {
      go.href = spec.href;
      go.innerHTML = `${spec.contact ? "open contacts" : `open ${spec.tool}`}${ARROW}`;
      go.toggleAttribute("data-contact", !!spec.contact);
    }
    draw();
  }

  function connect(i) {
    if (INPUTS[i].broken) return nope(i);
    const fresh = current !== i;
    current = i;
    render();
    if (fresh) {
      main.g.classList.add("is-new");
      setTimeout(() => main.g.classList.remove("is-new"), 900);
    }
  }
  let nopeTimer = 0;
  function nope(i) {
    const n = ins[i].n;
    n.classList.remove("is-nope");
    void n.offsetWidth;
    n.classList.add("is-nope");
    current = -1;
    render();
    hint.textContent = "nothing at this address";
    hint.classList.add("is-nope");
    clearTimeout(nopeTimer);
    nopeTimer = setTimeout(render, 1600);
  }

  // Протянуть провод от входа (или снять его с порта выхода и перекинуть).
  const overOut = (x, y) => {
    const r = out.getBoundingClientRect();
    const pad = 16;
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  };
  function start(from, e, moved = false) {
    const H = host.getBoundingClientRect();
    drag = { from, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved, x: e.clientX - H.left, y: e.clientY - H.top };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* указатель уже отпущен */
    }
    if (moved) host.classList.add("is-wiring");
  }
  function move(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const H = host.getBoundingClientRect();
    drag.x = e.clientX - H.left;
    drag.y = e.clientY - H.top;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
      drag.moved = true;
      host.classList.add("is-wiring");
      if (current === drag.from) {
        current = -1;
        render();
      }
    }
    if (drag.moved) {
      out.classList.toggle("is-target", overOut(e.clientX, e.clientY));
      draw();
    }
  }
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { from, moved } = drag;
    drag = null;
    host.classList.remove("is-wiring");
    out.classList.remove("is-target");
    if (!moved) {
      // Нажатие без протяжки — подключить или отключить.
      if (current === from) {
        current = -1;
        render();
      } else connect(from);
    } else if (overOut(e.clientX, e.clientY)) connect(from);
    else draw();
  }

  ins.forEach((x) => {
    x.n.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      start(x.i, e);
    });
    x.n.addEventListener("pointermove", move);
    x.n.addEventListener("pointerup", end);
    x.n.addEventListener("pointercancel", end);
    x.n.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (current === x.i) {
        current = -1;
        render();
      } else connect(x.i);
    });
  });
  // С порта выхода провод снимается и тянется дальше.
  inPort.addEventListener("pointerdown", (e) => {
    if (current < 0 || e.button !== 0) return;
    e.stopPropagation();
    const from = current;
    current = -1;
    render();
    start(from, e, true);
    draw();
  });
  inPort.addEventListener("pointermove", move);
  inPort.addEventListener("pointerup", end);
  inPort.addEventListener("pointercancel", end);
  // Выход с сигналом нажимается целиком.
  out.addEventListener("click", (e) => {
    if (current >= 0 && !e.target.closest("a, .node__port")) go.click();
  });

  // Раскладка: на широком экране входы колонкой слева, выход справа; на
  // узком — входы сеткой сверху, выход под ними.
  function layout() {
    vertical = narrow.matches;
    host.classList.toggle("is-vertical", vertical);
    const W = host.clientWidth;
    let bottom = 0;
    if (!vertical) {
      const k = W / 912;
      const w = 200 * k;
      ins.forEach((x) => (x.n.style.width = `${w}px`));
      const step = Math.max(...ins.map((x) => x.n.offsetHeight)) + 22 * k;
      ins.forEach((x, i) => {
        x.n.style.left = "0px";
        x.n.style.top = `${i * step}px`;
      });
      const colH = (ins.length - 1) * step + ins[0].n.offsetHeight;
      const ow = 380 * k;
      out.style.width = `${ow}px`;
      out.style.left = `${W - ow}px`;
      out.style.top = `${Math.max(0, (colH - out.offsetHeight) / 2)}px`;
      bottom = Math.max(colH, out.offsetTop + out.offsetHeight);
    } else {
      const k = W / 320;
      const w = 150 * k;
      const gap = 20 * k;
      ins.forEach((x) => (x.n.style.width = `${w}px`));
      const step = Math.max(...ins.map((x) => x.n.offsetHeight)) + 28 * k;
      ins.forEach((x, i) => {
        x.n.style.left = `${(i % 2) * (w + gap)}px`;
        x.n.style.top = `${Math.floor(i / 2) * step}px`;
      });
      const rows = Math.ceil(ins.length / 2);
      const top = (rows - 1) * step + ins[0].n.offsetHeight + 56 * k;
      out.style.width = `${W}px`;
      out.style.left = "0px";
      out.style.top = `${top}px`;
      bottom = top + out.offsetHeight;
    }
    host.style.height = `${Math.ceil(bottom)}px`;
    draw();
  }

  new ResizeObserver(layout).observe(host);
  narrow.addEventListener("change", layout);
  if (document.fonts) document.fonts.ready.then(layout);
  render();
  layout();
}
