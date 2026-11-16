import { Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, CanvasSource, VideoSampleSource, VideoSample,
  canEncodeVideo, Input, BufferSource, ALL_FORMATS, EncodedPacketSink } from 'mediabunny';
import { BASE_PIXELS } from "./scenes/catalog.js";
import { deliveryOption, deliveryBitrate, codecString, deliveryLabel } from "./delivery.js";

/** A frame samples one cycle at an exact output index. Playback speed changes video duration, not sampling accuracy.
 * @param {number} cycle @param {number} speed @param {number} fps */
export function frameCount(cycle, speed, fps) {
  if (!Number.isFinite(cycle) || cycle <= 0 || !Number.isFinite(speed) || speed <= 0 || !Number.isInteger(fps) || fps <= 0)
    throw new Error('Некорректная длительность, скорость или частота кадров');
  return Math.max(1, Math.ceil(cycle * fps / speed - 1e-9));
}
/** @param {number} index @param {number} fps */
export function frameTimestamp(index, fps) { return Math.round(index * 1000000 / fps) / 1000000; }

export const DEFAULT_VIDEO_BITRATE = 40000000;
export const MAX_VIDEO_BITRATE = 120000000;

/** Битрейт растёт вместе с площадью кадра: 4K требует вчетверо больше данных.
 * @param {number} width @param {number} height */
export function videoBitrateFor(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Некорректный размер кадра для оценки битрейта');
  const scaled = DEFAULT_VIDEO_BITRATE * (width * height) / BASE_PIXELS;
  return Math.round(Math.min(MAX_VIDEO_BITRATE, Math.max(DEFAULT_VIDEO_BITRATE, scaled)));
}

/** Rough encoded payload estimate, not peak memory or a guaranteed file size.
 * @param {number} total @param {number} fps @param {number} bitrate */
export function estimateVideoBytes(total, fps, bitrate = DEFAULT_VIDEO_BITRATE) {
  if (!Number.isInteger(total) || total < 1 || !Number.isFinite(fps) || fps <= 0 || !Number.isFinite(bitrate) || bitrate <= 0)
    throw new Error('Некорректные параметры оценки видео');
  return total / fps * bitrate / 8;
}

/**
 * Кадр 10-битного варианта собирается из RGBA-полотна в I420P10 (BT.709,
 * limited range). 8-битный canvas сам по себе 10 бит не даёт: расширение
 * разрядности без шума не добавляет ничего, но снимает бандинг в кодировщике
 * и в градиентах после цветового преобразования.
 * @param {ImageData} image @param {number} timestamp @param {number} duration @param {Uint16Array} [reusePlanes] */
function tenBitFrame(image, timestamp, duration, reusePlanes) {
  const { width, height } = image;
  const rgba = image.data;
  const lumaSize = width * height;
  const chromaWidth = Math.ceil(width / 2), chromaHeight = Math.ceil(height / 2);
  const chromaSize = chromaWidth * chromaHeight;
  const totalSamples = lumaSize + chromaSize * 2;
  const planes = reusePlanes && reusePlanes.length === totalSamples ? reusePlanes : new Uint16Array(totalSamples);
  // BT.709 limited range: Y' 16..235, Cb/Cr 16..240, в 10 битах — ×4.
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const i = (rowOffset + x) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      planes[rowOffset + x] = Math.round((16 + luma / 255 * 219) * 4);
    }
  }
  // Хрома — среднее по 2×2: цветовой шум на жирном зерне не должен «звенеть».
  const crOffset = lumaSize + chromaSize;
  for (let y = 0; y < chromaHeight; y++) {
    const sy0 = y * 2, sy1 = sy0 + 1;
    const hasSecondRow = sy1 < height;
    const chromaRow = y * chromaWidth;
    for (let x = 0; x < chromaWidth; x++) {
      const sx0 = x * 2, sx1 = sx0 + 1;
      const hasSecondCol = sx1 < width;
      const i00 = (sy0 * width + sx0) * 4;
      let r = rgba[i00], g = rgba[i00 + 1], b = rgba[i00 + 2], n = 1;
      if (hasSecondCol) { const i01 = i00 + 4; r += rgba[i01]; g += rgba[i01 + 1]; b += rgba[i01 + 2]; n++; }
      if (hasSecondRow) {
        const i10 = (sy1 * width + sx0) * 4;
        r += rgba[i10]; g += rgba[i10 + 1]; b += rgba[i10 + 2]; n++;
        if (hasSecondCol) { const i11 = i10 + 4; r += rgba[i11]; g += rgba[i11 + 1]; b += rgba[i11 + 2]; n++; }
      }
      r /= n; g /= n; b /= n;
      const cb = -0.1146 * r - 0.3854 * g + 0.5 * b;
      const cr = 0.5 * r - 0.4542 * g - 0.0458 * b;
      planes[lumaSize + chromaRow + x] = Math.round((128 + cb / 255 * 224) * 4);
      planes[crOffset + chromaRow + x] = Math.round((128 + cr / 255 * 224) * 4);
    }
  }
  const Frame = /** @type {typeof VideoFrame} */ (VideoFrame);
  const frame = new (/** @type {any} */ (Frame))(planes, {
    format: 'I420P10', codedWidth: width, codedHeight: height, timestamp, duration,
    colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false },
  });
  return new VideoSample(frame, { timestamp, duration });
}

/**
 * Оффлайн WebCodecs: рендер и кодирование каждого кадра, ожидание backpressure,
 * проверка получившегося файла. Реального времени нет: неподдерживаемый кодек и
 * сбой кодировщика сообщаются вызывающему, а не превращаются в тихую деградацию.
 * @param {{canvas:HTMLCanvasElement, fps:number, total:number, draw:(index:number)=>void, cancelled:()=>boolean,
 * progress?:(done:number,total:number)=>void, bitrate?:number, delivery?:string}} options */
export async function encodeOfflineVideo({canvas, fps, total, draw, cancelled, progress,
  bitrate = DEFAULT_VIDEO_BITRATE, delivery = 'h264'}) {
  if (!Number.isInteger(total) || total < 1) throw new Error('Нет кадров для экспорта');
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined')
    throw new Error('Браузер не поддерживает покадровый экспорт WebCodecs. Откройте проект в актуальном Chrome или Edge по HTTPS.');
  const option = deliveryOption(delivery);
  const target = new BufferTarget();
  const format = option.container === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat();
  const output = new Output({format, target});
  /** @type {import('mediabunny').VideoEncodingConfig} */
  const encoding = {codec:option.codec, bitrate:deliveryBitrate(option.id, bitrate), latencyMode:'quality'};
  // Для 10 бит строка кодека должна требовать Main 10 — иначе браузер молча
  // отдаст 8 бит и мы получим полосы, ради которых всё и делалось.
  if (option.bitDepth === 10) encoding.fullCodecString = codecString(option);
  const supported = await canEncodeVideo(option.codec, {width:canvas.width, height:canvas.height,
    bitrate:encoding.bitrate, frameRate:fps, ...(encoding.fullCodecString ? {fullCodecString:encoding.fullCodecString} : {})});
  if (!supported)
    throw new Error(`${deliveryLabel(option)} не поддерживается в этом браузере для ${canvas.width}×${canvas.height}. `
      + 'Выберите H.264 или другой разрешённый вариант доставки.');
  /** @type {number[]} */
  const timestamps = [];
  /** @param {{timestamp:number}} packet */
  const onEncodedPacket = packet => { timestamps.push(packet.timestamp); };
  // 10 бит требуют готовых I420P10-сэмплов: CanvasSource всегда отдаёт 8 бит.
  const source = option.bitDepth === 10
    ? new VideoSampleSource({...encoding, onEncodedPacket})
    : new CanvasSource(canvas, {...encoding, onEncodedPacket});
  output.addVideoTrack(source, {frameRate:fps});
  const context = option.bitDepth === 10 ? canvas.getContext('2d', {willReadFrequently:true}) : null;
  if (option.bitDepth === 10 && !context) throw new Error('Не удалось прочитать кадр для 10-битного экспорта');
  const planesBuffer = context
    ? new Uint16Array(canvas.width * canvas.height + Math.ceil(canvas.width / 2) * Math.ceil(canvas.height / 2) * 2)
    : undefined;
  try {
    await output.start();
    for (let i = 0; i < total; i++) {
      if (cancelled()) throw new DOMException('Экспорт отменён', 'AbortError');
      draw(i);
      const stamp = frameTimestamp(i, fps), next = frameTimestamp(i + 1, fps);
      if (context) {
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const sample = tenBitFrame(image, stamp, next - stamp, planesBuffer);
        try { await /** @type {VideoSampleSource} */ (source).add(sample); } finally { sample.close(); }
      } else {
        await /** @type {CanvasSource} */ (source).add(stamp, next - stamp);
      }
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
      // WebM/Matroska хранит время в миллисекундах, MP4 — точнее. Допуск берём
      // по контейнеру: это округление таймкода, а не потеря кадра (число кадров
      // проверено выше).
      const tolerance = option.container === 'webm' ? .0005 : .0001;
      if (packetTimes.some((timestamp, i) => Math.abs(timestamp - frameTimestamp(i, fps)) > tolerance))
        throw new Error('В видео нарушена последовательность кадров; файл не сохранён.');
      // Глубина — не обещание, а факт: читаем строку кодека из самого файла.
      const actual = await track.getCodecParameterString();
      const actualDepth = codecBitDepth(actual);
      if (option.bitDepth === 10 && actualDepth !== 10)
        throw new Error(`Кодировщик выдал ${actualDepth ?? '?'}-битный поток (${actual ?? 'без строки кодека'}); `
          + '10-битный файл не сохранён, чтобы не выдать 8 бит за 10.');
    } finally { input.dispose(); }
    return {blob:new Blob([target.buffer], {type:option.container === 'webm' ? 'video/webm' : 'video/mp4'}),
      codec:option.codec, delivery:option.id, bitDepth:option.bitDepth, frames:total};
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {});
    throw error;
  }
}

/**
 * Глубина потока по строке кодека, если её видно. `vp09.PP.LL.DD` — поле DD
 * задаёт битность; у H.264 и HEVC глубина в строке не указывается, поэтому
 * получаем `null` и не делаем вид, что знаем больше.
 * @param {string|null} parameterString */
export function codecBitDepth(parameterString) {
  if (typeof parameterString !== 'string') return null;
  const vp9 = /^vp09\.\d{2}\.\d{2}\.(08|10|12)/.exec(parameterString);
  if (vp9) return Number(vp9[1]);
  return null;
}
