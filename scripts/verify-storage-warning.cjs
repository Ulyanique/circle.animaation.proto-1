// Browser smoke test: failed saves stay visible despite other UI messages; backup contains live settings.
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser = await launchBrowser({width:960,height:540});
  try {
    const page = await browser.newPage();
    await page.goto(process.env.URL || 'http://localhost:5173/', {waitUntil:'networkidle0', timeout:120000});
    await page.waitForFunction(() => document.body.classList.contains('boot-ready'), {timeout:240000});
    const result = await page.evaluate(async () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function() { throw new DOMException('Full', 'QuotaExceededError'); };
      document.querySelector('.cfg-toggle').click();
      const input = document.querySelector('input[data-key="logo.scale"]');
      input.value = '0.62'; input.dispatchEvent(new Event('input', {bubbles:true}));
      const warning = document.querySelector('.storage-warning');
      let backup;
      const create = URL.createObjectURL, revoke = URL.revokeObjectURL, click = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = blob => { backup = blob; return 'blob:backup'; };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function() {};
      warning.querySelector('button').click();
      const data = JSON.parse(await backup.text());
      const visible = !warning.hidden;
      URL.createObjectURL = create; URL.revokeObjectURL = revoke; HTMLAnchorElement.prototype.click = click;
      Storage.prototype.setItem = original;
      input.value = '0.63'; input.dispatchEvent(new Event('input', {bubbles:true}));
      const recovered = warning.hidden;
      const oldConfirm = window.confirm; let prompts = [];
      window.confirm = message => { prompts.push(message); return false; };
      document.querySelector('[data-act="import"]').click();
      document.querySelector('.cfg-textarea').value = JSON.stringify({logo:{scale:0.8}});
      document.querySelector('[data-io="apply"]').click();
      const importCancelled = window.__logo.cfg.logo.scale === 0.63 && !document.querySelector('.cfg-io').hidden;
      const exportCancelled = window.__logo.startSequenceRecording() === false && !document.querySelector('.export-overlay');
      window.confirm = oldConfirm;
      return {visible, value:data.scenes.waiting.logo.scale, recovered, importCancelled, exportCancelled, prompts:prompts.length};
    });
    assert.deepEqual(result, {visible:true, value:0.62, recovered:true, importCancelled:true, exportCancelled:true, prompts:2});
    console.log('Ошибка хранения, резервный JSON, восстановление и отмена импорта/экспорта — OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
