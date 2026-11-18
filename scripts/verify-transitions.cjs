// Переход в предпросмотре и в экспорте считается одной функцией. Проверяем:
//  - уходящий вид снимается маской, а не прозрачностью: двойной экспозиции нет;
//  - в каждой точке кадра виден ровно один вид, и граница идёт только вперёд;
//  - наложение в экспорте совпадает с тем же вызовом на прозрачном оверлее;
//  - настройка длительности независима по сценам.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async()=>{
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage();
    await page.goto((process.env.URL || 'http://localhost:5173') + '/tests/fixtures/editor.html', {waitUntil:'networkidle0'});
    const result = await page.evaluate(async()=>{
      const {transitionLook, outgoingOpacity, drawOutgoingFrame} = await import('/src/scene-transition.js');
      // 1. Уходящий вид либо непрозрачен, либо снят: промежуточной прозрачности нет.
      const partial = [];
      for (let i = 0; i <= 100; i++) {
        const o = transitionLook(i / 100).outgoing;
        if (o !== 0 && o !== 1) partial.push({ at: i / 100, o });
      }
      // 2. Граница идёт только вперёд и выходит за кадр на краях перехода.
      let backward = 0, prev = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const e = transitionLook(i / 100).edge;
        if (e < prev - 1e-9) backward++;
        prev = e;
      }
      const first = transitionLook(0), last = transitionLook(1);
      const cleanStart = first.edge + first.soft + first.tilt / 2 <= 0;
      const cleanEnd = last.edge - last.soft - last.tilt / 2 >= 1;

      // 3. Реальные пиксели: уходящий кадр красный, входящий — синий.
      const mk = (color) => {
        const c = document.createElement('canvas'); c.width = c.height = 8;
        const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 8, 8);
        return c;
      };
      const outgoing = mk('#ff0000');
      const rows = [];
      for (const duration of [0, .25, .9, 1.5]) {
        for (const index of [0, 3, 9, 27, 54, 90]) {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 0, 8, 8);
          // Состояние контекста до вызова: функция не должна его испортить.
          ctx.globalAlpha = .37;
          const active = drawOutgoingFrame(ctx, outgoing, index, 60, duration, 8, 8);
          const px = [...ctx.getImageData(0, 0, 8, 8).data];
          // Идём по горизонтали: слева начинается входящий вид (граница завесы
          // идёт слева направо), поэтому переход по строке должен быть один —
          // синее, затем мягкая граница, затем красное. Если красное и синее
          // чередуются, значит два вида наложены друг на друга.
          const line = [];
          for (let x = 0; x < 8; x++) {
            const i = (4 * 8 + x) * 4;
            const r = px[i], b = px[i + 2];
            // 'm' — мягкая граница или золотое свечение завесы: там важна
            // не чистота канала, а то, что пиксель вообще закрашен.
            line.push(r > 200 && b < 55 ? 'R' : b > 200 && r < 55 ? 'B' : (r > 8 || b > 8) ? 'm' : '.');
          }
          const text = line.join('');
          // Чередование R→B→R означало бы двойную экспозицию.
          const alternations = (text.match(/R+B+R+/g) || []).length + (text.match(/B+R+B+/g) || []).length;
          rows.push({ duration, index, active, alpha: ctx.globalAlpha,
            opacity: outgoingOpacity(index, 60, duration), line: text, alternations,
            red: (text.match(/R/g) || []).length, blue: (text.match(/B/g) || []).length,
            drawn: (text.match(/[RBm]/g) || []).length });
        }
      }

      // 4. Тот же вызов на прозрачном оверлее поверх кадра даёт тот же пиксель,
      // как в предпросмотре.
      const direct = document.createElement('canvas'); direct.width = direct.height = 8;
      const dc = direct.getContext('2d'); dc.fillStyle = '#0000ff'; dc.fillRect(0, 0, 8, 8);
      drawOutgoingFrame(dc, outgoing, 27, 60, .9, 8, 8);
      const overlay = document.createElement('canvas'); overlay.width = overlay.height = 8;
      drawOutgoingFrame(overlay.getContext('2d'), outgoing, 27, 60, .9, 8, 8);
      const composed = document.createElement('canvas'); composed.width = composed.height = 8;
      const cc = composed.getContext('2d'); cc.fillStyle = '#0000ff'; cc.fillRect(0, 0, 8, 8);
      cc.drawImage(overlay, 0, 0);
      const a = dc.getImageData(0, 0, 8, 8).data, b = cc.getImageData(0, 0, 8, 8).data;
      let maxChannelDiff = 0;
      for (let i = 0; i < a.length; i++) maxChannelDiff = Math.max(maxChannelDiff, Math.abs(a[i] - b[i]));

      window.editorFixture.createFinaleSettings();
      const control = document.querySelector('[data-key="transition.duration"]');
      control.value = '1.5'; control.dispatchEvent(new Event('input', {bubbles:true}));
      return { partial, backward, cleanStart, cleanEnd, rows, maxChannelDiff,
        finale: window.finaleSettings.configs.finale.transition.duration,
        brand: window.finaleSettings.configs.brand.transition.duration,
        hint: document.querySelector('[data-section=transition] .cfg-io-hint').textContent };
    });

    assert.deepEqual(result.partial, [], 'уходящий вид имеет промежуточную прозрачность — будет двойная экспозиция');
    assert.equal(result.backward, 0, 'граница завесы откатывается назад');
    assert.ok(result.cleanStart, 'на первом кадре перехода виден кусок входящего вида');
    assert.ok(result.cleanEnd, 'на последнем кадре перехода виден кусок уходящего вида');

    for (const row of result.rows) {
      const label = JSON.stringify(row);
      // Контекст восстановлен: функция не оставляет после себя globalAlpha.
      assert.ok(Math.abs(row.alpha - .37) < 1e-9, 'состояние контекста не восстановлено: ' + label);
      // Переход закончился — функция не рисовала ничего.
      if (row.duration === 0 || row.index / 60 / row.duration >= 1) {
        assert.equal(row.active, false, label);
        assert.equal(row.red, 0, 'после перехода уходящий вид не должен рисоваться: ' + label);
      }
      // Два вида не перемежаются: переход по строке один, слева входящий,
      // справа уходящий. Мягкая граница между ними — это и есть завеса.
      assert.equal(row.alternations, 0, 'виды перемежаются — двойная экспозиция: ' + label);
      assert.ok(row.drawn > 0, 'переход ничего не нарисовал: ' + label);
    }

    // На первом кадре перехода кадр ещё почти целиком уходящий, на последнем —
    // почти целиком входящий: завеса не «мигает» пустотой.
    const firstRow = result.rows.find(r => r.duration === .9 && r.index === 0);
    const lastRow = result.rows.find(r => r.duration === .9 && r.index === 54);
    assert.ok(firstRow && firstRow.blue === 0, 'на первом кадре уже виден входящий вид: ' + JSON.stringify(firstRow));
    assert.ok(lastRow && lastRow.red === 0, 'на последнем кадре ещё виден уходящий вид: ' + JSON.stringify(lastRow));

    // Предпросмотр и экспорт расходятся не больше чем на уровень округления.
    assert.ok(result.maxChannelDiff <= 2,
      `предпросмотр и экспорт разошлись на ${result.maxChannelDiff} уровней`);

    assert.equal(result.finale, 1.5);
    assert.equal(result.brand, .9);
    assert.match(result.hint, /одиночный цикл/);
    console.log('Переходы: завеса без двойной экспозиции, предпросмотр совпадает с экспортом, настройка независима по сценам — OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
