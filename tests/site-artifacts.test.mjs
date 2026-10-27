// Contrato de los artefactos públicos: gemelos markdown, llms.txt, páginas de confianza,
// 404 recuperable, sitemap, lista blanca del build y coherencia con el catálogo.
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { loadCatalog, projectRoot } from "../scripts/lib/catalog.mjs";
import { loadSiteConfig, pagePath, pageFile } from "../scripts/lib/site-config.mjs";
import { MARKDOWN_TWINS } from "../scripts/lib/markdown-negotiation.mjs";

const BASE = loadSiteConfig().base;
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const read = (file) => readFileSync(resolve(projectRoot, file), "utf8");
const exists = (file) => existsSync(resolve(projectRoot, file));
const catalog = loadCatalog();

// Texto visible aproximado: sin <head>, sin scripts/estilos y sin etiquetas.
function visibleText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const htmlPages = Object.keys(MARKDOWN_TWINS).map((path) => path.slice(1));
const markdownFiles = Object.values(MARKDOWN_TWINS).map((path) => path.slice(1));
const TRUST_ANCHORS = ["about", "contact", "privacy", "terms"];

/* ---------- Gemelos markdown ---------- */

test("cada página HTML publicada tiene su gemelo markdown", () => {
  for (const page of htmlPages) {
    assert.ok(exists(page), `falta ${page}`);
    assert.ok(exists(MARKDOWN_TWINS["/" + page].slice(1)), `falta el gemelo de ${page}`);
  }
});

test("cada página HTML declara su gemelo con rel=alternate", () => {
  for (const page of htmlPages) {
    const expected = BASE + MARKDOWN_TWINS["/" + page].slice(1);
    const tag = new RegExp(
      '<link rel="alternate" type="text/markdown" href="' + expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'
    );
    assert.match(read(page), tag, `${page} no declara ${expected}`);
  }
});

test("todo markdown publicado empieza por un H1 y tiene contenido", () => {
  for (const file of [...markdownFiles, "404.md", "agents.md"]) {
    const body = read(file);
    assert.match(body, /^# \S/, `${file} no empieza por un H1`);
    assert.ok(body.length > 200, `${file} es demasiado corto`);
  }
});

/* ---------- llms.txt (llmstxt.org) ---------- */

test("llms.txt sigue la estructura de llmstxt.org", () => {
  const lines = read("llms.txt").split("\n");
  assert.match(lines[0], /^# \S/, "la primera línea debe ser el H1 con el nombre del sitio");

  const summary = lines.slice(1).find((line) => line.trim() !== "");
  assert.match(summary, /^> \S/, "tras el H1 debe ir el resumen como blockquote");

  const headings = lines.filter((line) => line.startsWith("#"));
  assert.equal(headings.filter((line) => line.startsWith("# ")).length, 1, "solo puede haber un H1");
  assert.ok(
    headings.filter((line) => line.startsWith("## ")).length >= 2,
    "debe haber secciones H2"
  );
  for (const heading of headings) {
    assert.match(heading, /^(# |## )/, `nivel de encabezado no permitido: ${heading}`);
  }

  // Las viñetas de las secciones son enlaces markdown con nota opcional tras «:».
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith("## ")) inSection = true;
    if (inSection && line.startsWith("- ")) {
      assert.match(line, /^- \[[^\]]+\]\([^)]+\)(: .+)?$/, `viñeta no conforme: ${line}`);
    }
  }
});

test("llms.txt explica cuándo usar el sitio y cómo llamarlo", () => {
  const body = read("llms.txt");
  assert.match(body, /^## .*[Cc]uándo usar este sitio.*$/m, "falta la sección de cuándo usarlo");
  assert.match(body, /when to use this/i, "la sección debe ser localizable en inglés");
  assert.match(body, /Cómo llamar a este sitio/, "falta la guía de cómo llamar al sitio");
  assert.match(body, /No uses este sitio para/, "falta el límite de uso");
  assert.match(body, /Accept: text\/markdown|`\.md`/, "debe explicar el acceso markdown");
});

test("los enlaces internos de llms.txt apuntan a archivos publicados", () => {
  const pattern = new RegExp("\\]\\((" + escapeRe(BASE) + "[^)]*)\\)", "g");
  const links = [...read("llms.txt").matchAll(pattern)];
  assert.ok(links.length >= 15, "llms.txt debe indexar el sitio");
  for (const [, url] of links) {
    // El ancla (#…) apunta a un encabezado del documento; el archivo es lo que va antes.
    // tests/agent-knowledge.test.mjs comprueba que cada ancla exista.
    const path = pageFile(url.slice(BASE.length).split("#")[0]);
    assert.ok(exists(path), `llms.txt enlaza a ${url}, que no existe en el repositorio`);
  }
});

test("todos los productos del catálogo están en llms.txt", () => {
  const body = read("llms.txt");
  for (const product of catalog.CL_PRODUCTS) {
    assert.match(body, new RegExp(product.id + "\\.md"), `${product.id} no está en llms.txt`);
  }
});

/* ---------- Instrucciones para agentes y volcado completo ---------- */

test("agents.md es autocontenido: identidad, cuándo usarlo y cómo leerlo", () => {
  const body = read("agents.md");
  assert.match(body, /^## .*[Cc]uándo usar este sitio.*$/m, "falta cuándo usarlo");
  assert.match(body, /when to use this/i, "la sección debe ser localizable en inglés");
  assert.match(body, /^## .*[Cc]uándo NO usar este sitio.*$/m, "falta cuándo no usarlo");
  assert.match(body, /^## Cómo leer el sitio$/m, "falta cómo leer el sitio");
  // El dominio oficial (Cloudflare Pages) negocia por `Accept`; agents.md debe decirlo,
  // y seguir ofreciendo la URL `.md` como camino que funciona en cualquier espejo.
  assert.match(body, /negocia por cabecera `Accept`/, "no explica la negociación de contenido");
  assert.match(body, /URL `\.md`/, "no ofrece la URL .md como alternativa");
  assert.ok(body.includes(catalog.clWhatsAppDisplay()), "falta el contacto humano");
  assert.ok(body.includes("llms-full.txt"), "no apunta al volcado completo");
});

test("llms-full.txt reúne el markdown de todo el sitio", () => {
  const bundle = read("llms-full.txt");
  const expected = [
    "index.md",
    "tienda.md",
    "about.md",
    "contact.md",
    "privacy.md",
    "terms.md",
    "nosotros.md",
    ...catalog.CL_PRODUCTS.map((p) => p.id + ".md")
  ];
  for (const page of expected) {
    assert.ok(
      bundle.includes("<!-- source: " + BASE + page + " -->"),
      `llms-full.txt no incluye ${page}`
    );
    // El contenido, no solo la referencia: se comprueba el H1 de cada página.
    const [heading] = read(page).split("\n");
    assert.ok(bundle.includes(heading), `llms-full.txt no trae el contenido de ${page}`);
  }
});

test("robots.txt permite a los rastreadores de IA y señala los recursos", () => {
  const body = read("robots.txt");
  for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Applebot"]) {
    assert.match(
      body,
      new RegExp("User-agent: " + bot + "\\nAllow: /"),
      `robots.txt no permite explícitamente a ${bot}`
    );
  }
  assert.match(body, new RegExp("^Sitemap: " + escapeRe(BASE) + "sitemap\\.xml$", "m"));
  assert.ok(body.includes("llms.txt"), "robots.txt no señala llms.txt");
  assert.ok(!/^Disallow: \/$/m.test(body), "robots.txt bloquea el sitio");
});

test("ningún texto publicado niega la analítica que el sitio sí carga", () => {
  const usaAnalitica = htmlPages.some((page) => read(page).includes("js/analytics.js"));
  if (!usaAnalitica) return; // Si algún día se quita la analítica, la prueba deja de aplicar.

  // Frases que dejarían al sitio mintiendo sobre su propio rastreo.
  const desmentidas = [
    /no ejecutamos analítica/i,
    /sin analítica/i,
    /no usamos cookies/i,
    /sin cookies/i,
    /sin scripts de terceros/i,
    /no recoge datos/i
  ];
  const revisables = [
    ...htmlPages,
    ...markdownFiles,
    "agents.md",
    "llms.txt",
    "llms-full.txt",
    "404.md"
  ];
  for (const file of revisables) {
    const body = read(file);
    for (const frase of desmentidas) {
      assert.ok(
        !frase.test(body),
        `${file} afirma ${frase} mientras el sitio carga js/analytics.js`
      );
    }
  }
});

test("la política de privacidad describe la analítica y el consentimiento", () => {
  for (const file of ["privacy.html", "privacy.md"]) {
    const body = read(file);
    assert.match(body, /analytics|analítica/i, `${file} no menciona la analítica`);
    assert.match(body, /consentimiento|aceptas|acepta/i, `${file} no menciona el consentimiento`);
  }
});

/* ---------- Páginas de confianza ---------- */

test("las páginas de confianza superan los 500 caracteres de contenido", () => {
  for (const anchor of TRUST_ANCHORS) {
    const text = visibleText(read(anchor + ".html"));
    assert.ok(
      text.length >= 500,
      `${anchor}.html solo tiene ${text.length} caracteres de texto visible`
    );
    const markdown = read(anchor + ".md");
    assert.ok(markdown.length >= 500, `${anchor}.md solo tiene ${markdown.length} caracteres`);
  }
});

test("las páginas de confianza tienen título, descripción y canónica propios", () => {
  for (const anchor of TRUST_ANCHORS) {
    const html = read(anchor + ".html");
    assert.match(html, /<title>[^<]*Chic&amp;Love Ecuador<\/title>/, `${anchor}: título`);
    assert.match(html, /<meta name="description" content="[^"]{80,}">/, `${anchor}: descripción`);
    assert.match(
      html,
      new RegExp('<link rel="canonical" href="' + BASE + pagePath(anchor + '.html') + '">'),
      `${anchor}: canónica`
    );
    assert.match(html, /application\/ld\+json/, `${anchor}: datos estructurados`);
  }
});

test("todas las páginas enlazan a las páginas de confianza desde el pie", () => {
  for (const page of htmlPages) {
    const html = read(page);
    for (const anchor of TRUST_ANCHORS) {
      assert.match(html, new RegExp('href="' + pagePath(anchor + '.html') + '"'), `${page} no enlaza ${anchor}`);
    }
  }
});

/* ---------- 404 recuperable ---------- */

test("el 404 ofrece rutas de recuperación para agentes", () => {
  const html = read("404.html");
  for (const target of ["/llms.txt", "/sitemap.xml", "/", "/tienda", "/404.md"]) {
    assert.match(html, new RegExp('href="' + target + '"'), `404.html no enlaza ${target}`);
  }
  assert.match(html, /<meta name="robots" content="noindex">/, "el 404 no debe indexarse");
  assert.match(
    html,
    /<link rel="alternate" type="text\/markdown" href="\/404\.md"/,
    "el 404 debe declarar su gemelo markdown"
  );

  const markdown = read("404.md");
  assert.match(markdown, /^# 404/, "404.md debe titularse como error 404");
  for (const target of ["llms.txt", "sitemap.xml", "tienda.md", "contact.md"]) {
    assert.ok(markdown.includes(target), `404.md no apunta a ${target}`);
  }
});

/* ---------- Sitemap y lista blanca del build ---------- */

test("el sitemap lista las páginas indexables y solo esas", () => {
  const locs = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  for (const anchor of TRUST_ANCHORS) {
    assert.ok(locs.includes(BASE + pagePath(anchor + ".html")), `el sitemap no incluye ${anchor}`);
  }
  for (const url of locs) {
    const path = pageFile(url.slice(BASE.length));
    assert.ok(exists(path), `el sitemap apunta a ${url}, que no existe`);
    assert.ok(!path.endsWith(".md"), "los gemelos markdown no van en el sitemap");
  }
  assert.ok(!locs.some((url) => url.endsWith("404")), "el 404 no va en el sitemap");
  assert.ok(!locs.some((url) => url.endsWith("producto")), "la página legacy no va en el sitemap");
});

test("la lista blanca del build publica todos los artefactos nuevos", () => {
  const build = read("scripts/build.mjs");
  const required = [
    ...htmlPages,
    ...markdownFiles,
    "404.html",
    "404.md",
    "agents.md",
    "llms.txt",
    "llms-full.txt",
    "ai.txt",
    "robots.txt",
    "sitemap.xml"
  ];
  for (const file of required) {
    assert.ok(build.includes('"' + file + '"'), `${file} no está en la lista blanca del build`);
  }
});

/* ---------- Coherencia con el catálogo ---------- */

test("los precios publicados coinciden con el catálogo", () => {
  // El precio de lista cuenta aunque ninguna fórmula lo cobre hoy: con todo el catálogo
  // en promoción, «antes $29.99» y «precio de catálogo» siguen siendo datos reales.
  const allowed = new Set(
    catalog.CL_PRODUCTS.flatMap((p) => [
      catalog.clMoney(catalog.clSinglePrice(p)),
      catalog.clMoney(p.price),
      catalog.clMoney(p.pricePack),
      catalog.clMoney(p.pricePack3)
    ]).concat(catalog.clMoney(catalog.CL_FREE_SHIPPING))
  );

  const files = [
    ...markdownFiles,
    "404.md",
    "agents.md",
    "llms.txt",
    "llms-full.txt",
    "guia-de-eleccion.md",
    "ingredientes.md",
    ...TRUST_ANCHORS.map((a) => a + ".html")
  ];
  for (const file of files) {
    for (const [price] of read(file).matchAll(/\$\d+\.\d{2}/g)) {
      assert.ok(allowed.has(price), `${file} publica ${price}, que no está en el catálogo`);
    }
  }
});

test("el teléfono y el usuario de Instagram coinciden con el catálogo", () => {
  // Además del WhatsApp de la marca, las páginas legales publican las fijas del
  // distribuidor: cualquier otro número sería un canal que no controlamos.
  const strip = (value) => value.replaceAll(" ", "");
  const known = new Set(
    [catalog.clWhatsAppDisplay(), ...catalog.CL_LEGAL.phones].map(strip)
  );
  const handle = "@" + catalog.CL_INSTAGRAM;
  for (const file of ["llms.txt", "agents.md", "about.md", "contact.md", "privacy.md", "terms.md", "contact.html", "terms.html"]) {
    const body = read(file);
    // Se compara sin espacios: el JSON-LD usa E.164 y el texto el formato legible.
    for (const [found] of body.matchAll(/\+593(?: ?\d){9}/g)) {
      assert.ok(
        known.has(strip(found)),
        `${file} publica ${found}, que no es un teléfono del catálogo`
      );
    }
    for (const [found] of body.matchAll(/@chiclove[a-z]*/g)) {
      assert.equal(found, handle, `${file} publica un Instagram distinto al del catálogo`);
    }
  }
  assert.ok(read("contact.md").includes("wa.me/" + catalog.CL_WHATSAPP), "falta el enlace wa.me");
});

test("los gemelos markdown de producto reflejan el catálogo", () => {
  for (const product of catalog.CL_PRODUCTS) {
    const markdown = read(product.id + ".md");
    assert.ok(markdown.includes(product.name), `${product.id}.md no nombra el producto`);
    assert.ok(
      markdown.includes(catalog.clMoney(catalog.clSinglePrice(product))),
      `${product.id}.md no publica el precio vigente`
    );
    assert.ok(markdown.includes(product.dose), `${product.id}.md no publica la dosis`);
    assert.ok(
      markdown.includes("Disponibilidad confirmada por WhatsApp; no hay stock en tiempo real."),
      `${product.id}.md no explica cómo confirmar disponibilidad`
    );
    for (const active of product.actives) {
      assert.ok(markdown.includes(active), `${product.id}.md no lista el activo ${active}`);
    }
  }
});

/* ---------- Verificación de Google Search Console ---------- */

test("la portada publica la etiqueta de verificación de Search Console", () => {
  // Segundo método de verificación, además del DNS. Hace falta porque el testigo
  // `googlee70d0e2c8fe95f2c.html` NO responde 200 en el dominio oficial: Cloudflare le
  // aplica la redirección a URLs limpias y devuelve un 308. Una etiqueta meta es inmune
  // a eso. Google avisa de que quitarla revoca la verificación aunque ya esté hecha, así
  // que esta prueba existe para que nadie la borre limpiando el <head>.
  const home = read("index.html");
  assert.match(
    home,
    /<meta name="google-site-verification" content="[A-Za-z0-9_-]{30,}">/,
    "index.html ya no declara la etiqueta de verificación de Search Console"
  );

  // Va solo en la portada: es la única página que Google comprueba, y repetirla
  // en las demás solo añade ruido que alguien acabará desincronizando.
  for (const page of htmlPages.filter((file) => file !== "index.html")) {
    assert.doesNotMatch(
      read(page),
      /google-site-verification/,
      `${page} no debe llevar la etiqueta de verificación: va solo en la portada`
    );
  }
});
