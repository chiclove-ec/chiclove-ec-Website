// Regenera los datos estructurados que dependen de otra fuente:
//   - FAQPage en index.html      ← desde los <details> visibles de la propia página
//   - ItemList en index.html     ← desde el catálogo
//   - CollectionPage en tienda.html ← desde el catálogo
//
// Van estáticos en el HTML para que buscadores y agentes los lean sin ejecutar JavaScript
// (y porque la CSP no admite scripts inline generados en tiempo de ejecución).
// Reejecutar tras tocar js/products.js o el FAQ de la portada:  npm run gen
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadCatalog, projectRoot as root } from "./lib/catalog.mjs";
import { loadSiteConfig, pagePath } from "./lib/site-config.mjs";
import { shippingPolicy } from "./lib/shipping-policy.mjs";

// El dominio sale de site.config.json; el build lo reescribe si se publica en otro.
const siteConfig = loadSiteConfig();
const BASE = siteConfig.base;
const SITE_NAME = siteConfig.brandName;
const CONTENT_MODIFIED = siteConfig.contentModified;
const catalog = loadCatalog();
const { clSinglePrice, clFreeShippingLabel } = catalog;

const HTML_ENTITIES = Object.freeze({ amp: "&", quot: '"', lt: "<", gt: ">" });
function plainText(html) {
  let text = "";
  let inTag = false;
  for (let index = 0; index < html.length; index += 1) {
    const character = html[index];
    if (character === "<") {
      inTag = true;
      continue;
    }
    if (inTag) {
      if (character === ">") inTag = false;
      continue;
    }
    if (character === "&") {
      const entity = html.slice(index).match(/^&(amp|quot|lt|gt);/);
      if (entity) {
        text += HTML_ENTITIES[entity[1]];
        index += entity[0].length - 1;
        continue;
      }
    }
    text += character;
  }
  return text.replace(/\s+/g, " ").trim();
}

// Reemplaza el bloque ld+json cuyo @type coincide, o lo inserta antes del favicon.
function upsertJsonLd(html, type, data) {
  const block = '<script type="application/ld+json">' + JSON.stringify(data) + "</script>";
  const existing = new RegExp(
    '<script type="application/ld\\+json">\\{[^<]*"@type":"' + type + '"[^<]*</script>'
  );
  if (existing.test(html)) return html.replace(existing, block);
  const anchor = '  <link rel="icon" href="favicon.ico" sizes="48x48">';
  return html.replace(anchor, "  " + block + "\n" + anchor);
}

/* ---------- FAQPage: se lee el FAQ visible de la portada ---------- */

const indexPath = resolve(root, "index.html");
let indexHtml = readFileSync(indexPath, "utf8");

const questions = [
  ...indexHtml.matchAll(
    /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-body"([^>]*)>([\s\S]*?)<\/div>\s*<\/details>/g
  )
].map(([, question, attrs, answer]) => {
  let text = plainText(answer);
  // main.js completa estas dos respuestas desde el catálogo; aquí se dejan resueltas.
  if (attrs.includes("data-free-shipping-faq")) {
    text =
      "Sí, enviamos a todo el país. Envío gratis en compras desde " +
      clFreeShippingLabel() +
      ". IVA incluido.";
  } else if (text.includes("escríbenos al o por Instagram a")) {
    text = text
      .replace("escríbenos al o", "escríbenos al " + catalog.clWhatsAppDisplay() + " o")
      .replace("por Instagram a .", "por Instagram a @" + catalog.CL_INSTAGRAM + ".");
  }
  return {
    "@type": "Question",
    name: plainText(question),
    acceptedAnswer: { "@type": "Answer", text }
  };
});

if (questions.length === 0) throw new Error("No se encontró el FAQ de la portada");

indexHtml = upsertJsonLd(indexHtml, "FAQPage", {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": BASE + "#faq",
  inLanguage: "es-EC",
  isPartOf: { "@id": BASE + "#website" },
  mainEntity: questions
});

/* ---------- ItemList de la portada y CollectionPage de la tienda ---------- */

// Las páginas de portada y catálogo son páginas resumen, no fichas de producto.
// Google recomienda reservar el marcado Product para la página individual que
// concentra toda la oferta; aquí basta con enlazar cada detalle desde el ItemList.
const listItems = () =>
  catalog.CL_PRODUCTS.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: BASE + pagePath(product.id + ".html")
  }));

// En la portada el ItemList vive dentro del @graph con Organization y WebSite.
const graphMatch = /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@graph":\[\{"@type":\["Organization"[\s\S]*?)<\/script>/.exec(
  indexHtml
);
if (!graphMatch) throw new Error("No se encontró el @graph de la portada");

const graph = JSON.parse(graphMatch[1]);
const itemList = graph["@graph"].find((node) => node["@type"] === "ItemList");
if (!itemList) throw new Error("No se encontró el ItemList de la portada");
itemList.itemListElement = listItems();
itemList.isPartOf = { "@id": BASE + "#website" };
itemList.about = { "@id": BASE + "#organization" };
itemList.dateModified = CONTENT_MODIFIED;

const organization = graph["@graph"].find((node) => [].concat(node["@type"]).includes("Organization"));
const website = graph["@graph"].find((node) => node["@type"] === "WebSite");
if (!organization || !website) throw new Error("El grafo de la portada no declara Organization y WebSite");
organization.name = SITE_NAME;
organization.alternateName = ["Chic&Love", "Chic & Love", "Chic and Love Ecuador"];
organization.image = BASE + "assets/img/share-square.jpg";
// Nombre del sitio para Google: el oficial y la forma en que la marca se escribe a sí misma.
website.alternateName = ["Chic&Love Ecuador", "Chic&Love"];
organization.dateModified = CONTENT_MODIFIED;
organization.hasShippingService = shippingPolicy({ base: BASE, freeShipping: catalog.CL_FREE_SHIPPING });
organization.hasOfferCatalog = {
  "@type": "OfferCatalog",
  name: "Colección " + SITE_NAME,
  // La portada ya publica el ItemList completo. Aquí solo se enlazan esas entidades
  // para que Google no reciba dos Products con el mismo @id y duplique `brand`.
  itemListElement: catalog.CL_PRODUCTS.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: { "@id": BASE + pagePath(product.id + ".html") + "#product" }
  }))
};
/* `knowsAbout` con los activos ENLAZADOS a su entidad externa. Un `Thing` con nombre
   obliga a adivinar que la «melisa» del catálogo es Melissa officinalis; un `DefinedTerm`
   con su `sameAs` a Wikidata lo resuelve sin ambigüedad. Los identificadores viven en
   CL_ACTIVES (js/products.js) y están verificados uno a uno. */
const goalLabels = [...new Set(catalog.CL_PRODUCTS.map((product) => product.goalLabel))];
const activeNames = [...new Set(catalog.CL_PRODUCTS.flatMap((product) => product.actives))];
organization.knowsAbout = [
  ...goalLabels.map((name) => ({ "@type": "Thing", name })),
  ...activeNames.map((name) => {
    const info = catalog.clActiveInfo(name);
    return {
      "@type": "DefinedTerm",
      name,
      alternateName: info.aka,
      inDefinedTermSet: { "@id": BASE + "ingredientes.md" },
      sameAs: [info.wikidata, info.wikipedia]
    };
  })
];
organization.identifier = {
  "@type": "PropertyValue",
  propertyID: "RUC",
  name: "Registro Único de Contribuyentes (Ecuador)",
  value: catalog.CL_LEGAL.ruc
};

/* Nodos que describen la capa para agentes como entidades de primera clase:
   el glosario de activos y el catálogo en JSON. Se hacen upsert por `@id` para que
   `npm run gen` siga siendo idempotente — CI falla si deja diferencias. */
const machineNodes = [
  {
    "@type": "DefinedTermSet",
    "@id": BASE + "ingredientes.md",
    url: BASE + "ingredientes.md",
    name: "Activos de " + SITE_NAME,
    description:
      "Glosario de los " + activeNames.length + " activos del catálogo: qué es cada uno, cómo se " +
      "llama también, en qué fórmulas está y su entidad en Wikidata y Wikipedia.",
    inLanguage: "es-EC",
    dateModified: CONTENT_MODIFIED,
    publisher: { "@id": BASE + "#organization" },
    hasDefinedTerm: activeNames.map((name) => {
      const info = catalog.clActiveInfo(name);
      return {
        "@type": "DefinedTerm",
        name,
        alternateName: info.aka,
        termCode: info.kind,
        description: info.what + " " + info.role,
        sameAs: [info.wikidata, info.wikipedia]
      };
    })
  },
  {
    "@type": "DataFeed",
    "@id": BASE + "catalog.json",
    url: BASE + "catalog.json",
    name: "Catálogo " + SITE_NAME + " en JSON",
    description:
      "El catálogo completo tipado en una sola petición: precios y packs, pauta diaria, duración " +
      "del frasco, activos con su identificador de Wikidata, datos de la empresa y límites de " +
      "uso. Documento estático y público; no es una API y no expone stock en tiempo real.",
    encodingFormat: "application/json",
    inLanguage: "es-EC",
    isAccessibleForFree: true,
    dateModified: CONTENT_MODIFIED,
    isPartOf: { "@id": BASE + "#website" },
    about: { "@id": BASE + "#organization" },
    publisher: { "@id": BASE + "#organization" }
  }
];

for (const node of machineNodes) {
  const index = graph["@graph"].findIndex((existing) => existing["@id"] === node["@id"]);
  if (index === -1) graph["@graph"].push(node);
  else graph["@graph"][index] = node;
}
website.dateModified = CONTENT_MODIFIED;
website.name = SITE_NAME;
indexHtml = indexHtml.replace(
  graphMatch[0],
  '<script type="application/ld+json">' + JSON.stringify(graph) + "</script>"
);

writeFileSync(indexPath, indexHtml);

const storePath = resolve(root, "tienda.html");
const storeHtml = upsertJsonLd(readFileSync(storePath, "utf8"), "CollectionPage", {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": BASE + pagePath("tienda.html"),
  url: BASE + pagePath("tienda.html"),
  name: "Tienda " + SITE_NAME + " — colección completa",
  inLanguage: "es-EC",
  dateModified: CONTENT_MODIFIED,
  isPartOf: { "@id": BASE + "#website" },
  about: { "@id": BASE + "#organization" },
  publisher: { "@id": BASE + "#organization" },
  mainEntity: {
    "@type": "ItemList",
    name: "Colección Chic&Love",
    numberOfItems: catalog.CL_PRODUCTS.length,
    itemListElement: listItems()
  }
});
writeFileSync(storePath, storeHtml);

const editorialPages = {
  "index.html": { type: "WebPage", id: BASE, name: SITE_NAME },
  "nosotros.html": { type: "WebPage", id: BASE + pagePath("nosotros.html"), name: "Nosotros — " + SITE_NAME }
};

for (const [file, page] of Object.entries(editorialPages)) {
  const path = resolve(root, file);
  const html = readFileSync(path, "utf8");
  writeFileSync(path, upsertJsonLd(html, page.type, {
    "@context": "https://schema.org",
    "@type": page.type,
    "@id": page.id,
    url: page.id,
    name: page.name,
    inLanguage: "es-EC",
    dateModified: CONTENT_MODIFIED,
    isPartOf: { "@id": BASE + "#website" },
    about: { "@id": BASE + "#organization" },
    publisher: { "@id": BASE + "#organization" }
  }));
}

const connectedTypes = new Set(["Product", "CollectionPage", "FAQPage", "WebPage", "AboutPage", "ContactPage"]);
const allIndexablePages = [
  "index.html", "tienda.html", "nosotros.html", "about.html", "contact.html", "privacy.html", "terms.html",
  ...catalog.CL_PRODUCTS.map((product) => product.id + ".html")
];

for (const file of allIndexablePages) {
  const path = resolve(root, file);
  const html = readFileSync(path, "utf8");
  const rewritten = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (block, json) => {
    const data = JSON.parse(json);
    const nodes = data["@graph"] ?? [data];
    for (const node of nodes) {
      const types = [].concat(node["@type"]);
      if (types.includes("Organization")) {
        node.name = SITE_NAME;
        if (node.alternateName) {
          node.alternateName = ["Chic&Love", "Chic & Love", "Chic and Love Ecuador"];
        }
      }
      if (types.includes("WebSite")) node.name = SITE_NAME;
      if (types.some((type) => ["WebPage", "AboutPage", "ContactPage", "CollectionPage"].includes(type)) && typeof node.name === "string") {
        node.name = node.name.replaceAll("Chic&Love Ecuador", SITE_NAME);
      }
      if (types.includes("BreadcrumbList")) {
        node.isPartOf = { "@id": BASE + "#website" };
        node.about = { "@id": BASE + "#organization" };
        node.publisher = { "@id": BASE + "#organization" };
        node.dateModified = CONTENT_MODIFIED;
      }
      if (types.some((type) => connectedTypes.has(type))) {
        node.dateModified = CONTENT_MODIFIED;
        node.isPartOf = { "@id": BASE + "#website" };
        node.about = { "@id": BASE + "#organization" };
        node.publisher = { "@id": BASE + "#organization" };
      }
      if (types.includes("WebSite")) {
        node.dateModified = CONTENT_MODIFIED;
        node.publisher = { "@id": BASE + "#organization" };
      }
    }
    return '<script type="application/ld+json">' + JSON.stringify(data) + "</script>";
  });
  const [head, body] = rewritten.split(/(?=<\/head>)/i);
  writeFileSync(path, head.replaceAll("Chic&amp;Love Ecuador", "Chic &amp; Love Ecuador") + body);
}

console.log(
  "index.html: FAQPage con " + questions.length + " preguntas e ItemList con " +
    catalog.CL_PRODUCTS.length + " productos\n" +
    "tienda.html: CollectionPage con " + catalog.CL_PRODUCTS.length + " productos"
);
