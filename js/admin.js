/* Админка: Lab и проекты.

   Требование к разделу Lab сформулировано в 04 Соцсети/Lab/заметки:
   добавление работы занимает пять минут и не требует правки вёрстки.
   Отсюда устройство панели — поле, поле, перетащенный файл, «сохранить».

   Куда пишем
   ----------
   Если рядом работает tools/dev-server.py, «Сохранить» кладёт json прямо
   в data/ и файл постера в assets/. Если сервера нет, панель отдаёт тот
   же json скачиванием: результат одинаковый, разница только в числе
   движений. Молча терять правки она не должна ни в одном случае.

   Схема описана в data/README.md. Панель её не изобретает: она читает
   существующий файл, правит и кладёт обратно — незнакомые поля
   сохраняются как были. */

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
      { name: "video", label: "Видео", type: "url", hint: "урл в Selectel — вертикаль 9:16, без звука" },
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
let canWrite = false;

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

async function probeServer() {
  // Отличаем dev-сервер от обычной статики. Запрос должен быть безобидным
  // и успешным: проверка через заведомо неверный POST работала, но
  // оставляла в консоли красную строку при каждом открытии панели.
  try {
    const r = await fetch("/api/ping", { cache: "no-store" });
    canWrite = r.ok && (await r.json()).write === true;
  } catch {
    canWrite = false;
  }
}

async function loadTab(name) {
  if (dirty && !confirm("Есть несохранённые правки. Уйти и потерять их?")) return;

  tab = name;
  dirty = false;
  index = 0;

  document.querySelectorAll(".ad-tab").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });

  const cfg = TABS[tab];
  els.listTitle.textContent = cfg.listTitle;
  status("загрузка…");

  const res = await fetch(`data/${cfg.file}`, { cache: "no-cache" });
  doc = await res.json();
  base = JSON.parse(JSON.stringify(doc));
  list = doc[cfg.key] || [];

  renderList();
  renderForm();
  status(canWrite ? "готово · пишем в data/" : "готово · сервера нет, сохранение скачиванием", canWrite ? "ok" : "warn");
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
  const cfg = TABS[tab];

  let pulled = 0;
  if (canWrite) {
    const disk = await fetch(`data/${cfg.file}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    if (disk && JSON.stringify(disk) !== JSON.stringify(base)) {
      pulled = mergeFromDisk(disk, cfg.key);
    }
  }

  doc[cfg.key] = list;
  doc.updated = new Date().toISOString().slice(0, 10);

  if (!canWrite) return download();

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
  if (!canWrite) {
    status("без dev-сервера файл не зальётся — положи его в assets вручную", "warn");
    return null;
  }
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safe = `${slugify(name) || "file"}.${ext}`;

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

/* --- Список ----------------------------------------------------------------- */

function renderList() {
  els.items.replaceChildren();

  list.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "ad-item" + (i === index ? " is-current" : "");

    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "ad-item__pick";
    pick.onclick = () => {
      index = i;
      renderList();
      renderForm();
    };

    const title = document.createElement("span");
    title.className = "ad-item__title";
    title.textContent = item.title || "(без названия)";

    const flag = document.createElement("span");
    flag.className = "ad-item__flag";
    // Три состояния одной меткой: черновик, есть на сайте, вынесен на главную.
    flag.textContent = item.published === false ? "draft" : item.featured ? "home" : "live";
    flag.dataset.kind = item.published === false ? "draft" : item.featured ? "home" : "live";

    pick.append(title, flag);

    const tools = document.createElement("span");
    tools.className = "ad-item__tools";
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
  b.className = "ad-icon";
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
  wrap.className = "ad-row";
  if (label) {
    const l = document.createElement("span");
    l.className = "ad-label";
    l.textContent = label;
    wrap.append(l);
  }
  wrap.append(control);
  if (hint) {
    const h = document.createElement("span");
    h.className = "ad-hint";
    h.textContent = hint;
    wrap.append(h);
  }
  return wrap;
}

function note(text) {
  const p = document.createElement("p");
  p.className = "ad-hint";
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

  if (f.type === "bool") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "ad-check";
    input.checked = value === true;
    input.onchange = () => commit(item, f.name, input.checked);

    const wrap = document.createElement("label");
    wrap.className = "ad-row ad-row--flag";
    wrap.append(input);
    const l = document.createElement("span");
    l.className = "ad-label";
    l.textContent = f.label;
    wrap.append(l);
    if (f.hint) wrap.append(note(f.hint));
    return wrap;
  }

  if (f.type === "select") {
    const sel = document.createElement("select");
    sel.className = "ad-input";
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
    ta.className = "ad-input ad-input--area";
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
    box.className = "ad-file";

    const path = document.createElement("input");
    path.type = "text";
    path.className = "ad-input";
    path.placeholder = "assets/…";
    path.value = value || "";
    path.oninput = () => commit(item, f.name, path.value);

    const drop = document.createElement("label");
    drop.className = "ad-drop";
    drop.textContent = "перетащи файл сюда или выбери";

    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*,video/*";
    picker.className = "ad-drop__input";

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
  input.className = "ad-input";
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
  return /^(https?:|assets\/)/.test(path) ? path : (doc.mediaBase || "") + path;
}

function mediaSize(it, i) {
  return MEDIA_SIZES.some(([k]) => k === it.size) ? it.size : i === 0 ? "full" : "half";
}

function mediaThumb(it, cls) {
  const src = mediaUrl(it.src);
  let node;
  if (MEDIA_VIDEO.test(src)) {
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
  box.className = "ad-media";

  const strip = document.createElement("div");
  strip.className = "ad-media__strip";
  const media = item.media || [];
  media.slice(0, 12).forEach((it) => strip.append(mediaThumb(it, "ad-media__thumb")));
  if (!media.length) strip.append(note("файлов пока нет"));

  const open = document.createElement("button");
  open.type = "button";
  open.className = "ad-btn";
  open.textContent = `Открыть конструктор · ${media.length}`;
  open.onclick = () => openBuilder(item);

  box.append(strip, open);

  // Не <label>, как у остальных полей: клик по миниатюре внутри label
  // «нажимал» бы кнопку конструктора.
  const wrap = document.createElement("div");
  wrap.className = "ad-row";
  const l = document.createElement("span");
  l.className = "ad-label";
  l.textContent = f.label;
  wrap.append(l, box);
  if (f.hint) wrap.append(note(f.hint));
  return wrap;
}

function openBuilder(item) {
  if (!Array.isArray(item.media)) item.media = [];
  const media = item.media;

  const dlg = document.createElement("dialog");
  dlg.className = "ad-builder";

  const head = document.createElement("div");
  head.className = "ad-builder__head";
  const title = document.createElement("p");
  title.className = "ad-builder__title";

  const addPath = document.createElement("button");
  addPath.type = "button";
  addPath.className = "ad-btn";
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
  addFile.className = "ad-btn";
  addFile.textContent = "+ файл с диска";
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*,video/*";
  picker.multiple = true;
  picker.hidden = true;
  picker.onchange = async () => {
    for (const file of picker.files) {
      const stem = file.name.replace(/\.[^.]+$/, "");
      const saved = await upload(file, `${item.slug || slugify(item.title)}-${stem}`);
      if (saved) media.push({ src: saved });
    }
    picker.value = "";
    changed();
  };
  addFile.append(picker);

  const done = document.createElement("button");
  done.type = "button";
  done.className = "ad-btn ad-btn--go";
  done.textContent = "Готово";
  done.onclick = () => dlg.close();

  head.append(title, addPath, addFile, done);

  const hint = document.createElement("p");
  hint.className = "ad-hint ad-builder__hint";
  hint.textContent =
    "Тащи карточку, чтобы поменять порядок. 1/1 — вся строка, 1/2 — половина, 1/3 — треть. Так же встанет на странице кейса. Изменения сохраняются кнопкой «Сохранить» в шапке.";

  const grid = document.createElement("ol");
  grid.className = "ad-builder__grid";

  let dragFrom = -1;

  function render() {
    grid.replaceChildren();
    media.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = `ad-tile ad-tile--${mediaSize(it, i)}`;
      li.draggable = true;

      const bar = document.createElement("div");
      bar.className = "ad-tile__bar";
      const num = document.createElement("span");
      num.className = "ad-tile__num";
      num.textContent = String(i + 1).padStart(2, "0");
      bar.append(num);
      for (const [key, label] of MEDIA_SIZES) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ad-tile__size";
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
      del.className = "ad-tile__del";
      del.title = "Убрать из галереи";
      del.textContent = "×";
      del.onclick = () => {
        media.splice(i, 1);
        changed();
      };
      bar.append(del);

      const frame = document.createElement("div");
      frame.className = "ad-tile__frame";
      frame.append(mediaThumb(it, "ad-tile__media"));

      const cap = document.createElement("input");
      cap.className = "ad-input ad-tile__cap";
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
      path.className = "ad-tile__path";
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
          .querySelectorAll(".ad-tile")
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
    frame.className = "ad-reel";
    if (item.video) {
      const v = document.createElement("video");
      v.src = item.video;
      v.poster = item.poster || "";
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.playsInline = true;
      frame.append(v);
    } else if (item.poster) {
      const img = document.createElement("img");
      img.src = item.poster;
      img.alt = "";
      frame.append(img);
    } else {
      frame.textContent = "no file yet";
    }

    const t = document.createElement("p");
    t.className = "ad-reel__title";
    t.textContent = item.title || "(без названия)";

    const m = document.createElement("p");
    m.className = "ad-reel__meta";
    m.textContent = [item.tech && item.tech.join(" · "), item.date, item.series]
      .filter(Boolean)
      .join(" — ");

    els.preview.append(frame, t, m);
  } else {
    const box = document.createElement("div");
    box.className = "ad-card";
    if (item.cover) box.style.backgroundImage = `url("${item.cover}")`;

    const t = document.createElement("p");
    t.className = "ad-reel__title";
    t.textContent = `${item.title || "(без названия)"}${item.year ? " · " + item.year : ""}`;

    const m = document.createElement("p");
    m.className = "ad-reel__meta";
    m.textContent = item.kicker || "";

    els.preview.append(box, t, m);
  }

  const left = (item.todo || []).length;
  els.hint.textContent = left
    ? `Осталось заполнить: ${item.todo.join("; ")}`
    : "Ссылка на сайте: " + (tab === "lab" ? `lab.html` : `case.html?p=${item.slug || ""}`);
}

/* --- Запуск ------------------------------------------------------------------ */

document.querySelectorAll(".ad-tab").forEach((b) => {
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

probeServer().then(() => loadTab("lab"));

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
