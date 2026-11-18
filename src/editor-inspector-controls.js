import { inspectorProperties } from './editor-properties.js';
import { inspectorPropertyGroup } from './editor-property-groups.js';

/** UI-адаптер параметров выбранного слоя. Команды истории и изменение конфигурации — через переданные функции. */
export function createExtraPropertyControls({menu, getState, isLocked, onChange, refresh, begin, session, finish}) {
  const container = menu.querySelector('.editor-extra-properties');
  let currentKey = '', controls = [];
  function populate(id) {
    const state = getState(), key = `${state.id}:${id}`;
    if (key !== currentKey) {
      currentKey = key; controls = []; container.replaceChildren();
      const specs = inspectorProperties(id, state.id, state.config);
      menu.querySelector('[data-property-group="advanced"]').hidden = specs.length === 0;
      const groups = new Map();
      for (const spec of specs) {
        const {section, field, shared} = spec;
        const groupName = inspectorPropertyGroup(id, spec);
        if (!groups.has(groupName)) {
          const group = document.createElement('details'); group.className = 'editor-extra-group';
          const summary = document.createElement('summary'); summary.textContent = groupName; group.appendChild(summary);
          groups.set(groupName, group); container.appendChild(group);
        }
        const row = document.createElement('label'); row.className = 'editor-extra-row';
        const label = document.createElement('span'); label.textContent = field.label + (shared ? ' · общее' : '');
        row.appendChild(label);
        const input = document.createElement(field.type === 'select' ? 'select' : 'input');
        input.dataset.extraProperty = `${section}.${field.key}`;
        if (field.type === 'select') for (const option of field.options) {
          const el = document.createElement('option'); el.value = option.value; el.textContent = option.label; input.appendChild(el);
        } else {
          input.type = field.type === 'range' ? 'range' : field.type === 'bool' ? 'checkbox' : field.type;
          if (field.type === 'range') { input.min = field.min; input.max = field.max; input.step = field.step; }
          if (field.type === 'text') input.maxLength = field.maxLength || 100;
        }
        const out = document.createElement('output');
        if (field.type === 'range') { const valueRow = document.createElement('div'); valueRow.append(input, out); row.appendChild(valueRow); }
        else row.appendChild(input);
        groups.get(groupName).appendChild(row);
        const prop = {section, key: field.key};
        input.addEventListener('focus', () => begin(prop));
        const update = () => {
          begin(prop); const active = session();
          if (!active?.field || active.field.section !== section || active.field.key !== field.key) return;
          const value = field.type === 'bool' ? input.checked : field.type === 'range' ? Number(input.value) : input.value;
          active.config[section][field.key] = value; out.textContent = String(value);
          onChange();
        };
        input.addEventListener(field.type === 'bool' || field.type === 'select' ? 'change' : 'input', update);
        input.addEventListener('change', () => { finish(); refresh(); });
        input.addEventListener('blur', () => { finish(); refresh(); });
        controls.push({input, out, section, field});
      }
    }
    for (const {input, out, section, field} of controls) {
      if (document.activeElement === input) continue;
      const value = state.config[section][field.key];
      if (field.type === 'bool') input.checked = !!value;
      else input.value = value ?? field.fallback ?? '';
      out.textContent = String(value ?? '');
      input.disabled = isLocked(state.config, id) && section === 'rings' && ['radius','cornerX','cornerY'].includes(field.key);
    }
  }
  return {populate};
}
