import { BufferTarget, CanvasSource, Output, Quality, WebMOutputFormat } from "mediabunny";

/** Точный покадровый WebM: таймкод k/fps задаётся до кодирования и не зависит от RAF.
 * renderFrame(k) заполняет тот же canvas, который читает CanvasSource.
 * @param {{canvas:HTMLCanvasElement, fps:number, totalFrames:number,
 * renderFrame:(frame:number)=>void|Promise<void>, onProgress?:(done:number)=>void,
 * signal?:AbortSignal, bitrate?:number}} options */
export async function encodeOffline(options) {
  const { canvas, fps, totalFrames, renderFrame, onProgress, signal, bitrate = 40_000_000 } = options;
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined")
    throw new Error("Этот браузер не поддерживает WebCodecs VideoEncoder. Используйте Chrome или Edge с HTTPS.");
  const target = new BufferTarget();
  const output = new Output({ format: new WebMOutputFormat(), target });
  const source = new CanvasSource(canvas, {
    codec: "vp9", quality: new Quality({ bitrate }), keyFrameInterval: 2,
  });
  output.addVideoTrack(source);
  let finalized = false;
  try {
    await output.start();
    for (let k = 0; k < totalFrames; k++) {
      if (signal?.aborted) throw new DOMException("Экспорт отменён", "AbortError");
      await renderFrame(k);
      await source.add(k / fps, 1 / fps);
      onProgress?.(k + 1);
      // После каждого кадра отдаём браузеру очередь событий, чтобы «Отменить»
      // сработала даже на мощном GPU и при очень коротком ролике.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (signal?.aborted) throw new DOMException("Экспорт отменён", "AbortError");
    await output.finalize();
    finalized = true;
    if (!target.buffer) throw new Error("Кодер не вернул WebM");
    return new Blob([target.buffer], { type: "video/webm" });
  } finally {
    if (!finalized) await output.cancel();
  }
}
