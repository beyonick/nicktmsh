#!/usr/bin/env bash
# Собирает сайт в _deploy/ с .htaccess для Apache и заливает на хостинг. Без --upload только собирает.
# Переменные для заливки: HOSTING_PROTOCOL (sftp|ftp), HOSTING_HOST, HOSTING_USER, HOSTING_PASSWORD, HOSTING_DIR.
set -euo pipefail
cd "$(dirname "$0")/.."

bash .github/deploy-selectel.sh
OUT=_deploy
PY=${PYTHON:-python3}

# nginx на Timeweb отдаёт css и js с кэшем на год и заголовки из .htaccess к ним не применяет.
# Поэтому каждая ссылка на css/js получает ?v=<хэш содержимого>: поменялся файл — поменялся адрес.
# У js хэш считается после подстановки версий в его импорты, иначе правка в store.js
# не дошла бы до модулей, которые его импортируют.
"$PY" - "$OUT" <<'PY'
import hashlib, pathlib, re, sys
out = pathlib.Path(sys.argv[1]).resolve()
IMPORT = re.compile(r"""(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}/[^"'?]+\.js)\2""")
LINK = re.compile(r"""\b(href|src)="(/?(?:[\w.-]+/)*[\w.-]+\.(?:css|js))\"""")
done, busy = {}, set()

def version(path):
    """Хэш файла; для js — после переписывания его собственных импортов."""
    if path in done:
        return done[path]
    if path.suffix == ".js" and path not in busy:
        busy.add(path)
        text = path.read_text("utf-8")
        def sub(m):
            dep = (path.parent / m.group(3)).resolve()
            if not dep.is_file():
                return m.group(0)
            return f"{m.group(1)}{m.group(2)}{m.group(3)}?v={version(dep)}{m.group(2)}"
        text = IMPORT.sub(sub, text)
        path.write_text(text, "utf-8")
    done[path] = hashlib.sha1(path.read_bytes()).hexdigest()[:10]
    return done[path]

pages = 0
for page in [*out.glob("*.html"), *out.glob("*.php")]:
    text = page.read_text("utf-8")
    def sub(m):
        target = out / m.group(2).lstrip("/")
        if not target.is_file():
            return m.group(0)
        return f'{m.group(1)}="{m.group(2)}?v={version(target.resolve())}"'
    page.write_text(LINK.sub(sub, text), "utf-8")
    pages += 1
print(f"cache-bust: {pages} pages, {len(done)} files versioned")
PY

# То, что на Vercel делали cleanUrls и redirects из vercel.json, здесь делает Apache.
"$PY" - "$OUT" <<'PY'
import json, pathlib, re, sys
out = pathlib.Path(sys.argv[1])
redirects = "\n".join(
    f"RewriteRule ^{re.escape(r['source'].strip('/'))}/?$ {r['destination']} [R=301,L]"
    for r in json.loads(pathlib.Path("vercel.json").read_text("utf-8"))["redirects"]
)
(out / ".htaccess").write_text(f"""Options -Indexes -MultiViews
DirectoryIndex index.html
ErrorDocument 404 /404.html
AddType font/woff2 .woff2

RewriteEngine On

# Проверка Let's Encrypt должна дойти до хостинга, иначе сертификат не выпустится.
RewriteRule ^\\.well-known/acme-challenge/ - [L]

# .ru — служебный домен под превью клиентских сайтов, портфолио живёт на .com.
# Правило выше www-редиректа, чтобы www.nicktmsh.ru уезжал за один переход, а не за два.
RewriteCond %{{HTTP_HOST}} ^(www\\.)?nicktmsh\\.ru$ [NC]
RewriteRule ^ https://nicktmsh.com%{{REQUEST_URI}} [R=301,L]

# Главный адрес — без www.
RewriteCond %{{HTTP_HOST}} ^www\\.(.+)$ [NC]
RewriteRule ^ https://%1%{{REQUEST_URI}} [R=301,L]

# Короткие ссылки.
{redirects}

# Адрес с .html — на чистый вариант, это делал cleanUrls на Vercel.
# THE_REQUEST хранит исходный запрос, поэтому внутренняя подмена ниже сюда не возвращается.
RewriteCond %{{THE_REQUEST}} \\s/+(.*/)?index\\.html[?\\s]
RewriteRule ^ /%1 [R=301,L]
RewriteCond %{{THE_REQUEST}} \\s/+([^?\\s]+)\\.html[?\\s]
RewriteRule ^ /%1 [R=301,L]

# /admin/ -> /admin: со слэшем относительные пути к css и js уезжают в /admin/css/… и страница ломается.
RewriteCond %{{REQUEST_FILENAME}} !-d
RewriteCond %{{REQUEST_FILENAME}} ^(.+?)/?$
RewriteCond %1.html -f
RewriteRule ^(.+)/$ /$1 [R=301,L]

# Админка — только после входа: admin-gate.php спрашивает пароль и сам отдаёт admin.html.
# /admin.html сюда не дойдёт: выше его уже увёл на /admin редирект с .html.
RewriteRule ^admin$ /admin-gate.php [L]
RewriteRule ^(admin|media)-auth\\.php$ - [F,L]

# /work -> work.html
RewriteCond %{{REQUEST_FILENAME}} !-f
RewriteCond %{{REQUEST_FILENAME}}.html -f
RewriteRule ^(.+?)/?$ $1.html [L]

# html, css, js и json браузер всегда сверяет с сервером, остальное держит сутки.
<IfModule mod_headers.c>
  <FilesMatch "\\.(html|css|js|json)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\\.(woff2|png|jpe?g|webp|svg|ico)$">
    Header set Cache-Control "public, max-age=86400"
  </FilesMatch>
</IfModule>
""", "utf-8")
PY
echo "htaccess: $(grep -c 'R=301' "$OUT/.htaccess") redirects"

# Пароль админки — из секрета ADMIN_PASSWORD; в репозиторий попадает только этот код,
# на хостинг — соль и хэш PBKDF2. Без секрета файла нет и admin-gate.php никого не пускает.
if [[ -n "${ADMIN_PASSWORD:-}" ]]; then
  "$PY" - "$OUT/admin-auth.php" <<'PY'
import hashlib, os, pathlib, sys
salt, iterations = os.urandom(16), 200_000
digest = hashlib.pbkdf2_hmac("sha256", os.environ["ADMIN_PASSWORD"].encode(), salt, iterations).hex()
pathlib.Path(sys.argv[1]).write_text(
    f"<?php return ['salt' => '{salt.hex()}', 'iterations' => {iterations}, 'hash' => '{digest}'];\n", "utf-8")
PY
  echo "admin: пароль задан"
else
  echo "::warning::секрет ADMIN_PASSWORD пуст — вход в /admin закрыт для всех"
fi

# Ключи бакета медиа для admin-media.php: админка заливает сжатые ролики в Selectel через него.
if [[ -n "${MEDIA_S3_ACCESS_KEY:-}" && -n "${MEDIA_S3_SECRET_KEY:-}" ]]; then
  "$PY" - "$OUT/media-auth.php" <<'PY'
import os, pathlib, sys
q = lambda s: "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"
cfg = {
    "key": os.environ["MEDIA_S3_ACCESS_KEY"],
    "secret": os.environ["MEDIA_S3_SECRET_KEY"],
    "bucket": os.environ.get("MEDIA_BUCKET") or "websites-media",
    "prefix": os.environ.get("MEDIA_PREFIX") or "nicktmsh/",
    "endpoint": os.environ.get("MEDIA_S3_ENDPOINT") or "s3.ru-7.storage.selcloud.ru",
    "region": os.environ.get("MEDIA_S3_REGION") or "ru-7",
}
pathlib.Path(sys.argv[1]).write_text(
    "<?php return [" + ", ".join(f"{q(k)} => {q(v)}" for k, v in cfg.items()) + "];\n", "utf-8")
PY
  echo "media: ключи Selectel заданы"
else
  echo "::warning::секреты SELECTEL_S3_* пусты — заливка видео из админки выключена"
fi
[[ "${1:-}" == "--upload" ]] || exit 0

if [[ -z "${HOSTING_HOST:-}" ]]; then
  echo "::warning::HOSTING_HOST не задан — выкладка на хостинг пропущена"
  exit 0
fi
fail() { echo "::error::$*"; exit 1; }
[[ -n "${HOSTING_USER:-}" ]] || fail "переменная HOSTING_USER пуста"
[[ -n "${HOSTING_PASSWORD:-}" ]] || fail "секрет HOSTING_PASSWORD пуст или не виден"
[[ -n "${HOSTING_DIR:-}" ]] || fail "переменная HOSTING_DIR пуста"
echo "target=${HOSTING_PROTOCOL}://${HOSTING_HOST}/${HOSTING_DIR}"

# .well-known и cgi-bin создаёт сам хостинг: --delete не должен их трогать.
LFTP_PASSWORD="$HOSTING_PASSWORD" lftp --env-password -u "$HOSTING_USER" "${HOSTING_PROTOCOL}://${HOSTING_HOST}" -e "
  set cmd:fail-exit yes
  set net:max-retries 3
  set net:timeout 20
  set sftp:auto-confirm yes
  set ftp:ssl-allow yes
  mirror --reverse --delete --verbose --parallel=4 \
    --exclude-glob .well-known/ --exclude-glob cgi-bin/ \
    $OUT/ $HOSTING_DIR/
  quit
" || fail "заливка на ${HOSTING_HOST} не удалась, подробности в логе шага"
