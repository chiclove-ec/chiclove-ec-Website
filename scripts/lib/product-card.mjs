import { loadCatalog } from "./catalog.mjs";
import { pagePath } from "./site-config.mjs";

const catalog = loadCatalog();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function productUrl(product, baseUrl) {
  return String(baseUrl || "") + encodeURIComponent(pagePath(product.id + ".html"));
}

export function renderProductCard(product, { page = "home", headingLevel = 3, baseUrl = "" } = {}) {
  const heading = Number(headingLevel) === 2 ? "h2" : "h3";
  const url = productUrl(product, baseUrl);
  const isStoreImage = page === "store" || page === "product";
  const image = isStoreImage ? product.store : product.splash;
  const imageSmall = isStoreImage ? product.storeSmall : product.splashSmall;
  const width = isStoreImage ? 900 : product.splashWidth;
  const height = isStoreImage ? 1361 : 1600;
  const promo = catalog.clActivePromo(product);
  const singlePrice = catalog.clSinglePrice(product);
  const priceMarkup = promo
    ? '<div class="pcard-pack-prices"><small>−' + escapeHtml(catalog.clPromoPercent(product)) + "% en " + escapeHtml(promo.campaignLabel || promo.monthLabel) + '</small></div>' +
      '<span class="pcard-saving">Ahorras ' + escapeHtml(catalog.clMoney(product.price - singlePrice)) + "</span>"
    : '<div class="pcard-pack-prices"><small>Pack x2 ' + escapeHtml(catalog.clMoney(product.pricePack)) + '</small><small>Pack x3 ' + escapeHtml(catalog.clMoney(product.pricePack3)) + '</small></div>' +
      '<span class="pcard-saving">Ahorra hasta ' + escapeHtml(catalog.clMoney(product.price * 3 - product.pricePack3)) + "</span>";

  return '<article class="pcard' + (promo ? " is-promo" : "") + '" data-product-id="' + escapeHtml(product.id) + '">' +
    '<span class="pcard-tag">' + escapeHtml(product.goalLabel) + "</span>" +
    (promo ? '<span class="pcard-promo-tag">−' + escapeHtml(catalog.clPromoPercent(product)) + "%</span>" : "") +
    '<a class="pcard-img" href="' + escapeHtml(url) + '" aria-label="Ver ' + escapeHtml(product.name) + '">' +
      '<img src="' + escapeHtml(imageSmall) + '" srcset="' + escapeHtml(imageSmall) + " 640w, " + escapeHtml(image) + " " + width + 'w" sizes="(max-width: 720px) 80vw, 280px" alt="' + escapeHtml(product.name) + '" width="' + width + '" height="' + height + '" loading="lazy" decoding="async">' +
    "</a>" +
    '<div class="pcard-body">' +
      '<div class="pcard-rating">Sabor ' + escapeHtml(product.flavor) + ", 60 gummies</div>" +
      "<" + heading + '><a href="' + escapeHtml(url) + '">' + escapeHtml(product.name) + "</a></" + heading + ">" +
      '<p class="ptagline">' + escapeHtml(product.tagline) + "</p>" +
      '<div class="pcard-foot"><div class="pcard-price"><div class="pcard-price-head"><strong class="pcard-now-price">' + escapeHtml(catalog.clMoney(singlePrice)) + "</strong>" +
        (promo ? '<del class="pcard-was-price">' + escapeHtml(catalog.clMoney(product.price)) + "</del>" : "") +
        '</div><small class="pcard-vat">' + escapeHtml(catalog.CL_VAT_NOTE) + "</small>" + priceMarkup +
      '</div><a class="add-btn" href="' + escapeHtml(url) + '" aria-label="Ver ' + escapeHtml(product.name) + '">Ver producto</a></div>' +
    "</div></article>";
}

export function renderProductGrid(products, options = {}) {
  const { filter = "todos", exclude = "", limit = products.length } = options;
  return products
    .filter((product) => product.id !== exclude && (filter === "todos" || product.goal === filter))
    .slice(0, limit)
    .map((product) => renderProductCard(product, options))
    .join("\n");
}
