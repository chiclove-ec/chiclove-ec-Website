// El sitio se publica en Cloudflare Pages y puede construirse para otros hosts, y
// las cabeceras están escritas tres veces: en `_headers` (Cloudflare/Netlify), en
// `vercel.json` y en el `<meta>` de cada página. Estas pruebas impiden que una
// copia se quede atrás, que una referencia interna apunte a un archivo que el
// build no publica y que el cache-busting se desincronice entre páginas.
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { projectRoot } from "../scripts/lib/catalog.mjs";
import { assertContentModified, loadSiteConfig, pageFile, pagePath } from "../scripts/lib/site-config.mjs";
import { loadPublicFiles } from "./public-files.mjs";

const read = (file) => readFileSync(resolve(projectRoot, file), "utf8");
const exists = (file) => existsSync(resolve(projectRoot, file));

const publicFiles = loadPublicFiles();
const htmlPages = [...publicFiles].filter(
  // La página de verificación de Search Console es un testigo de 54 bytes sin <head> propio.
  (file) => file.endsWith(".html") && !file.startsWith("google")
);

const INDEXABLE_ROBOTS = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const indexablePages = htmlPages.filter((file) => !["404.html", "producto.html"].includes(file));

test("contentModified es una fecha ISO de calendario", () => {
  assert.equal(assertContentModified("2026-09-16"), "2026-09-16");
  for (const invalid of ["", "2026-9-16", "2026-02-29", "16-09-2026", "2026-09-16T00:00:00Z"]) {
    assert.throws(() => assertContentModified(invalid), /contentModified/);
  }
  assert.match(loadSiteConfig().contentModified, /^\d{4}-\d{2}-\d{2}$/);
});

test("toda página indexable declara metadatos regionales completos", () => {
  const origin = loadSiteConfig().canonicalOrigin;
  for (const page of indexablePages) {
    const html = read(page);
    const expectedUrl = origin + "/" + pagePath(page);
    const markdown = page.replace(/\.html$/, ".md");
    assert.match(html, /<html lang="es-EC">/, `${page} no declara es-EC`);
    assert.match(html, /<meta name="author" content="Chic&amp;Love Ecuador">/, `${page} no declara autor`);
    assert.match(html, new RegExp('<meta name="robots" content="' + INDEXABLE_ROBOTS + '">'), `${page} no declara robots`);
    assert.match(html, /<meta property="og:locale" content="es_EC">/, `${page} no declara og:locale`);
    assert.match(html, new RegExp('<meta property="og:url"[^>]*content="' + expectedUrl.replace(/[.]/g, "\\.") + '">'), `${page} no declara og:url`);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, `${page} no declara twitter:card`);
    assert.match(html, new RegExp('<link rel="canonical"[^>]*href="' + expectedUrl.replace(/[.]/g, "\\.") + '">'), `${page} no declara canonical`);
    assert.match(html, new RegExp('<link rel="alternate" type="text/markdown" href="' + origin + "/" + markdown.replace(/[.]/g, "\\.") + '"'), `${page} no declara su gemelo Markdown`);
  }
});

test("las páginas de recuperación y plantilla permanecen fuera del índice", () => {
  for (const page of ["404.html", "producto.html"]) {
    const html = read(page);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(html, new RegExp(INDEXABLE_ROBOTS));
  }
});

/* ---------- Cabeceras de seguridad en las tres copias ---------- */

// Las cabeceras que un navegador acepta por `<meta http-equiv>`; el resto
// (HSTS, X-Frame-Options, COOP/COEP…) solo existe por cabecera HTTP real.
const CSP = "Content-Security-Policy";

function cspFromHeadersFile() {
  const line = read("_headers")
    .split("\n")
    .find((row) => row.trim().startsWith(CSP + ":"));
  assert.ok(line, "_headers no declara Content-Security-Policy");
  return line.trim().slice((CSP + ":").length).trim();
}

function cspFromVercel() {
  const config = JSON.parse(read("vercel.json"));
  const global = config.headers.find((rule) => rule.source === "/(.*)");
  assert.ok(global, "vercel.json no tiene una regla de cabeceras global");
  const header = global.headers.find((entry) => entry.key === CSP);
  assert.ok(header, "vercel.json no declara Content-Security-Policy");
  return header.value.trim();
}

function cspFromPage(page) {
  const match = read(page).match(
    /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
  );
  assert.ok(match, `${page} no declara la CSP por <meta>`);
  return match[1].trim();
}

test("la CSP es la misma en _headers, vercel.json y todas las páginas", () => {
  const reference = cspFromHeadersFile();
  assert.equal(cspFromVercel(), reference, "vercel.json se desvió de _headers");
  for (const page of htmlPages) {
    assert.equal(cspFromPage(page), reference, `${page} se desvió de _headers`);
  }
});

test("la CSP cierra los sinks y no reabre inline ni orígenes abiertos", () => {
  const csp = cspFromHeadersFile();
  const directives = new Map(
    csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      })
  );

  assert.deepEqual(directives.get("default-src"), ["'none'"], "default-src debe ser 'none'");
  for (const directive of ["object-src", "base-uri", "form-action", "frame-ancestors", "frame-src"]) {
    assert.deepEqual(directives.get(directive), ["'none'"], `${directive} debe ser 'none'`);
  }
  assert.ok(!csp.includes("'unsafe-inline'"), "la CSP no debe permitir 'unsafe-inline'");
  assert.ok(!csp.includes("'unsafe-eval'"), "la CSP no debe permitir 'unsafe-eval'");
  assert.ok(!/(script|style|connect)-src[^;]*\s\*/.test(csp), "ninguna fuente debe ser un comodín");
  assert.match(
    csp,
    /img-src[^;]*https:\/\/www\.googletagmanager\.com/,
    "GA4 necesita su endpoint de medición de imágenes"
  );
  assert.ok(csp.includes("upgrade-insecure-requests"), "falta upgrade-insecure-requests");
});

test("las cabeceras HTTP de seguridad están en todos los hosts que las admiten", () => {
  const headersFile = read("_headers");
  const vercel = JSON.parse(read("vercel.json"));
  const vercelKeys = new Set(
    vercel.headers.find((rule) => rule.source === "/(.*)").headers.map((entry) => entry.key)
  );
  const required = [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Embedder-Policy",
    "Cross-Origin-Resource-Policy"
  ];
  for (const header of required) {
    assert.ok(headersFile.includes(header + ":"), `_headers no declara ${header}`);
    assert.ok(vercelKeys.has(header), `vercel.json no declara ${header}`);
  }
});

test("HSTS y Permissions-Policy cumplen directivas completas de protección", () => {
  const headersFile = read("_headers");
  const vercel = JSON.parse(read("vercel.json"));
  const vercelGlobal = vercel.headers.find((rule) => rule.source === "/(.*)").headers;
  const vercelHsts = vercelGlobal.find((h) => h.key === "Strict-Transport-Security")?.value || "";
  const vercelPerms = vercelGlobal.find((h) => h.key === "Permissions-Policy")?.value || "";

  assert.match(headersFile, /Strict-Transport-Security: max-age=31536000; includeSubDomains; preload/);
  assert.equal(vercelHsts, "max-age=31536000; includeSubDomains; preload");

  assert.match(headersFile, /interest-cohort=\(\)/);
  assert.match(vercelPerms, /interest-cohort=\(\)/);
});

test("el guard anti-frame se carga en todas las páginas, que es lo único que hay en Pages", () => {
  for (const page of htmlPages) {
    assert.match(
      read(page),
      /<script src="\/?js\/frame-guard\.js\?v=/,
      `${page} no carga el guard anti-frame`
    );
  }
});

/* ---------- Integridad de las referencias internas ---------- */

// href/src de las páginas y url(...) de la hoja de estilos, en forma de ruta
// relativa a la raíz del sitio y sin ancla ni query.
function internalReferences(source, { css = false } = {}) {
  const raw = css
    ? [...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(([, value]) => value)
    : [...source.matchAll(/(?:href|src)="([^"]*)"/g)].map(([, value]) => value);

  return raw
    .filter((value) => !/^(?:[a-z]+:|\/\/|#|$)/i.test(value))
    .map((value) => value.split("#")[0].split("?")[0])
    .filter(Boolean)
    .map((value) => value.replace(/^\.\//, "").replace(/^\//, ""));
}

test("cada referencia interna existe en el repositorio", () => {
  for (const page of [...htmlPages, "producto.html"]) {
    for (const reference of internalReferences(read(page))) {
      const target = exists(reference) ? reference : reference + ".html";
      assert.ok(exists(target), `${page} apunta a ${reference}, que no existe`);
    }
  }
  for (const reference of internalReferences(read("css/styles.css"), { css: true })) {
    const target = reference.startsWith("assets/") ? reference : "css/" + reference;
    assert.ok(exists(target) || exists(reference), `styles.css apunta a ${reference}, que no existe`);
  }
});

test("todo lo que una página publicada referencia también se publica", () => {
  for (const page of htmlPages) {
    for (const reference of internalReferences(read(page))) {
      const target = publicFiles.has(reference) ? reference : pageFile(reference);
      assert.ok(
        publicFiles.has(target),
        `${page} referencia ${reference}, que falta en la lista blanca de scripts/build.mjs`
      );
    }
  }
  for (const reference of internalReferences(read("css/styles.css"), { css: true })) {
    if (!reference.startsWith("assets/")) continue;
    assert.ok(
      publicFiles.has(reference),
      `styles.css referencia ${reference}, que falta en la lista blanca de scripts/build.mjs`
    );
  }
});

test("la lista blanca del build no arrastra archivos que ya no existen", () => {
  for (const entry of publicFiles) {
    assert.ok(exists(entry), `la lista blanca publica ${entry}, que ya no existe`);
  }
});

/* ---------- Cache-busting ---------- */

test("el cache-busting de CSS y JS es el mismo en todas las páginas", () => {
  const versions = new Map();
  for (const page of [...htmlPages, "producto.html"]) {
    for (const [, version] of read(page).matchAll(/(?:\.css|\.js)\?v=([0-9A-Za-z.-]+)"/g)) {
      if (!versions.has(version)) versions.set(version, []);
      versions.get(version).push(page);
    }
  }
  assert.equal(
    versions.size,
    1,
    "hay más de un token ?v=: " +
      [...versions].map(([version, pages]) => `${version} en ${pages.join(", ")}`).join(" | ")
  );
});

test("todo CSS y JS propio se pide con cache-busting", () => {
  for (const page of [...htmlPages, "producto.html"]) {
    const source = read(page);
    for (const [, reference] of source.matchAll(/(?:href|src)="\/?((?:css|js)\/[^"]+)"/g)) {
      assert.match(reference, /\?v=/, `${page} pide ${reference} sin ?v=`);
    }
  }
});

/* ---------- security.txt ---------- */

test("security.txt sigue vigente y declara un canal de contacto", () => {
  const source = read(".well-known/security.txt");
  const expires = source.match(/^Expires:\s*(\S+)/m);
  assert.ok(expires, "security.txt no declara Expires, que es obligatorio (RFC 9116)");

  const deadline = new Date(expires[1]);
  assert.ok(!Number.isNaN(deadline.getTime()), "la fecha de Expires no es válida");
  assert.ok(
    deadline.getTime() > Date.now(),
    `security.txt caducó el ${expires[1]}: renueva Expires antes de desplegar`
  );

  assert.match(source, /^Contact:\s*\S+/m, "security.txt no declara Contact");

  // Canonical evita que el archivo sirva de aval si alguien lo replica en otro
  // dominio. Se reescribe con el resto del sitio, así que debe salir del origen
  // declarado y no de un dominio escrito a mano.
  const canonical = source.match(/^Canonical:\s*(\S+)$/m);
  assert.ok(canonical, "security.txt no declara Canonical (RFC 9116)");
  assert.equal(
    canonical[1],
    loadSiteConfig().canonicalOrigin + "/.well-known/security.txt",
    "Canonical no apunta al dominio declarado en site.config.json"
  );
});
