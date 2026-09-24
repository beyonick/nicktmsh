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

/* --- Окно: нодовая версия --------------------------------------------------
   «Get in touch» собран как маленький граф, той же системой, что пайплайн
   на главной (css/nodes.css): слева INPUT — само сообщение, в середине —
   каналы, справа OUTPUT · SEND. Клик по каналу прокладывает маршрут:
   провода к нему загораются, к остальным гаснут. «Send» по почте
   открывает письмо с уже вписанным текстом; мессенджеры текст принять
   ссылкой не умеют — сообщение копируется, и открывается чат. */

const ROUTES = ["mail", "telegram", "max", "instagram"];
const NS = "http://www.w3.org/2000/svg";

function build() {
  const channels = CONTACTS.filter((c) => c.href && ROUTES.includes(c.key));
  let route = channels[0];

  const close = el("button", { class: "social contact__close", type: "button", "aria-label": "Close" }, [
    icon("close"),
  ]);

  const graph = el("div", { class: "nodes__canvas contact__graph" });
  const wires = document.createElementNS(NS, "svg");
  wires.setAttribute("class", "nodes__wires");
  wires.setAttribute("aria-hidden", "true");
  graph.append(wires);

  const node = (cls, type, tool, body) =>
    el("figure", { class: `node ${cls}` }, [
      el("figcaption", { class: "node__head" }, [
        el("span", { class: "node__type", text: type }),
        el("span", { class: "node__tool", text: tool }),
      ]),
      el("div", { class: "node__body" }, [
        ...body,
        el("span", { class: "node__port node__port--in" }),
        el("span", { class: "node__port node__port--out" }),
      ]),
    ]);

  // Вход: сообщение.
  const message = el("textarea", {
    class: "pipe__prompt contact__message",
    rows: "5",
    placeholder: "Two sentences about your project…",
    "aria-label": "Your message",
  });
  const input = node("node--text pipe__io contact__in", "Input", "Your project", [message]);

  // Каналы.
  const routeNodes = channels.map((c) => {
    const n = node("pipe__tool contact__route", "", "", [
      el("span", { class: "contact__route-icon" }, [icon(c.key)]),
      el("span", { class: "pipe__name", text: c.name }),
      el("span", { class: "pipe__role", text: c.hint }),
    ]);
    n.tabIndex = 0;
    n.setAttribute("role", "radio");
    n.dataset.key = c.key;
    n.addEventListener("click", () => pick(c));
    n.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(c);
      }
    });
    return n;
  });
  const routeBox = el("div", { class: "contact__routes", role: "radiogroup", "aria-label": "Channel" }, routeNodes);

  // Выход: куда уйдёт и кнопка.
  const where = el("p", { class: "node__text contact__where" });
  const send = el("button", { class: "pill contact__send", type: "button", text: "send" });
  const output = node("node--text pipe__io contact__out", "Output", "Send", [where, send]);

  graph.append(input, routeBox, output);

  const status = el("p", {
    class: "contact__status",
    text: "Currently taking one project at a time. Working internationally.",
  });

  const dialog = el("dialog", { class: "contact contact--nodes", "aria-label": "Get in touch" }, [
    el("div", { class: "contact__head" }, [el("p", { class: "label", text: "Get in touch" }), close]),
    graph,
    el("div", { class: "contact__foot" }, [
      status,
      el("ul", { class: "socials contact__more" }, socials().filter((li) => {
        const a = li.querySelector("a");
        return a && /youtube|pinterest/i.test(a.href);
      })),
    ]),
  ]);

  /* Провода: от сообщения к каждому каналу и от каждого канала к выходу.
     Выбранный маршрут горит и по нему бежит сигнал, остальные — тусклые. */
  const lines = [];
  const wire = () => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "wire");
    const line = document.createElementNS(NS, "path");
    line.setAttribute("class", "wire__line");
    const flow = document.createElementNS(NS, "path");
    flow.setAttribute("class", "wire__flow");
    g.append(line, flow);
    wires.append(g);
    return { g, line, flow };
  };
  routeNodes.forEach((n) => {
    lines.push({ from: input, to: n, key: n.dataset.key, ...wire() });
    lines.push({ from: n, to: output, key: n.dataset.key, ...wire() });
  });

  function draw() {
    const c = graph.getBoundingClientRect();
    if (!c.width) return;
    wires.setAttribute("viewBox", `0 0 ${c.width} ${c.height}`);
    for (const l of lines) {
      const a = l.from.querySelector(".node__body").getBoundingClientRect();
      const b = l.to.querySelector(".node__body").getBoundingClientRect();
      const x1 = a.right - c.left;
      const y1 = a.top + a.height / 2 - c.top;
      const x2 = b.left - c.left;
      const y2 = b.top + b.height / 2 - c.top;
      const dx = Math.max(24, Math.abs(x2 - x1) * 0.5);
      const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
      l.line.setAttribute("d", d);
      l.flow.setAttribute("d", d);
    }
  }

  function pick(c) {
    route = c;
    routeNodes.forEach((n) => {
      const on = n.dataset.key === c.key;
      n.classList.toggle("is-on", on);
      n.setAttribute("aria-checked", String(on));
    });
    lines.forEach((l) => l.g.classList.toggle("is-hot", l.key === c.key));
    graph.classList.add("is-focus");
    const mail = c.key === "mail";
    where.textContent = mail
      ? `via Email · ${EMAIL}. Opens your mail app with the message filled in.`
      : `via ${c.name} · ${c.hint}. The message is copied — paste it into the chat.`;
    send.textContent = mail ? "send email" : `open ${c.name}`;
    output.classList.remove("is-pulse");
    void output.offsetWidth;
    output.classList.add("is-pulse");
  }

  send.addEventListener("click", async () => {
    const text = message.value.trim();
    if (route.key === "mail") {
      const q = new URLSearchParams({ subject: "Project", body: text }).toString().replace(/\+/g, "%20");
      location.href = `mailto:${EMAIL}?${q}`;
      return;
    }
    if (text && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // не скопировалось — чат всё равно откроется
      }
    }
    window.open(route.href, "_blank", "noopener");
  });

  close.addEventListener("click", () => dialog.close());
  // Клик по подложке закрывает; клик внутри панели — нет.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  // Окно въезжает анимацией — провода считаем, когда оно встало, и на
  // любое изменение размера.
  dialog.addEventListener("animationend", draw);
  new ResizeObserver(draw).observe(graph);
  message.addEventListener("input", draw);

  document.body.append(dialog);
  pick(route);
  dialog.__draw = draw;
  return dialog;
}

let dialog = null;

export function openContact() {
  if (!dialog) dialog = build();
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => dialog.__draw && dialog.__draw());
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
