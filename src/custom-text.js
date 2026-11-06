/** Восемь независимых текстовых слотов в каждой сцене. Ключи плоские для точечной истории. */
export const CUSTOM_TEXT_IDS = Array.from({ length: 8 }, (_, i) => `text${i + 1}`);
export function customTextDefaults() {
  const values = {};
  for (const id of CUSTOM_TEXT_IDS) Object.assign(values, {
    [`${id}Present`]: false, [`${id}Visible`]: true, [`${id}Text`]: 'Новый текст',
    [`${id}Color`]: '#ecd08c', [`${id}X`]: 0, [`${id}Y`]: 0.25, [`${id}Scale`]: 1,
  });
  return values;
}
/** @param {string} id */
export const customTextKeys = id => ['Present', 'Visible', 'Text', 'Color', 'X', 'Y', 'Scale'].map(suffix => `${id}${suffix}`);
