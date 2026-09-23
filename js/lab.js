/* Lab: вертикальные ролики из data/lab.json.

   Правило раздела (04 Соцсети/Lab/заметки/README.md): добавление работы
   занимает пять минут и не требует правки вёрстки. Отсюда всё остальное —
   разметка карточек собирается здесь, данные приходят из json, json
   пишет админка.

   Видео играют только во вьюпорте и без звука. Двенадцать одновременно
   играющих роликов кладут слабый ноутбук, поэтому пауза за пределами
   экрана — не оптимизация, а условие работоспособности раздела.

   Постер обязателен: пока ролик не начал играть, в ленте должен стоять
   кадр. Заливок-заглушек и проволочной графики на месте кадра нет —
   без файла остаётся пустая рамка с номером.

   Раскладка — горизонтальная лента в закреплённом кадре: вертикальный
   скролл страницы ведёт её вбок (реф: mersi-architecture.com). */

import { load, published, el, labDate, fail } from "./store.js";
import { boot } from "./motion.js";

const host = document.querySelector("[data-reels]");
const introHost = document.querySelector("[data-intro]");
const countHost = document.querySelector("[data-count]");

const viewer = document.querySelector("[data-viewer]");
const stage = viewer.querySelector("[data-stage]");
const vTitle = viewer.querySelector("[data-viewer-title]");
const vMeta = viewer.querySelector("[data-viewer-meta]");
const vDesc = viewer.querySelector("[data-viewer-desc]");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let items = [];
let openIndex = -1;

/* --- Лента ---------------------------------------------------------------- */

function metaLine(item) {
  return [item.tech && item.tech.join(" · "), labDate(item.date), item.series]
    .filter(Boolean)
    .join(" — ");
}

function reel(item, index) {
  const frame = el("div", { class: "reel__frame" });

  if (item.video) {
    const video = el("video", {
      class: "reel__video",
      src: item.video,
      poster: item.poster || null,
      muted: "",
      loop: "",
      playsinline: "",
      preload: "none",
      tabindex: "-1",
    });
    video.muted = true;
    frame.append(video);
  } else if (item.poster) {
    frame.append(el("img", { class: "reel__poster", src: item.poster, alt: "", loading: "lazy" }));
  }

  const button = el("button", {
    class: "reel__open",
    type: "button",
    "aria-label": `Open ${item.title}`,
    onclick: () => open(index),
  });

  return el("li", { class: "reel rise", "data-index": String(index) }, [
    el("div", { class: "reel__media" }, [
      frame,
      el("span", { class: "reel__num", "aria-hidden": "true", text: String(index + 1).padStart(2, "0") }),
      button,
    ]),
  ]);
}

/* --- Горизонтальный скролл -------------------------------------------------
   Секция получает высоту «экран + длина ленты за вычетом экрана», кадр
   внутри неё закреплён sticky, и пройденная внутри секции вертикаль
   становится сдвигом ленты. Своей инерции у ленты нет: мягкость даёт
   общий скролл сайта (js/smooth.js), вторая поверх него сделала бы
   ленту ватной. */

const hs = document.querySelector("[data-hscroll]");
const pin = hs.querySelector("[data-pin]");
const track = hs.querySelector("[data-track]");

let travel = 0;
let hsRaf = 0;

function measure() {
  travel = Math.max(0, track.scrollWidth - pin.clientWidth);
  hs.style.height = `${pin.offsetHeight + travel}px`;
  kickTrack();
}

function wanted() {
  return Math.min(travel, Math.max(0, -hs.getBoundingClientRect().top));
}

function stepTrack() {
  hsRaf = 0;
  track.style.transform = `translate3d(${-wanted().toFixed(2)}px, 0, 0)`;
}

function kickTrack() {
  if (!hsRaf) hsRaf = requestAnimationFrame(stepTrack);
}

addEventListener("scroll", kickTrack, { passive: true });
addEventListener("resize", measure);
if (document.fonts) document.fonts.ready.then(measure);

// Фокус с клавиатуры на кадре за краем экрана: браузер прокрутил бы сам
// закреплённый кадр вбок, мимо сдвига ленты. Вместо этого прокручиваем
// страницу до места, где кадр стоит по центру.
track.addEventListener("focusin", (e) => {
  pin.scrollLeft = 0;
  const item = e.target.closest(".reel, .lab-intro");
  if (!item) return;
  const x = item.offsetLeft + item.offsetWidth / 2 - pin.clientWidth / 2;
  const top = hs.getBoundingClientRect().top + scrollY;
  scrollTo({ top: top + Math.min(travel, Math.max(0, x)), behavior: reduced ? "auto" : "smooth" });
});

/* --- Воспроизведение по видимости ----------------------------------------- */

function watchPlayback() {
  const videos = host.querySelectorAll(".reel__video");
  if (!videos.length) return;

  if (reduced || !("IntersectionObserver" in window)) {
    // Без автоплея ролик остаётся постером до клика — это осознанно.
    videos.forEach((v) => v.setAttribute("controls", ""));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) {
          if (v.preload === "none") v.preload = "auto";
          v.play().catch(() => {}); // автоплей мог не разрешиться — не повод падать
        } else {
          v.pause();
        }
      }
    },
    { rootMargin: "10% 0px", threshold: 0.25 }
  );

  videos.forEach((v) => io.observe(v));
}

/* --- Просмотр ------------------------------------------------------------- */

function open(index) {
  openIndex = (index + items.length) % items.length;
  const item = items[openIndex];

  vTitle.textContent = item.title;
  vMeta.textContent = metaLine(item);
  vDesc.textContent = item.description || "";
  vDesc.hidden = !item.description;

  stage.replaceChildren(
    item.video
      ? el("video", {
          class: "viewer__video",
          src: item.video,
          poster: item.poster || null,
          controls: "",
          autoplay: "",
          loop: "",
          playsinline: "",
        })
      : item.poster
        ? el("img", { class: "viewer__video", src: item.poster, alt: item.title })
        : el("p", { class: "reel__hold", text: "no file yet" })
  );

  if (!viewer.open) viewer.showModal();
}

function close() {
  stage.replaceChildren(); // ролик должен остановиться, а не играть за диалогом
  if (viewer.open) viewer.close();
}

viewer.querySelector("[data-close]").addEventListener("click", close);
viewer.querySelector("[data-prev]").addEventListener("click", () => open(openIndex - 1));
viewer.querySelector("[data-next]").addEventListener("click", () => open(openIndex + 1));
viewer.addEventListener("close", () => stage.replaceChildren());
viewer.addEventListener("click", (e) => {
  if (e.target === viewer) close(); // клик по подложке
});
viewer.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") open(openIndex - 1);
  if (e.key === "ArrowRight") open(openIndex + 1);
});

/* --- Загрузка -------------------------------------------------------------- */

load("lab")
  .then((data) => {
    items = published(data.items);
    if (introHost) introHost.textContent = data.intro || "";

    host.replaceChildren(...items.map(reel));
    host.removeAttribute("aria-busy");

    if (data.instagram) {
      host.append(
        el("li", { class: "reel reel--more rise" }, [
          el(
            "a",
            { class: "reel__more", href: data.instagram, target: "_blank", rel: "noopener" },
            [el("span", { text: "More on Instagram →" })]
          ),
        ])
      );
    }
    boot(host);

    const missing = items.filter((i) => !i.video && !i.poster).length;
    countHost.textContent = missing
      ? `${items.length} pieces · ${missing} still waiting for a file`
      : `${items.length} pieces`;

    measure();
    watchPlayback();
  })
  .catch((err) => {
    host.removeAttribute("aria-busy");
    fail(host, err);
  });
