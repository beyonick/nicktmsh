/* Lab: вертикальные ролики из data/lab.json.

   Вариант без попапа: на кадре в фокусе (наведение, на таче — нажатие)
   внизу проявляется строка с названием и кнопкой звука справа. Техника
   и описание выезжают под ней, только когда курсор опускается в нижнюю
   часть кадра (на таче — по нажатию на строку). Стили — css/lab-v2.css.
   Фон ленты — точечный узор главной.

   Правило раздела (04 Соцсети/Lab/заметки/README.md): добавление работы
   занимает пять минут и не требует правки вёрстки. Отсюда всё остальное —
   разметка карточек собирается здесь, данные приходят из json, json
   пишет админка.

   Видео играют только во вьюпорте. Двенадцать одновременно играющих
   роликов кладут слабый ноутбук, поэтому пауза за пределами экрана —
   не оптимизация, а условие работоспособности раздела.

   Звук. Слышно только ролик под курсором: убрал курсор — тишина.
   Кнопка на кадре выключает звук для всей ленты, пока его не включат
   обратно. Оговорка браузеров: до первого клика или нажатия клавиши
   на странице звук не разрешён вовсе, поэтому до тех пор кнопка стоит
   в положении «выключено», и её нажатие звук как раз и включает.

   Раскладка — горизонтальная лента в закреплённом кадре: вертикальный
   скролл страницы ведёт её вбок (реф: mersi-architecture.com). */

import { load, published, el, labDate, fail } from "./store.js";
import { boot } from "./motion.js";

const host = document.querySelector("[data-reels]");
const introHost = document.querySelector("[data-intro]");
const countHost = document.querySelector("[data-count]");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let items = [];
let current = null; // кадр в фокусе
let leaveTimer = 0;
let soundOn = true; // выбор посетителя
let allowed = !!navigator.userActivation?.hasBeenActive; // разрешил ли браузер звук

/* --- Лента ---------------------------------------------------------------- */

function metaLine(item) {
  return [item.tech && item.tech.join(" · "), labDate(item.date), item.series]
    .filter(Boolean)
    .join(" — ");
}

// Динамик: с косой чертой — звук выключен, с волнами — включён.
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/>
  <g class="snd-off"><path d="M16 9.5l5 5M21 9.5l-5 5"/></g>
  <g class="snd-on"><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></g>
</svg>`;

function reel(item, index) {
  const frame = el("div", { class: "reel__frame" });
  let sound = null;

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
    sound = el("button", {
      class: "reel__sound",
      type: "button",
      "aria-pressed": "false",
      "aria-label": "Sound",
      html: ICON,
    });
    sound.addEventListener("click", () => {
      // Первый клик по кнопке — это и есть разрешение браузера: звук
      // включается, а не переключается обратно в «выключено».
      soundOn = allowed ? !soundOn : true;
      allowed = true;
      syncSound();
    });
  } else if (item.poster) {
    frame.append(el("img", { class: "reel__poster", src: item.poster, alt: "", loading: "lazy" }));
  } else {
    frame.append(el("div", { class: "reel__empty" }, [el("p", { class: "reel__hold", text: "no file yet" })]));
  }

  const meta = metaLine(item);
  const hasMore = !!(meta || item.description);
  const row = el("div", { class: "reel__row" }, [el("p", { class: "reel__title", text: item.title }), sound]);
  const cap = el("div", { class: "reel__cap" }, [
    row,
    hasMore
      ? el("div", { class: "reel__more-info" }, [
          el("div", {}, [
            meta ? el("p", { class: "reel__meta", text: meta }) : null,
            item.description ? el("p", { class: "reel__desc", text: item.description }) : null,
          ]),
        ])
      : null,
  ]);

  // Кнопка — для тача и клавиатуры: наведения там нет, фокус даёт нажатие.
  const button = el("button", {
    class: "reel__open",
    type: "button",
    "aria-label": item.title,
    "aria-expanded": "false",
  });

  const li = el("li", { class: "reel rise", "data-index": String(index) }, [
    el("div", { class: "reel__media" }, [frame, button, cap]),
  ]);

  // Нижняя треть кадра раскрывает описание. Считаем по положению
  // курсора, а не наведением на саму подпись: пока она свёрнута, в неё
  // трудно попасть.
  const media = li.querySelector(".reel__media");
  li.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !hasMore) return;
    const r = media.getBoundingClientRect();
    li.classList.toggle("is-more", e.clientY > r.top + r.height * 0.66);
  });
  // На таче наведения нет: описание открывает нажатие на строку названия.
  row.addEventListener("click", (e) => {
    if (e.pointerType === "mouse" || !hasMore || e.target.closest(".reel__sound")) return;
    li.classList.toggle("is-more");
  });

  // Между кадрами зазор: без короткой задержки звук обрывался бы
  // и возвращался на каждом переходе курсора с кадра на соседний.
  li.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(leaveTimer);
    focus(li);
  });
  li.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse" || current !== li) return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => current === li && focus(null), 160);
  });
  button.addEventListener("click", (e) => {
    // Мышь дала фокус ещё наведением — щелчок его не снимает.
    if (e.pointerType === "mouse") return;
    focus(current === li ? null : li);
  });

  return li;
}

/* --- Фокус ----------------------------------------------------------------- */

function focus(li) {
  if (current === li) return;
  if (current) {
    current.classList.remove("is-open", "is-more");
    current.querySelector(".reel__open").setAttribute("aria-expanded", "false");
  }
  current = li;
  if (li) {
    li.classList.add("is-open");
    li.querySelector(".reel__open").setAttribute("aria-expanded", "true");
  }
  syncSound();
}

/* --- Звук ------------------------------------------------------------------ */

// Любой клик или клавиша на странице снимает запрет браузера — после
// этого звук у кадра под курсором появляется сразу. Кнопку звука здесь
// не считаем: её нажатие обрабатывает она сама.
for (const type of ["pointerdown", "keydown"]) {
  addEventListener(
    type,
    (e) => {
      if (allowed || e.target.closest?.(".reel__sound")) return;
      allowed = true;
      syncSound();
    },
    { capture: true }
  );
}

// Есть ли в ролике звуковая дорожка, браузер говорит только после начала
// воспроизведения, и каждый по-своему. Кадрам без звука кнопку не
// показываем.
function probeAudio(v) {
  if (v.dataset.audio) return;
  let known = null;
  if ("mozHasAudio" in v) known = v.mozHasAudio;
  else if ("webkitAudioDecodedByteCount" in v) known = v.webkitAudioDecodedByteCount > 0 ? true : v.currentTime > 1 ? false : null;
  else if (v.audioTracks) known = v.audioTracks.length > 0;
  if (known === null) return;
  v.dataset.audio = known ? "1" : "0";
  if (!known) v.closest(".reel")?.classList.add("no-audio");
}

function syncSound() {
  const on = soundOn && allowed;
  const target = on ? current?.querySelector(".reel__video") : null;
  for (const v of host.querySelectorAll(".reel__video")) {
    const muted = v !== target;
    if (v.muted === muted) continue;
    v.muted = muted;
    // Браузер, не признавший разрешение, ставит ролик на паузу вместо
    // звука — тогда ролик возвращается к игре без звука.
    if (!muted && !v.paused) v.play().catch(() => ((v.muted = true), v.play().catch(() => {})));
  }
  for (const b of host.querySelectorAll(".reel__sound")) {
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Mute" : "Sound on");
  }
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
const dots = hs.querySelector("[data-dots]");

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
  const x = wanted();
  track.style.transform = `translate3d(${-x.toFixed(2)}px, 0, 0)`;
  // Точки едут вместе с лентой: это поверхность, на которой лежат кадры.
  dots?.style.setProperty("--dx", `${-x.toFixed(2)}px`);
}

function kickTrack() {
  if (!hsRaf) hsRaf = requestAnimationFrame(stepTrack);
}

addEventListener("scroll", kickTrack, { passive: true });
// Тач: фокус, данный нажатием, снимается, когда ленту листают дальше.
addEventListener(
  "scroll",
  () => {
    if (current && !current.matches(":hover")) focus(null);
  },
  { passive: true }
);
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

/* --- Точки ------------------------------------------------------------------
   Узор главной (стили .dots в home.css): едва видная сетка, которую курсор
   проявляет вокруг себя. Слой лежит в закреплённом кадре, поэтому
   координаты курсора — от кадра, а не от страницы. */

if (dots && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const aim = { x: -999, y: -999 };
  const pos = { x: -999, y: -999 };
  let raf = 0;
  const frame = () => {
    raf = 0;
    const k = reduced ? 1 : 0.18;
    pos.x += (aim.x - pos.x) * k;
    pos.y += (aim.y - pos.y) * k;
    dots.style.setProperty("--mx", `${pos.x.toFixed(1)}px`);
    dots.style.setProperty("--my", `${pos.y.toFixed(1)}px`);
    if (Math.abs(aim.x - pos.x) > 0.3 || Math.abs(aim.y - pos.y) > 0.3) raf = requestAnimationFrame(frame);
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const r = pin.getBoundingClientRect();
      aim.x = e.clientX - r.left;
      aim.y = e.clientY - r.top;
      if (pos.x < -900) Object.assign(pos, aim);
      dots.style.setProperty("--on", "1");
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true }
  );
  document.documentElement.addEventListener("pointerleave", () => dots.style.setProperty("--on", "0"));
}

/* --- Воспроизведение по видимости ----------------------------------------- */

/* Шторка: кадр открывается один раз, когда на треть вошёл в экран. Лента
   горизонтальная, но наблюдатель смотрит на реальный прямоугольник, поэтому
   сдвиг ленты он видит так же, как вертикальный скролл.

   Наблюдаем рамку (.reel__media), а не сам кадр: закрытый кадр обрезан
   clip-path целиком, и Chrome считает обрезанное невидимым — наблюдатель
   никогда бы не сработал, кадр не открылся, а видео не запустились. */
function watchReveal() {
  const boxes = host.querySelectorAll(".reel__media");
  const open = (box) => box.querySelector(".reel__frame")?.classList.add("is-shown");
  if (reduced || !("IntersectionObserver" in window)) {
    boxes.forEach(open);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        open(e.target);
        io.unobserve(e.target);
      }
    },
    { threshold: 0.3 }
  );
  boxes.forEach((b) => io.observe(b));
}

function watchPlayback() {
  watchReveal();
  const videos = host.querySelectorAll(".reel__video");
  if (!videos.length) return;

  videos.forEach((v) => v.addEventListener("timeupdate", () => probeAudio(v)));

  if (reduced || !("IntersectionObserver" in window)) {
    // Без автоплея ролик остаётся постером до клика — это осознанно.
    videos.forEach((v) => v.setAttribute("controls", ""));
    return;
  }

  // Видимость — тоже по рамке, а не по самому видео: пока кадр закрыт
  // шторкой, видео внутри обрезано и для наблюдателя «не на экране».
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target.querySelector(".reel__video");
        if (!v) continue;
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

  videos.forEach((v) => io.observe(v.closest(".reel__media") || v));
}

/* --- Загрузка -------------------------------------------------------------- */

load("lab")
  .then((data) => {
    // Ролики и постеры лежат в Selectel: в json — путь от mediaBase или
    // полный адрес, как у галерей кейсов.
    const base = data.mediaBase || "";
    const url = (p) => (!p || /^https?:/.test(p) ? p : base + p);
    items = published(data.items).map((i) => ({ ...i, video: url(i.video), poster: url(i.poster) }));
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
