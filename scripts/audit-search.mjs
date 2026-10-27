// Auditoría pública de solo lectura. Ejecutar DESPUÉS de publicar; no consulta
// Search Console ni confirma que Google haya elegido un nombre o indexado una URL.
import { strict as assert } from "node:assert";
import { loadSiteConfig } from "./lib/site-config.mjs";
import { PRODUCT_PATHS, VERIFICATION_FILES } from "./lib/search-routes.mjs";

const { canonicalOrigin: origin, brandName, contentModified } = loadSiteConfig();
const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const results = [];
const get = (path, options = {}) => fetch(new URL(path, origin), {
  redirect: "manual",
  signal: AbortSignal.timeout(20000),
  ...options,
  headers: { Accept: "text/html", "User-Agent": googlebot, ...options.headers }
});
async function check(label, action) {
  try {
    await action();
    results.push({ check: label, ok: true });
  } catch (error) {
    results.push({ check: label, ok: false, error: error.message });
  }
}
const nodes = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap(([, raw]) => { const data = JSON.parse(raw); return data["@graph"] ?? [data]; });
const ofType = (html, type) => nodes(html).filter((node) => [].concat(node["@type"]).includes(type));
const noBlockingHeader = (response) => assert.doesNotMatch(response.headers.get("x-robots-tag") ?? "", /noindex|none/i);
const encodedBrand = brandName.replaceAll("&", "&amp;");
let locations = [];

await check("Sitemap público: solo URLs canónicas y fecha publicada", async () => {
  const response = await get("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /xml/);
  const xml = await response.text();
  locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  assert.equal(locations.length, 14);
  assert.equal(new Set(locations).size, locations.length);
  assert.ok(locations.every((url) => new URL(url).origin === origin && !/\.html|\.md|\?/.test(url)));
  const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(([, date]) => date);
  assert.equal(dates.length, locations.length);
  assert.ok(dates.every((date) => date === contentModified));
});

await check("Robots permite Googlebot y declara el sitemap", async () => {
  const response = await get("/robots.txt");
  assert.equal(response.status, 200);
  const robots = await response.text();
  assert.ok(robots.includes("Sitemap: " + origin + "/sitemap.xml"));
  assert.match(robots, /User-agent: Googlebot\s+Allow: \/(?:\s|$)/);
  assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m);
});

// En lotes pequeños para no bombardear el origen con peticiones simultáneas.
for (let index = 0; index < locations.length; index += 3) {
  await Promise.all(locations.slice(index, index + 3).map((url) => check(new URL(url).pathname, async () => {
    const response = await get(url);
    assert.equal(response.status, 200, "Googlebot debe recibir HTML sin redirección");
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    noBlockingHeader(response);
    const html = await response.text();
    assert.doesNotMatch(html, /<meta\s+name="(?:robots|googlebot)"[^>]*content="[^"]*(?:noindex|none)/i);
    const canonicals = [...html.matchAll(/<link rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
    assert.equal(canonicals.length, 1);
    assert.equal(canonicals[0][1], url);
    assert.ok(html.includes('<meta property="og:site_name" content="' + encodedBrand + '">'));
    assert.ok(html.match(/<title>([^<]+)<\/title>/)?.[1].includes(encodedBrand));
    if (new URL(url).pathname === "/") {
      assert.ok(html.includes('<meta name="google-site-verification"'));
      const websites = ofType(html, "WebSite");
      assert.equal(websites.length, 1);
      assert.equal(websites[0].name, brandName);
      assert.equal(websites[0].url, origin + "/");
      assert.ok(websites[0].alternateName.every((name) => name.endsWith(" Ecuador")));
      assert.equal(ofType(html, "Organization")[0].name, brandName);
    }
    if (Object.values(PRODUCT_PATHS).includes(new URL(url).pathname)) {
      assert.equal(ofType(html, "Product").length, 1);
    }
  })));
}

for (const [id, canonical] of Object.entries(PRODUCT_PATHS)) {
  await check("Producto heredado: " + id, async () => {
    const response = await get("/producto.html?id=" + id);
    assert.equal(response.status, 301);
    assert.equal(new URL(response.headers.get("location"), origin).href, origin + canonical);
  });
}
for (const [path, expected] of Object.entries(VERIFICATION_FILES)) {
  await check("Verificación Search Console: " + path, async () => {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), expected);
  });
}
for (const path of ["/ruta-inexistente-auditoria-google", "/producto?id=no-existe"]) {
  await check("404 real: " + path, async () => {
    const response = await get(path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  });
}
for (const [path, canonical] of [["/index.md", "/"], ["/tienda.md", "/tienda"]]) {
  await check("Markdown consolidado: " + path, async () => {
    const response = await get(path, { headers: { Accept: "text/markdown" } });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("link")?.includes(`<${origin + canonical}>; rel="canonical"`));
  });
}
for (const url of [origin.replace("https:", "http:") + "/", origin.replace("https://", "https://www.") + "/"]) {
  await check("Origen alternativo: " + url, async () => {
    const response = await get(url);
    assert.ok([301, 308].includes(response.status));
    assert.equal(new URL(response.headers.get("location"), url).href, origin + "/");
  });
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), origin, brandName, results }, null, 2));
const failures = results.filter((result) => !result.ok);
console.log(`${results.length - failures.length}/${results.length} comprobaciones públicas correctas.`);
if (failures.length) process.exitCode = 1;
