// Реальный композит: наличие камня, отличие от выключенной фактуры и повторный seek.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {launchBrowser} = require('./browser.cjs');
(async () => {
  const browser=await launchBrowser({width:960,height:540});
  try {
    for (const id of ['photo-pause','finale']) {
      const page=await browser.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const url=new URL(process.env.URL||'http://localhost:5173');url.searchParams.set('scene',id);
      await page.goto(url.href,{waitUntil:'networkidle0',timeout:120000});
      await page.waitForFunction(()=>document.body.classList.contains('boot-ready'),{timeout:240000});
      const result=await page.evaluate(async () => {
        await document.fonts.ready;window.requestAnimationFrame=()=>0;
        const L=window.__logo;L.cfg.playback.paused=true;
        const grab=t=>{const c=L.compositeFrameAt(t);return c.getContext('2d').getImageData(180,200,350,250).data};
        const digest=async pixels=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).join(',');
        const on=grab(9),hash=await digest(on);
        const uniforms={texture:L.scene.background.uniforms.uFabricTexture.value,ready:L.scene.background.uniforms.uFabricReady.value,light:L.scene.background.uniforms.uCinematic.value,viewfinder:!!L.scene.viewfinder?.visible};
        grab(4);const repeat=await digest(grab(9));
        L.cfg.background.fabricTexture=0;const off=grab(9);L.cfg.background.fabricTexture=.8;
        let changed=0;for(let i=0;i<on.length;i+=4)if(Math.abs(on[i]-off[i])+Math.abs(on[i+1]-off[i+1])+Math.abs(on[i+2]-off[i+2])>4)changed++;
        return {hash,repeat,uniforms,changed,image:L.compositeFrameAt(9).toDataURL('image/jpeg',.9)};
      });
      assert.equal(result.hash,result.repeat);assert.equal(result.uniforms.texture,.8);
      assert.equal(result.uniforms.ready,1);assert.equal(result.uniforms.light,1);
      if(id==='photo-pause') assert.ok(result.uniforms.viewfinder);
      assert.ok(result.changed>1000,`Фактура незаметна: ${result.changed}`);assert.deepEqual(errors,[]);
      if(process.env.OUT){fs.mkdirSync(process.env.OUT,{recursive:true});fs.writeFileSync(path.join(process.env.OUT,`${id}.jpg`),Buffer.from(result.image.split(',')[1],'base64'));}
      console.log(id, {changed:result.changed, uniforms:result.uniforms,seek:'OK'});
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
