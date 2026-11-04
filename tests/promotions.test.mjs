// Reglas de las promociones de CL_PROMOS: fechas coherentes, packs retirados solo cuando
// dejan de ahorrar, grupos que comparten de verdad la misma oferta y bandas bien formadas.
// Cada promoción se evalúa en su propia ventana, así que estas pruebas no caducan con el mes.
import { strict as assert } from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { loadCatalog, projectRoot } from "../scripts/lib/catalog.mjs";
import { loadPublicFiles } from "./public-files.mjs";

const catalog = loadCatalog();
const promos = Object.entries(catalog.CL_PROMOS).flatMap(([id, schedule]) => schedule.map((promo) => [id, promo]));
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];
const cents = (value) => Math.round(value * 100);
const ecuadorDay = (timestamp) => new Date(timestamp - 5 * 3600 * 1000).toISOString().slice(0, 10);

test("cada promoción apunta a un producto y rebaja su precio de lista", () => {
  for (const [id, promo] of promos) {
    const product = catalog.CL_PRODUCTS.find((p) => p.id === id);
    assert.ok(product, `${id}: promoción de un producto que no existe`);
    assert.ok(promo.price > 0 && promo.price < product.price, `${id}: el precio promocional no rebaja el de lista`);
    assert.ok(Number.isFinite(promo.start) && Number.isFinite(promo.end) && promo.start < promo.end, `${id}: ventana inválida`);
  }
});

test("las fechas visibles de cada promoción coinciden con su ventana", () => {
  for (const [id, promo] of promos) {
    // `end` es exclusivo: el último día de la promo es el anterior, en hora de Ecuador.
    const lastDay = ecuadorDay(promo.end - 1);
    assert.equal(promo.priceValidUntil, lastDay, `${id}: priceValidUntil no es el último día`);
    const [, month, day] = lastDay.split("-").map(Number);
    assert.equal(promo.endsLabel, day + " de " + MONTHS[month - 1], `${id}: endsLabel no coincide con el cierre`);
    assert.equal(promo.monthLabel, MONTHS[Number(ecuadorDay(promo.start).slice(5, 7)) - 1], `${id}: monthLabel no es el mes de inicio`);
  }
});

test("los packs se retiran exactamente cuando los frascos sueltos salen más baratos", () => {
  for (const [id, promo] of promos) {
    const product = catalog.CL_PRODUCTS.find((p) => p.id === id);
    const singlesBeatPacks =
      cents(promo.price) * 2 <= cents(product.pricePack) || cents(promo.price) * 3 <= cents(product.pricePack3);
    assert.equal(
      Boolean(promo.singleOnly),
      singlesBeatPacks,
      singlesBeatPacks
        ? `${id}: a ${promo.price} los sueltos ya ahorran más que el pack; hay que retirar los packs (singleOnly)`
        : `${id}: los packs siguen ahorrando a ${promo.price}; no hace falta retirarlos`
    );
  }
});

test("las fórmulas de un grupo comparten la misma oferta", () => {
  const groups = new Map();
  for (const [id, promo] of promos) {
    if (!promo.group) continue;
    assert.ok(catalog.CL_PROMO_GROUPS[promo.group], `${id}: grupo ${promo.group} sin ficha en CL_PROMO_GROUPS`);
    const key = [promo.price, promo.start, promo.end, Boolean(promo.singleOnly)].join("|");
    const groupWindow = promo.group + "|" + promo.start;
    const known = groups.get(groupWindow);
    if (known) assert.equal(key, known, `${id}: no comparte precio y fechas con el resto de ${promo.group}`);
    else groups.set(groupWindow, key);
  }
});

test("las imágenes de cada grupo existen y se publican", () => {
  const publicFiles = loadPublicFiles();
  for (const [name, group] of Object.entries(catalog.CL_PROMO_GROUPS)) {
    for (const field of ["title", "label", "cta", "accent", "accentDark"]) {
      assert.ok(group[field], `${name}: falta ${field}`);
    }
    for (const file of [group.image, group.imageSmall, group.imageNarrow].filter(Boolean)) {
      assert.ok(existsSync(resolve(projectRoot, file)), `${name}: falta ${file}`);
      assert.ok(publicFiles.has(file), `${name}: ${file} no está en la lista blanca del build`);
    }
  }
});

test("las bandas agrupan, ordenan por descuento y desaparecen al cerrar la promo", () => {
  for (const [id, promo] of promos) {
    const bands = catalog.clPromoBands(promo.start);
    const percents = bands.map((band) => band.percent);
    assert.deepEqual(percents, [...percents].sort((a, b) => b - a), "las bandas no van de mayor a menor descuento");
    const ids = bands.flatMap((band) => band.products.map((p) => p.id));
    assert.equal(new Set(ids).size, ids.length, "un producto aparece en dos bandas");
    assert.ok(ids.includes(id), `${id}: su promoción no tiene banda`);
    const groupIds = bands.filter((band) => band.groupId).map((band) => band.groupId);
    assert.equal(new Set(groupIds).size, groupIds.length, "un grupo genera más de una banda");
    for (const band of bands) {
      assert.equal(band.percent, catalog.clPromoPercent(band.product, promo.start));
      assert.ok(band.group || band.products.length === 1, "una banda sin grupo anuncia varios productos");
    }
    assert.equal(
      catalog.clPromoBands(promo.end).some((band) => band.promo === promo && band.products.some((p) => p.id === id)),
      false,
      `${id}: la banda sigue viva al cerrar la promo`
    );
  }
});

test("con el reloj fijado, el catálogo evalúa las promociones en ese instante", () => {
  for (const [id, promo] of promos) {
    const opening = loadCatalog({ now: promo.start });
    const closing = loadCatalog({ now: promo.end });
    const product = (cat) => cat.CL_PRODUCTS.find((p) => p.id === id);
    assert.ok(opening.clActivePromo(product(opening)), `${id}: la promo no está viva al abrir`);
    assert.equal(loadCatalog({ now: promo.end - 1 }).clSinglePrice(product(opening)), promo.price, `${id}: el último instante ya no tiene precio de promo`);
    const next = closing.clActivePromo(product(closing));
    assert.ok(!next || next.start >= promo.end, `${id}: sigue viva una promoción anterior`);
    assert.equal(closing.clSinglePrice(product(closing)), next ? next.price : product(closing).price);
  }
  // Una fecha creada fuera del catálogo se sigue reconociendo como fecha dentro.
  const [id, promo] = promos[0];
  const fixed = loadCatalog({ now: promo.end });
  const product = fixed.CL_PRODUCTS.find((p) => p.id === id);
  assert.ok(fixed.clActivePromo(product, new Date(promo.start)), "una Date de fuera no se evalúa");
  assert.throws(() => loadCatalog({ now: "mañana" }), /CL_NOW/);
});

test("sin promociones vivas, la franja superior vuelve a anunciar los packs", () => {
  const afterAll = Math.max(...promos.map(([, promo]) => promo.end));
  const later = loadCatalog({ now: afterAll });
  assert.equal(later.clPromoBands().length, 0);
  assert.match(later.clCatalogOfferText(), /^Packs x2 por \$\d+\.\d{2} y x3 por \$\d+\.\d{2}\.$/);
  for (const [, promo] of promos) {
    assert.match(loadCatalog({ now: promo.start }).clCatalogOfferText(), new RegExp(" en " + (promo.campaignLabel || promo.monthLabel) + "$"));
  }
});

test("la franja superior escrita en el HTML es la oferta vigente", () => {
  // main.js la repinta al cargar; el HTML la lleva escrita para quien no ejecuta
  // JavaScript. Si no coincide, alguien no regeneró al abrir o cerrar una promo.
  const expected = catalog.clCatalogOfferText().replace(/&/g, "&amp;");
  const pages = readdirSync(projectRoot).filter((file) => file.endsWith(".html"));
  let found = 0;
  for (const page of pages) {
    const match = readFileSync(resolve(projectRoot, page), "utf8")
      .match(/<span class="topbar-offer" data-catalog-offer>([^<]*)<\/span>/);
    if (!match) continue;
    found++;
    assert.equal(match[1], expected, `${page}: la franja superior no es la oferta vigente (ejecuta npm run refresh)`);
  }
  assert.ok(found >= 10, `solo ${found} páginas llevan la franja superior`);
});

// Una fecha no puede seleccionar dos campañas para la misma fórmula.
test("las campañas de cada producto no se solapan", () => {
  for (const [id, schedule] of Object.entries(catalog.CL_PROMOS)) {
    const ordered = [...schedule].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(ordered[i - 1].end <= ordered[i].start, `${id}: campañas solapadas`);
    }
  }
});
