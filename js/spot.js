/* Чернила в сетке проектов — одна жидкость на всю сетку (реф: buttermax.net,
   сетка работ).

   Курсор тащит за собой краску: она течёт, закручивается кольцами, рвётся
   на брызги и медленно тает. Край жёсткий — это не дым и не размытое
   пятно, а порог по плотности краски: где её больше половины, там чернила,
   где меньше — нет ничего.

   Жидкость одна, а цвет у неё свой в каждой ячейке: у проекта с цветом
   бренда (color в projects.json) — бренд, у остальных — лайм и фиолет
   шахматкой. Поэтому след, перетекая через рамку, меняет цвет ровно по
   линии сетки.

   Внутри — классическая stable fluids (Stam) на WebGL2 в текстурах
   половинной точности: скорость, давление, завихрённость, краска. Скорость
   считается на грубой сетке, краска — на тонкой, а край выводится по
   fwidth, поэтому он чёткий на любом разрешении экрана.

   Холст лежит под рамками ячеек и подписями. Чернила начинаются за рамкой:
   курсор ближе NEAR к сетке уже красит, и краска затекает в ячейку раньше
   него. Кадры идут, пока курсор рядом и ещё несколько секунд после — пока
   краска не растает. Без WebGL2 и float-текстур чернил нет: это украшение
   ховера, а не содержимое. */

/* Параметры. Правятся вживую панелью «ink» (js/ink-panel.js) и хранятся в
   localStorage — это настройка разработчика; здесь стартовые значения. */
export const INK_DEFAULTS = {
  sim: 128, // короткая сторона сетки скоростей, ячеек симуляции
  dye: 0.6, // разрешение краски от CSS-размера сетки
  iters: 20, // итераций давления на кадр
  curl: 26, // завихрённость: кольца и завитки, как в рефе
  velFade: 0.4, // затухание скорости, 1/с
  dyeFade: 0.25, // таяние краски, 1/с: след держится секунды три
  radius: 0.07, // радиус мазка, доля ширины ячейки
  force: 110, // какая доля скорости курсора уходит в жидкость
  flow: 1.5, // сколько краски кладёт стоящий курсор, в секунду
  ink: 1.2, // плотность следа по его оси — одна на любой скорости мыши
  full: 1.5, // потолок плотности: густое тает дольше тонкого
  near: 0.25, // с какого расстояния за рамкой курсор уже красит, доля ячейки
  linger: 6, // сколько секунд сцена живёт после ухода курсора
};
const STORE = "nicktmsh:ink";
export const P = { ...INK_DEFAULTS };
try {
  Object.assign(P, JSON.parse(localStorage.getItem(STORE) || "{}"));
} catch (err) {
  // приватный режим или битое значение — работаем со стартовыми
}
export function setInk(key, value) {
  P[key] = value;
  try {
    localStorage.setItem(STORE, JSON.stringify(P));
  } catch (err) {
    // не сохранили — значение всё равно действует до перезагрузки
  }
}
export function resetInk() {
  Object.assign(P, INK_DEFAULTS);
  try {
    localStorage.removeItem(STORE);
  } catch (err) {
    // нечего чистить
  }
}

const enabled =
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --- Шейдеры ----------------------------------------------------------------- */

const VS = `#version 300 es
in vec2 aPos;
uniform vec2 uTexel;
out vec2 vUv, vL, vR, vT, vB;
void main(){
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 o;
`;

const FS = {
  // Мазок: гауссово пятно в точке курсора — краска или скорость.
  splat: `
uniform sampler2D uTarget;
uniform float uAspect, uRadius, uMax;
uniform vec2 uPoint;
uniform vec3 uValue;
void main(){
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 v = texture(uTarget, vUv).xyz + exp(-dot(p, p) / uRadius) * uValue;
  o = vec4(clamp(v, -uMax, uMax), 1.0);
}`,
  // Перенос полем скорости: значение берётся оттуда, откуда его принесло.
  advect: `
uniform sampler2D uVelocity, uSource;
uniform vec2 uVelTexel;
uniform float uDt, uFade;
void main(){
  vec2 c = vUv - uDt * texture(uVelocity, vUv).xy * uVelTexel;
  o = texture(uSource, c) / (1.0 + uFade * uDt);
}`,
  divergence: `
uniform sampler2D uVelocity;
void main(){
  vec2 C = texture(uVelocity, vUv).xy;
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  // Стенки по краям сетки: жидкость отражается, а не утекает.
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  curl: `
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
  // Подкачка завихрённости: без неё след просто размазывается, с ней —
  // закручивается кольцами, как чернила в воде.
  vorticity: `
uniform sampler2D uVelocity, uCurl;
uniform float uCurlK, uDt;
void main(){
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uCurlK * C;
  f.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + f * uDt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
  pressure: `
uniform sampler2D uPressure, uDivergence;
void main(){
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float d = texture(uDivergence, vUv).x;
  o = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: `
uniform sampler2D uPressure, uVelocity;
void main(){
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  o = vec4(v, 0.0, 1.0);
}`,
  scale: `
uniform sampler2D uTarget;
uniform float uK;
void main(){ o = uK * texture(uTarget, vUv); }`,
  // Вывод: порог по краске, ширина перехода — один пиксель экрана.
  // Цвет берётся из карты ячеек: альфа карты — 1 внутри ячейки, 0 на
  // полях вокруг сетки, поэтому за рамкой чернил не видно.
  display: `
uniform sampler2D uDye, uCells;
void main(){
  float d = texture(uDye, vUv).x;
  float w = fwidth(d) * 0.75 + 1e-4;
  float m = smoothstep(0.5 - w, 0.5 + w, d);
  vec4 cell = texture(uCells, vUv);
  float a = m * cell.a;
  o = vec4(cell.rgb * a, a);
}`,
};

/* --- Одна сетка -------------------------------------------------------------- */

function mount(host) {
  const canvas = document.createElement("canvas");
  canvas.className = "work__ink";
  canvas.setAttribute("aria-hidden", "true");

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VS);
  if (!vs) return null;

  const prog = {};
  for (const [name, src] of Object.entries(FS)) {
    const fs = compile(gl.FRAGMENT_SHADER, HEAD + src);
    if (!fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      return null;
    }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const un = gl.getActiveUniform(p, i).name;
      u[un] = gl.getUniformLocation(p, un);
    }
    prog[name] = { p, u };
  }

  // Один полноэкранный треугольник на все проходы.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);

  /* Текстуры-мишени. Скорость — два канала, остальное — один. */
  const target = (w, h, ifmt, fmt, filter) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h, texel: [1 / w, 1 / h] };
  };
  const pair = (w, h, ifmt, fmt, filter) => {
    let a = target(w, h, ifmt, fmt, filter);
    let b = target(w, h, ifmt, fmt, filter);
    return {
      get read() { return a; },
      get write() { return b; },
      swap() { [a, b] = [b, a]; },
      texel: a.texel,
    };
  };
  const drop = (t) => {
    if (!t) return;
    for (const x of "read" in t ? [t.read, t.write] : [t]) {
      gl.deleteTexture(x.tex);
      gl.deleteFramebuffer(x.fbo);
    }
  };

  let vel, dye, pressure, divergence, curl;
  let W = 1;
  let H = 1;
  let cellW = 1;
  let dpr = 1;

  const use = (name) => {
    gl.useProgram(prog[name].p);
    return prog[name].u;
  };
  const bind = (unit, t) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    return unit;
  };
  const blit = (t) => {
    if (t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* --- Карта ячеек ------------------------------------------------------------
     Цвет каждой ячейки рисуется прямоугольником в 2D-холст размером с
     WebGL-холст и уходит в шейдер текстурой без сглаживания: граница цвета
     проходит ровно по краю ячейки, под её рамкой. */

  const cells = { tex: gl.createTexture() };
  gl.bindTexture(gl.TEXTURE_2D, cells.tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const map = document.createElement("canvas");
  const mctx = map.getContext("2d");

  /* Режим «проявления» (data-ink-reveal): вместо цветов ячеек чернила
     берут пиксели картинки. Так фото «обо мне» стоит чёрно-белым, а под
     жидкостью за курсором проступает цветным. */
  const reveal = host.dataset.inkReveal ? new Image() : null;
  if (reveal) {
    reveal.decoding = "async";
    reveal.onload = () => {
      if (canvas.isConnected) {
        paintCells();
        render();
      }
    };
    reveal.src = host.dataset.inkReveal;
  }

  function paintCells() {
    map.width = canvas.width;
    map.height = canvas.height;
    if (reveal) {
      cellW = W;
      mctx.clearRect(0, 0, map.width, map.height);
      if (reveal.complete && reveal.naturalWidth) mctx.drawImage(reveal, 0, 0, map.width, map.height);
      gl.bindTexture(gl.TEXTURE_2D, cells.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return;
    }
    const box = host.getBoundingClientRect();
    const left = box.left + host.clientLeft;
    const top = box.top + host.clientTop;
    const cs = getComputedStyle(host);
    const tones = [cs.getPropertyValue("--accent").trim(), cs.getPropertyValue("--accent-2").trim()];

    mctx.clearRect(0, 0, map.width, map.height);
    for (const card of host.querySelectorAll(".card")) {
      const r = card.getBoundingClientRect();
      cellW = r.width || cellW;
      const col = Math.round((r.left - left) / r.width);
      const row = Math.round((r.top - top) / r.height);
      mctx.fillStyle = card.style.getPropertyValue("--brand") || tones[(col + row) % 2];
      const x0 = Math.round((r.left - left) * dpr);
      const y0 = Math.round((r.top - top) * dpr);
      const x1 = Math.round((r.right - left) * dpr);
      const y1 = Math.round((r.bottom - top) * dpr);
      mctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    gl.bindTexture(gl.TEXTURE_2D, cells.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /* Размер: скорость — P.sim ячеек по короткой стороне, краска — доля
     CSS-размера. Ячейки симуляции квадратные, поэтому скорость в них
     одинакова по обеим осям. */
  function size() {
    W = host.clientWidth || 1;
    H = host.clientHeight || 1;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const k = P.sim / Math.min(W, H);
    const sw = Math.max(8, Math.round(W * k));
    const sh = Math.max(8, Math.round(H * k));
    const dk = Math.min(P.dye, 1024 / Math.max(W, H));

    [vel, dye, pressure, divergence, curl].forEach(drop);
    vel = pair(sw, sh, gl.RG16F, gl.RG, gl.LINEAR);
    pressure = pair(sw, sh, gl.R16F, gl.RED, gl.NEAREST);
    divergence = target(sw, sh, gl.R16F, gl.RED, gl.NEAREST);
    curl = target(sw, sh, gl.R16F, gl.RED, gl.NEAREST);
    dye = pair(Math.round(W * dk), Math.round(H * dk), gl.R16F, gl.RED, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, vel.read.fbo);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) broken = true;

    paintCells();
    render();
  }

  /* --- Шаг жидкости ------------------------------------------------------------ */

  function splat(x, y, vx, vy, amount, R) {
    const aspect = W / H;
    const point = [x / W, 1 - y / H];
    const radius = (R / H) ** 2;

    const u = use("splat");
    gl.uniform2fv(u.uTexel, vel.texel);
    gl.uniform1i(u.uTarget, bind(0, vel.read));
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform2fv(u.uPoint, point);
    gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uMax, 1000);
    gl.uniform3f(u.uValue, vx, vy, 0);
    blit(vel.write);
    vel.swap();

    gl.uniform2fv(u.uTexel, dye.texel);
    gl.uniform1i(u.uTarget, bind(0, dye.read));
    gl.uniform1f(u.uMax, P.full);
    gl.uniform3f(u.uValue, amount, 0, 0);
    blit(dye.write);
    dye.swap();
  }

  function step(dt) {
    let u = use("curl");
    gl.uniform2fv(u.uTexel, vel.texel);
    gl.uniform1i(u.uVelocity, bind(0, vel.read));
    blit(curl);

    u = use("vorticity");
    gl.uniform2fv(u.uTexel, vel.texel);
    gl.uniform1i(u.uVelocity, bind(0, vel.read));
    gl.uniform1i(u.uCurl, bind(1, curl));
    gl.uniform1f(u.uCurlK, P.curl);
    gl.uniform1f(u.uDt, dt);
    blit(vel.write);
    vel.swap();

    u = use("divergence");
    gl.uniform2fv(u.uTexel, vel.texel);
    gl.uniform1i(u.uVelocity, bind(0, vel.read));
    blit(divergence);

    // Давление прошлого кадра — стартовое приближение, чуть ослабленное.
    u = use("scale");
    gl.uniform2fv(u.uTexel, pressure.texel);
    gl.uniform1i(u.uTarget, bind(0, pressure.read));
    gl.uniform1f(u.uK, 0.8);
    blit(pressure.write);
    pressure.swap();

    u = use("pressure");
    gl.uniform2fv(u.uTexel, pressure.texel);
    gl.uniform1i(u.uDivergence, bind(1, divergence));
    for (let i = 0; i < P.iters; i++) {
      gl.uniform1i(u.uPressure, bind(0, pressure.read));
      blit(pressure.write);
      pressure.swap();
    }

    u = use("gradient");
    gl.uniform2fv(u.uTexel, vel.texel);
    gl.uniform1i(u.uPressure, bind(0, pressure.read));
    gl.uniform1i(u.uVelocity, bind(1, vel.read));
    blit(vel.write);
    vel.swap();

    u = use("advect");
    gl.uniform2fv(u.uTexel, vel.texel);
    gl.uniform2fv(u.uVelTexel, vel.texel);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1i(u.uVelocity, bind(0, vel.read));
    gl.uniform1i(u.uSource, bind(0, vel.read));
    gl.uniform1f(u.uFade, P.velFade);
    blit(vel.write);
    vel.swap();

    gl.uniform2fv(u.uTexel, dye.texel);
    gl.uniform1i(u.uVelocity, bind(0, vel.read));
    gl.uniform1i(u.uSource, bind(1, dye.read));
    gl.uniform1f(u.uFade, P.dyeFade);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    const u = use("display");
    gl.uniform2fv(u.uTexel, dye.texel);
    gl.uniform1i(u.uDye, bind(0, dye.read));
    gl.uniform1i(u.uCells, bind(1, cells));
    blit(null);
  }

  function reset() {
    for (const t of [vel.read, vel.write, dye.read, dye.write, pressure.read, pressure.write]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    render();
  }

  /* --- Курсор и кадры ------------------------------------------------------------ */

  const ptr = { x: 0, y: 0, px: 0, py: 0, inside: false };
  let lastInside = 0;
  let visible = false;
  let broken = false;
  let raf = 0;
  let last = 0;

  function frame(now) {
    raf = 0;
    // Метка кадра бывает чуть раньше момента запуска — шаг не бывает меньше
    // четверти миллисекундного кадра и больше 1/30: после паузы жидкость не
    // выстреливает.
    const dt = Math.min(Math.max((now - last) / 1000, 1 / 240), 1 / 30);
    last = now;

    if (ptr.inside) {
      lastInside = now;
      // Мазки кладутся по отрезку от прошлой точки: быстрый рывок мыши
      // даёт сплошной след, а не пунктир из пятен.
      const dx = ptr.x - ptr.px;
      const dy = ptr.y - ptr.py;
      const dist = Math.hypot(dx, dy);
      const R = cellW * P.radius;
      const n = Math.min(10, Math.max(1, Math.ceil(dist / (R * 0.6))));
      const vx = dt ? (dx / W / dt) * P.force : 0;
      const vy = dt ? (-dy / H / dt) * P.force : 0;
      // Краска кладётся на длину пути, а не на кадр: гауссовы мазки через
      // шаг s дают по оси следа плотность amount·R·√π/s, поэтому медленный
      // и быстрый след одинаково густые.
      const amount = (P.flow * dt) / n + (P.ink * dist) / n / (R * 1.772);
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        splat(ptr.px + dx * k, ptr.py + dy * k, vx, vy, amount, R);
      }
      ptr.px = ptr.x;
      ptr.py = ptr.y;
    }

    step(dt);
    render();

    if (visible && (ptr.inside || now - lastInside < P.linger * 1000)) {
      raf = requestAnimationFrame(frame);
    } else if (!ptr.inside && now - lastInside >= P.linger * 1000) {
      reset();
    }
  }

  function wake() {
    if (raf || broken || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && (ptr.inside || performance.now() - lastInside < P.linger * 1000)) wake();
  });
  io.observe(host);

  new ResizeObserver(() => {
    if (canvas.isConnected) size();
  }).observe(host);

  // Тема переключается атрибутом — вместе с ней меняются акценты ячеек.
  new MutationObserver(() => {
    if (canvas.isConnected) {
      paintCells();
      render();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return {
    // Сетку пересобирают целиком (фильтр на /work) — холст выпадает из
    // неё вместе со старыми карточками и вставляется обратно.
    attach() {
      if (!canvas.isConnected) host.prepend(canvas);
      host.classList.add("has-ink");
      size();
    },
    detach() {
      canvas.remove();
      host.classList.remove("has-ink");
      ptr.inside = false;
    },
    // Курсор в координатах сетки — в том числе за её пределами.
    // quiet — сдвиг от скролла: сетка уехала под стоящим курсором. Это не
    // мазок, иначе прокрутка колесом заливала бы краской всю сетку.
    point(cx, cy, quiet = false) {
      if (!canvas.isConnected) return;
      const box = host.getBoundingClientRect();
      const x = cx - box.left - host.clientLeft;
      const y = cy - box.top - host.clientTop;
      const m = cellW * P.near;
      const inside = x > -m && x < W + m && y > -m && y < H + m;
      // Первое касание — без рывка скорости из прошлой точки.
      if ((inside && !ptr.inside) || quiet) {
        ptr.px = x;
        ptr.py = y;
      }
      ptr.x = x;
      ptr.y = y;
      ptr.inside = inside;
      if (inside) wake();
    },
  };
}

/* --- Все сетки на странице -------------------------------------------------------
   Один обработчик курсора на все сетки. Скролл двигает сетку под стоящим
   курсором: позиция пересчитывается, но мазка это не даёт. */

const inks = new Map();
const cursor = { x: -1e4, y: -1e4 };

function update(quiet = false) {
  for (const ink of inks.values()) ink.point(cursor.x, cursor.y, quiet);
}

if (enabled) {
  addEventListener(
    "pointermove",
    (e) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      update();
    },
    { passive: true }
  );
  addEventListener("scroll", () => update(true), { passive: true });
  document.documentElement.addEventListener("pointerleave", () => {
    cursor.x = cursor.y = -1e4;
    update();
  });
}

export function watchSpots(root = document) {
  if (!enabled) return;

  // На /work один и тот же список переключается между сеткой и строками.
  const self = root.classList && inks.get(root);
  if (self && !root.classList.contains("work")) self.detach();

  const hosts = root.matches && root.matches(".work") ? [root] : [...root.querySelectorAll(".work")];
  if (root.querySelectorAll) hosts.push(...root.querySelectorAll("[data-ink-reveal]"));
  for (const host of hosts) {
    if (!host.dataset.inkReveal && !host.querySelector(".card")) continue;
    let ink = inks.get(host);
    if (!ink) {
      ink = mount(host);
      if (!ink) continue;
      inks.set(host, ink);
    }
    ink.attach();
  }
}
