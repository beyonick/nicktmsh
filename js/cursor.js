/* Курсор-кольцо.

   Кольцо догоняет указатель с лёгкой инерцией. Над тем, что нажимается
   (ссылки, кнопки, карточки, ноды), оно вырастает и заливается — это и
   есть отклик на ховер; над тем, что таскается (ноды), рамка становится
   пунктиром; на нажатии кольцо сжимается. Нарисовано в режиме difference,
   поэтому видно и на тёмном фоне, и на светлом подвале.

   Только для мыши: на тачскрине курсора нет. В полях ввода возвращается
   системный текстовый курсор — кольцо прячется. Без движения (reduced
   motion) кольцо стоит ровно под указателем, без догоняния. */

const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const HOT = "a, button, [role='button'], [role='switch'], [role='radio'], [data-contact], .card, .logo, .marquee b, .picto, .social, summary, label";
// Таскаются ноды схем; ноды окна контактов только нажимаются.
const DRAG = ".node:not(.contact .node)";
const TEXT = "input, textarea, select, [contenteditable='true']";

if (fine) {
  const ring = document.createElement("div");
  ring.className = "cursor";
  ring.setAttribute("aria-hidden", "true");
  // Кольцо живёт в верхнем слое браузера (popover): иначе модальное окно
  // (dialog — тоже верхний слой) ложится поверх него, и курсор пропадает
  // под «Get in touch».
  ring.setAttribute("popover", "manual");
  document.body.append(ring);
  document.documentElement.classList.add("has-cursor");

  const raise = () => {
    // Сначала домой, в body: перенос показанного popover закрыл бы его.
    if (ring.parentElement !== document.body) document.body.append(ring);
    try {
      if (ring.matches(":popover-open")) ring.hidePopover();
      ring.showPopover();
    } catch {
      // Верхний слой недоступен — кладём кольцо внутрь открытого окна.
      const open = document.querySelector("dialog[open]");
      if (open) open.append(ring);
    }
  };
  raise();
  // Окно открылось — поднимаем кольцо над ним: верхний слой рисуется в
  // порядке показа, последний сверху.
  new MutationObserver(raise).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });

  const aim = { x: -100, y: -100 };
  const pos = { x: -100, y: -100 };
  let shown = false;
  let raf = 0;

  const frame = () => {
    raf = 0;
    const k = reduced ? 1 : 0.28;
    pos.x += (aim.x - pos.x) * k;
    pos.y += (aim.y - pos.y) * k;
    ring.style.translate = `${pos.x}px ${pos.y}px`;
    if (Math.abs(aim.x - pos.x) > 0.1 || Math.abs(aim.y - pos.y) > 0.1) raf = requestAnimationFrame(frame);
  };

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      aim.x = e.clientX;
      aim.y = e.clientY;
      if (!shown) {
        shown = true;
        pos.x = aim.x;
        pos.y = aim.y;
        ring.classList.add("is-shown");
      }
      const t = e.target instanceof Element ? e.target : null;
      const text = t && t.closest(TEXT);
      ring.classList.toggle("is-text", !!text);
      ring.classList.toggle("is-drag", !text && !!(t && t.closest(DRAG)));
      ring.classList.toggle("is-hot", !text && !!(t && t.closest(HOT)));
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true }
  );
  addEventListener("pointerdown", () => ring.classList.add("is-down"));
  addEventListener("pointerup", () => ring.classList.remove("is-down"));
  document.documentElement.addEventListener("pointerleave", () => {
    shown = false;
    ring.classList.remove("is-shown");
  });
}
