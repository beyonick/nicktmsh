/* Точечный паттерн главной: курсор проявляет точки вокруг себя.

   Пишет координаты курсора на странице в --mx / --my слоя .dots, с лёгким
   догонянием, чтобы пятно света плыло, а не прыгало. Ушёл курсор —
   подсветка гаснет. Только для мыши. */

const layer = document.querySelector(".dots");
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (layer && fine) {
  const aim = { x: -999, y: -999 };
  const pos = { x: -999, y: -999 };
  let raf = 0;
  const frame = () => {
    raf = 0;
    const k = reduced ? 1 : 0.18;
    pos.x += (aim.x - pos.x) * k;
    pos.y += (aim.y - pos.y) * k;
    layer.style.setProperty("--mx", `${pos.x.toFixed(1)}px`);
    layer.style.setProperty("--my", `${pos.y.toFixed(1)}px`);
    if (Math.abs(aim.x - pos.x) > 0.3 || Math.abs(aim.y - pos.y) > 0.3) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      aim.x = e.pageX;
      aim.y = e.pageY;
      if (pos.x < -900) {
        pos.x = aim.x;
        pos.y = aim.y;
      }
      layer.style.setProperty("--on", "1");
      kick();
    },
    { passive: true }
  );
  // Прокрутка колесом двигает страницу под стоящим курсором — пятно
  // остаётся под курсором.
  let lastY = scrollY;
  addEventListener(
    "scroll",
    () => {
      aim.y += scrollY - lastY;
      pos.y += scrollY - lastY;
      lastY = scrollY;
      kick();
    },
    { passive: true }
  );
  document.documentElement.addEventListener("pointerleave", () => layer.style.setProperty("--on", "0"));
}
