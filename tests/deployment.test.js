import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Никакого SPA-fallback в корне: ошибка абсолютного пути должна давать 404,
// как на хостинге, где приложение опубликовано только в подпапке.
async function serveAt(directory, mount) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (!pathname.startsWith(mount)) throw new Error("not mounted");
      const relative = decodeURIComponent(pathname.slice(mount.length) || "index.html");
      const file = path.resolve(directory, relative);
      if (!file.startsWith(directory + path.sep)) throw new Error("outside build");
      const contents = await readFile(file);
      res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
      res.end(contents);
    } catch (_) {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function checkAsset(ref, from, mount) {
  const asset = new URL(ref, from);
  assert.equal(asset.origin, from.origin, `Внешний адрес ресурса: ${asset}`);
  assert.ok(asset.pathname.startsWith(mount), `Ресурс вышел за пределы ${mount}: ${asset.pathname}`);
  const response = await fetch(asset);
  assert.equal(response.status, 200, `Не загрузился ресурс: ${asset}`);
  return response;
}

test("production-сборка загружает JS, CSS и шрифты из корня и подпапки", async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), "circle-deployment-test-"));
  try {
    await build({ configFile: path.join(root, "vite.config.js"), logLevel: "silent",
      build: { outDir, emptyOutDir: true } });
    for (const mount of ["/", "/event/preview/"]) {
      const server = await serveAt(outDir, mount);
      try {
        const page = new URL(mount, `http://127.0.0.1:${server.address().port}`);
        const html = await (await checkAsset(page.href, page, mount)).text();
        const tags = [...html.matchAll(/<(?:script|link)\b[^>]*>/gi)].map((match) => match[0]);
        const script = tags.find((tag) => /\bsrc=["'][^"']+\.js(?:[?#][^"']*)?["']/i.test(tag));
        const style = tags.find((tag) => /\bhref=["'][^"']+\.css(?:[?#][^"']*)?["']/i.test(tag));
        assert.match(script || "", /\bdata-boot-critical\b/, "Скрипт сборки не отмечен как критичный");
        assert.match(style || "", /\bdata-boot-critical\b/, "Стили сборки не отмечены как критичные");
        const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)=["']([^"']+)["']/gi)]
          .map((match) => match[1]).filter((ref) => !ref.startsWith("data:"));
        assert.ok(refs.some((ref) => /\.js(?:[?#]|$)/.test(ref)), "Нет скрипта сборки");
        assert.ok(refs.some((ref) => /\.css(?:[?#]|$)/.test(ref)), "Нет стилей сборки");
        for (const ref of refs) {
          const asset = new URL(ref, page);
          const response = await checkAsset(ref, page, mount);
          if (!asset.pathname.endsWith(".css")) continue;
          const css = await response.text();
          const urls = [...css.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)]
            .map((match) => match[1]).filter((url) => !url.startsWith("data:"));
          assert.ok(urls.length > 0, "Не найдены файлы шрифтов");
          for (const url of urls) await checkAsset(url, asset, mount);
        }
      } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
