import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Vite заменяет исходный <script> на собранный и не переносит его атрибуты.
// Помечаем только файлы самой сборки, чтобы необязательные сторонние скрипты
// и стили не могли остановить запуск заставки.
function markBootAssets() {
  return {
    name: "mark-critical-boot-assets",
    transformIndexHtml: {
      order: "post",
      handler(html, { bundle, chunk }) {
        if (!bundle || !chunk) return html;
        const scripts = new Set([chunk.fileName]);
        const styles = new Set(Object.values(bundle)
          .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
          .map((file) => file.fileName));
        let markedEntry = false;
        const result = html.replace(/<(script|link)\b[^>]*>/gi, (tag, kind) => {
          if (kind.toLowerCase() === "link" && !/\brel=["']stylesheet["']/i.test(tag)) return tag;
          const match = /\b(?:src|href)=["']([^"']+)["']/i.exec(tag);
          if (!match) return tag;
          const pathname = new URL(match[1], "http://build.local/").pathname;
          const files = kind.toLowerCase() === "script" ? scripts : styles;
          if (![...files].some((file) => pathname.endsWith(`/${file}`))) return tag;
          if (kind.toLowerCase() === "script") markedEntry = true;
          return tag.replace(/^<(script|link)\b/i, "$& data-boot-critical");
        });
        if (!markedEntry) throw new Error("Не удалось отметить модуль заставки для контроля загрузки");
        return result;
      },
    },
  };
}

export default defineConfig({
  // Сборка должна находить свои файлы и в корне сайта, и в любой подпапке.
  base: "./",
  plugins: [markBootAssets()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    // превью Arena открывается под произвольным хостом — разрешаем все
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        archive: fileURLToPath(new URL("./archive.html", import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three") || id.includes("node_modules/postprocessing")) return "vendor-three";
          if (id.includes("node_modules/mediabunny")) return "vendor-mediabunny";
          if (id.includes("node_modules/opentype.js")) return "vendor-opentype";
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
