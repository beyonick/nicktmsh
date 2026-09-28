<?php
/* Заливка медиа из админки в бакет Selectel.

   Админка сжимает ролик в браузере и шлёт сюда PUT с готовым mp4 или
   постером: /admin-media.php?path=lab/<slug>/<файл>. Скрипт пускает только
   того, кто вошёл в /admin (сессия admin-gate.php), и сам подписывает
   запрос в S3 (AWS Signature V4) — ключи бакета в браузер не попадают.

   Ключей в репозитории нет: deploy-hosting.sh берёт их из секретов
   SELECTEL_S3_ACCESS_KEY / SELECTEL_S3_SECRET_KEY и кладёт на хостинг
   media-auth.php. Нет файла — заливка выключена. Локально этот файл не
   участвует: то же самое делает tools/dev-server.py через rclone. */

declare(strict_types=1);

const MAX_BYTES = 60 * 1024 * 1024;
const TYPES = ['mp4' => 'video/mp4', 'webm' => 'video/webm', 'webp' => 'image/webp', 'jpg' => 'image/jpeg', 'png' => 'image/png'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function reply(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Та же папка сессий, что у admin-gate.php, иначе вход здесь не виден.
$sessions = dirname(__DIR__) . '/.admin-sessions';
if (is_dir($sessions)) {
    session_save_path($sessions);
}
session_name('nicktmsh_admin');
session_start(['read_and_close' => true]);
if (empty($_SESSION['admin'])) {
    reply(401, ['ok' => false, 'error' => 'сессия админки закончилась — обнови страницу и войди заново']);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'PUT') {
    reply(405, ['ok' => false, 'error' => 'нужен PUT']);
}

$path = (string) ($_GET['path'] ?? '');
if (!preg_match('~^(lab|work)/[a-z0-9][a-z0-9-]{0,60}/[a-z0-9][a-z0-9._-]{0,80}\.(mp4|webm|webp|jpg|png)$~', $path, $m)) {
    reply(400, ['ok' => false, 'error' => 'недопустимый путь']);
}

$cfg = is_file(__DIR__ . '/media-auth.php') ? require __DIR__ . '/media-auth.php' : null;
if (!is_array($cfg)) {
    reply(503, ['ok' => false, 'error' => 'на хостинге нет ключей Selectel — добавь секреты SELECTEL_S3_ACCESS_KEY и SELECTEL_S3_SECRET_KEY в GitHub и перевыложи сайт']);
}
if (!function_exists('curl_init')) {
    reply(500, ['ok' => false, 'error' => 'на хостинге выключено PHP-расширение curl']);
}

$body = file_get_contents('php://input');
if ($body === false || $body === '') {
    reply(400, ['ok' => false, 'error' => 'пустой файл']);
}
if (strlen($body) > MAX_BYTES) {
    reply(413, ['ok' => false, 'error' => 'файл больше 60 МБ — сожми сильнее']);
}

/* AWS Signature V4, путь в стиле s3.<region>…/<bucket>/<key>. Символы пути
   ограничены регуляркой выше, поэтому кодировать ключ не нужно. */
function sign(array $cfg, string $method, string $uri, array $headers, string $payloadHash, string $now): string
{
    $day = substr($now, 0, 8);
    ksort($headers);
    $canonical = '';
    foreach ($headers as $k => $v) {
        $canonical .= $k . ':' . trim((string) $v) . "\n";
    }
    $signed = implode(';', array_keys($headers));
    $request = "$method\n$uri\n\n$canonical\n$signed\n$payloadHash";
    $scope = "$day/{$cfg['region']}/s3/aws4_request";
    $toSign = "AWS4-HMAC-SHA256\n$now\n$scope\n" . hash('sha256', $request);

    $key = hash_hmac('sha256', $day, 'AWS4' . $cfg['secret'], true);
    $key = hash_hmac('sha256', $cfg['region'], $key, true);
    $key = hash_hmac('sha256', 's3', $key, true);
    $key = hash_hmac('sha256', 'aws4_request', $key, true);
    $signature = hash_hmac('sha256', $toSign, $key);

    return "AWS4-HMAC-SHA256 Credential={$cfg['key']}/$scope, SignedHeaders=$signed, Signature=$signature";
}

$now = gmdate('Ymd\THis\Z');
$hash = hash('sha256', $body);
$uri = '/' . $cfg['bucket'] . '/' . $cfg['prefix'] . $path;
$headers = [
    'cache-control' => 'public, max-age=31536000',
    'content-type' => TYPES[$m[2]],
    'host' => $cfg['endpoint'],
    'x-amz-content-sha256' => $hash,
    'x-amz-date' => $now,
];
$auth = sign($cfg, 'PUT', $uri, $headers, $hash, $now);

$send = [];
foreach ($headers as $k => $v) {
    if ($k !== 'host') {
        $send[] = "$k: $v";
    }
}
$send[] = "authorization: $auth";

$ch = curl_init("https://{$cfg['endpoint']}$uri");
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'PUT',
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => $send,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT => 300,
]);
$answer = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($answer === false) {
    reply(502, ['ok' => false, 'error' => "нет связи с Selectel: $error"]);
}
if ($code < 200 || $code >= 300) {
    preg_match('~<Code>([^<]+)</Code>~', (string) $answer, $e);
    reply(502, ['ok' => false, 'error' => "Selectel ответил $code" . ($e ? " ({$e[1]})" : '')]);
}
reply(200, ['ok' => true, 'path' => $path]);
