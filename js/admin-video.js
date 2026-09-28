/* Сжатие ролика прямо в браузере — то же, что tools/compress-video.py:
   mp4 H.264 со звуком AAC 128 кбит/с, кадр вписан в 1920×1280 (вертикаль 1080×1920
   станет 720×1280), плюс постер webp с трети ролика.

   Кодирует встроенный в браузер WebCodecs через Mediabunny, так что ни
   сервер, ни ffmpeg не нужны. Библиотека грузится только при первом
   перетаскивании ролика. ProRes и прочие монтажные форматы браузер не
   декодирует — такие файлы жмутся «Сжать видео.bat». */

const LIB = "https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/dist/bundles/mediabunny.min.mjs";
const BOX = [1920, 1280];
// ~2.5 Мбит/с на кадр 720×1280, пропорционально площади — как crf 27 с потолком 3M в ffmpeg.
const BITS_PER_PIXEL = 2_500_000 / (720 * 1280);

const even = (x) => Math.max(2, Math.round(x / 2) * 2);

export async function compress(file, onProgress) {
  const mb = await import(LIB);
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("в файле нет видеодорожки");
    if (!(await track.canDecode())) {
      throw new Error(`браузер не читает кодек ${track.codec || "этого файла"} — сожми его «Сжать видео.bat»`);
    }
    const w = await track.getDisplayWidth();
    const h = await track.getDisplayHeight();
    const scale = Math.min(1, BOX[0] / w, BOX[1] / h);
    const width = even(w * scale);
    const height = even(h * scale);

    // Звук — AAC, а где браузер его не кодирует — Opus (тоже живёт в mp4).
    // Если ни то ни другое, ролик уходит без звука, но об этом говорим.
    const sound = { numberOfChannels: 2, sampleRate: 48000, bitrate: 128_000 };
    const audioTrack = await input.getPrimaryAudioTrack();
    const audioCodec =
      audioTrack && (await audioTrack.canDecode())
        ? await mb.getFirstEncodableAudioCodec(["aac", "opus"], sound)
        : null;
    const audio = audioCodec ? { codec: audioCodec, ...sound } : { discard: true };
    const lostSound = Boolean(audioTrack) && !audioCodec;

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: {
        width,
        height,
        fit: "contain",
        codec: "avc",
        bitrate: Math.round(Math.min(4_000_000, Math.max(800_000, width * height * BITS_PER_PIXEL))),
        forceTranscode: true,
      },
      audio,
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const why = conversion.discardedTracks.map((t) => t.reason).join(", ");
      throw new Error(`не получается пересобрать ролик (${why}) — сожми его «Сжать видео.bat»`);
    }
    conversion.onProgress = (p) => onProgress && onProgress(p);
    await conversion.execute();

    // Уже сжатый под веб файл (-SE.webm из Shutter Encoder) после
    // перекодирования с постоянным битрейтом может только потяжелеть — тогда
    // берём его как есть, как это делает tools/web-media.py.
    let video = new Blob([output.target.buffer], { type: "video/mp4" });
    const webReady = /\.(mp4|webm)$/i.test(file.name) && scale === 1;
    const kept = webReady && video.size >= file.size;
    if (kept) video = new Blob([file], { type: /\.webm$/i.test(file.name) ? "video/webm" : "video/mp4" });
    return {
      video, width, height, kept,
      sound: kept ? "как в исходнике" : audioCodec ? audioCodec.toUpperCase() : lostSound ? "потерян" : "нет",
      poster: await posterOf(video),
    };
  } finally {
    input.dispose();
  }
}

/* Кадр с трети ролика. Safari не умеет кодировать webp из canvas — тогда jpeg. */
async function posterOf(blob) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await once(v, "loadedmetadata");
    v.currentTime = Math.min(v.duration / 3, Math.max(v.duration - 0.1, 0));
    await once(v, "seeked");
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const webp = await new Promise((r) => c.toBlob(r, "image/webp", 0.82));
    if (webp && webp.type === "image/webp") return webp;
    return await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function once(el, event) {
  return new Promise((resolve, reject) => {
    el.addEventListener(event, resolve, { once: true });
    el.addEventListener("error", () => reject(new Error("ролик не открылся для постера")), { once: true });
  });
}
