/* Данные сайта.

   Проекты и работы Lab лежат в data/*.json и больше нигде. Страницы их
   только читают, админка — пишет. Правило то же, что в 04 Соцсети/Lab:
   добавление работы не должно требовать правки вёрстки.

   Файлы читаются fetch-ем, поэтому сайт надо открывать по http, а не
   двойным кликом по index.html: с file:// браузер запрещает fetch даже
   соседнего файла. Локально это `python tools/dev-server.py` (см.
   .claude/launch.json), на проде — любой статический хостинг. */

export const DATA = {
  projects: "data/projects.json",
  lab: "data/lab.json",
};

const cache = new Map();

export async function load(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const p = fetch(DATA[kind], { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`${DATA[kind]} — ${r.status}`);
    return r.json();
  });
  cache.set(kind, p);
  return p;
}

/* Опубликованные проекты в порядке файла. Черновики (published: false)
   на сайт не попадают: они лежат в том же файле, чтобы данные копились
   заранее, но страница показывает только готовое. */
export function published(list) {
  return (list || []).filter((x) => x.published !== false);
}

export function byBranch(projects, branch) {
  return branch ? projects.filter((p) => p.branch === branch) : projects;
}

export function findBySlug(list, slug) {
  return (list || []).find((x) => x.slug === slug) || null;
}

/* --- Мелкие помощники разметки ------------------------------------------- */

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children || [])) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c);
  }
  return node;
}

/* Год показываем, только когда он подтверждён. Пустое место честнее
   выдуманной даты — годы по CG-кейсам в keys.md до сих пор с TODO. */
export function yearMark(year) {
  return year ? el("sup", { text: String(year) }) : null;
}

/* Дату Lab печатаем как `2026 · March` — мелким моно под роликом. */
export function labDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getFullYear()} · ${d.toLocaleString("en", { month: "long" })}`;
}

/* Проявление блоков, собранных в js уже после загрузки страницы.
   Наблюдатель в main.js отрабатывает один раз по готовой разметке и о
   содержимом, пришедшем позже, ничего не знает — поэтому узлы кейса
   проявляются отсюда. Задержки остаются на --delay, поэтому порядок
   появления тот же, что у статичных секций. */
export function reveal(root) {
  requestAnimationFrame(() => {
    root.querySelectorAll(".rise").forEach((n) => n.classList.add("is-in"));
  });
}

/* Сообщение об ошибке вместо молчаливо пустой секции: если json не
   доехал, это должно быть видно, а не выглядеть как «работ нет». */
export function fail(host, err) {
  console.error(err);
  host.replaceChildren(
    el("p", {
      class: "empty",
      text: "Данные не загрузились. Открой сайт по http, а не файлом с диска.",
    })
  );
}
