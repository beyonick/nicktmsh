/* Аватар «обо мне»: круг, пунктирная орбита и смена кадра по клику.

   Список кадров — в data-photos на <figure>. Клик (или Enter) проигрывает
   переход на холсте поверх фото, языком айдентики — линиями: кадр
   раскладывается на тонкие горизонтальные линии, они редеют и расходятся
   волной, сверху вниз проходит линия-сканер акцентом; в середине кадр
   меняется и собирается из линий обратно. Счётчик в углу —
   какой кадр из скольких. Без движения (reduced motion) кадр меняется
   сразу. */

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DUR = 720; // мс на весь переход

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

  let at = Math.max(0, list.indexOf(img.getAttribute("src")));
  let busy = false;
  const show = () =>
    (count.textContent = `${String(at + 1).padStart(2, "0")}/${String(list.length).padStart(2, "0")}`);
  show();

  fig.tabIndex = 0;
  fig.setAttribute("role", "button");
  fig.setAttribute("aria-label", "Next photo");

  // Кадр линиями — язык айдентики: тонкие горизонтальные линии, как растр
  // миллиметровки. k (0..1) — сила эффекта: линии редеют и утончаются,
  // расходятся волной; сверху вниз идёт линия-сканер акцентом.
  function paint(pic, k, t, lime, dpr, lw) {
    const w = fx.width;
    const h = fx.height;
    ctx.clearRect(0, 0, w, h);
    // Как object-fit: cover — середина кадра во весь круг.
    const iw = pic.naturalWidth || w;
    const ih = pic.naturalHeight || h;
    const s = Math.max(w / iw, h / ih);
    const sx = (iw - w / s) / 2;
    const sy = (ih - h / s) / 2;
    const gap = Math.max(1, Math.round((1 + k * 6) * dpr));
    const thick = Math.max(1, gap * (1 - k * 0.8));
    for (let y = 0; y < h; y += gap) {
      const off = Math.sin((y * 0.045) / dpr + t * 12) * k * w * 0.05;
      ctx.drawImage(pic, sx, sy + y / s, w / s, thick / s, off, y, w, thick);
    }
    ctx.fillStyle = lime;
    ctx.fillRect(0, t * h - lw / 2, w, lw);
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
    // Толщина линии-сканера — линия сайта (--line-px, js/main.js).
    const lw = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--line-px")) || 1) * dpr;
    fig.classList.add("is-fx");
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const k = Math.sin(t * Math.PI); // 0 → 1 → 0: пик в середине
      paint(t < 0.5 ? from : to, k, t, lime, dpr, lw);
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
