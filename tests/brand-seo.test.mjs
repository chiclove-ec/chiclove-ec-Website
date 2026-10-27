import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { loadCatalog, projectRoot } from "../scripts/lib/catalog.mjs";
import { loadSiteConfig } from "../scripts/lib/site-config.mjs";

const SEARCH_NAME = "Chic&Love Ecuador";
const FORBIDDEN_ALIAS = /Chic&Love EC|ChicLove EC/;
const catalog = loadCatalog();
const read = (file) => readFileSync(resolve(projectRoot, file), "utf8");
const htmlPages = [
  "index.html",
  "tienda.html",
  "nosotros.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "terms.html",
  ...catalog.CL_PRODUCTS.map((product) => product.id + ".html")
];

function jsonLd(file) {
  return [...read(file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json))
    .flatMap((data) => (data["@graph"] ? data["@graph"] : [data]));
}

const nodesOfType = (file, type) =>
  jsonLd(file).filter((node) => [].concat(node["@type"] ?? []).includes(type));

test("la identidad SEO usa exactamente Chic&Love Ecuador", () => {
  const home = read("index.html");

  assert.match(home, /<title>Chic&amp;Love Ecuador — Vitaminas y complementos en gummies<\/title>/);
  assert.match(home, /<meta property="og:site_name" content="Chic&amp;Love Ecuador">/);
  assert.match(home, /<meta property="og:title" content="Chic&amp;Love Ecuador — Vitaminas y complementos en gummies">/);

  const organization = nodesOfType("index.html", "Organization")[0];
  const website = nodesOfType("index.html", "WebSite")[0];
  assert.equal(loadSiteConfig().brandName, SEARCH_NAME);
  assert.equal(organization.name, SEARCH_NAME);
  assert.equal(website.name, SEARCH_NAME);
  assert.ok(!organization.alternateName.includes("Chic&Love EC"));
  assert.ok(!FORBIDDEN_ALIAS.test(home));
});

test("Google recibe un solo WebSite canónico y alternativas de la tienda ecuatoriana", () => {
  const websites = nodesOfType("index.html", "WebSite");
  assert.equal(websites.length, 1, "no crear un segundo WebSite para indicar el nombre");
  const website = websites[0];
  const base = loadSiteConfig().base;
  assert.equal(website.url, base);
  assert.equal(website["@id"], base + "#website");
  assert.equal(website.publisher["@id"], base + "#organization");
  assert.deepEqual(website.alternateName, ["Chic & Love Ecuador", "Chic and Love Ecuador"]);
  assert.ok(website.alternateName.every((name) => name.endsWith(" Ecuador")));
  // La misma forma debe existir en el contenido visible, además de en el JSON-LD.
  const body = read("index.html").split("</head>")[1];
  assert.match(body, /<p class="manifesto-sign">Chic&amp;Love Ecuador<\/p>/);
  assert.match(body, /alt="Chic&amp;Love Ecuador"/);
});

test("todas las páginas publican el nombre oficial en Open Graph y Organization", () => {
  for (const page of htmlPages) {
    const html = read(page);
    assert.match(html, /<meta property="og:site_name" content="Chic&amp;Love Ecuador">/, page);
    assert.match(html, /<title>[^<]*Chic&amp;Love Ecuador[^<]*<\/title>/, `${page}: título sin nombre oficial completo`);
    assert.ok(!FORBIDDEN_ALIAS.test(html), `${page}: alias corto no permitido`);
    for (const organization of nodesOfType(page, "Organization")) {
      assert.equal(organization.name, SEARCH_NAME, `${page}: Organization.name`);
    }
  }
});

test("el catálogo para máquinas no ofrece ChicLove EC como nombre de marca", () => {
  const data = JSON.parse(read("catalog.json"));
  assert.equal(data.brand.storefront, SEARCH_NAME);
  assert.ok(!data.brand.alternateNames.includes("Chic&Love EC"));
  // «Chic&Love EC» sí puede aparecer como FORMA DE BÚSQUEDA (brand.searchVariants): es como
  // la escribe la gente. Lo que no puede es ser un NOMBRE, que es lo que Google usa para
  // elegir el título del sitio. Se comprueba todo el JSON salvo esas listas de búsqueda.
  const { searchVariants, searchVariantsNote, categoryQueries, ...brand } = data.brand;
  assert.ok(searchVariants.includes("Chic&Love EC"), "faltan las formas de búsqueda con EC");
  assert.ok(!FORBIDDEN_ALIAS.test(JSON.stringify({ ...data, brand })));
});
