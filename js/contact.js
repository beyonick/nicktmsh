/* Контакты: окно «Get in touch» и список ссылок.

   Все контакты сайта живут здесь, в одном массиве: окно, блок «обо мне»
   на главной и любая кнопка с data-contact берут их отсюда. Поменять
   ник или добавить сеть — одна строка.

   Окно открывает любой элемент с data-contact. У кнопки в шапке href —
   обычный mailto: без скрипта она просто открывает почту, со скриптом —
   окно, где почта стоит первым действием, а мессенджеры и сети ниже.

   Строка с пустым href не выводится: ссылка, которая никуда не ведёт,
   хуже отсутствующей. */

import { el } from "./store.js";

export const EMAIL = "n27tomash@gmail.com";

export const CONTACTS = [
  { name: "Telegram", handle: "@beyoy", href: "https://t.me/beyoy" },
  { name: "MAX", handle: "", href: "" }, // ссылка ещё не задана — строка скрыта
  { name: "Instagram", handle: "@nicktmsh", href: "https://www.instagram.com/nicktmsh" },
  { name: "YouTube", handle: "@nicktmsh", href: "https://www.youtube.com/@nicktmsh" },
  { name: "Pinterest", handle: "nicktmsh", href: "https://www.pinterest.com/nicktmsh/" },
];

/* Строки списка: название слева, ник справа, стрелка сайта (.arrow) на
   ховере. Почта тоже строкой — в списке «обо мне» она нужна наравне
   с остальными. */
export function contactRows({ withMail = false } = {}) {
  const rows = CONTACTS.filter((c) => c.href).map((c) => ({ ...c, external: true }));
  if (withMail) rows.unshift({ name: "Email", handle: EMAIL, href: `mailto:${EMAIL}` });
  return rows.map((c) =>
    el("li", { class: "contacts__row" }, [
      el(
        "a",
        {
          class: "contacts__link",
          href: c.href,
          target: c.external ? "_blank" : null,
          rel: c.external ? "noopener" : null,
        },
        [
          el("span", { class: "contacts__name", text: c.name }),
          el("span", { class: "contacts__handle", text: c.handle }),
          el("span", { class: "contacts__arrow arrow", "aria-hidden": "true" }),
        ]
      ),
    ])
  );
}

/* --- Окно ------------------------------------------------------------------ */

function build() {
  const copy = el("button", { class: "pill contact__copy", type: "button", text: "copy" });
  copy.addEventListener("click", () => {
    if (navigator.clipboard) navigator.clipboard.writeText(EMAIL);
    copy.textContent = "copied";
    setTimeout(() => (copy.textContent = "copy"), 1400);
  });

  const title = el("h2", { class: "contact__title", id: "contact-title" });
  title.innerHTML = 'Have a <em>project</em>, or just<br>a feeling about <em class="alt">one</em>?';

  const dialog = el("dialog", { class: "contact", "aria-labelledby": "contact-title" }, [
    el("div", { class: "contact__in graph" }, [
      el("div", { class: "contact__head" }, [
        el("p", { class: "label", text: "Get in touch" }),
        el("button", { class: "pill contact__close", type: "button", "data-close": "", text: "close" }),
      ]),
      title,
      el("p", {
        class: "contact__note",
        text:
          "Write me two sentences about it. I’ll tell you honestly whether I’m the right person for it — and if I’m not, I usually know who is.",
      }),
      el("div", { class: "contact__mail" }, [
        el("a", { class: "contact__address", href: `mailto:${EMAIL}`, text: EMAIL }),
        copy,
      ]),
      el("ul", { class: "contacts" }, contactRows()),
      el("p", {
        class: "contact__status",
        text: "Currently taking one project at a time. Working internationally.",
      }),
    ]),
  ]);

  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
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

// Списки контактов в разметке страницы (блок «обо мне» на главной).
document.querySelectorAll("[data-contacts]").forEach((host) => {
  host.replaceChildren(...contactRows({ withMail: true }));
});
