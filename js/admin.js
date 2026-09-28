/* Админка: Lab и проекты.

   Требование к разделу Lab сформулировано в 04 Соцсети/Lab/заметки:
   добавление работы занимает пять минут и не требует правки вёрстки.
   Отсюда устройство панели — поле, поле, перетащенный файл, «сохранить».

   Куда пишем
   ----------
   Три режима, выбираются сами:
   - рядом работает tools/dev-server.py — «Сохранить» кладёт json прямо
     в data/ и файл постера в assets/;
   - панель открыта с хостинга и подключена к GitHub — «Сохранить» делает
     один коммит в репозиторий, сайт выкладывается сам (admin-github.js).
     До нажатия ничего никуда не уходит: перетащенные файлы ждут в
     браузере и едут тем же коммитом;
   - ни того ни другого — тот же json отдаётся скачиванием.
   Молча терять правки панель не должна ни в одном случае.

   Схема описана в data/README.md. Панель её не изобретает: она читает
   существующий файл, правит и кладёт обратно — незнакомые поля
   сохраняются как были. */

import * as github from "./admin-github.js";

const TABS = {
  lab: {
    file: "lab.json",
    key: "items",
    listTitle: "Работы Lab",
    uploadDir: "lab",
    blank: () => ({
      slug: "",
      title: "",
      date: new Date().toISOString().slice(0, 10),
      tech: [],
      series: null,
      video: "",
      poster: "",
      description: "",
      published: true,
    }),
    fields: [
      { name: "title", label: "Название", type: "text", required: true },
      { name: "slug", label: "Слаг", type: "text", hint: "латиница, дефисы; из названия подставится само" },
      { name: "date", label: "Дата", type: "date" },
      { name: "tech", label: "Техника", type: "list", hint: "через запятую: Houdini, Karma XPU" },
      { name: "series", label: "Серия", type: "text", hint: "например Mardini 2026 — day 17; пусто, если работа сама по себе" },
      { name: "video", label: "Видео", type: "video", hint: "перетащи ролик — сожмётся и уедет в Selectel, постер снимется сам. Лучше вертикаль 9:16" },
      { name: "poster", label: "Постер", type: "file", hint: "кадр, который стоит в сетке до запуска ролика" },
      { name: "description", label: "Описание", type: "textarea", hint: "1–3 предложения: что исследовал и зачем" },
      { name: "published", label: "Показывать на сайте", type: "bool" },
    ],
  },

  projects: {
    file: "projects.json",
    key: "projects",
    listTitle: "Проекты",
    uploadDir: "work",
    blank: () => ({
      slug: "",
      title: "",
      titleRu: "",
      client: "",
      year: null,
      branch: "web",
      kicker: "",
      role: "",
      summary: "",
      capabilities: [],
      cover: "",
      logo: null,
      color: null,
      link: null,
      linkLabel: null,
      featured: false,
      published: false,
      status: "in-progress",
      body: [],
      todo: [],
    }),
    fields: [
      { name: "title", label: "Название", type: "text", required: true, hint: "на сайте всё по-английски; русские названия транслитерируем" },
      { name: "titleRu", label: "Название по-русски", type: "text", hint: "для себя, на сайт не выводится" },
      { name: "slug", label: "Слаг", type: "text" },
      { name: "client", label: "Клиент", type: "text" },
      { name: "year", label: "Год", type: "number", hint: "пусто = год не подтверждён; тогда сайт его не печатает" },
      { name: "branch", label: "Ветка", type: "select", options: ["web", "branding", "motion"] },
      { name: "kicker", label: "Что делал", type: "text", hint: "строка под названием: Logo, branding, web" },
      { name: "role", label: "Роль", type: "text", hint: "честно: арт-дирекция или исполнение" },
      { name: "summary", label: "Короткое описание", type: "textarea" },
      { name: "capabilities", label: "Объём работ", type: "list", hint: "через запятую" },
      { name: "cover", label: "Обложка", type: "file" },
      { name: "logo", label: "Знак клиента", type: "text", hint: "путь к svg в assets/logos" },
      { name: "color", label: "Цвет бренда", type: "text", hint: "#E30611 — знак по центру ячейки и пятно цвета на ховере; пусто — обычная карточка" },
      { name: "link", label: "Живой сайт", type: "url" },
      { name: "linkLabel", label: "Подпись ссылки", type: "text" },
      { name: "body", label: "Текст кейса", type: "paras", hint: "пустая строка разделяет абзацы" },
      { name: "media", label: "Галерея кейса", type: "media", hint: "порядок, ширина и подписи картинок и видео — в конструкторе" },
      { name: "todo", label: "Что осталось заполнить", type: "lines", hint: "по пункту на строку; на сайт не выводится" },
      { name: "status", label: "Статус", type: "select", options: ["done", "in-progress"] },
      { name: "featured", label: "На главной", type: "bool", hint: "в сетке главной шесть мест" },
      { name: "published", label: "Показывать на сайте", type: "bool" },
    ],
  },
};

const $ = (sel) => document.querySelector(sel);

const els = {
  status: $("[data-status]"),
  items: $("[data-items]"),
  form: $("[data-form]"),
  preview: $("[data-preview]"),
  hint: $("[data-hint]"),
  listTitle: $("[data-list-title]"),
};

let tab = "lab";
let doc = null; // весь файл целиком: незнакомые поля не теряем
let base = null; // файл, каким он был при загрузке или последнем сохранении
let list = [];
let index = 0;
let dirty = false;
let mode = "offline"; // local · cloud · offline
let cloud = null; // { repo, branch, token } в облачном режиме

/* Файлы, перетащенные в облачном режиме: до «Сохранить» они живут только
   в браузере. Ключ — путь, под которым файл встанет в репозиторий. */
const pending = new Map(); // путь → File
const previews = new Map(); // путь → blob: адрес для миниатюр

/* --- Утилиты --------------------------------------------------------------- */

function slugify(s) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
    щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return (s || "")
    .toLowerCase()
    .split("")
    .map((c) => (c in map ? map[c] : c))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* Служебные поля панели (__slugTouched и подобные) в файл не уезжают:
   json читают страницы сайта, и мусор из редактора им не нужен. */
function clean(key, value) {
  return key.startsWith("__") ? undefined : value;
}

function status(text, kind) {
  els.status.textContent = text;
  els.status.dataset.kind = kind || "";
}

function markDirty() {
  dirty = true;
  status("есть несохранённые правки", "warn");
}

/* --- Загрузка и запись ------------------------------------------------------ */

async function detectMode() {
  // Отличаем dev-сервер от обычной статики. Запрос должен быть безобидным
  // и успешным: проверка через заведомо неверный POST работала, но
  // оставляла в консоли красную строку при каждом открытии панели.
  let server = false;
  try {
    const r = await fetch("/api/ping", { cache: "no-store" });
    server = r.ok && (await r.json()).write === true;
  } catch {
    server = false;
  }
  cloud = server ? null : github.getConfig();
  mode = server ? "local" : cloud ? "cloud" : "offline";
  renderCloudButton();
}

const READY = {
  local: ["готово · пишем в data/", "ok"],
  cloud: ["готово · «Сохранить» публикует на сайт", "ok"],
  offline: ["готово · не подключено, сохранение скачиванием", "warn"],
};

async function loadTab(name) {
  if (dirty && !confirm("Есть несохранённые правки. Уйти и потерять их?")) return;

  tab = name;
  dirty = false;
  index = 0;

  document.querySelectorAll(".cms-tab").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });

  const cfg = TABS[tab];
  els.listTitle.textContent = cfg.listTitle;
  status("загрузка…");

  clearPending();
  try {
    doc =
      mode === "cloud"
        ? await github.readJson(cloud, `data/${cfg.file}`)
        : await fetch(`data/${cfg.file}`, { cache: "no-cache" }).then((r) => r.json());
  } catch (e) {
    status(`не загрузилось: ${e.message}`, "err");
    return;
  }
  base = JSON.parse(JSON.stringify(doc));
  list = doc[cfg.key] || [];

  renderList();
  renderForm();
  status(...READY[mode]);
}

/* Файл мог измениться на диске, пока открыта панель: правка в коде,
   второе окно админки. Сохранение целиком поверх молча стёрло бы эти
   правки. Поэтому перед записью читаем файл заново и переносим в панель
   каждое поле записи, которое снаружи поменялось, а в панели нет. Записи
   сопоставляются по slug; новые записи с диска добавляются в конец. */
function mergeFromDisk(disk, key) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bySlug = (arr) => new Map((arr || []).filter((x) => x.slug).map((x) => [x.slug, x]));
  const was = bySlug(base && base[key]);
  const mine = bySlug(list);
  let pulled = 0;

  for (const d of disk[key] || []) {
    if (!d.slug) continue;
    const item = mine.get(d.slug);
    const old = was.get(d.slug);
    if (!item) {
      if (!old) {
        list.push(d);
        pulled++;
      }
      continue;
    }
    for (const k of Object.keys(d)) {
      const changedOutside = !old || !same(d[k], old[k]);
      const untouchedHere = !old || same(item[k], old[k]);
      if (changedOutside && untouchedHere && !same(item[k], d[k])) {
        item[k] = d[k];
        pulled++;
      }
    }
  }
  return pulled;
}

async function save() {
  if (mode === "cloud") return saveCloud();
  const cfg = TABS[tab];

  let pulled = 0;
  if (mode === "local") {
    const disk = await fetch(`data/${cfg.file}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    if (disk && JSON.stringify(disk) !== JSON.stringify(base)) {
      pulled = mergeFromDisk(disk, cfg.key);
    }
  }

  doc[cfg.key] = list;
  doc.updated = new Date().toISOString().slice(0, 10);

  if (mode !== "local") return download();

  status("сохраняю…");
  const r = await fetch(`/api/data/${cfg.file}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc, clean, 2),
  });
  const j = await r.json().catch(() => ({}));

  if (r.ok && j.ok) {
    dirty = false;
    base = JSON.parse(JSON.stringify(doc, clean));
    if (pulled) {
      renderList();
      renderForm();
    }
    status(
      pulled
        ? `сохранено в ${j.path} · подтянул с диска правок: ${pulled}`
        : `сохранено в ${j.path}`,
      "ok"
    );
  } else {
    status(`не сохранилось: ${j.error || r.status}. Жми «Скачать json»`, "err");
  }
}

/* Облако: читаем свежий файл из репозитория, подтягиваем чужие правки
   тем же mergeFromDisk и коммитим json вместе с ждущими файлами. Если
   ветка сдвинулась между чтением и записью, пробуем ещё раз — один. */
async function saveCloud(retry = true) {
  const cfg = TABS[tab];
  const path = `data/${cfg.file}`;
  let sha;
  let pulled = 0;
  let message;

  status("публикую…");
  try {
    const fresh = await github.readJson(cloud, path);
    if (JSON.stringify(fresh) !== JSON.stringify(base)) pulled = mergeFromDisk(fresh, cfg.key);

    message = commitMessage(cfg);
    doc[cfg.key] = list;
    doc.updated = new Date().toISOString().slice(0, 10);
    const text = JSON.stringify(doc, clean, 2) + "\n";

    // Файл, который перетащили, а потом заменили другим, в репозиторий
    // не везём: на него больше ничто не ссылается.
    const files = [{ path, text }];
    for (const [p, blob] of pending) if (text.includes(`"${p}"`)) files.push({ path: p, blob });

    sha = await github.commit(cloud, files, message);
  } catch (e) {
    if (retry && (e.status === 409 || e.status === 422)) return saveCloud(false);
    status(`не опубликовалось: ${e.message}. Правки на месте — можно «Скачать json»`, "err");
    return;
  }

  dirty = false;
  base = JSON.parse(JSON.stringify(doc, clean));
  pending.clear(); // превью оставляем: пока сайт выкладывается, файла там ещё нет
  if (pulled) {
    renderList();
    renderForm();
  }
  const extra = pulled ? ` · подтянул чужих правок: ${pulled}` : "";
  status(`сохранено${extra} · сайт обновляется…`, "ok");
  watchDeploy(sha, extra);
}

/* Подпись коммита — какие записи тронуты, чтобы в истории репозитория
   было видно, что и когда меняли, без открытия диффа. */
function commitMessage(cfg) {
  const was = new Map(((base && base[cfg.key]) || []).map((x) => [x.slug, JSON.stringify(x)]));
  const touched = list
    .filter((x) => was.get(x.slug) !== JSON.stringify(x, clean))
    .map((x) => x.title || x.slug)
    .slice(0, 6);
  const removed = [...was.keys()].filter((s) => !list.some((x) => x.slug === s));
  const parts = [];
  if (touched.length) parts.push(touched.join(", "));
  if (removed.length) parts.push(`removed ${removed.join(", ")}`);
  return `Content from the admin: ${cfg.file}${parts.length ? " — " + parts.join("; ") : ""}`;
}

/* Сайт выкладывает workflow; ждём его, если токену разрешено смотреть
   Actions. Не разрешено — честно говорим, сколько это обычно занимает. */
async function watchDeploy(sha, extra) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    if (dirty) return; // пошли новые правки — статус теперь про них
    const s = await github.deployState(cloud, sha);
    if (!s) {
      status(`сохранено${extra} · сайт обновится примерно через минуту`, "ok");
      return;
    }
    if (s.state === "done") return status(`опубликовано${extra} · сайт обновлён`, "ok");
    if (s.state === "failed") return status("сохранено, но выкладка упала — см. Actions на GitHub", "err");
  }
}

function clearPending() {
  pending.clear();
  previews.forEach((u) => URL.revokeObjectURL(u));
  previews.clear();
}

function download() {
  const cfg = TABS[tab];
  doc[cfg.key] = list;
  const blob = new Blob([JSON.stringify(doc, clean, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = cfg.file;
  a.click();
  URL.revokeObjectURL(a.href);
  status(`${cfg.file} скачан — положи его в site/data/`, "ok");
}

async function upload(file, name) {
  const cfg = TABS[tab];
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safe = `${slugify(name) || "file"}.${ext}`;

  if (mode === "cloud") {
    // Видео в репозиторий не кладём: ролики живут в Selectel, а GitHub
    // не принимает файлы больше 100 МБ и раздувается от каждого.
    if (file.type.startsWith("video/") || file.size > 20 * 1024 * 1024) {
      status("видео и файлы больше 20 МБ — в Selectel, сюда вставь ссылку", "warn");
      return null;
    }
    const path = `assets/${cfg.uploadDir}/${safe}`;
    if (previews.has(path)) URL.revokeObjectURL(previews.get(path));
    pending.set(path, file);
    previews.set(path, URL.createObjectURL(file));
    status(`${safe} уедет на сайт вместе с «Сохранить»`, "warn");
    return path;
  }
  if (mode !== "local") {
    status("без подключения файл не зальётся — положи его в assets вручную", "warn");
    return null;
  }

  status(`заливаю ${safe}…`);
  const r = await fetch(`/api/upload/${cfg.uploadDir}/${safe}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  const j = await r.json().catch(() => ({}));

  if (r.ok && j.ok) {
    status(`залит ${j.path}`, "ok");
    return j.path;
  }
  status(`файл не залился: ${j.error || r.status}`, "err");
  return null;
}

/* Видео не едет ни в репозиторий, ни через «Сохранить»: браузер его сжимает
   (admin-video.js) и сразу кладёт в бакет Selectel — на хостинге через
   admin-media.php, у которого ключи бакета, локально через dev-сервер и
   rclone. В json уходит только путь, и уже «Сохранить» публикует его.
   Имя файла каждый раз новое: старый адрес мог осесть в кэше браузеров. */
async function putMedia(path, blob) {
  const url =
    mode === "local"
      ? `/api/media?path=${encodeURIComponent(path)}`
      : `/admin-media.php?path=${encodeURIComponent(path)}`;
  let r;
  try {
    r = await fetch(url, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
  } catch (e) {
    throw new Error("нет связи с сервером");
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 404 && !j.error) throw new Error("заливать некуда — видео грузится из админки на хостинге или с dev-сервера");
  if (r.status === 413) throw new Error("хостинг не принял такой большой файл");
  if (!r.ok || !j.ok) throw new Error(j.error || `ответ ${r.status}`);
  return j.path;
}

async function takeVideo(file, slug, dir) {
  if (!slug) throw new Error("сначала заполни название — по нему назовётся папка");
  const mb = (n) => (n / 1e6).toFixed(1);
  status(`сжимаю ${file.name}…`, "warn");
  const { compress } = await import("./admin-video.js");
  const out = await compress(file, (p) => status(`сжимаю ${file.name}… ${Math.round(p * 100)}%`, "warn"));

  const stamp = Date.now().toString(36);
  const folder = `${dir}/${slug}`;
  const posterExt = out.poster.type === "image/webp" ? "webp" : "jpg";
  const videoExt = out.video.type === "video/webm" ? "webm" : "mp4";
  status(`заливаю ${mb(out.video.size)} МБ в Selectel…`, "warn");
  const video = await putMedia(`${folder}/${slug}-${stamp}.${videoExt}`, out.video);
  const poster = await putMedia(`${folder}/${slug}-${stamp}-poster.${posterExt}`, out.poster);

  previews.set(video, URL.createObjectURL(out.video));
  previews.set(poster, URL.createObjectURL(out.poster));
  const note = out.kept
    ? `${mb(file.size)} МБ — файл уже был сжат под веб, залил как есть`
    : `${mb(file.size)} → ${mb(out.video.size)} МБ, ${out.width}×${out.height}`;
  return { video, poster, note };
}

/* --- Список ----------------------------------------------------------------- */

function renderList() {
  els.items.replaceChildren();

  list.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "cms-item" + (i === index ? " is-current" : "");

    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "cms-item__pick";
    pick.onclick = () => {
      index = i;
      renderList();
      renderForm();
    };

    const title = document.createElement("span");
    title.className = "cms-item__title";
    title.textContent = item.title || "(без названия)";

    const flag = document.createElement("span");
    flag.className = "cms-item__flag";
    // Три состояния одной меткой: черновик, есть на сайте, вынесен на главную.
    flag.textContent = item.published === false ? "draft" : item.featured ? "home" : "live";
    flag.dataset.kind = item.published === false ? "draft" : item.featured ? "home" : "live";

    pick.append(title, flag);

    const tools = document.createElement("span");
    tools.className = "cms-item__tools";
    tools.append(
      iconButton("↑", "Выше", () => move(i, -1)),
      iconButton("↓", "Ниже", () => move(i, 1)),
      iconButton("×", "Удалить", () => remove(i))
    );

    li.append(pick, tools);
    els.items.append(li);
  });
}

function iconButton(glyph, label, onclick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cms-icon";
  b.title = label;
  b.setAttribute("aria-label", label);
  b.textContent = glyph;
  b.onclick = onclick;
  return b;
}

function move(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  index = j;
  markDirty();
  renderList();
}

function remove(i) {
  const item = list[i];
  if (!confirm(`Удалить «${item.title || "без названия"}»? Это не отменяется.`)) return;
  list.splice(i, 1);
  index = Math.max(0, Math.min(index, list.length - 1));
  markDirty();
  renderList();
  renderForm();
}

function add() {
  list.unshift(TABS[tab].blank());
  index = 0;
  markDirty();
  renderList();
  renderForm();
  els.form.querySelector("input")?.focus();
}

/* --- Форма ------------------------------------------------------------------ */

function renderForm() {
  els.form.replaceChildren();
  const item = list[index];

  if (!item) {
    els.form.append(row("", note("Список пуст. Жми «+ новая».")));
    renderPreview();
    return;
  }

  for (const f of TABS[tab].fields) {
    els.form.append(field(f, item));
  }
  renderPreview();
}

function row(label, control, hint) {
  const wrap = document.createElement("label");
  wrap.className = "cms-row";
  if (label) {
    const l = document.createElement("span");
    l.className = "cms-label";
    l.textContent = label;
    wrap.append(l);
  }
  wrap.append(control);
  if (hint) {
    const h = document.createElement("span");
    h.className = "cms-hint";
    h.textContent = hint;
    wrap.append(h);
  }
  return wrap;
}

function note(text) {
  const p = document.createElement("p");
  p.className = "cms-hint";
  p.textContent = text;
  return p;
}

function commit(item, name, value) {
  item[name] = value;
  markDirty();
  renderList();
  renderPreview();
}

function field(f, item) {
  const value = item[f.name];

  if (f.type === "media") return mediaField(f, item);
  if (f.type === "video") return videoField(f, item);

  if (f.type === "bool") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "cms-check";
    input.checked = value === true;
    input.onchange = () => commit(item, f.name, input.checked);

    const wrap = document.createElement("label");
    wrap.className = "cms-row cms-row--flag";
    wrap.append(input);
    const l = document.createElement("span");
    l.className = "cms-label";
    l.textContent = f.label;
    wrap.append(l);
    if (f.hint) wrap.append(note(f.hint));
    return wrap;
  }

  if (f.type === "select") {
    const sel = document.createElement("select");
    sel.className = "cms-input";
    for (const o of f.options) {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      opt.selected = value === o;
      sel.append(opt);
    }
    sel.onchange = () => commit(item, f.name, sel.value);
    return row(f.label, sel, f.hint);
  }

  if (f.type === "textarea" || f.type === "paras" || f.type === "lines") {
    const ta = document.createElement("textarea");
    ta.className = "cms-input cms-input--area";
    ta.rows = f.type === "paras" ? 8 : 4;
    ta.value = Array.isArray(value)
      ? value.join(f.type === "paras" ? "\n\n" : "\n")
      : value || "";
    ta.oninput = () => {
      if (f.type === "paras") {
        commit(item, f.name, ta.value.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean));
      } else if (f.type === "lines") {
        commit(item, f.name, ta.value.split("\n").map((s) => s.trim()).filter(Boolean));
      } else {
        commit(item, f.name, ta.value);
      }
    };
    return row(f.label, ta, f.hint);
  }

  if (f.type === "file") {
    const box = document.createElement("div");
    box.className = "cms-file";

    const path = document.createElement("input");
    path.type = "text";
    path.className = "cms-input";
    path.placeholder = "assets/…";
    path.value = value || "";
    path.oninput = () => commit(item, f.name, path.value);

    const drop = document.createElement("label");
    drop.className = "cms-drop";
    drop.textContent = "перетащи файл сюда или выбери";

    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*,video/*";
    picker.className = "cms-drop__input";

    const take = async (file) => {
      if (!file) return;
      const base = `${item.slug || slugify(item.title)}-${f.name}`;
      const saved = await upload(file, base);
      if (saved) {
        path.value = saved;
        commit(item, f.name, saved);
      }
    };

    picker.onchange = () => take(picker.files[0]);
    drop.append(picker);
    drop.ondragover = (e) => {
      e.preventDefault();
      drop.classList.add("is-over");
    };
    drop.ondragleave = () => drop.classList.remove("is-over");
    drop.ondrop = (e) => {
      e.preventDefault();
      drop.classList.remove("is-over");
      take(e.dataTransfer.files[0]);
    };

    box.append(path, drop);
    return row(f.label, box, f.hint);
  }

  const input = document.createElement("input");
  input.className = "cms-input";
  input.type = f.type === "number" ? "number" : f.type === "date" ? "date" : "text";
  input.value = Array.isArray(value) ? value.join(", ") : value === null ? "" : value;
  if (f.required) input.required = true;

  input.oninput = () => {
    let v = input.value;
    if (f.type === "list") v = v.split(",").map((s) => s.trim()).filter(Boolean);
    else if (f.type === "number") v = v ? Number(v) : null;
    else if (f.type === "url" || f.name === "logo") v = v || null;
    commit(item, f.name, v);

    // Слаг подставляется из названия ровно до того момента, пока его не
    // тронули руками: переименовать работу потом можно, а слаг уже ушёл
    // в ссылки и меняться сам не должен.
    if (f.name === "title" && !item.__slugTouched && !item.slug) {
      item.slug = slugify(v);
      renderForm();
    }
    if (f.name === "slug") item.__slugTouched = true;
  };

  return row(f.label, input, f.hint);
}

function videoField(f, item) {
  const box = document.createElement("div");
  box.className = "cms-file";

  const path = document.createElement("input");
  path.type = "text";
  path.className = "cms-input";
  path.placeholder = "lab/<slug>/файл.mp4 или полный адрес";
  path.value = item[f.name] || "";
  path.oninput = () => commit(item, f.name, path.value);

  const drop = document.createElement("label");
  drop.className = "cms-drop";
  drop.textContent = "перетащи ролик сюда или выбери";

  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "video/*,.mov,.mkv";
  picker.className = "cms-drop__input";

  let busy = false;
  const take = async (file) => {
    if (!file || busy) return;
    if (!file.type.startsWith("video/") && !/\.(mov|mkv|mp4|webm|m4v)$/i.test(file.name)) {
      return status(`${file.name} — это не видео`, "err");
    }
    busy = true;
    drop.classList.add("is-busy");
    drop.firstChild.textContent = "сжимаю и заливаю — не закрывай вкладку";
    try {
      const got = await takeVideo(file, item.slug || slugify(item.title), TABS[tab].uploadDir);
      if (!item.slug) item.slug = slugify(item.title);
      item[f.name] = got.video;
      const keptPoster = item.poster && !previews.has(item.poster);
      if (!keptPoster) item.poster = got.poster;
      commit(item, f.name, got.video);
      renderForm();
      status(`залито: ${got.note}${keptPoster ? " · постер оставил прежний" : ""} · жми «Сохранить», чтобы опубликовать`, "warn");
    } catch (e) {
      status(`видео не залилось: ${e.message}`, "err");
    } finally {
      busy = false;
      drop.classList.remove("is-busy");
      drop.firstChild.textContent = "перетащи ролик сюда или выбери";
    }
  };

  picker.onchange = () => take(picker.files[0]);
  drop.append(picker);
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("is-over");
  };
  drop.ondragleave = () => drop.classList.remove("is-over");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("is-over");
    take(e.dataTransfer.files[0]);
  };

  box.append(path, drop);
  return row(f.label, box, f.hint);
}

/* --- Конструктор галереи -------------------------------------------------------
   Галерея кейса правится вживую: та же сетка на шесть долей, что на
   странице кейса (css/pages.css), файлы перетаскиваются мышью, у каждого —
   ширина (вся строка / половина / треть), подпись и удаление. Правки
   сразу ложатся в item.media; «Сохранить» пишет их в projects.json, как
   любое другое поле.

   Новые файлы: путь в Selectel (work/<slug>/файл.webp) или полный адрес —
   или файл с диска, который dev-сервер положит в assets/work/. Тяжёлое
   видео лучше в Selectel: репозиторий не для этого. */

const MEDIA_VIDEO = /\.(mp4|webm|mov)(\?|$)/i;
const MEDIA_SIZES = [
  ["full", "1/1"],
  ["half", "1/2"],
  ["third", "1/3"],
];

function mediaUrl(path) {
  if (!path) return "";
  if (previews.has(path)) return previews.get(path);
  return /^(https?:|assets\/)/.test(path) ? path : (doc.mediaBase || "") + path;
}

function mediaSize(it, i) {
  return MEDIA_SIZES.some(([k]) => k === it.size) ? it.size : i === 0 ? "full" : "half";
}

function mediaThumb(it, cls) {
  const src = mediaUrl(it.src);
  let node;
  // По пути, а не по src: у свежезалитого файла src — blob: без расширения.
  if (MEDIA_VIDEO.test(it.src)) {
    node = document.createElement("video");
    node.src = src;
    if (it.poster) node.poster = mediaUrl(it.poster);
    node.muted = true;
    node.loop = true;
    node.playsInline = true;
    node.preload = "metadata";
    // Играет только под курсором: в кейсе бывает по пятнадцать роликов.
    node.onmouseenter = () => node.play().catch(() => {});
    node.onmouseleave = () => node.pause();
  } else {
    node = document.createElement("img");
    node.src = src;
    node.alt = "";
    node.loading = "lazy";
  }
  node.className = cls;
  node.draggable = false;
  node.onerror = () => node.classList.add("is-broken");
  return node;
}

function mediaField(f, item) {
  const box = document.createElement("div");
  box.className = "cms-media";

  const strip = document.createElement("div");
  strip.className = "cms-media__strip";
  const media = item.media || [];
  media.slice(0, 12).forEach((it) => strip.append(mediaThumb(it, "cms-media__thumb")));
  if (!media.length) strip.append(note("файлов пока нет"));

  const open = document.createElement("button");
  open.type = "button";
  open.className = "cms-btn";
  open.textContent = `Открыть конструктор · ${media.length}`;
  open.onclick = () => openBuilder(item);

  box.append(strip, open);

  // Не <label>, как у остальных полей: клик по миниатюре внутри label
  // «нажимал» бы кнопку конструктора.
  const wrap = document.createElement("div");
  wrap.className = "cms-row";
  const l = document.createElement("span");
  l.className = "cms-label";
  l.textContent = f.label;
  wrap.append(l, box);
  if (f.hint) wrap.append(note(f.hint));
  return wrap;
}

function openBuilder(item) {
  if (!Array.isArray(item.media)) item.media = [];
  const media = item.media;

  const dlg = document.createElement("dialog");
  dlg.className = "cms-builder";

  const head = document.createElement("div");
  head.className = "cms-builder__head";
  const title = document.createElement("p");
  title.className = "cms-builder__title";

  const addPath = document.createElement("button");
  addPath.type = "button";
  addPath.className = "cms-btn";
  addPath.textContent = "+ путь или ссылка";
  addPath.onclick = () => {
    const v = prompt(
      "Путь в Selectel (work/<slug>/файл.webp), путь на сайте (assets/…) или полный адрес. Несколько — через пробел."
    );
    if (!v) return;
    v.split(/\s+/).map((x) => x.trim()).filter(Boolean).forEach((src) => media.push({ src }));
    changed();
  };

  const addFile = document.createElement("label");
  addFile.className = "cms-btn";
  addFile.textContent = "+ файл с диска";
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*,video/*";
  picker.multiple = true;
  picker.hidden = true;
  picker.onchange = async () => {
    let report = null;
    for (const file of picker.files) {
      if (file.type.startsWith("video/") || /\.(mov|mkv)$/i.test(file.name)) {
        try {
          const got = await takeVideo(file, item.slug || slugify(item.title), TABS[tab].uploadDir);
          media.push({ src: got.video, poster: got.poster });
          report = [`залито: ${got.note} · жми «Сохранить», чтобы опубликовать`, "warn"];
        } catch (e) {
          report = [`${file.name} не залился: ${e.message}`, "err"];
        }
        continue;
      }
      const stem = file.name.replace(/\.[^.]+$/, "");
      const saved = await upload(file, `${item.slug || slugify(item.title)}-${stem}`);
      if (saved) media.push({ src: saved });
    }
    picker.value = "";
    changed();
    if (report) status(...report);
  };
  addFile.append(picker);

  const done = document.createElement("button");
  done.type = "button";
  done.className = "cms-btn cms-btn--go";
  done.textContent = "Готово";
  done.onclick = () => dlg.close();

  head.append(title, addPath, addFile, done);

  const hint = document.createElement("p");
  hint.className = "cms-hint cms-builder__hint";
  hint.textContent =
    "Тащи карточку, чтобы поменять порядок. 1/1 — вся строка, 1/2 — половина, 1/3 — треть. Так же встанет на странице кейса. Изменения сохраняются кнопкой «Сохранить» в шапке.";

  const grid = document.createElement("ol");
  grid.className = "cms-builder__grid";

  let dragFrom = -1;

  function render() {
    grid.replaceChildren();
    media.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = `cms-tile cms-tile--${mediaSize(it, i)}`;
      li.draggable = true;

      const bar = document.createElement("div");
      bar.className = "cms-tile__bar";
      const num = document.createElement("span");
      num.className = "cms-tile__num";
      num.textContent = String(i + 1).padStart(2, "0");
      bar.append(num);
      for (const [key, label] of MEDIA_SIZES) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cms-tile__size";
        b.textContent = label;
        b.setAttribute("aria-pressed", String(mediaSize(it, i) === key));
        b.onclick = () => {
          it.size = key;
          changed();
        };
        bar.append(b);
      }
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cms-tile__del";
      del.title = "Убрать из галереи";
      del.textContent = "×";
      del.onclick = () => {
        media.splice(i, 1);
        changed();
      };
      bar.append(del);

      const frame = document.createElement("div");
      frame.className = "cms-tile__frame";
      frame.append(mediaThumb(it, "cms-tile__media"));

      const cap = document.createElement("input");
      cap.className = "cms-input cms-tile__cap";
      cap.placeholder = "подпись (необязательно)";
      cap.value = it.caption || "";
      cap.oninput = () => {
        if (cap.value.trim()) it.caption = cap.value;
        else delete it.caption;
        markDirty();
      };
      // Выделение текста в подписи не должно утаскивать карточку.
      cap.onfocus = () => (li.draggable = false);
      cap.onblur = () => (li.draggable = true);

      const path = document.createElement("p");
      path.className = "cms-tile__path";
      path.textContent = it.src;
      path.title = it.src;

      li.append(bar, frame, cap, path);

      li.ondragstart = (e) => {
        dragFrom = i;
        li.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
      };
      li.ondragend = () => {
        dragFrom = -1;
        grid
          .querySelectorAll(".cms-tile")
          .forEach((t) => t.classList.remove("is-dragging", "is-before", "is-after"));
      };
      li.ondragover = (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        const r = li.getBoundingClientRect();
        const after = e.clientX > r.left + r.width / 2;
        li.classList.toggle("is-after", after);
        li.classList.toggle("is-before", !after);
      };
      li.ondragleave = () => li.classList.remove("is-before", "is-after");
      li.ondrop = (e) => {
        e.preventDefault();
        if (dragFrom < 0) return;
        const r = li.getBoundingClientRect();
        let to = i + (e.clientX > r.left + r.width / 2 ? 1 : 0);
        const [moved] = media.splice(dragFrom, 1);
        if (dragFrom < to) to--;
        media.splice(to, 0, moved);
        dragFrom = -1;
        changed();
      };

      grid.append(li);
    });
    title.textContent = `Галерея · ${item.title || "без названия"} · ${media.length}`;
  }

  function changed() {
    markDirty();
    render();
  }

  dlg.append(head, hint, grid);
  dlg.addEventListener("close", () => {
    dlg.remove();
    renderForm();
  });
  document.body.append(dlg);
  render();
  dlg.showModal();
}

/* --- Превью ------------------------------------------------------------------ */

function renderPreview() {
  const item = list[index];
  els.preview.replaceChildren();
  els.hint.textContent = "";

  if (!item) return;

  if (tab === "lab") {
    const frame = document.createElement("div");
    frame.className = "cms-reel";
    if (item.video) {
      const v = document.createElement("video");
      v.src = mediaUrl(item.video);
      v.poster = mediaUrl(item.poster);
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.playsInline = true;
      frame.append(v);
    } else if (item.poster) {
      const img = document.createElement("img");
      img.src = mediaUrl(item.poster);
      img.alt = "";
      frame.append(img);
    } else {
      frame.textContent = "no file yet";
    }

    const t = document.createElement("p");
    t.className = "cms-reel__title";
    t.textContent = item.title || "(без названия)";

    const m = document.createElement("p");
    m.className = "cms-reel__meta";
    m.textContent = [item.tech && item.tech.join(" · "), item.date, item.series]
      .filter(Boolean)
      .join(" — ");

    els.preview.append(frame, t, m);
  } else {
    // Как card() в js/cards.js: знак по центру, площадь одна при любой
    // пропорции. Адрес — абсолютный: url() из кастомного свойства браузер
    // разрешает от таблицы стилей, и «assets/…» уехал бы в css/assets/.
    const box = document.createElement("div");
    box.className = "cms-card";
    if (item.logo) {
      const mark = document.createElement("span");
      const ar = Number(item.logoRatio) || 1;
      mark.className = "cms-card__logo";
      mark.style.setProperty("--src", `url("${new URL(mediaUrl(item.logo), document.baseURI).href}")`);
      mark.style.width = `${Math.min(60, 25 * Math.sqrt(ar))}%`;
      mark.style.height = `${Math.min(60, 25 / Math.sqrt(ar))}%`;
      box.append(mark);
    }
    // Цвет бренда на сайте виден только в чернилах под курсором — здесь точкой.
    if (/^#[0-9a-f]{3,8}$/i.test(item.color || "")) {
      const dot = document.createElement("span");
      dot.className = "cms-card__brand";
      dot.style.setProperty("--brand", item.color);
      dot.title = `цвет бренда ${item.color}`;
      box.append(dot);
    }

    const t = document.createElement("p");
    t.className = "cms-reel__title";
    t.textContent = `${item.title || "(без названия)"}${item.year ? " · " + item.year : ""}`;

    const m = document.createElement("p");
    m.className = "cms-reel__meta";
    m.textContent = item.kicker || "";

    els.preview.append(box, t, m);
  }

  const left = (item.todo || []).length;
  els.hint.textContent = left
    ? `Осталось заполнить: ${item.todo.join("; ")}`
    : "Ссылка на сайте: " + (tab === "lab" ? `/lab` : `/case?p=${item.slug || ""}`);
}

/* --- Запуск ------------------------------------------------------------------ */

document.querySelectorAll(".cms-tab").forEach((b) => {
  b.onclick = () => loadTab(b.dataset.tab);
});
$("[data-new]").onclick = add;
$("[data-save]").onclick = save;
$("[data-download]").onclick = download;

addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save();
  }
});

addEventListener("beforeunload", (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = "";
});

detectMode().then(() => loadTab("lab"));

/* --- Подключение к GitHub -------------------------------------------------- */

const cloudButton = $("[data-cloud]");

function renderCloudButton() {
  if (!cloudButton) return;
  cloudButton.hidden = mode === "local";
  // Вход есть только на хостинге (admin-gate.php); у dev-сервера выходить некуда.
  $("[data-logout]").hidden = mode === "local";
  cloudButton.textContent = mode === "cloud" ? `GitHub: ${cloud.repo.split("/")[1]}` : "Подключить GitHub";
  cloudButton.setAttribute("aria-pressed", String(mode === "cloud"));
}

function openConnect() {
  const dlg = $("[data-connect]");
  const form = dlg.querySelector("form");
  const msg = dlg.querySelector("[data-connect-msg]");
  const was = github.getConfig();
  form.repo.value = was ? was.repo : form.repo.defaultValue;
  form.branch.value = was ? was.branch : "main";
  form.token.value = "";
  form.token.placeholder = was ? "сохранён — оставь пустым, чтобы не менять" : "github_pat_…";
  msg.textContent = "";
  dlg.querySelector("[data-disconnect]").hidden = !was;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const repo = form.repo.value
      .trim()
      .replace(/^https:\/\/github\.com\//, "")
      .replace(/\.git$|\/$/g, "");
    const token = form.token.value.trim() || (was && was.token);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) {
      msg.textContent = "нужны репозиторий вида owner/name и токен";
      return;
    }
    msg.textContent = "проверяю…";
    try {
      const ok = await github.check({ repo, branch: form.branch.value.trim(), token });
      github.setConfig(ok);
      dlg.close();
      await detectMode();
      dirty = false;
      loadTab(tab);
    } catch (err) {
      msg.textContent = err.message;
    }
  };
  dlg.querySelector("[data-disconnect]").onclick = async () => {
    github.setConfig(null);
    dlg.close();
    await detectMode();
    dirty = false;
    loadTab(tab);
  };
  dlg.querySelector("[data-cancel]").onclick = () => dlg.close();
  dlg.showModal();
}

if (cloudButton) {
  cloudButton.onclick = () => {
    if (dirty && !confirm("Есть несохранённые правки — после переподключения они пропадут. Продолжить?")) return;
    openConnect();
  };
}

/* Панели настройки на сайте (ink / tilt / grid / ease). На публичных
   страницах их нет; эта кнопка включает их в этом браузере — флаг читает
   js/main.js. */
const devButton = document.querySelector("[data-devui]");
if (devButton) {
  const KEY = "nicktmsh:dev";
  const read = () => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch (err) {
      return false;
    }
  };
  const show = () => {
    const on = read();
    devButton.setAttribute("aria-pressed", String(on));
    devButton.textContent = on ? "Панели на сайте: вкл" : "Панели на сайте: выкл";
  };
  devButton.addEventListener("click", () => {
    try {
      if (read()) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, "1");
    } catch (err) {
      // нет localStorage — переключить нечем
    }
    show();
  });
  show();
}
