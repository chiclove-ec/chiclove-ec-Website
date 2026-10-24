// Los datos estructurados van estáticos en el HTML (buscadores y agentes los leen sin
// inyectarlos por JS), así que las pruebas son la única defensa contra que se
// desincronicen del catálogo o del contenido visible de la página.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { loadCatalog, projectRoot } from "../scripts/lib/catalog.mjs";
import { loadSiteConfig, pagePath } from "../scripts/lib/site-config.mjs";

const BASE = loadSiteConfig().base;
const catalog = loadCatalog();
const read = (file) => readFileSync(resolve(projectRoot, file), "utf8");

function jsonLd(file) {
  return [...read(file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json))
    .flatMap((data) => (data["@graph"] ? data["@graph"] : [data]));
}

const byType = (file, type) =>
  jsonLd(file).find((node) => [].concat(node["@type"]).includes(type));

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

const primaryTypes = new Set(["Product", "CollectionPage", "FAQPage", "WebPage", "AboutPage", "ContactPage"]);
const nodesOfType = (file, types) =>
  jsonLd(file).filter((node) => [].concat(node["@type"]).some((type) => types.has(type)));

test("todo el JSON-LD publicado es válido", () => {
  const pages = ["index.html", "tienda.html", "nosotros.html", "about.html", "contact.html", "privacy.html", ...catalog.CL_PRODUCTS.map((p) => p.id + ".html")];
  for (const page of pages) {
    assert.ok(jsonLd(page).length > 0, `${page} no publica datos estructurados`);
  }
});

test("cada ficha precarga solamente su hero responsive", () => {
  const sizes = "(max-width: 720px) 70vw, (max-width: 1024px) 440px, 500px";
  for (const product of catalog.CL_PRODUCTS) {
    const html = read(product.id + ".html");
    const preloads = [...html.matchAll(/<link rel="preload" as="image"[^>]*>/g)].map(([tag]) => tag);
    assert.equal(preloads.length, 1, `${product.id}: debe haber un solo preload crítico`);
    assert.match(preloads[0], new RegExp('href="' + product.heroSmall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'));
    assert.match(preloads[0], new RegExp('imagesrcset="' + product.heroSmall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ' 640w, ' + product.hero.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ' 1080w"'));
    assert.match(preloads[0], new RegExp('imagesizes="' + sizes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'));
    assert.match(preloads[0], /fetchpriority="high"/);
    assert.doesNotMatch(preloads[0], /https?:\/\//, `${product.id}: el preload debe ser same-origin`);
  }
});

test("el FAQPage de la portada coincide con las preguntas visibles", () => {
  const html = read("index.html");
  const faq = byType("index.html", "FAQPage");
  assert.ok(faq, "falta el FAQPage");

  const visible = [
    ...html.matchAll(
      /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-body"([^>]*)>([\s\S]*?)<\/div>\s*<\/details>/g
    )
  ];
  assert.equal(faq.mainEntity.length, visible.length, "el FAQPage no cubre todas las preguntas");

  visible.forEach(([, question, attrs, answer], index) => {
    const node = faq.mainEntity[index];
    assert.equal(node.name, plainText(question), "pregunta desincronizada");

    // Dos respuestas las completa main.js desde el catálogo: se comparan ya resueltas.
    if (attrs.includes("data-free-shipping-faq")) {
      assert.ok(
        node.acceptedAnswer.text.includes(catalog.clFreeShippingLabel()),
        "la respuesta de envíos no publica el umbral vigente"
      );
      return;
    }
    const expected = plainText(answer);
    if (expected.includes("escríbenos al o por Instagram")) {
      assert.ok(node.acceptedAnswer.text.includes(catalog.clWhatsAppDisplay()), "falta el teléfono");
      assert.ok(node.acceptedAnswer.text.includes("@" + catalog.CL_INSTAGRAM), "falta Instagram");
      return;
    }
    assert.equal(node.acceptedAnswer.text, expected, "respuesta desincronizada");
  });
});

test("los ItemList de portada y tienda reflejan el catálogo completo", () => {
  const home = byType("index.html", "ItemList");
  const store = byType("tienda.html", "CollectionPage");
  assert.ok(home, "falta el ItemList de la portada");
  assert.ok(store, "falta el CollectionPage de la tienda");

  for (const [label, list] of [["portada", home], ["tienda", store.mainEntity]]) {
    assert.equal(
      list.itemListElement.length,
      catalog.CL_PRODUCTS.length,
      `${label}: número de productos`
    );
    catalog.CL_PRODUCTS.forEach((product, index) => {
      const entry = list.itemListElement[index];
      assert.equal(entry.position, index + 1, `${label}: posición`);
      assert.equal(entry.url, BASE + pagePath(product.id + ".html"), `${label}: URL`);
      assert.equal("item" in entry, false, `${label}: no debe redeclarar el Product en la página resumen`);
    });
  }
});

test("las páginas resumen no publican ofertas Product parciales", () => {
  const store = byType("tienda.html", "CollectionPage");
  catalog.CL_PRODUCTS.forEach((product, index) => {
    const entry = store.mainEntity.itemListElement[index];
    assert.equal(entry.url, BASE + pagePath(product.id + ".html"), product.id);
    assert.equal("item" in entry, false, `${product.id}: no debe redeclarar el Product en la página resumen`);
  });
});

test("cada página de producto publica oferta, envío y vendedor", () => {
  for (const product of catalog.CL_PRODUCTS) {
    const node = byType(product.id + ".html", "Product");
    assert.ok(node, `${product.id}: falta el Product`);
    assert.equal(node.offers.price, catalog.clSinglePrice(product).toFixed(2), product.id);
    assert.equal("availability" in node.offers, false, `${product.id}: no se debe inventar stock en tiempo real`);
    const activePromo = catalog.clActivePromo(product);
    if (activePromo) {
      assert.equal(node.offers.priceValidUntil, activePromo.priceValidUntil, `${product.id}: fin de la promoción`);
      assert.match(
        node.offers.validFrom ?? "",
        /^\d{4}-\d{2}-\d{2}$/,
        `${product.id}: la promoción debe declarar desde cuándo es válido el precio`
      );
    } else {
      assert.equal("priceValidUntil" in node.offers, false, `${product.id}: no debe inventar caducidad del precio base`);
      assert.equal("validFrom" in node.offers, false, `${product.id}: no debe inventar inicio del precio base`);
    }
    assert.equal(node.offers.seller["@id"], BASE + "#organization", `${product.id}: vendedor`);

    // La tarifa depende del total del pedido, no del precio de este frasco.
    // Una anulación OfferShippingDetails con tarifa 0 anunciaría envío gratuito
    // incluso para compras que no alcanzan el umbral publicado.
    assert.equal("shippingDetails" in node.offers, false, `${product.id}: no anular la política condicionada`);
    const shipping = node.offers.seller.hasShippingService;
    assert.ok(shipping, `${product.id}: falta la política de la tienda`);
    assert.equal(shipping["@type"], "ShippingService");
    assert.equal(shipping["@id"], BASE + "#shipping");
    const conditions = shipping.shippingConditions;
    assert.equal(conditions["@type"], "ShippingConditions");
    assert.equal(conditions.shippingDestination.addressCountry, "EC", `${product.id}: destino`);
    assert.equal(conditions.orderValue.currency, "USD");
    assert.equal(conditions.orderValue.minValue, catalog.CL_FREE_SHIPPING, `${product.id}: umbral inclusivo`);
    assert.equal(conditions.shippingRate.currency, "USD");
    assert.equal(conditions.shippingRate.value, 0, `${product.id}: tarifa dentro de la condición`);
    assert.equal("eligibleTransactionVolume" in conditions, false);
    assert.equal("transitTime" in conditions, false, `${product.id}: no inventar plazos`);
    assert.equal("handlingTime" in shipping, false, `${product.id}: no inventar preparación`);

    const returns = node.offers.hasMerchantReturnPolicy;
    assert.equal(returns.applicableCountry, "EC", `${product.id}: país de la política`);
    assert.equal(
      returns.returnPolicyCategory,
      "https://schema.org/MerchantReturnFiniteReturnWindow",
      `${product.id}: la política publicada debe ser la ventana de devolución`
    );
    assert.equal(
      returns.merchantReturnDays,
      catalog.CL_LEGAL.returnDays,
      `${product.id}: los días de devolución deben salir del catálogo`
    );
    assert.equal(returns.merchantReturnLink, BASE + pagePath("terms.html"), `${product.id}: enlace`);
  }
});

test("la política de devoluciones se dice en texto allí donde se busca", () => {
  // La ventana de 15 días es el compromiso comercial: si desaparece de alguna página,
  // el sitio vuelve a contradecirse sobre lo que puede hacer quien ya compró.
  const window = new RegExp("(devolución|devoluciones|cambio).{0,120}" + catalog.CL_LEGAL.returnDays + " días", "is");
  const files = [
    "contact.html", "contact.md", "about.html", "about.md", "index.html",
    "tienda.md", "terms.html", "terms.md",
    ...catalog.CL_PRODUCTS.map((p) => p.id + ".md")
  ];
  for (const file of files) {
    assert.match(read(file), window, `${file} no declara la ventana de devolución`);
  }
  // La excepción por pedido dañado no puede perderse: es lo que evita dejar sin salida.
  for (const file of ["contact.html", "contact.md", "terms.html", "terms.md"]) {
    assert.match(read(file), /dañado, incompleto o/i, `${file} no explica la excepción`);
  }
  // Y nada puede seguir diciendo lo contrario.
  const denied = /(no (se )?acept(amos|an) devoluciones|sin devoluciones|venta (es )?final)/i;
  for (const file of [...files, "llms.txt", "llms-full.txt", "agents.md", "privacy.html", "privacy.md"]) {
    assert.ok(!denied.test(read(file)), `${file} sigue negando las devoluciones`);
  }
});

test("la Organization declara alias de marca, contacto y ubicación", () => {
  const org = byType("index.html", "Organization");
  assert.equal(org.legalName, catalog.CL_LEGAL.company, "razón social");
  assert.equal(org.taxID, catalog.CL_LEGAL.ruc, "RUC");
  assert.ok(org.alternateName.includes("Chic&Love"), "faltan alias de marca");
  assert.ok(org.alternateName.length >= 3, "pocos alias para desambiguar la marca");
  assert.ok(org.sameAs.includes("https://www.instagram.com/" + catalog.CL_INSTAGRAM));
  assert.equal(org.areaServed.name, "Ecuador");
  assert.equal(org.address.addressCountry, "EC");
  assert.equal(org.address.streetAddress, catalog.CL_LEGAL.streetAddress);
  assert.equal(org.address.addressLocality, catalog.CL_LEGAL.locality);
  assert.equal(org.address.addressRegion, catalog.CL_LEGAL.region);
  assert.equal(org.currenciesAccepted, "USD");
  assert.equal(org.paymentAccepted, "Transferencia bancaria");
  assert.match(org.contactPoint.url, new RegExp("wa\\.me/" + catalog.CL_WHATSAPP));
  assert.ok(org.hasOfferCatalog, "falta hasOfferCatalog");
  assert.equal(org.hasOfferCatalog.itemListElement.length, catalog.CL_PRODUCTS.length);
});

test("la portada referencia el catálogo sin redeclarar productos parciales", () => {
  const homeProducts = productNodes("index.html");
  assert.equal(homeProducts.length, 0, "la portada no debe redeclarar Product en su página resumen");
  const organization = byType("index.html", "Organization");
  const ids = organization.hasOfferCatalog.itemListElement.map((entry) => entry.item["@id"]);
  assert.equal(ids.length, catalog.CL_PRODUCTS.length, "el catálogo debe enlazar todos los productos");
  assert.equal(new Set(ids).size, ids.length, "Google no debe recibir referencias duplicadas");
});

test("cada Product publica identidad, imagen, precio, envío y devoluciones", () => {
  for (const product of catalog.CL_PRODUCTS) {
    const node = byType(product.id + ".html", "Product");
    assert.equal(node.category, product.goalLabel, `${product.id}: categoría`);
    assert.equal(node.brand.name, "Chic&Love", `${product.id}: marca`);
    assert.equal(node.sku, product.id, `${product.id}: SKU`);
    assert.ok([].concat(node.image).length > 0, `${product.id}: imagen`);

    const offer = node.offers;
    assert.equal(offer.priceSpecification["@type"], "UnitPriceSpecification", `${product.id}: priceSpecification`);
    assert.equal(offer.priceSpecification.priceCurrency, "USD", `${product.id}: moneda del precio`);
    assert.equal(offer.priceSpecification.valueAddedTaxIncluded, true, `${product.id}: IVA`);
    assert.equal(offer.seller["@type"], "Organization", `${product.id}: vendedor con política estándar`);
    assert.ok(offer.hasMerchantReturnPolicy, `${product.id}: política de devoluciones`);
  }
});

test("la misma política condicionada se declara en la portada y en cada vendedor", () => {
  const policy = byType("index.html", "Organization").hasShippingService;
  assert.ok(policy, "la tienda debe declarar su política estándar");
  assert.equal(policy.shippingConditions.orderValue.minValue, 49.99);
  for (const product of catalog.CL_PRODUCTS) {
    const seller = byType(product.id + ".html", "Product").offers.seller;
    assert.equal(seller.name, loadSiteConfig().brandName);
    assert.deepEqual(seller.hasShippingService, policy, product.id);
    assert.equal("shippingRate" in policy, false, "la tarifa debe vivir dentro de sus condiciones");
  }
});

test("la navegación estructurada incluye las páginas de confianza", () => {
  for (const page of ["index.html", "tienda.html", "nosotros.html"]) {
    const nav = jsonLd(page).filter((node) =>
      [].concat(node["@type"]).includes("SiteNavigationElement")
    );
    const urls = nav.map((node) => node.url);
    assert.ok(urls.includes(BASE + pagePath("contact.html")), `${page}: falta Contacto`);
    assert.ok(urls.includes(BASE + pagePath("about.html")), `${page}: falta Información de la empresa`);
  }
});

test("las entidades editoriales usan la fecha configurada y los mismos IDs", () => {
  const { contentModified } = loadSiteConfig();
  const organizationId = BASE + "#organization";
  const websiteId = BASE + "#website";
  const pages = [
    "index.html",
    "tienda.html",
    "nosotros.html",
    "about.html",
    "contact.html",
    "privacy.html",
    "terms.html",
    ...catalog.CL_PRODUCTS.map((product) => product.id + ".html")
  ];

  for (const page of pages) {
    for (const node of nodesOfType(page, primaryTypes)) {
      assert.equal(node.dateModified, contentModified, `${page}: fecha desincronizada en ${node["@type"]}`);
      const types = [].concat(node["@type"]);
      if (types.some((type) => ["Product", "FAQPage", "CollectionPage", "WebPage", "AboutPage", "ContactPage"].includes(type))) {
        assert.equal(node.isPartOf?.["@id"], websiteId, `${page}: isPartOf`);
        assert.equal(node.about?.["@id"], organizationId, `${page}: about`);
      }
      if (!types.includes("Product")) {
        assert.equal(node.publisher?.["@id"], organizationId, `${page}: publisher`);
      }
    }
  }

  const org = byType("index.html", "Organization");
  const website = byType("index.html", "WebSite");
  assert.equal(org["@id"], organizationId);
  assert.equal(website["@id"], websiteId);
  assert.equal(website.publisher?.["@id"], organizationId);
  assert.equal(website.dateModified, contentModified);
  assert.ok(!jsonLd("index.html").some((node) => "aggregateRating" in node));
});

test("el sitemap usa la fecha configurada exclusivamente en URLs indexables", () => {
  const { contentModified } = loadSiteConfig();
  const sitemap = read("sitemap.xml");
  const urls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) => entry);
  assert.ok(urls.length > 0, "sitemap vacío");
  for (const entry of urls) {
    assert.match(entry, new RegExp("<lastmod>" + contentModified + "</lastmod>"));
    assert.doesNotMatch(entry, /(?:\.md|404\.html|producto\.html)/);
  }
});

/* ---------- Fragmentos de producto: sin valoraciones inventadas ---------- */

// Todas las páginas que publican algún nodo Product, esté al nivel que esté.
const PRODUCT_PAGES = [
  "index.html",
  "tienda.html",
  ...catalog.CL_PRODUCTS.map((product) => product.id + ".html")
];

/** Todo nodo Product de una página, incluidos los anidados en listas y ofertas. */
function productNodes(file) {
  const found = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const types = [].concat(node["@type"] ?? []);
    if (types.includes("Product")) found.push(node);
    for (const value of Object.values(node)) walk(value);
  })(jsonLd(file));
  return found;
}

/** Cualquier nodo del JSON-LD de una página, para barrer propiedades prohibidas. */
function everyNode(file) {
  const found = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    found.push(node);
    for (const value of Object.values(node)) walk(value);
  })(jsonLd(file));
  return found;
}

// Search Console avisa de que a los fragmentos de producto les faltan `aggregateRating`
// y `review`. Son avisos NO críticos: la ficha ya califica por `offers`. La única forma
// legítima de cerrarlos es tener reseñas reales y visibles en la página; publicarlas sin
// tenerlas es «spammy structured markup» y se castiga con acción manual, que sí retira
// los resultados enriquecidos. Mientras el catálogo no tenga reseñas, no se publica ni
// una valoración. Para cerrar el aviso de verdad: añadir las reseñas reales al catálogo,
// renderizarlas visibles en la ficha, y entonces —y solo entonces— relajar esta prueba.
const RATING_PROPERTIES = [
  "aggregateRating",
  "review",
  "reviews",
  "ratingValue",
  "reviewCount",
  "ratingCount",
  "bestRating",
  "worstRating"
];

test("ninguna página publica valoraciones que el sitio no muestra", () => {
  for (const page of [...PRODUCT_PAGES, "nosotros.html", "about.html", "contact.html"]) {
    for (const node of everyNode(page)) {
      for (const property of RATING_PROPERTIES) {
        assert.ok(
          !(property in node),
          `${page} publica "${property}" en un nodo ${[].concat(node["@type"] ?? "?").join("+")}, ` +
            "pero el sitio no muestra ninguna reseña. Marcar valoraciones inexistentes es " +
            "motivo de acción manual en Google. Si ya hay reseñas reales, publícalas visibles " +
            "en la ficha primero y actualiza esta prueba a conciencia."
        );
      }
    }
  }
});

test("el catálogo no guarda contadores de reseñas sin respaldo", () => {
  // Hubo un campo `reviews: 214` por producto que ninguna página mostraba. Un número
  // así acaba publicado como `aggregateRating` por quien lo encuentre y lo dé por bueno.
  for (const product of catalog.CL_PRODUCTS) {
    for (const property of RATING_PROPERTIES) {
      assert.ok(
        !(property in product),
        `${product.id} declara "${property}" en js/products.js. Si son reseñas reales, ` +
          "deben traer texto y autor y verse en la ficha; si no lo son, no deben existir."
      );
    }
  }
});

test("ningún nodo Product se publica a medias", () => {
  // Un Product con solo nombre y URL es, para Google, otro producto sin precio: lo
  // denuncia como fragmento incompleto. Las referencias a otra ficha se hacen con
  // `@id` a secas, que es una referencia y no una definición.
  for (const page of PRODUCT_PAGES) {
    for (const node of productNodes(page)) {
      assert.ok(node.offers, `${page}: hay un Product sin oferta (${node.name ?? node["@id"] ?? "sin nombre"})`);
      assert.ok(node["@id"], `${page}: hay un Product sin @id (${node.name})`);
      assert.ok(node.name, `${page}: hay un Product sin nombre (${node["@id"]})`);
    }
  }
});

test("cada producto es una sola entidad en todo el sitio", () => {
  // La ficha, la portada y la tienda describen el mismo producto. Con el mismo `@id`
  // en los tres sitios, Google y cualquier modelo lo leen como una entidad, no como
  // tres parecidas.
  for (const product of catalog.CL_PRODUCTS) {
    const expected = BASE + pagePath(product.id + ".html") + "#product";
    for (const page of PRODUCT_PAGES) {
      for (const node of productNodes(page).filter((n) => n.name === product.name)) {
        assert.equal(
          node["@id"],
          expected,
          `${page}: ${product.name} se publica con otra identidad que su ficha canónica`
        );
      }
    }
  }
});
