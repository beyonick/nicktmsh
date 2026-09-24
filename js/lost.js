/* 404: нодовый граф, в который можно играть.

   Входы — этот адрес, страницы сайта, картинка из Lab и контакты —
   сходятся в Switch, как в Houdini: переключатель выбирает, какой вход
   пройдёт на выход. Вход 0 — этот адрес — не подключён (к нему тянется
   оборванный провод), поэтому сразу на выходе 404 и рамка алертным
   цветом. Переключи Switch — нажатием на ноду или на номер входа — и
   выход покажет страницу или картинку и поведёт туда.

   Ноды таскаются. Провод снимается с порта входа и цепляется обратно на
   Switch; вход 0 не цепляется — страницы нет. Нажатие на картинку
   подключает её, повторное — меняет картинку. Граф вписан в экран:
   масштабируется по высоте, ноды не выходят за края. */

const stage = document.querySelector("[data-lost]");
const NS = "http://www.w3.org/2000/svg";
const ARROW = '<span class="pill__arrow arrow" aria-hidden="true"></span>';
const narrow = matchMedia("(max-width: 760px)");
const path = decodeURI(location.pathname);

const INPUTS = [
  { kind: "request", type: "Request", tool: path, text: "not found" },
  { kind: "page", type: "Page", tool: "/", text: "home", href: "/" },
  { kind: "page", type: "Page", tool: "/work", text: "work", href: "/work" },
  { kind: "page", type: "Page", tool: "/lab", text: "lab", href: "/lab" },
  { kind: "image", type: "File", tool: "image", text: "", href: "/lab" },
  { kind: "page", type: "Contact", tool: "mail · tg", text: "talk", href: "mailto:n27tomash@gmail.com", contact: true },
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
function wire(draws) {
  const g = svg("g", "wire");
  const line = svg("path", "wire__line");
  const flow = svg("path", "wire__flow");
  if (draws) line.setAttribute("pathLength", "1");
  g.append(line, flow);
  return { g, set: (d) => (line.setAttribute("d", d), flow.setAttribute("d", d)) };
}

if (stage) {
  const canvas = el("div", "lost-canvas");
  const probe = el("div", "lost-probe");
  const wires = svg("svg", "nodes__wires");
  wires.setAttribute("aria-hidden", "true");
  canvas.append(wires);
  stage.append(probe, canvas);

  // --- Ноды ---------------------------------------------------------------
  function node(cls, type, toolText) {
    const n = el("div", `node ${cls}`);
    const head = el("div", "node__head");
    const tool = el("span", "node__tool", toolText);
    head.append(el("span", "node__type", type), tool);
    const body = el("div", "node__body");
    n.append(head, body);
    n.tabIndex = 0;
    canvas.append(n);
    return { n, body, tool, x: 0, y: 0, w: 100 };
  }

  const ins = INPUTS.map((spec, i) => {
    const image = spec.kind === "image";
    const item = node(`lost-node${image ? " lost-img" : " node--text"}${spec.kind === "request" ? " is-broken" : ""}`, spec.type, spec.tool);
    if (image) {
      item.pic = el("img", "lost-img__pic");
      item.pic.alt = "";
      item.pic.draggable = false;
      item.body.append(item.pic);
    } else item.body.append(el("p", "node__text", spec.text));
    item.port = el("span", "node__port node__port--out");
    item.body.append(item.port);
    item.n.setAttribute("role", "button");
    item.n.setAttribute("aria-label", spec.kind === "request" ? `${spec.tool} — not found` : `Switch to ${spec.text || "a picture"}`);
    item.wire = wire(true);
    wires.append(item.wire.g);
    return Object.assign(item, { spec, i });
  });

  // Switch, как в Houdini: номер входа — ячейки, нажатие на ноду — следующий.
  const sw = node("lost-sw", "Switch", "switch1");
  sw.n.setAttribute("role", "group");
  sw.n.setAttribute("aria-label", "Switch — select input");
  const swLabel = el("span", "lost-sw__label");
  const cellRow = el("div", "lost-sw__cells");
  const cells = INPUTS.map((_, i) => {
    const c = el("button", "lost-sw__cell", String(i));
    c.type = "button";
    c.setAttribute("aria-label", `Input ${i}`);
    c.addEventListener("pointerdown", (e) => e.stopPropagation());
    c.addEventListener("click", () => select(i));
    cellRow.append(c);
    return c;
  });
  sw.inPort = el("span", "node__port node__port--in");
  sw.outPort = el("span", "node__port node__port--out");
  sw.body.append(swLabel, cellRow, sw.inPort, sw.outPort);

  const out = node("lost-out", "Output", "screen");
  out.n.setAttribute("role", "button");
  const view = el("div", "lost-out__view graph");
  const big = el("span", "lost-out__big", "404");
  const outImg = el("img", "lost-out__img");
  outImg.alt = "";
  outImg.draggable = false;
  view.append(outImg, big);
  const foot = el("div", "lost-out__foot");
  const hint = el("span", "lost-out__hint");
  const go = el("a", "pill lost-out__go");
  go.addEventListener("pointerdown", (e) => e.stopPropagation());
  foot.append(hint, go);
  out.inPort = el("span", "node__port node__port--in");
  out.body.append(view, foot, out.inPort);

  const outWire = wire(false);
  const live = wire(false);
  const stub = svg("path", "lost-stub");
  const plug = svg("circle", "lost-plug");
  plug.setAttribute("r", "4");
  wires.append(outWire.g, stub, plug, live.g);

  const all = [...ins, sw, out];

  // --- Картинка: любой постер из Lab --------------------------------------
  let pics = [{ src: "/assets/me/lebowski.webp", title: "lebowski" }];
  let picAt = 0;
  const img = ins.find((x) => x.spec.kind === "image");
  function showPic() {
    const p = pics[picAt];
    img.pic.src = p.src;
    outImg.src = p.src;
    img.tool.textContent = p.title;
  }
  function shuffle() {
    if (pics.length > 1) picAt = (picAt + 1 + Math.floor(Math.random() * (pics.length - 1))) % pics.length;
    showPic();
  }
  showPic();
  fetch("/data/lab.json")
    .then((r) => r.json())
    .then((d) => {
      const base = d.mediaBase || "";
      const list = (d.items || [])
        .filter((it) => it.poster && it.published !== false)
        .map((it) => ({
          src: /^(https?:)?\//.test(it.poster) ? it.poster : base + it.poster,
          title: String(it.title || it.slug).toLowerCase(),
        }));
      if (list.length) {
        pics = list;
        picAt = Math.floor(Math.random() * pics.length);
        showPic();
      }
    })
    .catch(() => {});

  // --- Состояние ----------------------------------------------------------
  const links = new Set(INPUTS.map((_, i) => i).filter((i) => INPUTS[i].kind !== "request"));
  let sel = 0; // вход 0 — этот адрес, не подключён
  const valid = () => links.has(sel) && INPUTS[sel].kind !== "request";

  function render() {
    const ok = valid();
    const spec = INPUTS[sel];
    ins.forEach((x) => {
      x.n.classList.toggle("is-hot", ok && x.i === sel);
      x.n.classList.toggle("is-off", !links.has(x.i));
    });
    cells.forEach((c, i) => {
      c.classList.toggle("is-on", i === sel);
      c.classList.toggle("is-empty", !links.has(i) || INPUTS[i].kind === "request");
      c.setAttribute("aria-pressed", String(i === sel));
    });
    swLabel.textContent = `select input · ${sel}`;
    out.n.classList.toggle("is-live", ok);
    out.n.classList.toggle("is-alert", !ok);
    const image = ok && spec.kind === "image";
    big.textContent = ok ? (image ? "" : spec.text) : "404";
    outImg.hidden = !image;
    hint.hidden = ok;
    hint.textContent = ok ? "" : `input ${sel} · not connected`;
    go.hidden = !ok;
    if (ok) {
      go.href = spec.href;
      go.innerHTML = `${spec.contact ? "open contacts" : image ? "open lab" : `open ${spec.tool}`}${ARROW}`;
      go.toggleAttribute("data-contact", !!spec.contact);
    }
    out.n.setAttribute("aria-label", ok ? go.textContent : "No signal");
    draw();
  }
  function select(i) {
    sel = (i + INPUTS.length) % INPUTS.length;
    render();
    if (INPUTS[sel].kind === "request") nope();
  }
  function nope() {
    const n = ins[0].n;
    n.classList.remove("is-nope");
    void n.offsetWidth;
    n.classList.add("is-nope");
  }
  function fresh(i) {
    const g = ins[i].wire.g;
    g.classList.add("is-new");
    setTimeout(() => g.classList.remove("is-new"), 900);
  }

  // --- Раскладка: в единицах сайта, вписана в экран -------------------------
  let u = 1;
  let fit = 1;
  let vertical = null;
  let touched = false;
  const L = { W: 912, H: 480 };

  function setW(item, w) {
    item.w = w;
    item.n.style.setProperty("--w", w.toFixed(2));
  }
  const tall = (item) => item.n.offsetHeight / u;
  function place(item, x, y) {
    item.x = Math.max(0, Math.min(L.W - item.w, x));
    item.y = Math.max(0, Math.min(L.H - tall(item), y));
    item.n.style.setProperty("--x", item.x.toFixed(2));
    item.n.style.setProperty("--y", item.y.toFixed(2));
  }

  // По умолчанию: широкий экран — входы колонкой слева, Switch посередине,
  // выход справа; узкий — входы сеткой сверху, дальше Switch и выход.
  function defaults() {
    const W = L.W;
    const at = new Map();
    if (!vertical) {
      const iw = 176;
      ins.forEach((x) => setW(x, iw));
      let y = 0;
      ins.forEach((x) => {
        at.set(x, [0, y]);
        y += tall(x) + 12;
      });
      const colH = y - 12;
      setW(sw, 196);
      setW(out, 330);
      const outX = W - 330;
      const outY = Math.max(0, (colH - tall(out)) / 2);
      at.set(out, [outX, outY]);
      at.set(sw, [iw + (outX - iw - 196) / 2, outY + (tall(out) - tall(sw)) / 2]);
      L.H = Math.max(colH, outY + tall(out));
    } else {
      const gap = 10;
      const iw = (W - 2 * gap) / 3;
      ins.forEach((x) => setW(x, iw));
      const rowH = [0, 1].map((r) => Math.max(...ins.slice(r * 3, r * 3 + 3).map(tall)));
      ins.forEach((x, i) => at.set(x, [(i % 3) * (iw + gap), Math.floor(i / 3) * (rowH[0] + 14)]));
      const swY = rowH[0] + 14 + rowH[1] + 40;
      setW(sw, Math.min(240, W));
      setW(out, W);
      at.set(sw, [(W - sw.w) / 2, swY]);
      const outY = swY + tall(sw) + 40;
      at.set(out, [0, outY]);
      L.H = outY + tall(out);
    }
    at.forEach(([x, y], item) => place(item, x, y));
  }

  let laid = false;
  function layout(reset) {
    // Пока сцена без размера (вкладка скрыта) — раскладывать не во что.
    if (!stage.clientWidth || !probe.offsetWidth) return;
    if (!laid) reset = laid = true;
    u = probe.offsetWidth / 100;
    const v = narrow.matches;
    if (v !== vertical) {
      vertical = v;
      canvas.classList.toggle("is-vertical", v);
      reset = true;
    }
    L.W = stage.clientWidth / u;
    if (reset) defaults();
    else all.forEach((x) => place(x, x.x, x.y));
    const w = L.W * u;
    const h = L.H * u;
    fit = Math.min(1, stage.clientHeight / h || 1);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.scale = String(fit);
    canvas.style.left = `${(stage.clientWidth - w * fit) / 2}px`;
    wires.setAttribute("viewBox", `0 0 ${w} ${h}`);
    draw();
  }

  // --- Провода ------------------------------------------------------------
  function local(node) {
    const r = node.getBoundingClientRect();
    const C = canvas.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - C.left) / fit, y: (r.top + r.height / 2 - C.top) / fit };
  }
  function curve(a, b) {
    if (vertical) {
      const dy = Math.max(24, Math.abs(b.y - a.y) * 0.5);
      return `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`;
    }
    const dx = Math.max(30, Math.abs(b.x - a.x) * 0.5);
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  }
  let act = null; // жест: { mode: "node" | "wire", item, id, sx, sy, ox, oy, moved, x, y }

  function draw() {
    const ok = valid();
    const pin = local(sw.inPort);
    ins.forEach((x) => {
      const on = links.has(x.i);
      x.wire.g.style.display = on ? "" : "none";
      if (on) x.wire.set(curve(local(x.port), pin));
      x.wire.g.classList.toggle("is-hot", ok && x.i === sel);
    });
    outWire.set(curve(local(sw.outPort), local(out.inPort)));
    outWire.g.classList.toggle("is-hot", ok);
    outWire.g.classList.toggle("is-alert", !ok);
    // Оборванный провод от Switch к этому адресу.
    const loose = !links.has(0) && !(act && act.mode === "wire" && act.item === ins[0]);
    stub.style.display = plug.style.display = loose ? "" : "none";
    if (loose) {
      const src = local(ins[0].port);
      const end = { x: pin.x + (src.x - pin.x) * 0.45, y: pin.y + (src.y - pin.y) * 0.45 };
      stub.setAttribute("d", curve(end, pin));
      plug.setAttribute("cx", end.x);
      plug.setAttribute("cy", end.y);
    }
    stub.classList.toggle("is-alert", sel === 0);
    plug.classList.toggle("is-alert", sel === 0);
    const wiring = act && act.mode === "wire";
    live.g.style.display = wiring ? "" : "none";
    if (wiring) live.set(curve(local(act.item.port), { x: act.x, y: act.y }));
  }

  // --- Жесты --------------------------------------------------------------
  const inside = (node, e, pad = 12) => {
    const r = node.getBoundingClientRect();
    return e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad;
  };
  function point(e) {
    const C = canvas.getBoundingClientRect();
    act.x = (e.clientX - C.left) / fit;
    act.y = (e.clientY - C.top) / fit;
  }
  function down(e, item) {
    if (e.button !== 0 || act) return;
    const wireMode = item.port && e.target.closest(".node__port--out");
    act = { mode: wireMode ? "wire" : "node", item, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, moved: false };
    try {
      item.n.setPointerCapture(e.pointerId);
    } catch {
      /* указатель уже отпущен */
    }
    if (wireMode) {
      // Провод снимается с Switch и идёт за курсором.
      links.delete(item.i);
      point(e);
      stage.classList.add("is-wiring");
      render();
    }
  }
  function move(e) {
    if (!act || e.pointerId !== act.id) return;
    if (act.mode === "wire") {
      point(e);
      sw.n.classList.toggle("is-target", inside(sw.n, e));
      draw();
      return;
    }
    const dx = e.clientX - act.sx;
    const dy = e.clientY - act.sy;
    if (!act.moved && Math.hypot(dx, dy) < 4) return;
    act.moved = true;
    touched = true;
    act.item.n.classList.add("is-dragging");
    place(act.item, act.ox + dx / (u * fit), act.oy + dy / (u * fit));
    draw();
  }
  function up(e) {
    if (!act || e.pointerId !== act.id) return;
    const a = act;
    act = null;
    stage.classList.remove("is-wiring");
    sw.n.classList.remove("is-target");
    a.item.n.classList.remove("is-dragging");
    if (a.mode === "wire") {
      if (e.type === "pointerup" && inside(sw.n, e)) {
        if (a.item.spec.kind === "request") nope();
        else {
          links.add(a.item.i);
          fresh(a.item.i);
        }
      }
      render();
      return;
    }
    if (!a.moved && e.type === "pointerup") tap(a.item);
  }
  // Нажатие без перетаскивания.
  function tap(item) {
    if (item === sw) return select(sel + 1);
    if (item === out) {
      if (valid()) go.click();
      return;
    }
    if (item.spec.kind === "image" && sel === item.i && links.has(item.i)) shuffle();
    if (item.spec.kind !== "request" && !links.has(item.i)) {
      links.add(item.i);
      fresh(item.i);
    }
    select(item.i);
  }

  all.forEach((item) => {
    item.n.addEventListener("pointerdown", (e) => down(e, item));
    item.n.addEventListener("pointermove", move);
    item.n.addEventListener("pointerup", up);
    item.n.addEventListener("pointercancel", up);
    item.n.addEventListener("keydown", (e) => {
      if (item === sw && /^Arrow/.test(e.key)) {
        e.preventDefault();
        return select(sel + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1));
      }
      if (e.target !== item.n || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      tap(item);
    });
  });

  new ResizeObserver(() => layout(false)).observe(stage);
  narrow.addEventListener("change", () => layout(true));
  if (document.fonts) document.fonts.ready.then(() => layout(!touched));
  layout(true);
  render();
}
