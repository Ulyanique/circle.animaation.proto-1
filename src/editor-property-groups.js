/** Разделы инспектора — представление схемы, не часть данных проекта. */
export function inspectorPropertyGroup(id, {section, field, shared}) {
  if (shared) return 'Общие параметры';
  if (id === 'logo') {
    if (/^outline/.test(field.key)) return 'Контур';
    if (['depth','bevel','metalness','roughness','clearcoat','facetPolish','studioRelief','amber','envIntensity'].includes(field.key)) return 'Материал';
    return 'Движение и проявление';
  }
  if (section === 'constructionGuides' || section === 'topIllumination') return 'Вид и свет';
  if (section.startsWith('particleCloud')) return 'Частицы и движение';
  if (section.startsWith('backgroundGlow')) return 'Пульсация';
  return 'Оформление и движение';
}
