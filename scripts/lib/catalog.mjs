// Carga js/products.js (que es un script clásico del navegador) en un sandbox y expone
// el catálogo y sus helpers a las herramientas de Node: generador de páginas y tests.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Reloj del catálogo. Las promociones dependen de la fecha, así que todo lo generado
   también: `now` (o la variable CL_NOW, con fecha ISO) fija el instante en que se
   evalúa el catálogo. Sirve para ver HOY cómo quedará el sitio cuando una promo abra
   o cierre (`npm run refresh -- --now=2026-11-01T00:00:00-05:00`). Sin valor, el
   reloj es el real. */
function catalogClock(now) {
  if (now === undefined || now === "") return Date;
  const fixed = typeof now === "number" ? now : Date.parse(now);
  if (!Number.isFinite(fixed)) throw new Error("CL_NOW no es una fecha válida: " + now);
  return class CatalogDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [fixed]));
    }

    static now() {
      return fixed;
    }

    // Una fecha creada fuera del catálogo sigue contando como fecha dentro de él.
    static [Symbol.hasInstance](value) {
      return value instanceof Date;
    }
  };
}

export function loadCatalog({ now = process.env.CL_NOW } = {}) {
  const source = readFileSync(resolve(projectRoot, "js/products.js"), "utf8").replace(
    /^\s*"use strict";/,
    ""
  );
  const catalog = {};
  new Function(
    "Date",
    source +
      "\nthis.CL_PRODUCTS=CL_PRODUCTS; this.CL_FREE_SHIPPING=CL_FREE_SHIPPING;" +
      "\nthis.CL_INSTAGRAM=CL_INSTAGRAM; this.CL_WHATSAPP=CL_WHATSAPP;" +
      "\nthis.clSinglePrice=clSinglePrice; this.clWhatsAppDisplay=clWhatsAppDisplay;" +
      "\nthis.clMoney=clMoney; this.clActivePromo=clActivePromo; this.clHasPacks=clHasPacks;" +
      "\nthis.clFreeShippingLabel=clFreeShippingLabel; this.clPromoPercent=clPromoPercent;" +
      "\nthis.clBestSingleBundle=clBestSingleBundle; this.CL_VAT_NOTE=CL_VAT_NOTE;" +
      "\nthis.CL_LEGAL=CL_LEGAL; this.clFooterLegal=clFooterLegal;" +
      "\nthis.CL_ACTIVES=CL_ACTIVES; this.clActiveInfo=clActiveInfo;" +
      "\nthis.CL_GOAL_GUIDE=CL_GOAL_GUIDE; this.CL_SERVINGS=CL_SERVINGS;" +
      "\nthis.CL_GOALS=CL_GOALS; this.CL_PRODUCT_PRICING=CL_PRODUCT_PRICING;" +
      "\nthis.clBottleDuration=clBottleDuration;" +
      "\nthis.CL_PROMOS=CL_PROMOS; this.CL_PROMO_GROUPS=CL_PROMO_GROUPS;" +
      "\nthis.clPromotedProducts=clPromotedProducts; this.clPromoBands=clPromoBands;" +
      "\nthis.clCatalogOfferText=clCatalogOfferText; this.clNextPromoBoundary=clNextPromoBoundary;"
  ).call(catalog, catalogClock(now));
  return catalog;
}
