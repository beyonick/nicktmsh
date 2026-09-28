/* Прожектор над логотипами клиентов.

   Над лентой курсор светит пятном: знак, до которого указатель ближе,
   сильнее окрашивается во второй акцент, дальние остаются приглушёнными.
   Расстояние меряется до ближайшей точки знака, а не до центра, — иначе
   длинный Сбер под самым курсором горел бы вполсилы.

   Ленты едут, поэтому пока курсор в зоне, доли пересчитываются каждый
   кадр. На входе и выходе пятно разгорается и гаснет плавно, а не
   щелчком. Только для мыши: на тачскрине ховера нет. */

const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const zone = document.querySelector("#clients .ticker");

if (fine && zone) {
  const logos = [...zone.querySelectorAll(".logo")];
  const RADIUS = 220; // макетных px: дальше пятно не достаёт
  const FADE = 0.18; // постоянная времени разгорания/угасания, сек

  const aim = { x: 0, y: 0 };
  let inside = false;
  let power = 0; // 0..1, общая яркость пятна
  let raf = 0;
  let last = 0;

  const smooth = (t) => t * t * (3 - 2 * t);

  const frame = (time) => {
    const dt = last ? Math.min(time - last, 100) / 1000 : 0;
    last = time;
    power += ((inside ? 1 : 0) - power) * (1 - Math.exp(-dt / FADE));
    if (!inside && power < 0.005) power = 0;

    const reach = (RADIUS * innerWidth) / 1200;
    for (const logo of logos) {
      const r = logo.getBoundingClientRect();
      const dx = Math.max(r.left - aim.x, 0, aim.x - r.right);
      const dy = Math.max(r.top - aim.y, 0, aim.y - r.bottom);
      const near = 1 - Math.min(Math.hypot(dx, dy) / reach, 1);
      logo.style.setProperty("--p", (smooth(near) * power).toFixed(3));
    }

    if (inside || power > 0) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      last = 0;
    }
  };

  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  zone.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    aim.x = e.clientX;
    aim.y = e.clientY;
    inside = true;
    wake();
  });
  zone.addEventListener("pointerleave", () => {
    inside = false;
    wake();
  });
  // Страница прокрутилась под неподвижной мышью — пятно остаётся на месте
  // экрана, а зона могла из-под него уехать.
  addEventListener(
    "scroll",
    () => {
      if (!inside) return;
      const r = zone.getBoundingClientRect();
      if (aim.y < r.top || aim.y > r.bottom) {
        inside = false;
        wake();
      }
    },
    { passive: true }
  );
}
