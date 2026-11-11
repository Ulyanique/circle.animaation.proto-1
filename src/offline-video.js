import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, canEncodeVideo, Input, BufferSource, ALL_FORMATS, EncodedPacketSink } from 'mediabunny';

/** A frame samples one cycle at an exact output index. Playback speed changes video duration, not sampling accuracy.
 * @param {number} cycle @param {number} speed @param {number} fps */
export function frameCount(cycle, speed, fps) {
  if (!Number.isFinite(cycle) || cycle <= 0 || !Number.isFinite(speed) || speed <= 0 || !Number.isInteger(fps) || fps <= 0)
    throw new Error('Некорректная длительность, скорость или частота кадров');
  return Math.max(1, Math.ceil(cycle * fps / speed - 1e-9));
}
/** @param {number} index @param {number} fps */
export function frameTimestamp(index, fps) { return Math.round(index * 1000000 / fps) / 1000000; }

/** Offline WebCodecs: render and encode every frame, await backpressure, and verify the resulting MP4.
 * No real-time capture fallback: unsupported codecs and encoder failures are reported to the caller.
 * @param {{canvas:HTMLCanvasElement, fps:number, total:number, draw:(index:number)=>void, cancelled:()=>boolean,
 * progress?:(done:number,total:number)=>void, bitrate?:number}} options */
export async function encodeOfflineVideo({canvas, fps, total, draw, cancelled, progress, bitrate = 40000000}) {
  if (!Number.isInteger(total) || total < 1) throw new Error('Нет кадров для экспорта');
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined')
    throw new Error('Браузер не поддерживает покадровый экспорт WebCodecs. Откройте проект в актуальном Chrome или Edge по HTTPS.');
  const codec = 'avc'; // H.264 in MP4 is widely supported by players and editors.
  if (!await canEncodeVideo(codec, {width:canvas.width, height:canvas.height, bitrate, frameRate:fps, latencyMode:'quality'}))
    throw new Error('Браузер не поддерживает кодирование H.264 для MP4 в этом разрешении. Попробуйте актуальный Chrome или Edge.');
  const target = new BufferTarget();
  const output = new Output({format:new Mp4OutputFormat(), target});
  const timestamps = [];
  const source = new CanvasSource(canvas, {codec, bitrate, latencyMode:'quality', onEncodedPacket: packet => timestamps.push(packet.timestamp)});
  output.addVideoTrack(source, {frameRate:fps});
  try {
    await output.start();
    for (let i = 0; i < total; i++) {
      if (cancelled()) throw new DOMException('Экспорт отменён', 'AbortError');
      draw(i);
      const stamp = frameTimestamp(i, fps), next = frameTimestamp(i + 1, fps);
      await source.add(stamp, next - stamp);
      progress?.(i + 1, total);
      // Yield to input/painting; slow machines or background tabs simply take longer.
      if (i % 4 === 3) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (cancelled()) throw new DOMException('Экспорт отменён', 'AbortError');
    await output.finalize();
    if (cancelled()) throw new DOMException('Экспорт отменён', 'AbortError');
    if (!target.buffer) throw new Error('Не удалось сформировать видео');
    const sorted = timestamps.slice().sort((a,b) => a-b);
    if (sorted.length !== total || sorted.some((timestamp, i) => Math.abs(timestamp - frameTimestamp(i, fps)) > .00001))
      throw new Error(`Кодировщик пропустил или изменил кадры (${sorted.length} из ${total}); файл не сохранён.`);
    // Independently inspect the actual muxed file, not just the number of submitted frames.
    const input = new Input({source:new BufferSource(target.buffer), formats:ALL_FORMATS});
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error('В файле отсутствует видеодорожка');
      const sink = new EncodedPacketSink(track);
      // H.264 can store frames in decode order rather than presentation order.
      const packetTimes = [];
      for await (const packet of sink.packets()) packetTimes.push(packet.timestamp);
      packetTimes.sort((a, b) => a - b);
      if (packetTimes.length !== total) throw new Error(`В файле ${packetTimes.length} кадров вместо ${total}; файл не сохранён.`);
      if (packetTimes.some((timestamp, i) => Math.abs(timestamp - frameTimestamp(i, fps)) > .0001))
        throw new Error('В видео нарушена последовательность кадров; файл не сохранён.');
    } finally { input.dispose(); }
    return {blob:new Blob([target.buffer], {type:'video/mp4'}), codec, frames:total};
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    throw error;
  }
}
