/* Панель «ink»: чернила в сетке проектов (js/spot.js) вживую.

   Меняет параметры жидкости на лету — следующий кадр уже идёт с новыми
   значениями. Значения хранятся в localStorage; строка внизу — готовый
   объект для INK_DEFAULTS в spot.js, клик копирует её. */

import { P, INK_DEFAULTS, setInk, resetInk } from "./spot.js";

const devbar = document.querySelector(".devbar");

if (devbar) {
  const SLIDERS = [
    { key: "radius", label: "размер мазка", min: 0.02, max: 0.25, step: 0.005 },
    { key: "ink", label: "плотность следа", min: 0, max: 4, step: 0.05 },
    { key: "flow", label: "эмиттер на месте", min: 0, max: 8, step: 0.1 },
    { key: "force", label: "сила движения", min: 0, max: 300, step: 5 },
    { key: "curl", label: "завихрения", min: 0, max: 60, step: 1 },
    { key: "dyeFade", label: "таяние краски", min: 0.05, max: 2, step: 0.05 },
    { key: "velFade", label: "затухание течения", min: 0, max: 3, step: 0.05 },
    { key: "near", label: "старт за рамкой", min: 0, max: 1, step: 0.05 },
    { key: "linger", label: "живёт после, с", min: 1, max: 15, step: 0.5 },
  ];

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ease-switch";
  button.textContent = "ink";
  button.setAttribute("aria-expanded", "false");
  devbar.prepend(button);

  const panel = document.createElement("aside");
  panel.className = "easepanel tiltpanel inkpanel";
  panel.hidden = true;
  panel.innerHTML = `
    <p class="easepanel__title">Чернила в проектах</p>
    <div class="easepanel__presets">
      <button type="button" class="easepanel__preset" data-reset>сбросить</button>
    </div>
    <div data-sliders></div>
    <p class="easepanel__code" data-code title="Кликните, чтобы скопировать"></p>`;
  document.body.append(panel);

  const code = panel.querySelector("[data-code]");
  const rows = SLIDERS.map((s) => {
    const row = document.createElement("label");
    row.className = "easepanel__row";
    row.innerHTML = `<span>${s.label}</span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}"><output></output>`;
    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      setInk(s.key, Number(input.value));
      render();
    });
    panel.querySelector("[data-sliders]").append(row);
    return { s, input, out: row.querySelector("output") };
  });

  function render() {
    rows.forEach(({ s, input, out }) => {
      input.value = P[s.key];
      out.textContent = String(+Number(P[s.key]).toFixed(3));
    });
    const changed = SLIDERS.map((s) => `${s.key}: ${+Number(P[s.key]).toFixed(3)}`);
    code.textContent = `{ ${changed.join(", ")} }`;
    code.dataset.same = String(SLIDERS.every((s) => P[s.key] === INK_DEFAULTS[s.key]));
  }

  panel.querySelector("[data-reset]").addEventListener("click", () => {
    resetInk();
    render();
  });

  code.addEventListener("click", () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code.textContent);
    code.textContent = "скопировано";
    setTimeout(render, 900);
  });

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    render();
  });

  render();
}
