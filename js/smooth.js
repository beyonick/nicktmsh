/* Мягкий инерционный скролл на всём сайте.

   Колесо не прокручивает страницу само: его шаг копится в цели, а
   страница догоняет цель с затуханием — отсюда длинный мягкий выкат, как
   у Lenis на vectors-group.com. Своя реализация на сорок строк вместо
   библиотеки: нужно ровно колесо, остальное браузер делает сам.

   Что остаётся нативным:
   - клавиатура, полоса прокрутки, якоря и scrollTo из кода — такой скролл
     замечается по несовпадению позиции, и цель просто синхронизируется;
   - тач и перо: у них своя инерция, поверх неё вторая только мешает;
   - колесо над прокручиваемым блоком (диалог, панели) и ctrl+колесо (зум). */

const LERP = 0.06; // доля пути до цели за кадр: меньше — длиннее выкат

const enabled =
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

if (enabled) {
  const root = document.documentElement;
  let target = scrollY;
  let current = scrollY;
  let expected = scrollY;
  let raf = 0;

  const maxScroll = () => root.scrollHeight - innerHeight;

  function scrollable(node) {
    for (let n = node; n && n !== document.body && n !== root; n = n.parentElement) {
      if (n.tagName === "DIALOG" && n.open) return true;
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return true;
    }
    return false;
  }

  function frame() {
    current += (target - current) * LERP;
    if (Math.abs(target - current) < 0.5) current = target;
    expected = Math.round(current);
    scrollTo({ top: current, behavior: "instant" });
    raf = current !== target ? requestAnimationFrame(frame) : 0;
  }

  addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (scrollable(e.target)) return;
      e.preventDefault();

      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      if (!raf) current = target = scrollY;
      target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit));
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: false }
  );

  // Скролл не от нас — клавиша, полоса, якорь: принимаем его позицию.
  addEventListener(
    "scroll",
    () => {
      if (Math.abs(scrollY - expected) > 2) {
        cancelAnimationFrame(raf);
        raf = 0;
        target = current = expected = scrollY;
      }
    },
    { passive: true }
  );
}
