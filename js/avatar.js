/* Аватар «обо мне»: круг, пунктирная орбита и смена кадра по клику.

   Список кадров — в data-photos на <figure>. Клик (или Enter) проигрывает
   цифровой переход на холсте поверх фото: кадр рассыпается в пиксельные
   блоки, строки сдвигаются, как сбойный сигнал, вспыхивают блоки данных
   акцентом — в пике кадр меняется и собирается обратно. Счётчик в углу —
   какой кадр из скольких. Без движения (reduced motion) кадр меняется
   сразу. */

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DUR = 560; // мс на весь переход

function accent() {
  const probe = document.createElement("span");
  probe.style.color = "var(--accent)";
  document.body.append(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}

document.querySelectorAll("[data-photos]").forEach((fig) => {
  const img = fig.querySelector("img");
  const list = JSON.parse(fig.dataset.photos || "[]");
  if (!img || list.length < 2) return;

  // Все кадры грузим заранее: переход рисует их на холсте.
  const frames = list.map((src) => {
    const pic = new Image();
    pic.src = src;
    return pic;
  });

  const fx = document.createElement("canvas");
  fx.className = "me__fx";
  fx.setAttribute("aria-hidden", "true");
  const count = document.createElement("span");
  count.className = "me__count";
  count.setAttribute("aria-hidden", "true");
  fig.append(fx, count);
  const ctx = fx.getContext("2d");
  const small = document.createElement("canvas");
  const sctx = small.getContext("2d");

  let at = Math.max(0, list.indexOf(img.getAttribute("src")));
  let busy = false;
  const show = () =>
    (count.textContent = `${String(at + 1).padStart(2, "0")}/${String(list.length).padStart(2, "0")}`);
  show();

  fig.tabIndex = 0;
  fig.setAttribute("role", "button");
  fig.setAttribute("aria-label", "Next photo");

  // Кадр с пикселизацией block и сбоем glitch (0..1).
  function paint(pic, block, glitch, lime) {
    const w = fx.width;
    const h = fx.height;
    const sw = Math.max(1, Math.round(w / block));
    const sh = Math.max(1, Math.round(h / block));
    small.width = sw;
    small.height = sh;
    sctx.drawImage(pic, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(small, 0, 0, w, h);
    // Сдвинутые строки — как сорванная синхронизация.
    const rows = Math.round(glitch * 9);
    for (let i = 0; i < rows; i++) {
      const y = Math.random() * h;
      const bh = (0.02 + Math.random() * 0.07) * h;
      const shift = (Math.random() - 0.5) * glitch * w * 0.35;
      ctx.drawImage(small, 0, (y / h) * sh, sw, (bh / h) * sh, shift, y, w, bh);
    }
    // Блоки данных акцентом.
    ctx.fillStyle = lime;
    const cells = Math.round(glitch * 14);
    const cell = Math.max(2, block);
    for (let i = 0; i < cells; i++) {
      ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.fillRect(Math.floor((Math.random() * w) / cell) * cell, Math.floor((Math.random() * h) / cell) * cell, cell, cell);
    }
    ctx.globalAlpha = 1;
  }

  const next = () => {
    if (busy) return;
    const from = frames[at];
    at = (at + 1) % list.length;
    const to = frames[at];
    if (reduced) {
      img.src = list[at];
      show();
      return;
    }
    busy = true;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fx.width = Math.round(fig.clientWidth * dpr);
    fx.height = Math.round(fig.clientHeight * dpr);
    const lime = accent();
    const maxBlock = fx.width / 10;
    fig.classList.add("is-fx");
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const k = Math.sin(t * Math.PI); // 0 → 1 → 0: пик в середине
      const block = 1 + k * k * maxBlock;
      paint(t < 0.5 ? from : to, block, k, lime);
      if (t >= 0.5 && img.getAttribute("src") !== list[at]) {
        img.src = list[at];
        show();
      }
      if (t < 1) requestAnimationFrame(step);
      else {
        fig.classList.remove("is-fx");
        busy = false;
      }
    };
    requestAnimationFrame(step);
  };

  fig.addEventListener("click", next);
  fig.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      next();
    }
  });
});
