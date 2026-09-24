/* Фото «обо мне»: шторки и смена кадра по клику.

   Список кадров — в data-photos на <figure>. Клик (или Enter) закрывает
   кадр полосами: они въезжают по очереди с разных сторон, кадр меняется,
   полосы разъезжаются. Счётчик в углу — какой кадр из скольких. Без
   движения (reduced motion) кадр просто меняется. */

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SLATS = 7;

document.querySelectorAll("[data-photos]").forEach((fig) => {
  const img = fig.querySelector("img");
  const list = JSON.parse(fig.dataset.photos || "[]");
  if (!img || list.length < 2) return;

  // Следующий кадр грузим заранее — иначе полосы разъедутся над пустотой.
  list.forEach((src) => {
    const pre = new Image();
    pre.src = src;
  });

  const shutter = document.createElement("span");
  shutter.className = "me__shutter";
  shutter.setAttribute("aria-hidden", "true");
  for (let i = 0; i < SLATS; i++) {
    const s = document.createElement("i");
    s.style.setProperty("--i", i);
    shutter.append(s);
  }
  const count = document.createElement("span");
  count.className = "me__count";
  count.setAttribute("aria-hidden", "true");
  fig.append(shutter, count);

  let at = Math.max(0, list.indexOf(img.getAttribute("src")));
  let busy = false;
  const show = () => (count.textContent = `${String(at + 1).padStart(2, "0")}/${String(list.length).padStart(2, "0")}`);
  show();

  fig.tabIndex = 0;
  fig.setAttribute("role", "button");
  fig.setAttribute("aria-label", "Next photo");

  const next = () => {
    if (busy) return;
    busy = true;
    at = (at + 1) % list.length;
    if (reduced) {
      img.src = list[at];
      show();
      busy = false;
      return;
    }
    fig.classList.add("is-closed");
    // Полосы закрылись (последняя стартует позже всех) — меняем кадр и открываем.
    setTimeout(() => {
      img.src = list[at];
      show();
      fig.classList.remove("is-closed");
      setTimeout(() => (busy = false), 520);
    }, 380 + SLATS * 40);
  };

  fig.addEventListener("click", next);
  fig.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      next();
    }
  });
});
