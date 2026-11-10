// Del carrito al pedido enviado: lo que el plan `2026-11-08-checkout-y-confianza.md`
// comprobó que frenaba la compra no puede volver. Mensaje corto y sin formulario,
// botón que describe lo que pasa, aviso de privacidad que nunca tapa una acción de
// compra, plan B cuando WhatsApp no se abre y la empresa a la vista donde se decide.
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

import { loadCatalog, projectRoot } from "../scripts/lib/catalog.mjs";
import { loadPublicFiles } from "./public-files.mjs";

const read = (path) => readFileSync(resolve(projectRoot, path), "utf8");
const productsSource = read("js/products.js");
const mainSource = read("js/main.js");
const css = read("css/styles.css");
const catalog = loadCatalog();

const NOVEMBER = Date.parse("2026-11-10T12:00:00-05:00"); // promo −20 %, solo frascos sueltos
const JANUARY = Date.parse("2027-01-15T12:00:00-05:00"); // sin promo: packs con su precio

function clock(now) {
  return class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
}

// Carga products.js y main.js juntos, como en el navegador, con un DOM mínimo.
// `window` es el propio global, igual que en una página.
function storefront({ now = NOVEMBER, cart = [], clipboard, elements = {}, open } = {}) {
  const storage = new Map([["cl_cart_v1", JSON.stringify(cart)]]);
  const toasts = [];
  const context = vm.createContext({
    navigator: clipboard === undefined ? {} : { clipboard },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    },
    document: {
      addEventListener() {},
      getElementById: (id) => elements[id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {}, select() {}, remove() {} }),
      execCommand: () => false,
      body: { appendChild() {}, classList: { contains: () => false } }
    },
    setTimeout,
    clearTimeout
  });
  context.window = context;
  context.Date = clock(now);
  context.open = open || (() => null);
  vm.runInContext(productsSource, context);
  vm.runInContext(mainSource, context);
  context.toast = (message) => toasts.push(message);
  return { context, toasts };
}

const message = (cart, now) => storefront({ now, cart }).context.whatsappOrderMessage(cart);

/* ---------- el mensaje de WhatsApp ---------- */

test("el mensaje lleva el pedido, el total y una sola pregunta, sin formulario de datos", () => {
  assert.equal(
    message([{ id: "anti-stress", variant: "uno", qty: 1 }]),
    [
      "Hola Chic&Love, quiero hacer este pedido:",
      "",
      "*Anti-Stress Gummies* · 1 frasco · $23.99 (promo −20%)",
      "",
      "*Total: $23.99* + envío · IVA incluido",
      "¿Me confirman disponibilidad y el costo de envío? Mi ciudad es:"
    ].join("\n")
  );
});

test("con varios productos y envío gratis, cada línea dice cantidad, precio vigente y descuento", () => {
  assert.equal(
    message([
      { id: "anti-stress", variant: "uno", qty: 2 },
      { id: "radiant-skin", variant: "uno", qty: 1 }
    ]),
    [
      "Hola Chic&Love, quiero hacer este pedido:",
      "",
      "*Anti-Stress Gummies* · 2 frascos · $47.98 (promo −20%)",
      "*Radiant Skin Vitamins* · 1 frasco · $23.99 (promo −20%)",
      "",
      "*Total: $71.97* · envío gratis · IVA incluido",
      "¿Me confirman disponibilidad? Mi ciudad es:"
    ].join("\n")
  );
});

test("sin promo, los packs y el descuento por cantidad se nombran tal cual se cobran", () => {
  assert.equal(
    message([
      { id: "hair-nails-forte", variant: "pack3", qty: 1 },
      { id: "sleep-vitamins", variant: "uno", qty: 2 }
    ], JANUARY),
    [
      "Hola Chic&Love, quiero hacer este pedido:",
      "",
      "*Hair & Nails Forte* · 1 pack de 3 frascos · $74.99",
      "*Sleep Vitamins* · 2 frascos · $49.99 (descuento por pack)",
      "",
      "*Total: $124.98* · envío gratis · IVA incluido",
      "¿Me confirman disponibilidad? Mi ciudad es:"
    ].join("\n")
  );
});

test("el mensaje nunca pide datos personales ni lleva emojis (regla 9)", () => {
  const carts = [
    [{ id: "anti-stress", variant: "uno", qty: 1 }],
    [{ id: "vinagre-de-manzana", variant: "uno", qty: 5 }, { id: "sexual-booster-men", variant: "uno", qty: 1 }]
  ];
  for (const now of [NOVEMBER, JANUARY]) {
    for (const cart of carts) {
      const text = message(cart, now);
      assert.doesNotMatch(text, /nombre:|tel[eé]fono|c[eé]dula|ruc|e-?mail|correo|direcci[oó]n|datos de entrega/i);
      assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, "WhatsApp convierte los emojis de la URL en U+FFFD");
      assert.doesNotMatch(text, /\n\n\n/, "sin saltos dobles que alarguen el cuadro de texto");
      assert.match(text, /Mi ciudad es:$/, "el único dato que se pide va al final, donde queda el cursor");
    }
  }
});

/* ---------- el botón y lo que pasa después ---------- */

test("el botón dice «Enviar pedido» en el carrito y en todos los textos publicados", () => {
  assert.match(mainSource, /"Enviar pedido por WhatsApp"/);
  const sources = [...loadPublicFiles()].filter((file) => /\.(html|md|txt|json|js)$/.test(file));
  sources.push(
    "README.md",
    ...readdirSync(resolve(projectRoot, "scripts")).filter((f) => f.endsWith(".mjs")).map((f) => "scripts/" + f),
    ...readdirSync(resolve(projectRoot, "scripts/lib")).filter((f) => f.endsWith(".mjs")).map((f) => "scripts/lib/" + f)
  );
  for (const file of sources) {
    let text;
    try { text = read(file); } catch { continue; }
    assert.doesNotMatch(text, /finalizar (tu )?pedido/i, `${file} conserva «Finalizar pedido»`);
  }
});

test("el carrito explica los tres pasos y que enviar el pedido no cobra nada", () => {
  assert.match(mainSource, /"Así sigue tu pedido"/);
  assert.match(mainSource, /solo envíalo/);
  assert.match(mainSource, /horario laboral/);
  assert.match(mainSource, /Pagas cuando te lo confirmemos: enviarlo no tiene costo/);
  assert.doesNotMatch(mainSource, /Antes de confirmar podrás revisar el total de tu compra\./);
});

/* ---------- el aviso de privacidad no tapa la compra ---------- */

test("el aviso de privacidad se aparta mientras el carrito o el menú están abiertos", () => {
  assert.match(css, /body\.ui-locked \.cl-consent-banner\s*\{[^}]*display:\s*none/);
});

test("en las fichas móviles el aviso sube por encima de la barra fija de compra", () => {
  assert.match(css, /body\.pd-sticky-on \.cl-consent-banner\s*\{[^}]*bottom:/);
  assert.match(read("js/product-page.js"), /classList\.toggle\("pd-sticky-on", shouldShow\)/);
});

test("mientras el aviso está abierto, el final de la página sigue siendo legible", () => {
  assert.match(css, /body:has\(> \.cl-consent-banner\) \.footer\s*\{[^}]*padding-bottom:/);
});

/* ---------- plan B si WhatsApp no se abre ---------- */

function fallbackElements() {
  return {
    "cart-fallback": { hidden: true },
    "cart-fallback-link": { href: "" }
  };
}

test("tras pulsar el botón, el carrito ofrece reabrir el chat con el pedido", () => {
  for (const opened of [true, false]) {
    const elements = fallbackElements();
    const popup = { opener: {}, location: { replace(url) { this.url = url; } }, close() {} };
    const { context } = storefront({
      cart: [{ id: "anti-stress", variant: "uno", qty: 1 }],
      elements,
      open: () => (opened ? popup : null)
    });
    context.checkoutWhatsApp();
    assert.equal(elements["cart-fallback"].hidden, false, opened ? "WhatsApp abierto" : "ventana bloqueada");
    const url = new URL(elements["cart-fallback-link"].href);
    assert.equal(url.hostname, "wa.me");
    assert.equal(url.searchParams.get("text"), context.whatsappOrderMessage(context.cartLoad()));
  }
});

test("«Copiar pedido» copia el mismo mensaje que se envía por WhatsApp", async () => {
  let copied = null;
  const cart = [{ id: "radiant-skin", variant: "uno", qty: 2 }];
  const { context, toasts } = storefront({ cart, clipboard: { writeText: async (text) => { copied = text; } } });
  context.copyOrderMessage();
  await new Promise((done) => setImmediate(done));
  assert.equal(copied, context.whatsappOrderMessage(cart));
  assert.match(toasts.at(-1), /copiado/i);
  assert.match(mainSource, /"¿No se abrió WhatsApp\? Escríbenos al "\);\s*fallbackText\.appendChild\(makeEl\("strong", "", clWhatsAppDisplay\(\)\)\)/,
    "el plan B dice a qué número escribir");
});

test("si no se puede copiar, el aviso da el número para escribir", async () => {
  const { context, toasts } = storefront({
    cart: [{ id: "radiant-skin", variant: "uno", qty: 1 }],
    clipboard: { writeText: async () => { throw new Error("denegado"); } }
  });
  context.copyOrderMessage();
  await new Promise((done) => setImmediate(done));
  assert.match(toasts.at(-1), /no se pudo copiar/i);
  assert.ok(toasts.at(-1).includes(catalog.clWhatsAppDisplay()));
});

test("los enlaces de ayuda del carrito son WhatsApp medidos con su contexto", () => {
  assert.match(mainSource, /"data-analytics-context", "cart_help"/);
  assert.match(mainSource, /"data-analytics-context", "cart_fallback"/);
  assert.match(mainSource, /"cart-copy-order"/, "el botón de copiar se mide como button_click");
});

/* ---------- la empresa a la vista ---------- */

test("la línea de quién vende sale de CL_LEGAL", () => {
  const line = catalog.clSellerLine();
  for (const fact of [catalog.CL_LEGAL.companyShort, catalog.CL_LEGAL.ruc, catalog.CL_LEGAL.locality, String(catalog.CL_LEGAL.returnDays)]) {
    assert.ok(line.includes(fact), `falta ${fact}`);
  }
  assert.match(mainSource, /clSellerLine\(\)/, "el carrito la pinta desde el catálogo");
});

test("cada ficha muestra quién vende, con el texto de CL_LEGAL también sin JavaScript", () => {
  const expected = catalog.clSellerLine().replace(/&/g, "&amp;");
  const pages = ["producto.html", ...catalog.CL_PRODUCTS.map((p) => p.id + ".html")];
  for (const page of pages) {
    assert.ok(read(page).includes('<p class="pd-seller" data-seller-line>' + expected + "</p>"), `${page} sin la línea del vendedor`);
  }
});

test("ninguna ficha promete «Entrega rápida» sin un plazo que la respalde", () => {
  const pages = ["producto.html", ...catalog.CL_PRODUCTS.map((p) => p.id + ".html")];
  for (const page of pages) {
    const html = read(page);
    assert.doesNotMatch(html, /Entrega rápida/, page);
    assert.match(html, /<strong>Envío a todo el Ecuador<\/strong><span data-free-shipping-short>/, page);
  }
});
