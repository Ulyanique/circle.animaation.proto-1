import { FIELD_TIMING, loopLocal } from "./scenes/cues.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / Math.max(b - a, 1e-4));
  return k * k * (3 - 2 * k);
};
const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Новая концовка №9 — чистые огибающие от абсолютного времени:
 * стирание надписей → лого в центр → удаление по z → обратный контур →
 * центральная построительная окружность из начала №1. Все стадии гаснут до шва.
 * Работает и с сырым project v2 (`holdDuration` = весь цикл), и с внутренним
 * render-таймлайном полевых сцен, где удержание — лишь одна из фаз.
 * @param {number} t @param {any} cfg
 */
export function finaleSequence(t, cfg) {
  const tl = cfg?.timeline || {};
  const D = num(tl.drawDuration, 0);
  const E = num(tl.emergeDuration, 0);
  const H = num(tl.holdDuration, 18);
  const F = num(tl.fadeDuration, FIELD_TIMING.fadeDuration);
  const R = num(tl.restDuration, FIELD_TIMING.restDuration);
  const rendered = D > 0 || E > 0 || F > 0 || R > 0;
  const cycle = Math.max(0.1, rendered ? D + E + H + F + R : H);
  const fade = Math.max(0.1, rendered ? F : FIELD_TIMING.fadeDuration);
  const rest = Math.max(0, rendered ? R : FIELD_TIMING.restDuration);
  const local = loopLocal(t, cycle);
  const exit = Math.max(0, cycle - rest - fade);
  const guard = cycle - 0.55;
  const f = cfg?.finale || {};
  const at = (key, fallback) => exit + num(f[key], fallback);
  const end = (start, span) => Math.min(guard, Math.max(start + 0.01, start + span));

  const eraseStart = at("eraseStart", 0.05);
  const captionErase = smooth(eraseStart, end(eraseStart, 0.8), local);
  const logoMoveStart = at("logoMoveStart", 0.35);
  const logoCenter = smooth(logoMoveStart, end(logoMoveStart, 0.7), local);
  const depthStart = at("depthStart", 0.8);
  const depth = smooth(depthStart, end(depthStart, 0.75), local);
  const contourStart = at("contourStart", 1.15);
  const contour = smooth(contourStart, end(contourStart, 0.6), local);
  const circleStart = at("circleStart", 1.45);
  const circleRise = end(circleStart, 0.3);
  const circleEnd = Math.min(guard, at("circleEnd", 2.45));
  const finalCircle = smooth(circleStart, circleRise, local) *
    (1 - smooth(circleRise, Math.max(circleRise + 0.05, circleEnd), local));

  return {
    local, cycle, exit, captionErase, logoCenter, depth, contour, finalCircle,
    circleStart, circleEnd,
    circleOpacity: clamp01(num(f.circleOpacity, 0.72)),
    circleRadius: Math.max(0.1, num(f.circleRadius, 0.8)),
    depthTravel: Math.max(0.5, num(f.depthTravel, 4)),
    finalCirclePreset: f.finalCircle || "center-construction",
  };
}
