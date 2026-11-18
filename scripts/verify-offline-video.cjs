// Small but real WebCodecs/MP4 roundtrip. Artificially slow rendering must not change timestamps.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:800, height:450});
  try {
    const page = await browser.newPage();
    await page.goto((process.env.URL || 'http://localhost:5173') + '/tests/fixtures/editor.html', {waitUntil:'networkidle0'});
    const result = await page.evaluate(async () => {
      const {encodeOfflineVideo} = await import('/src/offline-video.js');
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d');
      const seen = [];
      const video = await encodeOfflineVideo({canvas, fps:60, total:60, cancelled:()=>false,
        draw(i) { seen.push(i); ctx.fillStyle = `rgb(${i * 4}, 0, 0)`; ctx.fillRect(0,0,320,180);
          const end = performance.now() + 20; while (performance.now() < end) {} }});
      const element = document.createElement('video'); const url = URL.createObjectURL(video.blob); element.src = url;
      const duration = await new Promise((resolve, reject) => {element.onloadedmetadata = () => resolve(element.duration); element.onerror = reject;});
      URL.revokeObjectURL(url);
      let cancelError = ''; let draws = 0;
      try { await encodeOfflineVideo({canvas, fps:60, total:60, cancelled:()=>draws >= 3, draw(){draws++;}}); }
      catch (e) { cancelError = e.name; }
      const original = window.VideoEncoder; window.VideoEncoder = undefined; let supportError = '';
      try { await encodeOfflineVideo({canvas, fps:60, total:1, cancelled:()=>false, draw(){}}); }
      catch (e) { supportError = e.message; } finally { window.VideoEncoder = original; }
      const header = new TextDecoder().decode(new Uint8Array(await video.blob.slice(4, 8).arrayBuffer()));
      return {seen, duration, frames:video.frames, size:video.blob.size, type:video.blob.type, header, codec:video.codec, cancelError, draws, supportError};
    });
    assert.deepEqual(result.seen, Array.from({length:60}, (_, i)=>i));
    assert.equal(result.type,'video/mp4'); assert.equal(result.header,'ftyp'); assert.equal(result.codec,'avc');
    assert.equal(result.frames,60); assert.ok(Math.abs(result.duration - 1) < .002); assert.ok(result.size > 1000);
    assert.equal(result.cancelError,'AbortError'); assert.equal(result.draws,3); assert.match(result.supportError,/WebCodecs/);
    console.log('Offline MP4:', {frames:result.frames, duration:result.duration, codec:result.codec, bytes:result.size, cancel:result.cancelError});
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
