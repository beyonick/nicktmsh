<?php
/* Вход в админку на хостинге.

   .htaccess отправляет сюда /admin: без сессии страница показывает форму
   пароля, с сессией — отдаёт admin.html. Прямой адрес /admin.html
   .htaccess переводит на /admin, так что мимо входа не пройти.

   Пароля в репозитории нет: deploy-hosting.sh берёт его из секрета
   ADMIN_PASSWORD и кладёт на хостинг admin-auth.php с солью и хэшем
   PBKDF2. Нет файла — вход закрыт для всех.

   Локально (tools/dev-server.py) этот файл не участвует: админка
   открывается сразу. */

declare(strict_types=1);

const LIMIT = 5; // неудачных попыток
const WINDOW = 900; // за 15 минут — потом ждать

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');

// Сессии — в своей папке рядом с сайтом, а не в общей /tmp хостинга:
// там их чистит сборщик мусора соседей, и выкидывало бы через 24 минуты.
$sessions = dirname(__DIR__) . '/.admin-sessions';
if (is_dir($sessions) || @mkdir($sessions, 0700)) {
    session_save_path($sessions);
}
ini_set('session.gc_maxlifetime', (string) (30 * 86400));
session_name('nicktmsh_admin');
session_set_cookie_params([
    'lifetime' => 30 * 86400,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: /admin', true, 303);
    exit;
}

if (!empty($_SESSION['admin'])) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/admin.html');
    exit;
}

/* Счётчик неудач по IP — файлом, базы на хостинге нет. */
function attempts_file(): string
{
    return sys_get_temp_dir() . '/nicktmsh-admin-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '') . '.json';
}

function attempts(): array
{
    $raw = @file_get_contents(attempts_file());
    $a = $raw ? json_decode($raw, true) : null;
    if (!is_array($a) || time() - ($a['since'] ?? 0) > WINDOW) {
        return ['count' => 0, 'since' => time()];
    }
    return $a;
}

$auth = is_file(__DIR__ . '/admin-auth.php') ? require __DIR__ . '/admin-auth.php' : null;
$error = '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $a = attempts();
    if (!is_array($auth)) {
        $error = 'Пароль на сервере не задан — добавь секрет ADMIN_PASSWORD в GitHub и перевыложи сайт.';
    } elseif ($a['count'] >= LIMIT) {
        $error = 'Слишком много попыток. Попробуй через 15 минут.';
    } else {
        $password = (string) ($_POST['password'] ?? '');
        $hash = hash_pbkdf2('sha256', $password, hex2bin($auth['salt']), (int) $auth['iterations'], 64);
        if (hash_equals($auth['hash'], $hash)) {
            @unlink(attempts_file());
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            header('Location: /admin', true, 303);
            exit;
        }
        $a['count']++;
        @file_put_contents(attempts_file(), json_encode($a), LOCK_EX);
        sleep(1);
        $error = 'Неверный пароль.';
    }
}

header('Content-Type: text/html; charset=utf-8');
?><!doctype html>
<html lang="ru" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>вход — nicktmsh</title>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/favicon-32.png">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/admin.css">
</head>
<body class="admin cms-login">

<form class="cms-login__box" method="post" action="/admin" autocomplete="on">
  <p class="cms-login__head">
    <a class="cms-mark" href="/">nicktmsh</a>
    <span class="cms-dot" aria-hidden="true">/</span>
    <span class="cms-where">admin</span>
  </p>
  <label class="cms-row">
    <span class="cms-label">Пароль</span>
    <input class="cms-input" name="password" type="password" autocomplete="current-password" required autofocus>
  </label>
  <?php if ($error): ?>
  <p class="cms-status" data-kind="err" role="alert"><?= htmlspecialchars($error, ENT_QUOTES) ?></p>
  <?php endif; ?>
  <button class="cms-btn cms-btn--go" type="submit">Войти</button>
</form>

</body>
</html>
