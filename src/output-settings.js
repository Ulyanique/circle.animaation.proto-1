import { OUTPUT } from "./scenes/catalog.js";
import { MASTER_PRESETS } from "./output-profile.js";
import { QUALITY_PRESETS } from "./quality-presets.js";
import { DELIVERY_CHOICES } from "./delivery-catalog.js";
import { videoBitrateFor } from "./video-math.js";

/**
 * Настройки кадра: разрешение мастера, качество превью и кодек записи.
 *
 * Живут отдельно от сцены: они не влияют на композицию, а только на то, в
 * какую пиксельную сетку и каким кодеком рисуется кадр. Поэтому они уехали из
 * нижнего пульта в общие настройки — пульт должен оставаться транспортом, а не
 * складом технических переключателей.
 *
 * Модуль общий для пульта-настроек и проверок: одна и та же разметка id,
 * значит и подписи, и поведение не разъедутся.
 */
export const FRAME_SECTIONS = Object.freeze([
  Object.freeze({
    id: "master",
    label: "Разрешение",
    hint: "Пиксельная сетка мастер-кадра. Композиция задана в долях кадра, поэтому меняется только плотность пикселей.",
    options: Object.values(MASTER_PRESETS).map((preset) => ({
      value: preset.id, label: preset.label,
      description: `${preset.width}×${preset.height}`,
    })),
  }),
  Object.freeze({
    id: "quality",
    label: "Качество превью",
    hint: "Сглаживание и дизеринг кадра в просмотре. На запись влияет только как запас производительности.",
    options: Object.values(QUALITY_PRESETS).map((preset) => ({
      value: preset.id, label: preset.label, description: preset.description,
    })),
  }),
  Object.freeze({
    id: "delivery",
    label: "Кодек экспорта",
    hint: "Формат файла записи. Подписи «недоступно» ставятся по фактической поддержке кодировщика в этом браузере.",
    options: DELIVERY_CHOICES.map((option) => ({
      value: option.id, label: option.label, description: option.description,
    })),
  }),
]);

/** Сводка одной строкой для свёрнутой кнопки: «1920×1080 · Превью · H.264». */
export function frameSummary({ master, quality, delivery }) {
  const size = MASTER_PRESETS[master] ?? MASTER_PRESETS["1080p"];
  const q = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.preview;
  // В подписи кодека важна только первая часть: «H.264 · MP4» → «H.264».
  const codec = (DELIVERY_CHOICES.find((option) => option.id === delivery)?.label ?? "H.264").split(" ·")[0];
  return `${size.width}×${size.height} · ${q.label} · ${codec}`;
}

/**
 * Проверка кодеков под текущее разрешение. Раньше она висела на простое в
 * пульте; теперь пульт её не вызывает, поэтому тянем модуль по требованию из
 * самих настроек — там её и видно.
 * @param {string} masterKey
 * @returns {Promise<Record<string, {ok:boolean, reason?:string}> | null>}
 */
export async function probeDeliveries(masterKey) {
  const size = MASTER_PRESETS[masterKey] ?? MASTER_PRESETS["1080p"];
  try {
    const { probeAllDeliveries } = await import("./delivery.js");
    return await probeAllDeliveries({
      width: size.width, height: size.height,
      bitrate: videoBitrateFor(size.width, size.height), fps: OUTPUT.fps,
    });
  } catch (_) {
    // В окружении без WebCodecs проверка невозможна — оставляем штатные подписи.
    return null;
  }
}
