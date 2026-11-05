import { LogoScene } from "./scene.js";
import { OpeningPulse } from "./opening-pulse.js";
import { computePhase, openingAccent } from "./timeline.js";

/** №1 — интро, не экран ожидания. Один режиссёрский жест: чертёжная точка
 * передаёт движение символу, а переход контура в металл запускает волну
 * света и мягкий наезд камеры. В остальные сцены этот акцент не протекает. */
export class IntroScene extends LogoScene {
  constructor(canvas, cfg) {
    super(canvas, cfg);
    this.openingPulse = new OpeningPulse();
    this.scene.add(this.openingPulse.mesh);
  }

  update(t, dt) {
    super.update(t, dt);
    const cue = openingAccent(computePhase(t, this.cfg.timeline), this.cfg.timeline);
    this.openingPulse.update({ ...cue, energy: cue.energy * 0.68 }, this.logo.root.position.y);
    // Всплеск следует за начавшимся проявлением металла; не повторяет
    // длинный блик на титре, который появляется позже по отдельному такту.
    this.glintLight.intensity += cue.energy * 3.2;
    this.topLight.intensity += cue.energy * 1.8;
    this.camera.position.z += cue.dolly * 0.42;
    this.camera.lookAt(0, 0, 0);
  }
}
