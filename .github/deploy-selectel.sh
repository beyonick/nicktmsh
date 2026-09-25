#!/usr/bin/env bash
# Собирает сайт в _deploy/ и заливает в бакет Selectel. Без --upload только собирает.
# Переменные для заливки: BUCKET, S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=_deploy
CLEAN=_deploy_clean
PY=${PYTHON:-python3}
rm -rf "$OUT" "$CLEAN"
mkdir -p "$OUT" "$CLEAN"

# Админка живёт только на 127.0.0.1, в прод не идёт.
git ls-files -z \
  | grep -zvE '^(\.github/|\.gitignore$|vercel\.json$|admin\.html$|js/admin\.js$|css/admin\.css$|data/README\.md$)' \
  | xargs -0 cp --parents -t "$OUT"

# У хранилища нет cleanUrls и redirects, как у Vercel: адреса без .html
# (/work, /mts, ...) кладём отдельными объектами с типом text/html.
"$PY" - "$OUT" "$CLEAN" <<'PY'
import html, json, pathlib, sys
out, clean = map(pathlib.Path, sys.argv[1:3])
for page in out.glob("*.html"):
    if page.name not in ("index.html", "404.html"):
        (clean / page.stem).write_bytes(page.read_bytes())
for r in json.loads(pathlib.Path("vercel.json").read_text("utf-8"))["redirects"]:
    to = html.escape(r["destination"], quote=True)
    (clean / r["source"].strip("/")).write_text(
        '<!doctype html><meta charset="utf-8"><title>nicktmsh</title>'
        '<meta name="robots" content="noindex">'
        f'<link rel="canonical" href="{to}">'
        f'<meta http-equiv="refresh" content="0;url={to}">'
        f'<script>location.replace({json.dumps(r["destination"])})</script>'
        f'<a href="{to}">{to}</a>\n', "utf-8")
PY

echo "built: $(find "$OUT" -type f | wc -l) files, clean urls: $(ls "$CLEAN" | tr '\n' ' ')"
[[ "${1:-}" == "--upload" ]] || exit 0

fail() { echo "::error::$*"; exit 1; }
[[ -n "${BUCKET:-}" ]] || fail "SELECTEL_BUCKET пуст: нужна Repository variable, не Environment"
[[ -n "${AWS_ACCESS_KEY_ID:-}" ]] || fail "секрет SELECTEL_S3_ACCESS_KEY пуст или не виден"
[[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]] || fail "секрет SELECTEL_S3_SECRET_KEY пуст или не виден"
echo "bucket=$BUCKET endpoint=$S3_ENDPOINT region=${AWS_DEFAULT_REGION:-} key_len=${#AWS_ACCESS_KEY_ID}/${#AWS_SECRET_ACCESS_KEY}"
s3() { aws s3 --endpoint-url "$S3_ENDPOINT" "$@"; }
if ! err=$(s3 ls "s3://$BUCKET" 2>&1 >/dev/null); then
  fail "нет доступа к бакету $BUCKET ($S3_ENDPOINT): $(echo "$err" | tr '\n' ' ')"
fi

KEEP=()
for f in "$CLEAN"/*; do KEEP+=(--exclude "$(basename "$f")"); done

# Шрифты, картинки, иконки — на сутки; html/css/js/json — всегда свежие.
s3 sync "$OUT" "s3://$BUCKET" --delete --cache-control "public, max-age=86400" \
  --exclude "*.html" --exclude "*.css" --exclude "*.js" --exclude "*.json" "${KEEP[@]}"
s3 sync "$OUT" "s3://$BUCKET" --delete --cache-control "no-cache" \
  --exclude "*" --include "*.html" --include "*.css" --include "*.js" --include "*.json"
for f in "$CLEAN"/*; do
  s3 cp "$f" "s3://$BUCKET/$(basename "$f")" \
    --content-type "text/html; charset=utf-8" --cache-control "no-cache"
done
