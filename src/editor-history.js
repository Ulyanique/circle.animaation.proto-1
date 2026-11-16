/**
 * @typedef {{section:string, key:string, before:any, after:any}} HistoryChange
 */

/** История точечных правок: не перезаписывает остальные настройки сцены. */
export class EditorHistory {
  constructor(limit = 100) {
    this.limit = limit;
    /** @type {Map<string, {undo: HistoryChange[][], redo: HistoryChange[][]}>} */
    this.scenes = new Map();
  }
  /** @param {string} id */
  state(id) {
    let cur = this.scenes.get(id);
    if (!cur) {
      cur = { undo: [], redo: [] };
      this.scenes.set(id, cur);
    }
    return cur;
  }
  /** @param {string} id @param {HistoryChange[]} changes */
  record(id, changes) {
    const entries = changes.filter(c => !Object.is(c.before, c.after));
    if (!entries.length) return false;
    const state = this.state(id);
    state.undo.push(entries);
    if (state.undo.length > this.limit) state.undo.shift();
    state.redo.length = 0;
    return true;
  }
  /** @param {string} id @param {Record<string, any>} config @param {'undo'|'redo'} direction */
  apply(id, config, direction) {
    const state = this.state(id), source = state[direction];
    if (!source.length) return 'empty';
    const entries = source[source.length - 1];
    const expected = direction === 'undo' ? 'after' : 'before';
    const target = direction === 'undo' ? 'before' : 'after';
    // Если значение изменили извне, не откатываем чужую правку.
    if (entries.some(c => !config[c.section] || !Object.is(config[c.section][c.key], c[expected]))) {
      this.clear(id);
      return 'conflict';
    }
    source.pop();
    for (const c of entries) config[c.section][c.key] = c[target];
    state[direction === 'undo' ? 'redo' : 'undo'].push(entries);
    return 'applied';
  }
  /** @param {string} id @param {string} section @param {string} key */
  invalidate(id, section, key) {
    const state = this.state(id);
    if ([...state.undo, ...state.redo].some(entry => entry.some(c => c.section === section && c.key === key))) {
      this.clear(id);
    }
  }
  /** @param {string} id */
  clear(id) { this.scenes.delete(id); }
}
