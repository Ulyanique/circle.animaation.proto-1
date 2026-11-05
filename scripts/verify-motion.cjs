// Реальные пиксели фона во время удержания: он не превращается в стоп-кадр.
// Дополнительно проверяем, что возврат по таймлайну воспроизводит тот же кадр.
const { launchBrowser } = require("./browser.cjs");
const ids = ["brand", "photo-pause", "finale"];
const windows = [[70, 50, 350, 220], [1500, 650, 350, 250]];

(async () => {
  const browser = await launchBrowser({ width: 960, height: 540 });
  try {
    for (const id of ids) {
      const page = await browser.newPage();
      try {
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(`http://localhost:5173/?scene=${id}`, {
          waitUntil: "networkidle0", timeout: 120000,
        });
        await page.waitForFunction(() => document.body.classList.contains("boot-ready"), { timeout: 240000 });
        const regions = await page.evaluate((rects) => {
          const L = window.__logo;
          L.cfg.playback.paused = true;
          // Только фон/WebGL, без DOM-титров. Кадр реального разрешения 1920×1080.
          const sample = (t) => {
            const canvas = L.compositeFrameAt(t, 1 / 60, false);
            const ctx = canvas.getContext("2d");
            return rects.map(([x, y, w, h]) => ctx.getImageData(x, y, w, h).data);
          };
          const first = sample(9), next = sample(10), again = sample(9);
          return first.map((pixels, k) => {
            let moving = 0, drift = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              const delta = (other) => Math.abs(pixels[i] - other[i]) +
                Math.abs(pixels[i + 1] - other[i + 1]) + Math.abs(pixels[i + 2] - other[i + 2]);
              if (delta(next[k]) > 5) moving++;
              if (delta(again[k]) > 3) drift++;
            }
            return { moving, drift };
          });
        }, windows);
        console.log({ id, regions, errors });
        // Оба независимых световых очага живут на протяжении удержания;
        // seek не должен зависеть от числа предыдущих кадров/RAF.
        if (errors.length || regions.some(({ moving, drift }) => moving < 5000 || drift !== 0))
          process.exitCode = 1;
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
