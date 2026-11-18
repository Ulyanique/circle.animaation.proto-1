import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('opentype.js');

test('локальные файлы шести шрифтов содержат читаемые контуры кириллицы и латиницы', () => {
  for (const [name, bold] of [['cormorant-garamond',600], ['playfair-display',600], ['prata',400], ['pt-serif',700], ['manrope',600], ['unbounded',600]]) {
    for (const weight of new Set([400, bold])) for (const [subset, sample] of [['cyrillic','Я'], ['latin','A']]) {
      const data = readFileSync(`node_modules/@fontsource/${name}/files/${name}-${subset}-${weight}-normal.woff`);
      const font = parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      assert.notEqual(font.charToGlyph(sample).index, 0, `${name} ${weight} ${sample}`);
      assert.ok(font.getPath(sample, 0, 0, 1000).commands.length, `${name} ${weight} ${sample}`);
    }
  }
});
