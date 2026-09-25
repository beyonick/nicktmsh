#!/usr/bin/env bash
# Собирает сайт в _deploy/ с .htaccess для Apache и заливает на хостинг. Без --upload только собирает.
# Переменные для заливки: HOSTING_PROTOCOL (sftp|ftp), HOSTING_HOST, HOSTING_USER, HOSTING_PASSWORD, HOSTING_DIR.
set -euo pipefail
cd "$(dirname "$0")/.."

bash .github/deploy-selectel.sh
OUT=_deploy
PY=${PYTHON:-python3}

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

# Главный адрес — без www.
RewriteCond %{{HTTP_HOST}} ^www\\.(.+)$ [NC]
RewriteRule ^ https://%1%{{REQUEST_URI}} [R=301,L]

# Короткие ссылки.
{redirects}

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
