/* Первый экран: выворотка типа под чернильным следом курсора.
   Ср. референс из видео и прототип 02 Сайт/hero-lab.html, откуда взята
   математика метаболов и аберрации; здесь она доведена до продакшена.

   Как это устроено
   ----------------
   Весь первый экран рисует один WebGL-холст. Разметка остаётся на месте:
   h1 и подпись живут в DOM ради поиска, выделения и скринридера, но
   набраны прозрачным (color: transparent) — видимые глифы кладёт холст.
   Поэтому вёрстка держит вертикаль сама, а шейдеру достаётся только
   картинка текста и её позиция.

   Текст уходит в шейдер отдельной текстурой: имя в канал R, подпись — в G.
   Текстура заливается с UNPACK_PREMULTIPLY_ALPHA, поэтому в канале лежит
   ровно покрытие пикселя, а не 1.0 на любом полупрозрачном крае, и
   антиалиасинг букв не даёт кайму.

   Клякса — метаболы: сумма r²/d² по шарам следа. Два близких шара дают
   поле выше порога и сливаются одной формой с перемычкой, одинокий шар
   остаётся каплей. Маска берётся трижды с горизонтальным сдвигом — отсюда
   цветная кайма по краю, как в референсе.

   Выворотка: снаружи кляксы тип набран --fg по --bg; внутри — клякса
   кладётся акцентом, а тип на ней становится --bg. Одна и та же маска
   переворачивает и фон, и букву, поэтому эффект читается как проворот
   материала, а не как подсветка.

   Клякса не заходит под шапку: голова следа прижата ниже линейки, и
   радиус гаснет у верхней кромки. Шапка набрана акцентом, и акцентная
   клякса под ней съела бы навигацию. */

(function () {
  "use strict";

  const hero = document.querySelector("[data-ink]");
  if (!hero) return;

  const name = hero.querySelector(".hero__name");
  const sub = hero.querySelector(".hero__sub");
  if (!name) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return; // без движения эффект смысла не имеет — остаётся обычный текст

  const canvas = document.createElement("canvas");
  canvas.className = "hero__ink";
  canvas.setAttribute("aria-hidden", "true");

  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return; // нет WebGL — страница остаётся обычным текстом, и это нормально

  hero.prepend(canvas);
  hero.classList.add("is-ink");

  /* --- Параметры -----------------------------------------------------------
     Значения подобраны на прототипе. Радиус и сила параллакса считаются от
     ширины окна, а не в пикселях: на 2560 клякса должна остаться такой же
     долей экрана, как на 1200. */
  const P = {
    // Радиус одного шара, а не всей кляксы. Шары следа складываются полем,
    // поэтому видимая форма выходит примерно втрое крупнее: 0.045 ширины
    // на шар дают пятно около трети ширины имени — как в референсе.
    blobR: 0.045,
    blobTrail: 18, // сколько шаров следа участвует
    blobEase: 0.09, // как быстро голова догоняет курсор
    textPower: 0.022, // амплитуда параллакса текста в долях ширины
    textEase: 0.06,
    aberr: 3, // сдвиг каналов маски, px макета: кайма должна читаться
    //          как кайма, а не как радуга по всему краю
    wobble: 0.32, // расхождение шаров, доля радиуса — ломает ровный круг
  };

  const MAXB = 32;

  /* --- Шейдеры ------------------------------------------------------------- */

  const VS = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FS = `
precision highp float;

uniform vec2      uRes;
uniform vec3      uBalls[${MAXB}];   // xy — центр в пикселях холста, z — радиус
uniform int       uCount;
uniform sampler2D uText;
uniform vec2      uTextOff;
uniform float     uAberr;
uniform vec3      uBg;
uniform vec3      uFg;
uniform vec3      uAccent;

float field(vec2 p){
  float s = 0.0;
  for(int i = 0; i < ${MAXB}; i++){
    if(i >= uCount) break;
    vec2  d = p - uBalls[i].xy;
    float r = uBalls[i].z;
    s += (r * r) / (dot(d, d) + 1.0);
  }
  return s;
}

// Порог 1.0. Полоса сглаживания узкая: широкая превращает край чернил в
// размытое пятно, а в референсе край жёсткий, и вся мягкость приходится
// на цветную кайму от аберрации, а не на сам силуэт.
float mask(vec2 p){ return smoothstep(0.97, 1.03, field(p)); }

void main(){
  vec2 p = gl_FragCoord.xy;
  vec2 a = vec2(uAberr, 0.0);

  // Маска считается трижды со сдвигом — цветная кайма по краю кляксы.
  vec3 m = vec3(mask(p + a), mask(p), mask(p - a));

  vec2 uv = (p - uTextOff) / uRes;
  uv.y = 1.0 - uv.y;
  vec4 t = texture2D(uText, uv);   // r — покрытие имени, g — покрытие подписи

  vec3 ground = mix(uBg, uAccent, m);       // холст + чернила кляксы
  vec3 glyph  = mix(uFg, uBg, m);           // имя: снаружи --fg, внутри --bg
  vec3 caption = mix(uAccent, uBg, m);      // подпись: снаружи акцент, внутри --bg

  vec3 col = ground;
  col = mix(col, caption, t.g);
  col = mix(col, glyph,   t.r);

  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) {
    canvas.remove();
    hero.classList.remove("is-ink");
    return;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(prog, n);
  const uRes = U("uRes"),
    uBalls = U("uBalls[0]"),
    uCount = U("uCount"),
    uTextOff = U("uTextOff"),
    uAberr = U("uAberr"),
    uBg = U("uBg"),
    uFg = U("uFg"),
    uAccent = U("uAccent");

  gl.uniform1i(U("uText"), 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  /* --- Текстура текста -----------------------------------------------------
     Глифы снимаются с живой вёрстки: кегль, семейство, трекинг и центр
     строки читаются у самого элемента. Поэтому холст не расходится с
     макетом при смене --u, а правка типографики в CSS не требует правки
     здесь. Имя пишется в канал R, подпись — в G. */

  const textCanvas = document.createElement("canvas");
  const tctx = textCanvas.getContext("2d");

  function paintLayer(el, channel, frame) {
    if (!el) return;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();

    tctx.fillStyle = channel;
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // letterSpacing есть не везде; без него ширина строки чуть другая, но
    // DOM-копия прозрачна, поэтому расхождение нигде не проявляется.
    if ("letterSpacing" in tctx) tctx.letterSpacing = cs.letterSpacing;

    const x = box.left - frame.left + box.width / 2;
    const y = box.top - frame.top + box.height / 2;
    tctx.fillText(el.textContent.trim(), x, y);
  }

  let dpr = 1;
  // Кадр рисования — сам холст, а не секция: холст шире колонки контента
  // (клякса обязана уходить за поля), и если считать координаты по секции,
  // картинка растянется на разницу и размылит и кляксу, и глифы.
  let frame = { left: 0, top: 0, width: 1, height: 1 };

  function uploadText() {
    const w = frame.width;
    const h = frame.height;
    textCanvas.width = Math.max(1, Math.round(w * dpr));
    textCanvas.height = Math.max(1, Math.round(h * dpr));
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);

    paintLayer(name, "#f00", frame);
    paintLayer(sub, "#0f0", frame);

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  }

  /* --- Палитра -------------------------------------------------------------
     Цвета берутся у самой страницы, а не дублируются числами: тема
     переключается атрибутом data-theme, и шейдер обязан следовать за ней. */

  function readColor(prop) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    const probe = document.createElement("span");
    probe.style.color = raw || "#000";
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0];
    probe.remove();
    return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
  }

  let palette = { bg: [0, 0, 0], fg: [1, 1, 1], accent: [0.7, 1, 0.5] };

  function readPalette() {
    palette = {
      bg: readColor("--bg"),
      fg: readColor("--fg"),
      accent: readColor("--accent"),
    };
  }

  /* --- Курсор и след -------------------------------------------------------
     Голова следа догоняет курсор с инерцией, хвост тянется за головой.
     Когда мышь стоит, голова уходит в медленную восьмёрку — сцена не
     замирает, но и не требует внимания. */

  const pointer = { x: 0, y: 0, inside: false };
  const head = { x: 0, y: 0 };
  const textCur = { x: 0, y: 0 };
  const trail = [];
  const balls = new Float32Array(MAXB * 3);
  let idle = 0;
  let navGuard = 0; // ниже какой отметки держим голову, px

  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 2);

    const box = canvas.getBoundingClientRect();
    frame = { left: box.left, top: box.top, width: box.width, height: box.height };

    const w = frame.width;
    const h = frame.height;

    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);

    // Шапка набрана акцентом, и акцентная клякса под ней съела бы
    // навигацию. Голова следа держится ниже линейки.
    const nav = document.querySelector(".nav");
    navGuard = nav ? nav.getBoundingClientRect().bottom - frame.top + w * P.blobR : 0;

    if (!pointer.inside) {
      pointer.x = w * 0.5;
      pointer.y = Math.max(h * 0.58, navGuard);
      head.x = pointer.x;
      head.y = pointer.y;
    }

    readPalette();
    uploadText();
  }

  addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX - frame.left;
      pointer.y = e.clientY - frame.top;
      pointer.inside = true;
      idle = 0;
    },
    { passive: true }
  );

  let last = performance.now();
  let start = last;

  function tick(now) {
    const t = (now - start) / 1000;
    const dt = Math.min(now - last, 100) / 1000;
    last = now;
    idle += 1;

    const w = frame.width;
    const h = frame.height;

    // Мышь стоит — медленная восьмёрка, чтобы первый экран не выглядел
    // картинкой. Амплитуда набирается плавно, а не включается рывком.
    let mx = pointer.x;
    let my = pointer.y;
    if (idle > 110) {
      const k = Math.min((idle - 110) / 90, 1);
      mx += Math.sin(t * 0.45) * w * 0.2 * k;
      my += Math.sin(t * 0.31) * h * 0.22 * k;
    }

    // Голова держится внутри холста: вверху её ограничивает шапка, внизу —
    // край секции. Обрезанный краем шар читается как ошибка отрисовки.
    my = Math.max(my, navGuard);
    my = Math.min(my, h - w * P.blobR);

    head.x += (mx - head.x) * P.blobEase;
    head.y += (my - head.y) * P.blobEase;

    trail.unshift({ x: head.x, y: head.y });
    if (trail.length > MAXB) trail.length = MAXB;

    const radius = w * P.blobR;
    const n = Math.min(P.blobTrail, trail.length);
    for (let i = 0; i < n; i++) {
      const f = i / Math.max(n - 1, 1);
      const p = trail[i];
      // Радиус гаснет к хвосту, слегка дышит и досушивается у обеих
      // горизонтальных кромок — иначе шар срезался бы краем холста прямой.
      const near = Math.min(p.y - navGuard * 0.5, h - p.y);
      const fade = Math.min(1, Math.max(0, near / (radius * 2.2)));

      // Когда курсор стоит, все шары следа сходятся в одну точку и поле
      // даёт ровный круг. Расхождение по медленным синусам с разной фазой
      // возвращает силуэту неровность, не превращая его в кашу.
      const wob = radius * P.wobble;
      const ox = Math.sin(t * 0.7 + i * 1.7) * wob;
      const oy = Math.cos(t * 0.9 + i * 2.3) * wob;

      balls[i * 3] = (p.x + ox) * dpr;
      balls[i * 3 + 1] = (h - p.y + oy) * dpr;
      balls[i * 3 + 2] =
        radius * (1 - f * 0.82) * (1 + Math.sin(t * 2 + i * 0.5) * 0.06) * fade * dpr;
    }

    // Параллакс текста: только сдвиг, без наклона. Наклон на дисплейном
    // кегле читается как дефект рендера, сдвиг — как глубина.
    const nx = w ? (head.x / w) * 2 - 1 : 0;
    const ny = h ? (head.y / h) * 2 - 1 : 0;
    const power = w * P.textPower;
    textCur.x += (nx * power - textCur.x) * P.textEase;
    textCur.y += (ny * power * 0.6 - textCur.y) * P.textEase;

    gl.uniform1i(uCount, n);
    gl.uniform3fv(uBalls, balls);
    gl.uniform2f(uTextOff, textCur.x * dpr, -textCur.y * dpr);
    gl.uniform1f(uAberr, P.aberr * (w / 1200) * dpr);
    gl.uniform3fv(uBg, palette.bg);
    gl.uniform3fv(uFg, palette.fg);
    gl.uniform3fv(uAccent, palette.accent);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (running) requestAnimationFrame(tick);
  }

  /* Первый экран уехал из вида — кадры останавливаются. Иначе шейдер
     греет процессор всю страницу, а показать ему нечего. */
  let running = false;
  function run(on) {
    if (on === running) return;
    running = on;
    if (on) {
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => run(e[0].isIntersecting)).observe(hero);
  } else {
    run(true);
  }

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });

  // Тему переключает атрибут — палитру надо перечитать, а не перезагружать.
  new MutationObserver(readPalette).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  layout();
  run(true);

  // Cy грузится асинхронно: пока его нет, канвас нарисует подменный
  // гротеск и глифы разъедутся. Перерисовываем, когда шрифты готовы.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(layout);
  }
})();
