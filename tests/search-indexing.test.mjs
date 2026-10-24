import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";

import { onRequest } from "../functions/_middleware.js";
import { projectRoot } from "../scripts/lib/catalog.mjs";
import { loadSiteConfig } from "../scripts/lib/site-config.mjs";
import { createSiteServer } from "../scripts/lib/static-site.mjs";

const origin = loadSiteConfig().canonicalOrigin;
const productIds = ["hair-nails-forte", "radiant-skin", "vinagre-de-manzana", "sleep-vitamins",
  "sexual-booster-women", "sexual-booster-men", "anti-stress"];

// La normalización de .html por ASSETS es precisamente el problema del testigo.
const assetFetch = async (url) => {
  const path = new URL(url).pathname;
  if (path.endsWith(".html")) {
    return new Response(null, { status: 308, headers: { Location: path.slice(0, -5) } });
  }
  try {
    return new Response(readFileSync(resolve(projectRoot, path === "/404" ? "404.html" : "." + path)), {
      headers: { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" }
    });
  } catch {
    return new Response("missing", { status: 404 });
  }
};

const edge = (path, { method = "GET", accept = "text/html", status = 200 } = {}) =>
  onRequest({
    request: new Request(origin + path, { method, headers: { Accept: accept } }),
    env: { ASSETS: { fetch: assetFetch } },
    next: async () => {
      const directMarkdown = path.split("?")[0].endsWith(".md") && status === 200;
      return new Response(method === "HEAD" ? null : directMarkdown
        ? readFileSync(resolve(projectRoot, "." + path.split("?")[0])) : "<!DOCTYPE html>existing page", {
        status,
        headers: { "Content-Type": directMarkdown ? "text/markdown; charset=utf-8" : "text/html",
          Vary: "Origin", "X-Frame-Options": "DENY" }
      });
    }
  });

test("las siete URLs heredadas redirigen directamente a su ficha sin JavaScript", async () => {
  for (const id of productIds) {
    for (const path of ["/producto", "/producto.html", "/producto/"]) {
      const response = await edge(path + "?id=" + id);
      assert.equal(response.status, 301, path + "?id=" + id);
      assert.equal(new URL(response.headers.get("location"), origin).href, origin + "/" + id);
      assert.equal(await response.text(), "");
    }
  }
});

test("las redirecciones conservan campañas, retiran id y admiten HEAD", async () => {
  const response = await edge("/producto.html?utm_source=google&id=anti-stress&ref=a%26b", { method: "HEAD" });
  assert.equal(response.status, 301);
  assert.equal(new URL(response.headers.get("location"), origin).href,
    origin + "/anti-stress?utm_source=google&ref=a%26b");
  assert.equal(await response.text(), "");
});

test("un producto inexistente o ambiguo devuelve el 404 existente", async () => {
  for (const query of ["", "?id=", "?id=no-existe", "?id=toString", "?id=__proto__",
    "?id=https%3A%2F%2Fevil.example", "?id=anti-stress&id=radiant-skin"]) {
    for (const accept of ["text/html", "text/markdown"]) {
      const response = await edge("/producto" + query, { accept });
      assert.equal(response.status, 404, query);
      assert.equal(response.headers.get("location"), null);
      assert.match(response.headers.get("x-robots-tag"), /noindex/);
      assert.match(await response.text(), /404|Página no encontrada/);
    }
  }
});

test("el 404 heredado contiene recuperación también con la normalización real de Pages", async () => {
  const response = await edge("/producto?id=no-existe");
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("location"), null);
  assert.match(await response.text(), /href="\/tienda"/);
});

test("el testigo de Search Console se entrega exactamente y sin redirección", async () => {
  for (const method of ["GET", "HEAD"]) {
    const response = await edge("/googlee70d0e2c8fe95f2c.html", { method });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(await response.text(), method === "HEAD" ? "" :
      readFileSync(resolve(projectRoot, "googlee70d0e2c8fe95f2c.html"), "utf8"));
  }
});

test("los gemelos markdown declaran su HTML canónico por HTTP sin cambiar el texto", async () => {
  for (const [path, canonical] of [["/index.md", "/"], ["/tienda.md", "/tienda"],
    ["/contact.md", "/contact"], ["/sexual-booster-women.md", "/sexual-booster-women"]]) {
    const response = await edge(path, { accept: "text/markdown" });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("link")?.includes(`<${origin + canonical}>; rel="canonical"`), path);
  }
  const negotiated = await edge("/anti-stress", { accept: "text/markdown" });
  assert.match(negotiated.headers.get("link"), /rel="canonical"/);
  assert.match(negotiated.headers.get("link"), /rel="alternate"/);
  assert.equal(await negotiated.text(), readFileSync(resolve(projectRoot, "anti-stress.md"), "utf8"));
});

test("el 404 varía por Accept en ambos formatos y no se indexa", async () => {
  for (const accept of ["text/html", "text/markdown"]) {
    const response = await edge("/no-existe", { status: 404, accept });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("vary"), /Accept/);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
  }
});

test("la negociación conserva las cabeceras previas y los documentos independientes", async () => {
  const response = await edge("/tienda");
  assert.match(response.headers.get("vary"), /Origin/);
  assert.match(response.headers.get("vary"), /Accept/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  for (const path of ["/respuestas.md", "/guia-de-eleccion.md", "/ingredientes.md", "/catalog.json"]) {
    const independent = await edge(path);
    assert.equal(independent.headers.get("link"), null, path);
    assert.equal(independent.headers.get("x-robots-tag"), null, path);
  }
});

let server;
let localOrigin;
before(async () => {
  server = createSiteServer(projectRoot);
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  localOrigin = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

test("el servidor local reproduce redirección, 404 y canónica markdown de producción", async () => {
  const redirect = await fetch(localOrigin + "/producto.html?id=sexual-booster-women", { redirect: "manual" });
  assert.equal(redirect.status, 301);
  assert.equal(new URL(redirect.headers.get("location"), localOrigin).pathname, "/sexual-booster-women");
  const missing = await fetch(localOrigin + "/producto?id=no-existe");
  assert.equal(missing.status, 404);
  const markdown = await fetch(localOrigin + "/tienda.md");
  assert.ok(markdown.headers.get("link")?.includes(`<${localOrigin}/tienda>; rel="canonical"`));
});
