/* Облачный режим админки: запись прямо в репозиторий на GitHub.

   Сервер для этого не нужен. Панель — обычная страница на том же
   хостинге, что и сайт; «Сохранить» собирает все правки (json и новые
   файлы) в один коммит через GitHub API, а дальше workflow
   deploy-selectel.yml выкладывает сайт, как после любого пуша в main.

   Доступ — личный fine-grained токен GitHub, выпущенный на один
   репозиторий с правом Contents: read and write (и, по желанию,
   Actions: read — тогда панель покажет, что сайт обновился). Токен
   хранится только в localStorage этого браузера и уходит только на
   api.github.com. Ни у кого из нас нет общего сервера или ключа:
   у каждого сайта свой репозиторий, у каждого редактора свой токен. */

const KEY = "nicktmsh:github";
const API = "https://api.github.com";

export function getConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    return c && c.repo && c.token ? c : null;
  } catch {
    return null;
  }
}

export function setConfig(c) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    // без localStorage токен живёт до перезагрузки вкладки
  }
}

async function gh(cfg, path, opts = {}) {
  const r = await fetch(`${API}/repos/${cfg.repo}${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(explain(r.status, j.message));
    e.status = r.status;
    throw e;
  }
  return j;
}

function explain(code, message) {
  if (code === 401) return "токен не подходит или истёк";
  if (code === 403) return "у токена нет права на запись (Contents: read and write)";
  if (code === 404) return "репозиторий или ветка не найдены — либо токен выпущен не на этот репозиторий";
  if (code === 409 || code === 422) return "ветку только что обновили — сохрани ещё раз";
  return `${code} ${message || ""}`.trim();
}

/* Проверка при подключении: видим ли репозиторий и можем ли писать. */
export async function check(cfg) {
  const repo = await gh(cfg, "");
  if (!repo.permissions || !repo.permissions.push) {
    throw new Error("токен видит репозиторий, но писать в него не может");
  }
  const branch = cfg.branch || repo.default_branch;
  await gh(cfg, `/branches/${encodeURIComponent(branch)}`);
  return { ...cfg, branch };
}

/* Свежая версия json прямо из репозитория, а не с хостинга: сайт
   выкладывается с задержкой в минуту, и чужая правка, сделанная только
   что, на хостинге ещё не видна. */
export async function readJson(cfg, path) {
  const j = await gh(cfg, `/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`);
  const bin = atob(j.content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1]);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

/* Один коммит на всё сохранение: json и файлы появляются в репозитории
   одновременно, и сайт никогда не ссылается на постер, которого ещё нет.
   files — [{ path, text }] или [{ path, blob }]. */
export async function commit(cfg, files, message) {
  const ref = await gh(cfg, `/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
  const parent = ref.object.sha;
  const head = await gh(cfg, `/git/commits/${parent}`);

  const tree = [];
  for (const f of files) {
    const blob = f.blob
      ? await gh(cfg, "/git/blobs", {
          method: "POST",
          body: JSON.stringify({ content: await toBase64(f.blob), encoding: "base64" }),
        })
      : await gh(cfg, "/git/blobs", {
          method: "POST",
          body: JSON.stringify({ content: f.text, encoding: "utf-8" }),
        });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const t = await gh(cfg, "/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: head.tree.sha, tree }),
  });
  const c = await gh(cfg, "/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: t.sha, parents: [parent] }),
  });
  // force: false — если кто-то успел закоммитить между чтением и записью,
  // GitHub откажет, и чужая правка не пропадёт.
  await gh(cfg, `/git/refs/heads/${encodeURIComponent(cfg.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: c.sha, force: false }),
  });
  return c.sha;
}

/* Состояние выкладки после коммита. Нужен Actions: read; без него
   возвращаем null, и панель просто не показывает прогресс. */
export async function deployState(cfg, sha) {
  try {
    const j = await gh(cfg, `/actions/runs?head_sha=${sha}&per_page=5`);
    const run = (j.workflow_runs || [])[0];
    if (!run) return { state: "queued" };
    if (run.status !== "completed") return { state: "running", url: run.html_url };
    return { state: run.conclusion === "success" ? "done" : "failed", url: run.html_url };
  } catch (e) {
    return e.status === 403 || e.status === 404 ? null : { state: "unknown" };
  }
}
