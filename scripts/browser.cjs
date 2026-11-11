// Используем установленный Chrome/Chromium (CHROME) или портативный из setup-headless.sh.
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

async function launchBrowser(viewport = { width: 1920, height: 1080 }, overrides = {}) {
  const dir = process.env.HEADLESS_DIR || path.join(process.env.HOME || "", ".cache/headless");
  const modulePath = path.join(dir, "node_modules/@sparticuz/chromium");
  // 1920×1080 PNG через software WebGL иногда требует > стандартных 180 секунд.
  const options = { defaultViewport: viewport, headless: true, protocolTimeout: 360000, ...overrides };
  if (process.env.CHROME) {
    options.executablePath = process.env.CHROME;
    options.args = ["--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  } else if (fs.existsSync(modulePath)) {
    const chromium = require(modulePath);
    const libDir = path.join(dir, "libs/lib");
    process.env.LD_LIBRARY_PATH = libDir + ":" + (process.env.LD_LIBRARY_PATH || "");
    options.executablePath = await chromium.executablePath();
    options.args = [...chromium.args, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
    options.headless = "shell";
  } else {
    throw new Error("Укажите CHROME=/путь/к/chrome или запустите scripts/setup-headless.sh");
  }
  return puppeteer.launch(options);
}

module.exports = { launchBrowser };
