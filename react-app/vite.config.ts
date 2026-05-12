import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = path.resolve(__dirname, "..");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function isViteInternal(url: string): boolean {
  return (
    url === "/" ||
    url.startsWith("/@vite") ||
    url.startsWith("/@fs") ||
    url.startsWith("/@id") ||
    url.startsWith("/src/") ||
    url.startsWith("/node_modules/") ||
    url.startsWith("/.vite/") ||
    url.includes("@react-refresh")
  );
}

/** Serves repo-root static files so /wallet.html, /styles.css work while using `npm run dev`. */
function serveRepoRootStatic(): {
  name: string;
  configureServer(server: { middlewares: { use: (fn: unknown) => void } }): void;
  configurePreviewServer(server: { middlewares: { use: (fn: unknown) => void } }): void;
} {
  const middleware = (req: { method?: string; url?: string }, res: NodeJS.WritableStream & { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const raw = req.url?.split("?")[0] ?? "";
    if (req.method !== "GET" || isViteInternal(raw)) {
      next();
      return;
    }
    // Let Vite serve react-app/index.html for /index.html (SPA entry)
    if (raw === "/index.html") {
      next();
      return;
    }
    // Marketing homepage alias (repo root index.html)
    if (raw === "/home.html" || raw === "/home.html/") {
      const file = path.join(repoRoot, "index.html");
      if (fs.existsSync(file)) {
        res.setHeader("Content-Type", MIME[".html"]!);
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    const clean = raw.replace(/^\//, "");
    if (!clean || clean.includes("..")) {
      next();
      return;
    }
    const resolved = path.resolve(repoRoot, clean);
    if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
      next();
      return;
    }
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
      fs.createReadStream(resolved).pipe(res);
      return;
    }
    next();
  };

  return {
    name: "serve-repo-root-static",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), serveRepoRootStatic()],
  base: "./",
  server: {
    fs: { allow: [repoRoot, path.resolve(repoRoot, "react-app")] },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../react-dist"),
    emptyOutDir: true,
  },
});
