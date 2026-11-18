import { DECOR_IDS, decorSection } from './brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from './particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from './background-glow-config.js';

// От заднего плана к переднему. В исходном режиме физическая глубина не меняется.
export const ORDERABLE_EFFECTS = Object.freeze([...BACKGROUND_GLOW_IDS, ...DECOR_IDS, ...PARTICLE_CLOUD_IDS]);
export const effectOrderDefaults = () => ({enabled:false, ...Object.fromEntries(ORDERABLE_EFFECTS.map((id, i) => [id, i]))});
/** @param {any} config @param {boolean} [presentOnly] */
export function orderedEffects(config, presentOnly = false) {
  return ORDERABLE_EFFECTS.filter(id => !presentOnly || config?.[decorSection(id) || id]?.present === true).sort((a,b) => {
    const ai=ORDERABLE_EFFECTS.indexOf(a), bi=ORDERABLE_EFFECTS.indexOf(b);
    const av=config?.effectOrder?.[a], bv=config?.effectOrder?.[b];
    return (typeof av === 'number' && Number.isFinite(av) ? av : ai) - (typeof bv === 'number' && Number.isFinite(bv) ? bv : bi) || ai-bi;
  });
}
/** Точечные изменения для перестановки видимых и скрытых (но добавленных) эффектов. */
/** @param {any} config @param {string} id @param {'front'|'back'|'top'} direction */
export function effectOrderChanges(config, id, direction) {
  const all=orderedEffects(config), present=orderedEffects(config,true), index=present.indexOf(id);
  if (direction === 'top') {
    const i=all.indexOf(id); if(i<0) return [];
    all.splice(i,1); all.push(id);
  } else {
    const next=index+(direction==='front'?1:-1);
    if(index<0 || next<0 || next>=present.length) return [];
    const i=all.indexOf(id), j=all.indexOf(present[next]); [all[i],all[j]]=[all[j],all[i]];
  }
  return all.map((key,value)=>({section:'effectOrder',key,value}));
}
/** Применяет порядок к группам Three.js, не меняя пространственную глубину и depthTest.
 * @param {any} config @param {{brandDecors:any, particleClouds:any, backgroundGlows:any}} objects */
export function applyEffectOrder(config, objects) {
  const enabled=config?.effectOrder?.enabled === true, order=orderedEffects(config);
  for (const [index,id] of order.entries()) {
    const effect=objects.brandDecors?.[id] || objects.particleClouds?.[id] || objects.backgroundGlows?.[id];
    // Меняем порядок именно рисуемых объектов, не Group.groupOrder: иначе
    // чёрная шторка с renderOrder=1000 могла оказаться под эффектом.
    effect?.group?.traverse(/** @param {any} object */ object => {
      if (object.isMesh || object.isLine || object.isPoints || object.isSprite) object.renderOrder = enabled ? index+30 : 0;
    });
  }
}
