/* Нодовая схема: пайплайн проекта как граф (рефы — нодовые редакторы
   вроде Weavy / Krea: карточки с подписью «ТИП · ИНСТРУМЕНТ», провода между
   портами).

   Граф описывается json-ом прямо в разметке:

     <div class="nodes" data-nodes>
       <script type="application/json">{ "base": "…", "nodes": […], "edges": […] }</script>
     </div>

   node:  { id, type, tool, x, y, w, src?, poster?, text? }
          x, y, w — в макетных пикселях (сетка 912 по ширине, как колонка
          сайта); src — картинка или видео (путь от base или полный адрес),
          text — текстовая нода.
   edge:  [откуда, куда, подпись?]

   Ноды таскаются мышью, провода идут следом. Наведение на ноду подсвечивает
   её связи. По проводам бежит сигнал — пунктир с движением, только пока
   схема на экране. Провода — SVG поверх сетки, ниже карточек. */

const VIDEO = /\.(mp4|webm|mov)(\?|$)/i;
const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;


function mount(host) {
  const src = host.querySelector('script[type="application/json"]');
  if (!src) return;
  const graph = JSON.parse(src.textContent);
  const base = graph.base || "";
  const url = (p) => (!p ? "" : /^(https?:|assets\/)/.test(p) ? p : base + p);

  const canvas = document.createElement("div");
  canvas.className = "nodes__canvas";
  const wires = document.createElementNS(NS, "svg");
  wires.setAttribute("class", "nodes__wires");
  wires.setAttribute("aria-hidden", "true");
  canvas.append(wires);

  const byId = new Map();

  for (const n of graph.nodes) {
    const node = document.createElement("figure");
    node.className = `node node--${n.text && !n.src ? "text" : "media"}`;
    node.dataset.id = n.id;
    node.style.setProperty("--x", n.x);
    node.style.setProperty("--y", n.y);
    node.style.setProperty("--w", n.w);

    const head = document.createElement("figcaption");
    head.className = "node__head";
    head.innerHTML = `<span class="node__type"></span><span class="node__tool"></span>`;
    head.querySelector(".node__type").textContent = n.type;
    head.querySelector(".node__tool").textContent = n.tool || "";

    const body = document.createElement("div");
    body.className = "node__body";
    if (n.src) {
      const s = url(n.src);
      let m;
      if (VIDEO.test(s)) {
        m = document.createElement("video");
        m.muted = true;
        m.loop = true;
        m.playsInline = true;
        m.autoplay = !reduced;
        m.preload = "metadata";
        if (n.poster) m.poster = url(n.poster);
      } else {
        m = document.createElement("img");
        m.alt = "";
        m.decoding = "async";
      }
      m.src = s;
      m.className = "node__media";
      m.draggable = false;
      // Размер медиа известен только после загрузки — провода пересчитываются.
      m.addEventListener(m.tagName === "VIDEO" ? "loadedmetadata" : "load", () => draw());
      body.append(m);
    }
    if (n.text) {
      const p = document.createElement("p");
      p.className = "node__text";
      p.textContent = n.text;
      body.append(p);
    }

    const pin = (side) => {
      const s = document.createElement("span");
      s.className = `node__port node__port--${side}`;
      s.setAttribute("aria-hidden", "true");
      return s;
    };
    body.append(pin("in"), pin("out"));

    node.append(head, body);
    canvas.append(node);
    byId.set(n.id, { node, data: n, body });
  }

  // Провода: подложка (тонкая линия) и поверх неё сигнал (бегущий пунктир).
  const links = graph.edges.map(([from, to, label]) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "wire");
    const line = document.createElementNS(NS, "path");
    line.setAttribute("class", "wire__line");
    const flow = document.createElementNS(NS, "path");
    flow.setAttribute("class", "wire__flow");
    g.append(line, flow);
    wires.append(g);

    let tag = null;
    if (label) {
      tag = document.createElement("span");
      tag.className = "wire__label";
      tag.textContent = label;
      canvas.append(tag);
    }
    return { from, to, g, line, flow, tag };
  });

  // Порт без провода не рисуется: у входа схемы нет входа, у выхода — выхода.
  for (const [id, { body }] of byId) {
    body.querySelector(".node__port--in").classList.toggle("is-idle", !links.some((l) => l.to === id));
    body.querySelector(".node__port--out").classList.toggle("is-idle", !links.some((l) => l.from === id));
  }

  canvas.style.setProperty("--h", graph.height || 520);
  host.append(canvas);

  /* Геометрия. Порт стоит на середине тела ноды, по краю; провод — кубическая
     кривая с горизонтальными касательными, как в нодовых редакторах. */
  function port(id, side) {
    const { node, body } = byId.get(id);
    const c = canvas.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    return {
      x: (side === "out" ? b.right : b.left) - c.left,
      y: b.top + b.height / 2 - c.top,
    };
  }

  function draw() {
    const c = canvas.getBoundingClientRect();
    wires.setAttribute("viewBox", `0 0 ${c.width} ${c.height}`);
    for (const l of links) {
      if (!byId.has(l.from) || !byId.has(l.to)) continue;
      const a = port(l.from, "out");
      const b = port(l.to, "in");
      const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
      const d = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
      l.line.setAttribute("d", d);
      l.flow.setAttribute("d", d);
      if (l.tag) {
        // Середина кривой Безье при t = 0.5.
        l.tag.style.left = `${(a.x + b.x) / 2}px`;
        l.tag.style.top = `${(a.y + b.y) / 2}px`;
      }
    }
  }

  /* Подсветка связей ноды под курсором. */
  for (const [id, { node }] of byId) {
    node.addEventListener("pointerenter", () => {
      host.classList.add("is-focus");
      node.classList.add("is-hot");
      for (const l of links) {
        const hot = l.from === id || l.to === id;
        l.g.classList.toggle("is-hot", hot);
        if (hot) byId.get(l.from === id ? l.to : l.from).node.classList.add("is-near");
      }
    });
    node.addEventListener("pointerleave", () => {
      host.classList.remove("is-focus");
      node.classList.remove("is-hot");
      links.forEach((l) => l.g.classList.remove("is-hot"));
      byId.forEach(({ node: n }) => n.classList.remove("is-near"));
    });
  }

  /* Перетаскивание. Позиция хранится в макетных пикселях (--x, --y), поэтому
     схема остаётся той же при любой ширине окна. Нода не уходит за край
     холста. */
  for (const [, { node, data }] of byId) {
    node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      node.setPointerCapture(e.pointerId);
      node.classList.add("is-dragging");
      // Макетный пиксель — из ширины холста (912 единиц): --u в CSS — это
      // calc(), число из него не вынуть, а на телефоне база другая.
      const u = canvas.getBoundingClientRect().width / 912;
      const start = { x: e.clientX, y: e.clientY, nx: data.x, ny: data.y };
      const c = canvas.getBoundingClientRect();
      const move = (ev) => {
        const maxX = c.width / u - node.offsetWidth / u;
        const maxY = c.height / u - node.offsetHeight / u;
        data.x = Math.round(Math.min(maxX, Math.max(0, start.nx + (ev.clientX - start.x) / u)));
        data.y = Math.round(Math.min(maxY, Math.max(0, start.ny + (ev.clientY - start.y) / u)));
        node.style.setProperty("--x", data.x);
        node.style.setProperty("--y", data.y);
        draw();
      };
      const up = () => {
        node.classList.remove("is-dragging");
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerup", up);
        node.removeEventListener("pointercancel", up);
      };
      node.addEventListener("pointermove", move);
      node.addEventListener("pointerup", up);
      node.addEventListener("pointercancel", up);
    });
  }

  // Сигнал бежит и видео играют, только пока схема на экране.
  new IntersectionObserver((entries) => {
    const on = entries[0].isIntersecting;
    host.classList.toggle("is-live", on && !reduced);
    host.querySelectorAll("video").forEach((v) => (on && !reduced ? v.play().catch(() => {}) : v.pause()));
  }).observe(host);

  new ResizeObserver(draw).observe(canvas);
  if (document.fonts) document.fonts.ready.then(draw);
  draw();
}

document.querySelectorAll("[data-nodes]").forEach(mount);
