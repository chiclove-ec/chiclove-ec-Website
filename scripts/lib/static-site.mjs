// Servidor estático que imita a producción: rutas sin extensión como Cloudflare Pages,
// 404 real con cuerpo de recuperación y negociación `Accept: text/markdown` con el mismo
// módulo que usa la función de Cloudflare Pages. Se usa para desarrollo y en los tests.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";

import {
  MARKDOWN_CONTENT_TYPE,
  negotiationHeaders,
  planResponse,
  prefersMarkdown
} from "./markdown-negotiation.mjs";
import { legacyProductRoute, searchHeaders } from "./search-indexing.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".md": MARKDOWN_CONTENT_TYPE,
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png"
};

const NOT_ACCEPTABLE_BODY =
  "# 406 Not Acceptable\n\nEste recurso solo existe como `text/html` y `text/markdown`.\n";

export function createSiteServer(rootDir) {
  const root = resolve(rootDir);

  async function readIfFile(candidate) {
    const target = resolve(root, "." + normalize(candidate));
    if (!target.startsWith(root)) return null; // Nunca salir del directorio publicado.
    try {
      const info = await stat(target);
      if (!info.isFile()) return null;
      return { path: target, body: await readFile(target) };
    } catch {
      return null;
    }
  }

  // Resolución de rutas limpias: /x → x, x.html, x/index.html.
  async function resolveAsset(pathname) {
    const candidates = pathname.endsWith("/")
      ? [pathname + "index.html", pathname.slice(0, -1) + ".html"]
      : [pathname, pathname + ".html", pathname + "/index.html"];
    for (const candidate of candidates) {
      const found = await readIfFile(candidate);
      if (found) return found;
    }
    return null;
  }

  const send = (req, res, status, body, headers) => {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    res.writeHead(status, Object.fromEntries(searchHeaders(url, status, headers)));
    res.end(req.method === "HEAD" ? undefined : body);
  };

  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      pathname = url.pathname;
    }
    const legacy = ["GET", "HEAD"].includes(req.method) ? legacyProductRoute(url) : null;
    if (legacy?.location) return send(req, res, legacy.status, null, { Location: legacy.location });
    if (legacy?.status === 404) {
      const markdown = prefersMarkdown(req.headers.accept);
      const notFound = await readIfFile(markdown ? "/404.md" : "/404.html");
      return send(req, res, 404, notFound?.body || "404", {
        "Content-Type": markdown ? MARKDOWN_CONTENT_TYPE : "text/html; charset=utf-8",
        ...negotiationHeaders("/404.md")
      });
    }
    const plan = planResponse({ pathname, accept: req.headers.accept });
    const extra = plan.kind === "passthrough" ? {} : negotiationHeaders(plan.markdownPath);

    if (plan.kind === "notAcceptable") {
      return send(req, res, 406, NOT_ACCEPTABLE_BODY, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        ...extra
      });
    }

    if (plan.kind === "markdown") {
      const asset = await readIfFile(plan.markdownPath);
      if (asset) {
        return send(req, res, 200, asset.body, { "Content-Type": MARKDOWN_CONTENT_TYPE, ...extra });
      }
    }

    const asset = await resolveAsset(pathname);
    if (asset) {
      const type = TYPES[extname(asset.path)] || "application/octet-stream";
      return send(req, res, 200, asset.body, { "Content-Type": type, ...extra });
    }

    // El 404 también se negocia: un agente que pide markdown recibe /404.md.
    if (prefersMarkdown(req.headers.accept)) {
      const notFoundMd = await readIfFile("/404.md");
      if (notFoundMd) {
        return send(req, res, 404, notFoundMd.body, {
          "Content-Type": MARKDOWN_CONTENT_TYPE,
          ...negotiationHeaders("/404.md")
        });
      }
    }

    const notFound = await readIfFile("/404.html");
    return send(req, res, 404, notFound ? notFound.body : "404", {
      "Content-Type": "text/html; charset=utf-8",
      ...negotiationHeaders("/404.md")
    });
  });
}
