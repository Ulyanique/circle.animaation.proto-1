import { LogoScene } from "./scene.js";
import { OpeningPulse } from "./opening-pulse.js";
import { START_ANGLE } from "./plotter.js";
import { computePhase, openingAccent } from "./timeline.js";

/** №1 — интро, не экран ожидания. Три такта одной причинно-следственной
 * линии: игла света находит точку чертежа, переход контура в металл
 * отпускает волну, законченная подпись запирает композицию. Акценты
 * вводятся только здесь и не протекают в остальные сцены. */
export class IntroScene extends LogoScene {
  constructor(canvas, cfg) {
    super(canvas, cfg);
    this.openingPulse = new OpeningPulse(cfg.colors.goldHighlight);
    this.scene.add(this.openingPulse.mesh);
    this._waveCenter = { x: 0, y: 0 };
    this._traceAnchor = { x: 0, y: 0 };
  }

  // На старте камера ещё наклонена базовой сценой. Проекция луча из камеры
  // на плоскость слоя сохраняет точное совпадение световой точки с чертежом
  // в экранном пространстве — без переноса самого эффекта в систему камеры.
  _projectToPulse(out, x, y, z) {
    const cam = this.camera.position;
    const k = (this.openingPulse.mesh.position.z - cam.z) / (z - cam.z);
    out.x = cam.x + (x - cam.x) * k;
    out.y = cam.y + (y - cam.y) * k;
    return out;
  }

  update(t, dt) {
    super.update(t, dt);
    const cue = openingAccent(computePhase(t, this.cfg.timeline), this.cfg.timeline);
    // Всплеск следует за начавшимся проявлением металла; финальный штрих
    // тише и не повторяет длинный блик, который проходит раньше по граням.
    this.glintLight.intensity += cue.energy * 3.2 + cue.seal * 0.45;
    this.topLight.intensity += cue.energy * 1.8 + cue.seal * 0.3;
    // Отрицательное смещение z — действительно наезд, а не отъезд камеры.
    this.camera.position.z -= cue.dolly * 0.42 + cue.seal * 0.025;
    this.camera.lookAt(0, 0, 0);

    const centerY = this.cfg.logo.offsetY ?? 0;
    const radius = this.cfg.rings.radius * 0.8;
    const constructionZ = -0.08; // Plotter.group.position.z
    this._projectToPulse(this._waveCenter, 0, centerY, constructionZ);
    this._projectToPulse(this._traceAnchor,
      Math.cos(START_ANGLE) * radius,
      Math.sin(START_ANGLE) * radius + centerY,
      constructionZ);
    this.openingPulse.update({
      ...cue,
      energy: cue.energy * 0.68,
      trace: cue.trace * 0.9,
      seal: cue.seal * 0.65,
    }, this._waveCenter, this._traceAnchor);
  }
}
