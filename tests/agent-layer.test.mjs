// Contrato de la capa para agentes: el glosario de activos y su enlace a entidades
// externas, el catálogo tipado en JSON, la guía de elección, el FAQ de cada ficha, los
// datos estructurados de complemento alimenticio y las señales de idioma y región.
//
// Todo lo que se comprueba aquí es generado desde js/products.js. Las pruebas existen
// para que una edición del catálogo no deje una copia atrás: es exactamente el fallo que
// tenía llms.txt cuando se escribía a mano (anunciaba un precio y agents.md otro).
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { loadCatalog, projectRoot } from "../scripts/lib/catalog.mjs";
import { loadSiteConfig, pagePath, pageFile } from "../scripts/lib/site-config.mjs";
import { MARKDOWN_TWINS } from "../scripts/lib/markdown-negotiation.mjs";
import { loadPublicFiles } from "./public-files.mjs";

const siteConfig = loadSiteConfig();
const BASE = siteConfig.base;
const catalog = loadCatalog();
const read = (file) => readFileSync(resolve(projectRoot, file), "utf8");
const exists = (file) => existsSync(resolve(projectRoot, file));
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const AGENT_ARTIFACTS = ["catalog.json", "guia-de-eleccion.md", "ingredientes.md", "respuestas.md", "en.md"];
const activeNames = Object.keys(catalog.CL_ACTIVES);
const catalogActives = [...new Set(catalog.CL_PRODUCTS.flatMap((p) => p.actives))];

function jsonLd(file) {
  return [...read(file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap(([, json]) => {
      const data = JSON.parse(json);
      return data["@graph"] ?? [data];
    });
}

const byType = (file, type) =>
  jsonLd(file).find((node) => [].concat(node["@type"]).includes(type));

/* ---------- La capa semántica del catálogo no tiene huecos ---------- */

test("todo activo del catálogo tiene ficha, y toda ficha se usa", () => {
  for (const name of catalogActives) {
    assert.ok(catalog.CL_ACTIVES[name], `el activo "${name}" no está descrito en CL_ACTIVES`);
  }
  for (const name of activeNames) {
    assert.ok(
      catalogActives.includes(name),
      `CL_ACTIVES describe "${name}", que ya no aparece en ningún producto`
    );
  }
});

test("cada activo declara entidad externa verificable en Wikidata y Wikipedia", () => {
  for (const [name, info] of Object.entries(catalog.CL_ACTIVES)) {
    assert.match(
      info.wikidata,
      /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/,
      `${name}: wikidata debe ser una URL de entidad Q`
    );
    assert.match(
      info.wikipedia,
      /^https:\/\/es\.wikipedia\.org\/wiki\/\S+$/,
      `${name}: wikipedia debe ser una URL de es.wikipedia.org`
    );
    assert.ok(info.kind && info.what && info.role, `${name}: ficha incompleta`);
    assert.ok(Array.isArray(info.aka) && info.aka.length > 0, `${name}: falta algún sinónimo`);
  }

  const qids = Object.values(catalog.CL_ACTIVES).map((info) => info.wikidata);
  assert.equal(new Set(qids).size, qids.length, "dos activos apuntan a la misma entidad");
});

test("todo objetivo del catálogo tiene guía de decisión, y toda guía se usa", () => {
  const goals = [...new Set(catalog.CL_PRODUCTS.map((p) => p.goal))];
  for (const goal of goals) {
    const guide = catalog.CL_GOAL_GUIDE[goal];
    assert.ok(guide, `el objetivo "${goal}" no tiene entrada en CL_GOAL_GUIDE`);
    assert.match(guide.question, /\?$/, `${goal}: la guía debe plantear una pregunta`);
    assert.ok(guide.chooseIf, `${goal}: falta cuándo elegirla`);
    assert.ok(guide.keywords.length >= 3, `${goal}: pocas variantes de búsqueda`);
  }
  for (const goal of Object.keys(catalog.CL_GOAL_GUIDE)) {
    assert.ok(goals.includes(goal), `CL_GOAL_GUIDE describe "${goal}", que ya no tiene productos`);
  }
});

test("las gummies al día de cada producto cuadran con el texto de su dosis", () => {
  for (const product of catalog.CL_PRODUCTS) {
    const perDay = [].concat(product.perDay);
    assert.ok(perDay.length > 0, `${product.id}: falta perDay`);
    for (const amount of perDay) {
      assert.ok(
        Number.isInteger(amount) && amount > 0,
        `${product.id}: perDay debe ser un entero positivo`
      );
      assert.ok(
        new RegExp("\\b" + amount + "\\b").test(product.dose),
        `${product.id}: perDay incluye ${amount}, que no aparece en "${product.dose}"`
      );
    }
    const duration = catalog.clBottleDuration(product);
    assert.ok(duration.min > 0 && duration.max >= duration.min, `${product.id}: duración inválida`);
  }
});

/* ---------- Publicación ---------- */

test("los artefactos para agentes existen y los publica la lista blanca", () => {
  const published = loadPublicFiles();
  for (const file of AGENT_ARTIFACTS) {
    assert.ok(exists(file), `falta ${file}`);
    assert.ok(published.has(file), `${file} no está en la lista blanca de scripts/build.mjs`);
  }
});

/* ---------- /catalog.json ---------- */

test("catalog.json es JSON válido y describe el sitio y la empresa", () => {
  const data = JSON.parse(read("catalog.json"));
  const { CL_LEGAL } = catalog;

  assert.equal(data.canonicalUrl, BASE);
  assert.equal(data.language, "es-EC");
  assert.equal(data.country, "EC");
  assert.equal(data.lastModified, siteConfig.contentModified);
  assert.equal(data.company.legalName, CL_LEGAL.company);
  assert.equal(data.company.taxId.value, CL_LEGAL.ruc);
  assert.equal(data.company.address.locality, CL_LEGAL.locality);
  assert.equal(data.contact.whatsapp.number, catalog.clWhatsAppDisplay());
  assert.ok(data.contact.whatsapp.url.includes(catalog.CL_WHATSAPP));
  assert.equal(data.contact.instagram.handle, "@" + catalog.CL_INSTAGRAM);
  assert.equal(data.commerce.freeShippingFrom, catalog.CL_FREE_SHIPPING);
  assert.equal(data.commerce.servingsPerBottle, catalog.CL_SERVINGS);
  assert.equal(data.commerce.returns.days, CL_LEGAL.returnDays);
  assert.equal(data.commerce.vatIncluded, true);

  // El sitio no vende de forma automática: el JSON tiene que decirlo, o un agente
  // asumirá que puede cerrar un pedido por su cuenta.
  assert.equal(data.commerce.automatedCheckout, false);
  assert.equal(data.commerce.onlinePayment, false);
  assert.ok(data.doNotUseFor.length >= 4, "faltan los límites de uso");
  assert.match(data.doNotUseFor.join(" "), /checkout|pasarela/i, "no descarta la compra automática");
  assert.match(data.doNotUseFor.join(" "), /stock/i, "no descarta el stock en tiempo real");
  assert.match(data.doNotUseFor.join(" "), /médic/i, "no descarta el consejo médico");
  assert.match(data.disclaimer, /no son medicamentos|no medicamentos|complementos alimenticios/i);
});

test("catalog.json publica el catálogo entero, en orden y sin inventar datos", () => {
  const data = JSON.parse(read("catalog.json"));
  assert.deepEqual(
    data.products.map((p) => p.id),
    catalog.CL_PRODUCTS.map((p) => p.id),
    "los productos del JSON no son los del catálogo"
  );

  for (const [index, product] of catalog.CL_PRODUCTS.entries()) {
    const entry = data.products[index];
    const duration = catalog.clBottleDuration(product);
    const expectedDuration = duration.min === duration.max ? duration.min : [duration.min, duration.max];

    assert.equal(entry.name, product.name, `${product.id}: nombre`);
    assert.equal(entry.url, BASE + pagePath(product.id + ".html"), `${product.id}: URL canónica`);
    assert.equal(entry.markdownUrl, BASE + product.id + ".md", `${product.id}: gemelo markdown`);
    assert.equal(entry.goalLabel, product.goalLabel, `${product.id}: objetivo`);
    assert.equal(entry.flavor, product.flavor, `${product.id}: sabor`);
    assert.equal(entry.dose, product.dose, `${product.id}: dosis`);
    assert.equal(entry.servings, catalog.CL_SERVINGS, `${product.id}: unidades`);
    assert.deepEqual(entry.bottleLastsDays, expectedDuration, `${product.id}: duración`);
    assert.deepEqual(entry.badges, product.badges, `${product.id}: distintivos`);
    assert.equal(entry.vegan, product.badges.includes("Vegano"), `${product.id}: vegano`);
    assert.deepEqual(entry.benefits, product.benefits, `${product.id}: beneficios`);
    assert.equal(entry.audience.gender, product.audience || "any", `${product.id}: público`);
    assert.equal(
      entry.availability,
      "Disponibilidad confirmada por WhatsApp; no hay stock en tiempo real.",
      `${product.id}: disponibilidad`
    );

    assert.deepEqual(
      entry.actives.map((a) => a.name),
      product.actives,
      `${product.id}: activos`
    );
    for (const active of entry.actives) {
      const info = catalog.clActiveInfo(active.name);
      assert.equal(active.wikidata, info.wikidata, `${product.id}/${active.name}: wikidata`);
      assert.equal(active.wikipedia, info.wikipedia, `${product.id}/${active.name}: wikipedia`);
    }

    // El precio del frasco suelto es el vigente; los packs solo si se ofrecen.
    const single = entry.pricing.offers.find((offer) => offer.units === 1);
    assert.equal(single.price, catalog.clSinglePrice(product), `${product.id}: precio del frasco`);
    assert.equal(
      entry.pricing.offers.some((offer) => offer.units > 1),
      catalog.clHasPacks(product),
      `${product.id}: los packs del JSON no coinciden con lo que se puede comprar`
    );

    const promo = catalog.clActivePromo(product);
    if (promo) {
      assert.equal(entry.pricing.promotion.price, promo.price, `${product.id}: precio de promo`);
      assert.equal(entry.pricing.promotion.endsOn, promo.priceValidUntil, `${product.id}: cierre de promo`);
      assert.equal(entry.pricing.promotion.percentOff, catalog.clPromoPercent(product), `${product.id}: descuento`);
    } else {
      assert.equal(entry.pricing.promotion, null, `${product.id}: promo fantasma`);
    }
  }
});

test("catalog.json no publica ningún precio que no esté en el catálogo", () => {
  // Misma regla que para los markdown: solo existen los precios de js/products.js.
  // Un precio por unidad calculado (49.99 / 2) sería una oferta que nadie puede comprar.
  const allowed = new Set(
    catalog.CL_PRODUCTS.flatMap((p) => [
      catalog.clSinglePrice(p),
      p.price,
      p.pricePack,
      p.pricePack3
    ]).concat(catalog.CL_FREE_SHIPPING)
  );
  const priceKeys = new Set(["price", "listPrice", "freeShippingFrom"]);
  const found = [];

  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (priceKeys.has(key) && typeof value === "number") found.push([key, value]);
      else walk(value);
    }
  })(JSON.parse(read("catalog.json")));

  assert.ok(found.length > 0, "catalog.json no publica ningún precio");
  for (const [key, value] of found) {
    assert.ok(allowed.has(value), `catalog.json publica ${key}=${value}, que no está en el catálogo`);
  }
});

test("los recursos que anuncia catalog.json existen en el repositorio", () => {
  const data = JSON.parse(read("catalog.json"));
  const urls = [
    data.index,
    data.fullText,
    data.documentation,
    ...Object.values(data.agentResources).filter((value) => value.startsWith(BASE)),
    ...data.products.flatMap((p) => [p.url, p.markdownUrl, ...p.images])
  ];
  for (const url of urls) {
    const path = pageFile(url.slice(BASE.length));
    assert.ok(exists(path), `catalog.json anuncia ${url}, que no existe en el repositorio`);
  }
});

/* ---------- /ingredientes.md ---------- */

test("el glosario describe cada activo, con su entidad y los productos que lo llevan", () => {
  const body = read("ingredientes.md");
  assert.match(body, /^# \S/, "debe empezar por un H1");

  // Se trocea por encabezado en vez de con un regex «hasta el siguiente ##»: JavaScript
  // no tiene `\Z`, y escribirlo lo convierte en una «Z» literal que parte la sección de
  // Zinc por la mitad. El bug estuvo en esta prueba, no en el glosario.
  const sections = new Map(
    body
      .split(/^## /m)
      .slice(1)
      .map((chunk) => [chunk.split("\n")[0].trim(), chunk])
  );

  for (const name of catalogActives) {
    const info = catalog.clActiveInfo(name);
    const entry = sections.get(name);
    assert.ok(entry, `${name}: falta su sección en ingredientes.md`);
    assert.ok(entry.includes(info.what), `${name}: falta qué es`);
    assert.ok(entry.includes(info.role), `${name}: falta con qué se asocia`);
    assert.ok(entry.includes(info.wikidata), `${name}: falta el enlace a Wikidata`);
    assert.ok(entry.includes(info.wikipedia), `${name}: falta el enlace a Wikipedia`);

    for (const product of catalog.CL_PRODUCTS.filter((p) => p.actives.includes(name))) {
      assert.ok(
        entry.includes(BASE + product.id + ".md"),
        `${name}: no enlaza ${product.id}, que lo lleva`
      );
    }
  }

  assert.match(body, /no es consejo médico/i, "el glosario debe declarar su límite");
});

/* ---------- /guia-de-eleccion.md ---------- */

test("la guía de elección responde por objetivo y compara las fórmulas", () => {
  const body = read("guia-de-eleccion.md");
  assert.match(body, /^# \S/, "debe empezar por un H1");

  for (const [goal, guide] of Object.entries(catalog.CL_GOAL_GUIDE)) {
    assert.ok(body.includes(guide.question), `${goal}: falta la pregunta que responde`);
    assert.ok(body.includes(guide.chooseIf), `${goal}: falta cuándo elegirla`);
    for (const keyword of guide.keywords) {
      assert.ok(body.includes(keyword), `${goal}: falta la variante de búsqueda "${keyword}"`);
    }
  }

  // Una fila de tabla por producto, con su precio vigente.
  for (const product of catalog.CL_PRODUCTS) {
    const row = new RegExp(
      "^\\| \\[" + escapeRe(product.name) + "\\]\\(" + escapeRe(BASE + product.id + ".md") + "\\) \\|.*$",
      "m"
    );
    const match = row.exec(body);
    assert.ok(match, `${product.id}: falta su fila en la tabla comparativa`);
    assert.ok(
      match[0].includes(catalog.clMoney(catalog.clSinglePrice(product))),
      `${product.id}: la fila no publica el precio vigente`
    );
    assert.ok(match[0].includes(product.flavor), `${product.id}: la fila no publica el sabor`);
  }

  assert.match(body, /no es consejo médico/i, "la guía debe declarar su límite");
  assert.match(body, /no hay checkout|no existe checkout/i, "la guía debe decir que no hay compra automática");
});

/* ---------- FAQ dentro de cada gemelo de producto ---------- */

test("cada ficha en markdown resuelve las preguntas previas a la compra", () => {
  for (const product of catalog.CL_PRODUCTS) {
    const body = read(product.id + ".md");
    const faq = body.slice(body.indexOf("## Preguntas frecuentes"));
    assert.ok(faq, `${product.id}: falta el FAQ`);

    for (const question of [
      "¿Para qué sirve",
      "¿Cómo se toma?",
      "¿Cuánto dura un frasco?",
      "¿Cuánto cuesta",
      "¿Es vegano?",
      "¿Qué activos lleva",
      "¿Se puede combinar",
      "¿Tiene contraindicaciones?",
      "¿Cómo lo pido?",
      "¿Puedo devolverlo"
    ]) {
      assert.ok(faq.includes(question), `${product.id}: el FAQ no cubre "${question}"`);
    }

    const duration = catalog.clBottleDuration(product);
    const expected = duration.min === duration.max
      ? "unos " + duration.min + " días"
      : "entre " + duration.min + " y " + duration.max + " días";
    assert.ok(faq.includes(expected), `${product.id}: la duración del frasco no cuadra con la pauta`);

    const vegan = product.badges.includes("Vegano");
    assert.equal(
      /apto para veganos\./i.test(faq),
      vegan,
      `${product.id}: la respuesta sobre veganismo contradice los distintivos`
    );
    assert.ok(faq.includes(product.dose), `${product.id}: el FAQ no repite la pauta del catálogo`);
    assert.match(faq, /no un medicamento|no es un medicamento/i, `${product.id}: falta el límite sanitario`);
  }
});

/* ---------- Datos estructurados de complemento alimenticio ---------- */

test("cada ficha se declara DietarySupplement con activos, pauta y advertencia", () => {
  for (const product of catalog.CL_PRODUCTS) {
    const node = byType(product.id + ".html", "DietarySupplement");
    assert.ok(node, `${product.id}: la ficha no se declara DietarySupplement`);
    assert.ok(
      [].concat(node["@type"]).includes("Product"),
      `${product.id}: debe seguir siendo Product para no perder la oferta`
    );

    assert.deepEqual(node.activeIngredient, product.actives, `${product.id}: activos`);
    assert.equal(node.recommendedIntake.frequency, product.dose, `${product.id}: pauta`);
    assert.equal(node.recommendedIntake.doseUnit, "gummies", `${product.id}: unidad de la pauta`);
    assert.match(node.safetyConsideration, /no es un medicamento/i, `${product.id}: advertencia`);
    assert.match(node.safetyConsideration, /profesional de la salud/i, `${product.id}: derivación`);
    const page = byType(product.id + ".html", "WebPage");
    assert.equal(page.inLanguage, "es-EC", `${product.id}: idioma de la ficha`);
    assert.equal(node.mainEntityOfPage?.["@id"], page["@id"], `${product.id}: página del suplemento`);

    const properties = new Map(node.additionalProperty.map((entry) => [entry.name, entry.value]));
    assert.equal(properties.get("Sabor"), product.flavor, `${product.id}: sabor`);
    assert.equal(properties.get("Unidades por envase"), catalog.CL_SERVINGS, `${product.id}: unidades`);
    assert.equal(properties.get("Dosis diaria recomendada"), product.dose, `${product.id}: dosis`);
    assert.equal(properties.get("Objetivo"), product.goalLabel, `${product.id}: objetivo`);
    assert.equal(properties.get("Apto para veganos"), product.badges.includes("Vegano"), `${product.id}: vegano`);
    assert.ok(
      String(properties.get("Presentaciones y precio")).includes(
        catalog.clMoney(catalog.clSinglePrice(product))
      ),
      `${product.id}: la escalera de precios no publica el precio vigente`
    );

    assert.equal(node.audience.suggestedMinAge, 18, `${product.id}: edad mínima`);
    assert.equal(
      node.audience.suggestedGender,
      product.audience,
      `${product.id}: el público del dato estructurado no coincide con el catálogo`
    );

    // La oferta sigue siendo una sola: el precio canónico es el del frasco suelto.
    assert.equal(node.offers["@type"], "Offer", `${product.id}: la oferta debe seguir siendo única`);
    assert.equal(
      node.offers.price,
      catalog.clSinglePrice(product).toFixed(2),
      `${product.id}: precio de la oferta`
    );
  }
});

test("cada ficha publica su glosario de activos enlazado a entidades externas", () => {
  for (const product of catalog.CL_PRODUCTS) {
    const node = byType(product.id + ".html", "DefinedTermSet");
    assert.ok(node, `${product.id}: falta el DefinedTermSet de activos`);
    assert.deepEqual(
      node.hasDefinedTerm.map((term) => term.name),
      product.actives,
      `${product.id}: los términos no son los activos de la fórmula`
    );
    for (const term of node.hasDefinedTerm) {
      const info = catalog.clActiveInfo(term.name);
      assert.deepEqual(
        term.sameAs,
        [info.wikidata, info.wikipedia],
        `${product.id}/${term.name}: entidad externa`
      );
    }
  }
});

test("la portada enlaza cada activo a su entidad y declara la capa para máquinas", () => {
  const organization = byType("index.html", "Organization");

  const terms = organization.knowsAbout.filter((entry) =>
    [].concat(entry["@type"]).includes("DefinedTerm")
  );
  assert.deepEqual(
    terms.map((term) => term.name),
    catalogActives,
    "knowsAbout no enlaza exactamente los activos del catálogo"
  );
  for (const term of terms) {
    const info = catalog.clActiveInfo(term.name);
    assert.deepEqual(term.sameAs, [info.wikidata, info.wikipedia], `${term.name}: entidad externa`);
  }

  assert.equal(organization.identifier.propertyID, "RUC");
  assert.equal(organization.identifier.value, catalog.CL_LEGAL.ruc);

  const glossary = byType("index.html", "DefinedTermSet");
  assert.equal(glossary["@id"], BASE + "ingredientes.md", "el glosario no se declara como entidad");
  assert.equal(glossary.hasDefinedTerm.length, catalogActives.length);

  const feed = byType("index.html", "DataFeed");
  assert.equal(feed["@id"], BASE + "catalog.json", "el catálogo JSON no se declara como DataFeed");
  assert.equal(feed.encodingFormat, "application/json");
  assert.equal(feed.isAccessibleForFree, true);
  assert.equal(feed.dateModified, siteConfig.contentModified);
});

/* ---------- Señales de idioma y región ---------- */

test("cada página indexable se declara como la edición de Ecuador en español", () => {
  for (const htmlPath of Object.keys(MARKDOWN_TWINS)) {
    const page = htmlPath.slice(1);
    const html = read(page);
    const canonical = BASE + pagePath(page);

    for (const lang of ["es-EC", "x-default"]) {
      assert.match(
        html,
        new RegExp('<link rel="alternate" hreflang="' + lang + '" href="' + escapeRe(canonical) + '">'),
        `${page}: falta hreflang ${lang} apuntando a su canónica`
      );
    }
    assert.match(html, /<meta name="geo\.region" content="EC-P">/, `${page}: falta la región`);
    assert.match(
      html,
      new RegExp('<meta name="geo\\.placename" content="' + escapeRe(catalog.CL_LEGAL.locality) + '">'),
      `${page}: falta la ciudad`
    );
  }
});

test("las páginas del catálogo declaran su representación en JSON", () => {
  const pages = ["index.html", "tienda.html", ...catalog.CL_PRODUCTS.map((p) => p.id + ".html")];
  for (const page of pages) {
    assert.match(
      read(page),
      new RegExp(
        '<link rel="alternate" type="application/json" href="' + escapeRe(BASE + "catalog.json") + '"'
      ),
      `${page}: no declara catalog.json como representación alternativa`
    );
  }
});

/* ---------- Rastreadores ---------- */

test("robots.txt permite explícitamente a los rastreadores que alimentan modelos", () => {
  const body = read("robots.txt");

  // CCBot es Common Crawl: el corpus del que parten casi todos los modelos. Sin él, el
  // sitio puede aparecer en un buscador de IA pero no llegar a los datos de entrenamiento.
  for (const bot of [
    "CCBot",
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-User",
    "Claude-SearchBot",
    "anthropic-ai",
    "Google-Extended",
    "Google-CloudVertexBot",
    "Googlebot",
    "Bingbot",
    "Applebot",
    "Applebot-Extended",
    "meta-externalagent",
    "Meta-ExternalFetcher",
    "PerplexityBot",
    "Perplexity-User",
    "MistralAI-User",
    "cohere-ai",
    "Amazonbot",
    "DuckAssistBot",
    "YouBot",
    "Ai2Bot"
  ]) {
    assert.match(
      body,
      new RegExp("^User-agent: " + escapeRe(bot) + "\\nAllow: /$", "m"),
      `robots.txt no permite explícitamente a ${bot}`
    );
  }

  assert.ok(!/^Disallow: \//m.test(body), "robots.txt bloquea alguna ruta del sitio");
  for (const resource of AGENT_ARTIFACTS.concat(["llms.txt", "agents.md", "llms-full.txt", "ai.txt"])) {
    assert.ok(body.includes(resource), `robots.txt no señala ${resource}`);
  }
});

/* ---------- Coherencia entre los artefactos para agentes ---------- */

test("los artefactos para agentes anuncian el mismo precio más bajo", () => {
  const cheapest = catalog.clMoney(
    Math.min(...catalog.CL_PRODUCTS.map((p) => catalog.clSinglePrice(p)))
  );
  const listPrice = catalog.clMoney(catalog.CL_PRODUCT_PRICING.price);

  // El fallo que motivó generar llms.txt: anunciaba el precio de catálogo como si fuera
  // el único, mientras agents.md anunciaba el promocional. Los dos deben nombrar ambos.
  for (const file of ["llms.txt", "agents.md"]) {
    const body = read(file);
    assert.ok(body.includes(listPrice), `${file} no publica el precio de catálogo`);
    assert.ok(body.includes(cheapest), `${file} no publica el precio más bajo vigente`);
  }

  const data = JSON.parse(read("catalog.json"));
  const jsonCheapest = catalog.clMoney(
    Math.min(...data.products.map((p) => p.pricing.offers.find((o) => o.units === 1).price))
  );
  assert.equal(jsonCheapest, cheapest, "catalog.json no coincide con el precio más bajo del catálogo");
});

test("llms.txt, agents.md y ai.txt indexan los artefactos nuevos", () => {
  for (const file of ["llms.txt", "agents.md", "ai.txt"]) {
    const body = read(file);
    for (const artifact of AGENT_ARTIFACTS) {
      assert.ok(body.includes(BASE + artifact), `${file} no enlaza ${artifact}`);
    }
  }
});

test("el volcado completo incluye la guía y el glosario", () => {
  const bundle = read("llms-full.txt");
  for (const file of ["guia-de-eleccion.md", "ingredientes.md"]) {
    assert.ok(bundle.includes("<!-- source: " + BASE + file + " -->"), `llms-full.txt no incluye ${file}`);
    const [heading] = read(file).split("\n");
    assert.ok(bundle.includes(heading), `llms-full.txt no trae el contenido de ${file}`);
  }
});
