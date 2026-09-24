/* Страница кейса. Slug приходит в ?p=, содержимое — из projects.json.

   Ничего не выдумываем: у части CG-кейсов год и роль в keys.md до сих
   пор с TODO, и пустая строка честнее правдоподобной даты. Поэтому каждое
   поле рисуется только тогда, когда оно есть, а незаполненный кейс
   показывает короткую честную заглушку вместо каркаса из прочерков. */

import { load, published, findBySlug, el, fail, reveal } from "./store.js";
import { boot } from "./motion.js";

const host = document.querySelector("[data-case]");
const slug = new URL(location.href).searchParams.get("p") || "";

function meta(term, value) {
  if (!value) return null;
  return el("div", { class: "meta__item" }, [
    el("dt", { class: "meta__term", text: term }),
    el("dd", { class: "meta__value", text: value }),
  ]);
}

/* Галерея. Файлы лежат в Selectel, в json — путь от mediaBase (или
   полный адрес). Видео определяется по расширению: без звука, по кругу,
   играет только на экране — роликов в кейсе бывает с десяток. Файл,
   который не загрузился, убирается целиком, а не оставляет пустую рамку:
   так кейс не ломается, пока медиа ещё не залиты. */
const VIDEO = /\.(mp4|webm|mov)(\?|$)/i;

const player = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      }
    }, { rootMargin: "200px 0px" })
  : null;

function gallery(items, base) {
  if (!items || !items.length) return null;
  const url = (path) => (!path ? null : /^https?:/.test(path) ? path : base + path);

  const figures = items.map((it, i) => {
    const src = url(it.src);
    const drop = (e) => e.currentTarget.closest("figure").remove();
    const media = VIDEO.test(src)
      ? el("video", {
          class: "case-media__file",
          src,
          poster: url(it.poster),
          muted: "",
          loop: "",
          playsinline: "",
          preload: "metadata",
          onerror: drop,
        })
      : el("img", {
          class: "case-media__file",
          src,
          alt: it.caption || "",
          loading: i < 2 ? "eager" : "lazy",
          decoding: "async",
          onerror: drop,
        });
    if (media.tagName === "VIDEO") {
      media.muted = true; // атрибута мало: без свойства автоплей не пустят
      if (player) player.observe(media);
      else media.autoplay = true;
    }
    return el("figure", { class: "case-media__item" }, [
      media,
      it.caption ? el("figcaption", { class: "case-media__cap", text: it.caption }) : null,
    ]);
  });

  return el("section", { class: "case-media wrap" }, figures);
}

function render(project, next, base) {
  document.title = `${project.title} — Nikita Tomash`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && project.summary) desc.setAttribute("content", project.summary);

  const head = el("section", { class: "page-head wrap" }, [
    el("p", { class: "label rise" }, [
      el("a", { class: "under", href: "work.html", text: "← work" }),
    ]),
    el("h1", { class: "page-title rise", style: "--delay:80ms", text: project.title }),
    project.summary
      ? el("p", { class: "page-sub rise", style: "--delay:120ms", text: project.summary })
      : null,
  ]);

  const metaList = el("dl", { class: "meta rise", style: "--delay:160ms" }, [
    meta("Client", project.client),
    meta("Year", project.year ? String(project.year) : null),
    meta("Role", project.role),
    meta("Branch", project.branchLabel),
    project.capabilities && project.capabilities.length
      ? meta("Scope", project.capabilities.join(" · "))
      : null,
  ]);

  const link = project.link
    ? el("p", { class: "case__link rise", style: "--delay:200ms" }, [
        el("a", {
          class: "pill",
          href: project.link,
          target: "_blank",
          rel: "noopener",
          text: project.linkLabel || "live site",
        }),
      ])
    : null;

  const body = (project.body || []).map((text, i) =>
    el("p", { class: "case__p rise", style: `--delay:${i * 60}ms`, text })
  );

  // Кейс без текста — обычное состояние на этой стадии, и об этом лучше
  // сказать прямо, чем оставить пустой экран под заголовком.
  const empty = body.length
    ? null
    : el("p", { class: "case__p case__p--empty rise" }, [
        "The write-up for this one isn’t online yet. ",
        el("a", { class: "under", href: "mailto:n27tomash@gmail.com", "data-contact": "", text: "Ask me about it" }),
        " and I’ll send the full case.",
      ]);

  const nextBlock = next
    ? el("section", { class: "case-next wrap" }, [
        el("p", { class: "label", text: "Next" }),
        el("a", { class: "case-next__link", href: `case.html?p=${next.slug}` }, [
          el("span", { class: "case-next__title", text: next.title }),
          el("span", { class: "case-next__arrow", "aria-hidden": "true", text: "→" }),
        ]),
      ])
    : null;

  host.replaceChildren(
    head,
    el("section", { class: "band wrap case" }, [metaList, link, ...body, empty]),
    gallery(project.media, base),
    nextBlock
  );
  host.removeAttribute("aria-busy");
  reveal(host);
  boot(host);
}

function notFound() {
  document.title = "Not found — Nikita Tomash";
  host.replaceChildren(
    el("section", { class: "page-head wrap" }, [
      el("p", { class: "label" }, [
        el("a", { class: "under", href: "work.html", text: "← work" }),
      ]),
      el("h1", { class: "page-title", text: "No such project" }),
      el("p", {
        class: "page-sub",
        text: "The link points at a case that isn’t published. The full list is on the work page.",
      }),
    ])
  );
  host.removeAttribute("aria-busy");
}

load("projects")
  .then((data) => {
    const list = published(data.projects);
    const project = findBySlug(list, slug);
    if (!project) return notFound();

    project.branchLabel = (data.branches || {})[project.branch] || null;
    const i = list.indexOf(project);
    render(project, list[(i + 1) % list.length], data.mediaBase || "");
  })
  .catch((err) => {
    host.removeAttribute("aria-busy");
    fail(host, err);
  });
