/* Панель «tilt»: выбрать элемент и отрегулировать его наклон вживую.

   Группа выбирается списком или кликом по элементу на странице (кнопка
   «на странице»). Выбранная группа обводится пунктиром, пока панель
   открыта. Значения хранятся в localStorage (js/tilt.js) — это настройка
   разработчика; строка внизу панели — готовая запись для GROUPS в коде,
   клик копирует её. */

import { GROUPS, setTilt, resetTilt } from "./tilt.js";

const devbar = document.querySelector(".devbar");

if (devbar) {
  const SLIDERS = [
    { param: "amount", label: "влияние", min: 0, max: 4, step: 0.1, fmt: (v) => v.toFixed(1) },
    { param: "rot", label: "наклон", min: 0, max: 30, step: 0.5, fmt: (v) => `${v}°` },
    { param: "shift", label: "перемещение", min: 0, max: 80, step: 1, fmt: (v) => `${v}px` },
  ];

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ease-switch";
  button.textContent = "tilt";
  button.setAttribute("aria-expanded", "false");
  devbar.prepend(button);

  const panel = document.createElement("aside");
  panel.className = "easepanel tiltpanel";
  panel.hidden = true;
  panel.innerHTML = `
    <p class="easepanel__title">Наклон за курсором</p>
    <div class="tiltpanel__head">
      <select data-group aria-label="Элемент"></select>
      <button type="button" class="easepanel__preset" data-pick aria-pressed="false">на странице</button>
    </div>
    <div class="easepanel__presets" data-modes>
      <button type="button" class="easepanel__preset" data-mode="element">от элемента</button>
      <button type="button" class="easepanel__preset" data-mode="screen">от экрана</button>
      <button type="button" class="easepanel__preset" data-reset>сбросить</button>
    </div>
    <div data-sliders></div>
    <p class="easepanel__code" data-code title="Кликните, чтобы скопировать"></p>`;
  document.body.append(panel);

  const select = panel.querySelector("[data-group]");
  const pick = panel.querySelector("[data-pick]");
  const code = panel.querySelector("[data-code]");
  const slidersHost = panel.querySelector("[data-sliders]");

  for (const [key, g] of Object.entries(GROUPS)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = g.label;
    select.append(o);
  }

  const rows = SLIDERS.map((s) => {
    const row = document.createElement("label");
    row.className = "easepanel__row";
    row.innerHTML = `<span>${s.label}</span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}"><output></output>`;
    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      setTilt(select.value, s.param, Number(input.value));
      render();
    });
    slidersHost.append(row);
    return { s, input, out: row.querySelector("output") };
  });

  let marked = [];
  function mark() {
    marked.forEach((n) => n.classList.remove("is-tilt-picked"));
    marked = panel.hidden ? [] : [...document.querySelectorAll(GROUPS[select.value].sel)];
    marked.forEach((n) => n.classList.add("is-tilt-picked"));
  }

  function render() {
    const g = GROUPS[select.value];
    rows.forEach(({ s, input, out }) => {
      input.value = g[s.param];
      out.textContent = s.fmt(Number(g[s.param]));
    });
    panel.querySelectorAll("[data-mode]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.mode === g.mode));
    });
    code.textContent = `${select.value}: { mode: "${g.mode}", amount: ${g.amount}, rot: ${g.rot}, shift: ${g.shift} }`;
    mark();
  }

  select.addEventListener("change", render);

  panel.addEventListener("click", (e) => {
    const mode = e.target.dataset && e.target.dataset.mode;
    if (mode) {
      setTilt(select.value, "mode", mode);
      render();
    }
    if (e.target.hasAttribute("data-reset")) {
      resetTilt(select.value);
      render();
    }
  });

  code.addEventListener("click", () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code.textContent);
    code.textContent = "скопировано";
    setTimeout(render, 900);
  });

  /* Выбор кликом. Ищем по прямоугольникам, а не по цели клика: знак в
     ячейке лежит под ссылкой и сам события не ловит. Из нескольких
     попаданий берём самый мелкий элемент — он и имелся в виду. */
  function setPicking(on) {
    pick.setAttribute("aria-pressed", String(on));
    document.documentElement.classList.toggle("is-tilt-picking", on);
  }

  pick.addEventListener("click", () => setPicking(pick.getAttribute("aria-pressed") !== "true"));

  document.addEventListener(
    "click",
    (e) => {
      if (pick.getAttribute("aria-pressed") !== "true" || panel.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      let best = null;
      for (const [key, g] of Object.entries(GROUPS)) {
        document.querySelectorAll(g.sel).forEach((n) => {
          const r = n.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          const area = r.width * r.height;
          if (inside && (!best || area < best.area)) best = { key, area };
        });
      }
      if (best) {
        select.value = best.key;
        render();
      }
      setPicking(false);
    },
    true
  );

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    if (panel.hidden) setPicking(false);
    render();
  });

  render();
}
