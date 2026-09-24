/* Контакты: окно «Get in touch» и кнопки-иконки.

   Все контакты сайта живут здесь, в одном массиве: окно, блок «обо мне»
   на главной и любая кнопка с data-contact берут их отсюда. Поменять ник
   или добавить сеть — одна строка.

   Каждый контакт — круглая кнопка с иконкой, почта тоже: адрес не
   выставлен текстом, он в кнопке (mailto) и в подсказке. Иконки нарисованы
   линией той же толщины, что вся графика сайта (--line-px).

   Окно открывает любой элемент с data-contact. У кнопки в шапке href —
   обычный mailto: без скрипта она просто открывает почту.

   Контакт с пустым href не выводится: кнопка, которая никуда не ведёт,
   хуже отсутствующей. */

import { el } from "./store.js";

export const EMAIL = "n27tomash@gmail.com";

export const CONTACTS = [
  { key: "mail", name: "Email", hint: EMAIL, href: `mailto:${EMAIL}` },
  { key: "telegram", name: "Telegram", hint: "@beyoy", href: "https://t.me/beyoy" },
  { key: "max", name: "MAX", hint: "", href: "" }, // ссылка ещё не задана — кнопка скрыта
  { key: "instagram", name: "Instagram", hint: "@nicktmsh", href: "https://www.instagram.com/nicktmsh" },
  { key: "youtube", name: "YouTube", hint: "@nicktmsh", href: "https://www.youtube.com/@nicktmsh" },
  { key: "pinterest", name: "Pinterest", hint: "nicktmsh", href: "https://www.pinterest.com/nicktmsh/" },
];

/* Иконки 24×24, контуром. Заливка — только у мелких точек. */
const ICONS = {
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.8 6.6 12 12.8l8.2-6.2"/>',
  telegram: '<path d="M20.8 4.2 3.2 11.3l5.7 2.1 2 5.9 3.1-3.6 4.6 3.5z"/><path d="M8.9 13.4 20.8 4.2"/>',
  max: '<path d="M12 3.6c-4.7 0-8.4 3.3-8.4 7.6 0 2.2 1 4.2 2.6 5.5l-.6 3.7 3.7-1.9c.8.2 1.7.3 2.7.3 4.7 0 8.4-3.3 8.4-7.6S16.7 3.6 12 3.6z"/>',
  instagram: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.1" cy="6.9" r=".7" fill="currentColor" stroke="none"/>',
  youtube: '<rect x="2.6" y="5.6" width="18.8" height="12.8" rx="4"/><path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none"/>',
  pinterest: '<circle cx="12" cy="12" r="8.6"/><path d="M11.9 11.2 10.3 20.4M10.1 14.1c.6.7 1.5 1.1 2.5 1.1 2.2 0 3.7-1.9 3.7-4.4S14.3 6.6 12 6.6c-2.7 0-4.4 1.9-4.4 4.2 0 .9.3 1.7.9 2.2"/>',
  close: '<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>',
};

function icon(key) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "social__icon");
  svg.innerHTML = ICONS[key];
  return svg;
}

/* Ряд кнопок. У почты подсказка — сам адрес: навёл — увидел, нажал —
   открылась почта. */
export function socials() {
  return CONTACTS.filter((c) => c.href).map((c) => {
    const external = !c.href.startsWith("mailto:");
    return el("li", {}, [
      el(
        "a",
        {
          class: "social",
          href: c.href,
          target: external ? "_blank" : null,
          rel: external ? "noopener" : null,
          "aria-label": c.hint ? `${c.name}: ${c.hint}` : c.name,
          title: c.hint ? `${c.name} · ${c.hint}` : c.name,
        },
        [icon(c.key)]
      ),
    ]);
  });
}

/* --- Окно ------------------------------------------------------------------
   Компактная панель по центру: подпись и крестик, одна фраза, кнопка
   почты и ряд иконок, строка доступности. Без миллиметровки и без
   крупного вопроса — вопрос уже был на странице, окно отвечает на него. */

function build() {
  const close = el("button", { class: "social contact__close", type: "button", "aria-label": "Close" }, [
    icon("close"),
  ]);

  const dialog = el("dialog", { class: "contact", "aria-labelledby": "contact-title" }, [
    el("div", { class: "contact__head" }, [
      el("p", { class: "label", text: "Get in touch" }),
      close,
    ]),
    el("p", { class: "contact__title", id: "contact-title", text: "Write me two sentences about it." }),
    el("p", {
      class: "contact__note",
      text: "I’ll tell you honestly whether I’m the right person for it — and if I’m not, I usually know who is.",
    }),
    el("div", { class: "contact__actions" }, [
      el("a", { class: "pill contact__mail", href: `mailto:${EMAIL}`, text: "email me" }),
      el("ul", { class: "socials" }, socials().slice(1)), // почта уже кнопкой слева
    ]),
    el("p", {
      class: "contact__status",
      text: "Currently taking one project at a time. Working internationally.",
    }),
  ]);

  close.addEventListener("click", () => dialog.close());
  // Клик по подложке закрывает; клик внутри панели — нет.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  return dialog;
}

let dialog = null;

export function openContact() {
  if (!dialog) dialog = build();
  if (!dialog.open) dialog.showModal();
}

document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-contact]");
  if (!trigger || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  openContact();
});

// Ряды иконок в разметке страницы (блок «обо мне» на главной).
document.querySelectorAll("[data-socials]").forEach((host) => {
  host.replaceChildren(...socials());
});
