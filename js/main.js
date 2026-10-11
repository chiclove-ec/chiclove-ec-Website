/* Chic&Love Ecuador — comportamiento global:
   header, menú móvil, reveals, render de tarjetas, carrito (localStorage)
   y checkout vía WhatsApp. Sin dependencias externas. */
"use strict";

/* ---------- utilidades ---------- */
function makeEl(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function makeSvg(pathData) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  var path = document.createElementNS(ns, "path");
  path.setAttribute("d", pathData);
  svg.appendChild(path);
  return svg;
}

function trapDialogFocus(container, event) {
  if (event.key !== "Tab" || !container || !container.classList.contains("open")) return;
  var focusable = Array.from(container.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (el) {
    return !el.hidden && !el.inert;
  });
  if (!focusable.length) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

var toastTimer = null;
function toast(msg) {
  var el = document.getElementById("cl-toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
}

/* ---------- imágenes diferidas ---------- */
var lazyImageObserver = null;
// Las imágenes diferidas solo pueden salir del directorio local de assets.
function safeLazyImageUrl(value) {
  if (!value) return null;
  try {
    var url = new URL(value, document.baseURI);
    var assetRoot = new URL("assets/img/", document.baseURI);
    if (url.protocol !== window.location.protocol || url.origin !== window.location.origin) return null;
    if (!url.pathname.startsWith(assetRoot.pathname) || url.username || url.password) return null;
    if (url.search || url.hash) return null;
    return url.href;
  } catch (_) {
    return null;
  }
}

function safeLazyImageSrcset(value) {
  return value
    .split(",")
    .map(function (candidate) {
      var parts = candidate.trim().split(/\s+/);
      var safeUrl = safeLazyImageUrl(parts.shift());
      var safeDescriptors = parts.every(function (part) { return /^\d+[wx]$/.test(part); });
      return safeUrl && safeDescriptors ? [safeUrl].concat(parts).join(" ") : "";
    })
    .filter(Boolean)
    .join(", ");
}

function revealLazyImage(image) {
  var source = image.getAttribute("data-lazy-src");
  if (!source) return;
  var safeSource = safeLazyImageUrl(source);
  if (!safeSource) return;
  image.addEventListener("load", function () { image.classList.add("loaded"); }, { once: true });
  var sourceSet = image.getAttribute("data-lazy-srcset");
  var sizes = image.getAttribute("data-lazy-sizes");
  var safeSourceSet = sourceSet ? safeLazyImageSrcset(sourceSet) : "";
  if (safeSourceSet) image.srcset = safeSourceSet;
  if (sizes) image.sizes = sizes;
  image.src = safeSource;
  image.removeAttribute("data-lazy-src");
  image.removeAttribute("data-lazy-srcset");
  image.removeAttribute("data-lazy-sizes");
  if (image.complete) image.classList.add("loaded");
}

function observeLazyImages(scope) {
  var images = (scope || document).querySelectorAll("img[data-lazy-src]");
  if (!("IntersectionObserver" in window)) {
    images.forEach(revealLazyImage);
    return;
  }
  if (!lazyImageObserver) {
    lazyImageObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealLazyImage(entry.target);
        lazyImageObserver.unobserve(entry.target);
      });
    }, { rootMargin: "320px 0px" });
  }
  images.forEach(function (image) { lazyImageObserver.observe(image); });
}

/* ---------- carrito ---------- */
var CART_KEY = "cl_cart_v1";
var MAX_CART_STORAGE_LENGTH = 8192;
var MAX_CART_LINES = CL_PRODUCTS.length * 3;

function cartLoad() {
  try {
    var stored = localStorage.getItem(CART_KEY) || "[]";
    if (stored.length > MAX_CART_STORAGE_LENGTH) {
      localStorage.removeItem(CART_KEY);
      return [];
    }
    var raw = JSON.parse(stored);
    if (!Array.isArray(raw)) {
      cartSave([]);
      return [];
    }
    if (raw.length > MAX_CART_LINES * 2) raw = raw.slice(0, MAX_CART_LINES * 2);
    // Revalida, elimina campos inesperados y consolida duplicados manipulados.
    var normalized = [];
    raw.forEach(function (it) {
      var product = it && clFindProduct(it.id);
      if (!product ||
          (it.variant !== "uno" && it.variant !== "pack" && it.variant !== "pack3") ||
          !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) return;
      var variant = it.variant;
      var qty = it.qty;
      // Packs guardados antes de que una promo los retirara: se convierten a frascos
      // sueltos, que al precio promocional salen más baratos que el pack original.
      if (variant !== "uno" && !clHasPacks(product)) {
        qty = Math.min(qty * (variant === "pack3" ? 3 : 2), 99);
        variant = "uno";
      }
      var found = normalized.find(function (known) {
        return known.id === it.id && known.variant === variant;
      });
      if (found) found.qty = Math.min(found.qty + qty, 99);
      else if (normalized.length < MAX_CART_LINES) {
        normalized.push({ id: it.id, variant: variant, qty: qty });
      }
    });
    if (JSON.stringify(normalized) !== stored) cartSave(normalized);
    return normalized;
  } catch (e) {
    try { localStorage.removeItem(CART_KEY); } catch (storageError) { /* sin acceso */ }
    return [];
  }
}

function cartSave(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* modo privado */ }
}

function itemPrice(it) {
  var p = clFindProduct(it.id);
  if (it.variant === "pack3") return p.pricePack3;
  return it.variant === "pack" ? p.pricePack : clSinglePrice(p);
}

function itemTotal(it) {
  var p = clFindProduct(it.id);
  if (it.variant === "uno") return clBestSingleBundle(p, it.qty).total;
  return itemPrice(it) * it.qty;
}

function cartTotal(items) {
  return items.reduce(function (sum, it) { return sum + itemTotal(it); }, 0);
}

function cartCount(items) {
  return items.reduce(function (sum, it) { return sum + it.qty; }, 0);
}

function analyticsCartItems(items) {
  return items.map(function (it) {
    var product = clFindProduct(it.id);
    return {
      item_id: it.id,
      item_name: product.name,
      item_category: product.goalLabel,
      item_variant: it.variant,
      price: itemPrice(it),
      quantity: it.qty
    };
  });
}

function cartAdd(id, variant, qty) {
  var p = clFindProduct(id);
  if (!p) return;
  if (variant !== "pack" && variant !== "pack3") variant = "uno";
  qty = Math.min(Math.max(parseInt(qty, 10) || 1, 1), 99);
  var items = cartLoad();
  var found = items.find(function (it) { return it.id === id && it.variant === variant; });
  if (found) found.qty = Math.min(found.qty + qty, 99);
  else if (items.length < MAX_CART_LINES) items.push({ id: id, variant: variant, qty: qty });
  cartSave(items);
  renderCart();
  if (window.clAnalytics) {
    window.clAnalytics.track("add_to_cart", {
      item_id: id,
      item_name: p.name,
      item_variant: variant,
      quantity: qty,
      value: itemTotal({ id: id, variant: variant, qty: qty }),
      currency: "USD",
      items: [{
        item_id: id,
        item_name: p.name,
        item_category: p.goalLabel,
        item_variant: variant,
        price: itemPrice({ id: id, variant: variant, qty: 1 }),
        quantity: qty
      }]
    });
  }
  var cartBadge = document.getElementById("cart-count");
  if (cartBadge) { cartBadge.classList.remove("bump"); void cartBadge.offsetWidth; cartBadge.classList.add("bump"); }
  openCart();
}

function cartSetQty(id, variant, qty) {
  var items = cartLoad();
  var it = items.find(function (x) { return x.id === id && x.variant === variant; });
  if (!it) return;
  qty = Number(qty);
  it.qty = Number.isInteger(qty) ? Math.max(0, Math.min(qty, 99)) : 0;
  cartSave(items.filter(function (x) { return x.qty > 0; }));
  renderCart();
}

function cartRemove(id, variant) {
  var removed = cartLoad().find(function (x) { return x.id === id && x.variant === variant; });
  cartSave(cartLoad().filter(function (x) { return !(x.id === id && x.variant === variant); }));
  renderCart();
  if (removed && window.clAnalytics) {
    window.clAnalytics.track("remove_from_cart", {
      item_id: id,
      item_name: clFindProduct(id).name,
      item_variant: variant,
      quantity: removed.qty,
      currency: "USD",
      items: [{
        item_id: id,
        item_name: clFindProduct(id).name,
        item_category: clFindProduct(id).goalLabel,
        item_variant: variant,
        price: itemPrice({ id: id, variant: variant, qty: 1 }),
        quantity: removed.qty
      }]
    });
  }
}

function whatsappItemDetails(it) {
  var product = clFindProduct(it.id);
  var quantity;

  if (it.variant === "pack3") {
    quantity = it.qty + (it.qty === 1 ? " pack de 3 frascos" : " packs de 3 frascos");
  } else if (it.variant === "pack") {
    quantity = it.qty + (it.qty === 1 ? " pack de 2 frascos" : " packs de 2 frascos");
  } else {
    quantity = it.qty + (it.qty === 1 ? " frasco" : " frascos");
  }

  var details = [
    "*" + product.name + "*",
    quantity + " - *" + clMoney(itemTotal(it)) + "*"
  ];
  // El precio promocional solo afecta al frasco suelto; los packs conservan su tarifa.
  var promo = it.variant === "uno" ? clActivePromo(product) : null;
  if (promo) {
    details.push("Promo −" + clPromoPercent(product) + "% aplicada");
  } else if (it.variant === "uno" && it.qty > 1) {
    details.push("Descuento por pack aplicado");
  }
  return details;
}

function whatsappOrderMessage(items) {
  var lines = [
    "Hola Chic&Love, quiero hacer este pedido:",
    "",
    "",
    "*PEDIDO*",
    "",
    ""
  ];

  items.forEach(function (it) {
    lines = lines.concat(whatsappItemDetails(it));
    lines.push("", "");
  });

  var orderTotal = cartTotal(items);
  var totalLine = "*TOTAL: " + clMoney(orderTotal) + "*";
  if (orderTotal > 0 && orderTotal < CL_FREE_SHIPPING) totalLine += " + envío";
  totalLine += " (" + CL_VAT_NOTE + ")";
  lines.push(
    totalLine,
    "Los precios publicados incluyen IVA. Confirmaremos disponibilidad, dirección de entrega y datos para la transferencia.",
    "",
    "",
    "*DATOS DE ENTREGA*",
    "Nombre:",
    "Teléfono:",
    "Cédula / RUC:",
    "Email:",
    "Ciudad:",
    "Dirección:"
  );
  return lines.join("\n");
}

function checkoutWhatsApp() {
  var items = cartLoad();
  if (!items.length) { toast("Tu carrito está vacío"); return; }
  var url = clWhatsAppUrl(whatsappOrderMessage(items));
  if (!url) {
    toast("No se pudo abrir WhatsApp. Escríbenos desde el enlace de contacto.");
    return;
  }
  var checkoutWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (checkoutWindow) {
    checkoutWindow.opener = null;
    if (window.clAnalytics) window.clAnalytics.track("begin_checkout", {
      items_count: items.length,
      value: cartTotal(items),
      currency: "USD",
      items: analyticsCartItems(items)
    });
    if (window.clAnalytics) window.clAnalytics.track("generate_lead", {
      method: "whatsapp",
      items_count: items.length,
      value: cartTotal(items),
      currency: "USD",
      items: analyticsCartItems(items)
    });
  }
}

/* ---------- drawer del carrito (chrome inyectado) ---------- */
function buildCartChrome() {
  var overlay = document.createElement("div");
  overlay.className = "cart-overlay";
  overlay.id = "cart-overlay";
  overlay.addEventListener("click", closeCart);

  var drawer = document.createElement("aside");
  drawer.className = "cart-drawer";
  drawer.id = "cart-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", "Carrito de compras");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  var head = makeEl("div", "cart-head");
  head.appendChild(makeEl("h3", "", "Tu carrito"));
  var close = makeEl("button", "icon-btn", "×");
  close.type = "button";
  close.id = "cart-close";
  close.setAttribute("aria-label", "Cerrar carrito");
  head.appendChild(close);

  var cartItems = makeEl("div", "cart-items");
  cartItems.id = "cart-items";
  var foot = makeEl("div", "cart-foot");
  var total = makeEl("div", "cart-total");
  var totalLabel = makeEl("span", "", "Total");
  totalLabel.appendChild(makeEl("small", "cart-total-vat", CL_VAT_NOTE));
  total.appendChild(totalLabel);
  var totalValue = makeEl("span", "", "$0.00");
  totalValue.id = "cart-total";
  total.appendChild(totalValue);
  foot.appendChild(total);
  var shipping = makeEl("div", "cart-shipping");
  var shippingText = makeEl("p", "", "Añade productos para activar el envío gratis");
  shippingText.id = "cart-shipping-text";
  var shippingProgress = document.createElement("progress");
  shippingProgress.id = "cart-shipping-progress";
  shippingProgress.max = CL_FREE_SHIPPING;
  shippingProgress.value = 0;
  shippingProgress.setAttribute("aria-label", "Progreso para obtener envío gratis");
  shipping.append(shippingText, shippingProgress);
  foot.appendChild(shipping);
  foot.appendChild(makeEl("p", "cart-note", "Antes de confirmar podrás revisar el total de tu compra."));
  var checkout = makeEl("button", "btn btn-wa btn-wide");
  checkout.type = "button";
  checkout.id = "cart-checkout";
  checkout.appendChild(makeSvg("M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.7-5 6.6 6.6 0 0 1-1.3-3.4c0-1.6.9-2.4 1.2-2.7.3-.3.7-.4.9-.4h.6c.2 0 .5-.1.7.5l1 2.3c0 .2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.1.3.7 1.1 1.5 1.9 1 .9 1.9 1.2 2.2 1.4.3.1.5.1.7-.1l.8-1c.2-.3.4-.2.7-.1l2.2 1c.3.2.5.3.6.4 0 .2 0 .7-.2 1.2Z"));
  checkout.appendChild(document.createTextNode("Finalizar pedido por WhatsApp"));
  foot.appendChild(checkout);
  var terms = makeEl("p", "cart-note cart-terms");
  terms.append(
    document.createTextNode("Al finalizar tu pedido aceptas nuestros "),
    Object.assign(makeEl("a", "", "Términos de compra"), { href: "terms" }),
    document.createTextNode(". Consulta cómo tratamos tus datos en nuestra "),
    Object.assign(makeEl("a", "", "Política de privacidad"), { href: "privacy" }),
    document.createTextNode(".")
  );
  foot.appendChild(terms);
  drawer.append(head, cartItems, foot);

  var toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.id = "cl-toast";
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");

  document.body.append(overlay, drawer, toastEl);
  document.getElementById("cart-close").addEventListener("click", closeCart);
  document.getElementById("cart-checkout").addEventListener("click", checkoutWhatsApp);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Tab") {
      if (drawer.classList.contains("open")) trapDialogFocus(drawer, e);
      else trapDialogFocus(document.getElementById("mobile-menu"), e);
    }
    if (e.key === "Escape") { closeCart(); closeMenu(); }
  });
}

function openCart() {
  var drawer = document.getElementById("cart-drawer");
  document.getElementById("cart-overlay").classList.add("open");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  drawer.inert = false;
  document.body.classList.add("ui-locked");
  var trigger = document.getElementById("cart-open");
  if (trigger) trigger.setAttribute("aria-expanded", "true");
  if (window.clAnalytics) {
    var items = cartLoad();
    window.clAnalytics.track("view_cart", {
      value: cartTotal(items),
      currency: "USD",
      items: analyticsCartItems(items)
    });
  }
  document.getElementById("cart-close").focus();
}

function closeCart() {
  var drawer = document.getElementById("cart-drawer");
  var shouldRestoreFocus = drawer.contains(document.activeElement);
  document.getElementById("cart-overlay").classList.remove("open");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  if (!document.getElementById("mobile-menu").classList.contains("open")) document.body.classList.remove("ui-locked");
  var trigger = document.getElementById("cart-open");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  if (trigger && shouldRestoreFocus) trigger.focus();
}

function renderCart() {
  var items = cartLoad();
  var box = document.getElementById("cart-items");
  var totalEl = document.getElementById("cart-total");
  var shippingText = document.getElementById("cart-shipping-text");
  var shippingProgress = document.getElementById("cart-shipping-progress");
  var countEl = document.getElementById("cart-count");
  if (countEl) {
    var n = cartCount(items);
    var visibleCount = n > 99 ? "99+" : String(n);
    countEl.textContent = visibleCount;
    countEl.classList.toggle("on", n > 0);
    var cartTrigger = document.getElementById("cart-open");
    if (cartTrigger) cartTrigger.setAttribute("aria-label", "Abrir carrito, " + visibleCount + (n === 1 ? " producto" : " productos"));
  }
  if (!box) return;
  box.textContent = "";
  if (!items.length) {
    var empty = makeEl("div", "cart-empty");
    empty.appendChild(makeEl("div", "empty-mark", "0"));
    var emptyText = makeEl("p", "", "Tu carrito está vacío.");
    emptyText.append(document.createElement("br"), document.createTextNode("Tus vitaminas favoritas te esperan."));
    empty.appendChild(emptyText);
    box.appendChild(empty);
  } else {
    items.forEach(function (it) {
      var p = clFindProduct(it.id);
      var vLabel;
      if (it.variant === "pack3") vLabel = "Pack x3 frascos";
      else if (it.variant === "pack") vLabel = "Pack x2 frascos";
      else if (!clHasPacks(p)) vLabel = it.qty + (it.qty === 1 ? " frasco, −" : " frascos, −") + clPromoPercent(p) + "% aplicado";
      else if (it.qty === 2) vLabel = "2 frascos, pack x2 aplicado";
      else if (it.qty === 3) vLabel = "3 frascos, pack x3 aplicado";
      else if (it.qty > 3) vLabel = it.qty + " frascos, descuento por packs aplicado";
      else vLabel = "1 frasco con 60 gummies";
      var row = makeEl("div", "cart-item");
      var image = makeEl("img");
      image.src = p.bottle;
      image.alt = p.name;
      image.decoding = "async";
      var details = makeEl("div");
      details.appendChild(makeEl("h4", "", p.name));
      details.appendChild(makeEl("div", "variant", vLabel));
      details.appendChild(makeEl("div", "price", clMoney(itemTotal(it))));
      var qtyControl = makeEl("span", "qty");
      var minus = makeEl("button", "", "−");
      minus.type = "button";
      minus.setAttribute("aria-label", "Quitar uno");
      var quantity = makeEl("span", "q", it.qty);
      var plus = makeEl("button", "", "+");
      plus.type = "button";
      plus.setAttribute("aria-label", "Añadir uno");
      qtyControl.append(minus, quantity, plus);
      details.appendChild(qtyControl);
      var remove = makeEl("button", "rm", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Eliminar del carrito");
      row.append(image, details, remove);
      minus.addEventListener("click", function () { cartSetQty(it.id, it.variant, it.qty - 1); });
      plus.addEventListener("click", function () { cartSetQty(it.id, it.variant, Math.min(it.qty + 1, 99)); });
      remove.addEventListener("click", function () { cartRemove(it.id, it.variant); });
      box.appendChild(row);
    });
  }
  var addMore = makeEl("a", "btn btn-ghost btn-wide cart-add-more");
  addMore.href = "tienda";
  var addMoreIcon = makeEl("span", "cart-add-more-icon", "+");
  addMoreIcon.setAttribute("aria-hidden", "true");
  addMore.append(addMoreIcon, document.createTextNode("Añadir más productos"));
  addMore.addEventListener("click", function (event) {
    if (!document.body.classList.contains("page-store")) return;
    event.preventDefault();
    closeCart();
    var productGrid = document.querySelector("[data-products-grid]");
    if (productGrid) productGrid.scrollIntoView({ block: "start" });
  });
  box.appendChild(addMore);
  var total = cartTotal(items);
  if (totalEl) {
    totalEl.textContent = clMoney(total);
    if (total > 0 && total < CL_FREE_SHIPPING) {
      totalEl.appendChild(makeEl("span", "cart-total-ship", "+ envío"));
    }
  }
  if (shippingProgress) shippingProgress.value = Math.min(total, CL_FREE_SHIPPING);
  if (shippingText) {
    if (total >= CL_FREE_SHIPPING) shippingText.textContent = "Tu pedido incluye envío gratis";
    else if (total > 0) shippingText.textContent = "Te faltan " + clMoney(CL_FREE_SHIPPING - total) + " para el envío gratis";
    else shippingText.textContent = "Envío gratis en compras desde " + clFreeShippingLabel() + ". IVA incluido.";
  }
}

/* ---------- tarjetas de producto ---------- */
function productCard(p, revealDelay) {
  var card = makeEl("article", "pcard reveal" + (revealDelay ? " reveal-d" + revealDelay : ""));
  card.setAttribute("data-product-id", p.id);
  var productUrl = encodeURIComponent(p.id);
  var promo = clActivePromo(p);
  if (promo) card.classList.add("is-promo");
  card.appendChild(makeEl("span", "pcard-tag", p.goalLabel));
  if (promo) card.appendChild(makeEl("span", "pcard-promo-tag", "−" + clPromoPercent(p) + "%"));
  var imageLink = makeEl("a", "pcard-img");
  imageLink.href = productUrl;
  imageLink.setAttribute("data-analytics-item", p.id);
  imageLink.setAttribute("data-analytics-item-name", p.name);
  imageLink.setAttribute("data-analytics-item-category", p.goalLabel);
  imageLink.setAttribute("aria-label", "Ver " + p.name);
  var image = makeEl("img");
  image.className = "lazy-media";
  var useStore = (document.body.classList.contains("page-store") || document.body.classList.contains("page-product")) && p.store;
  var cardSrc = useStore ? p.store : p.splash;
  var cardSmall = useStore ? p.storeSmall : p.splashSmall;
  var cardWidth = useStore ? 900 : p.splashWidth;
  image.setAttribute("data-lazy-src", cardSrc);
  image.setAttribute("data-lazy-srcset", cardSmall + " 640w, " + cardSrc + " " + cardWidth + "w");
  image.setAttribute("data-lazy-sizes", "(max-width: 720px) 80vw, 280px");
  image.width = cardWidth;
  image.height = useStore ? 1361 : 1600;
  image.alt = p.name;
  image.loading = "lazy";
  image.decoding = "async";
  imageLink.appendChild(image);
  card.appendChild(imageLink);

  var body = makeEl("div", "pcard-body");
  var meta = makeEl("div", "pcard-rating", "Sabor " + p.flavor + ", 60 gummies");
  body.appendChild(meta);
  var heading = makeEl(document.body.classList.contains("page-store") ? "h2" : "h3");
  var nameLink = makeEl("a", "", p.name);
  nameLink.href = productUrl;
  nameLink.setAttribute("data-analytics-item", p.id);
  nameLink.setAttribute("data-analytics-item-name", p.name);
  nameLink.setAttribute("data-analytics-item-category", p.goalLabel);
  heading.appendChild(nameLink);
  body.appendChild(heading);
  body.appendChild(makeEl("p", "ptagline", p.tagline));
  var cardFoot = makeEl("div", "pcard-foot");
  var singlePrice = clSinglePrice(p);
  var price = makeEl("div", "pcard-price");
  var priceHead = makeEl("div", "pcard-price-head");
  priceHead.appendChild(makeEl("strong", "pcard-now-price", clMoney(singlePrice)));
  if (promo) priceHead.appendChild(makeEl("del", "pcard-was-price", clMoney(p.price)));
  price.appendChild(priceHead);
  price.appendChild(makeEl("small", "pcard-vat", CL_VAT_NOTE));
  // La tarjeta en promo reutiliza las mismas dos ranuras que las demás (línea
  // secundaria y píldora de ahorro), para que la rejilla no pierda simetría.
  var secondLine = makeEl("div", "pcard-pack-prices");
  if (promo) {
    secondLine.appendChild(makeEl("small", "", "−" + clPromoPercent(p) + "% en " + promo.monthLabel));
    price.appendChild(secondLine);
    price.appendChild(makeEl("span", "pcard-saving", "Ahorras " + clMoney(p.price - singlePrice)));
  } else {
    secondLine.appendChild(makeEl("small", "", "Pack x2 " + clMoney(p.pricePack)));
    secondLine.appendChild(makeEl("small", "", "Pack x3 " + clMoney(p.pricePack3)));
    price.appendChild(secondLine);
    price.appendChild(makeEl("span", "pcard-saving", "Ahorra hasta " + clMoney(p.price * 3 - p.pricePack3)));
  }
  var add = makeEl("button", "add-btn", "Añadir");
  add.type = "button";
  add.setAttribute("aria-label", "Añadir " + p.name + " al carrito");
  add.addEventListener("click", function () { cartAdd(p.id, "uno", 1); });
  cardFoot.append(price, add);
  body.appendChild(cardFoot);
  card.appendChild(body);
  return card;
}

function expectedGridProductIds(grid) {
  var filter = grid.getAttribute("data-filter") || "todos";
  var limit = parseInt(grid.getAttribute("data-limit"), 10) || CL_PRODUCTS.length;
  var exclude = grid.getAttribute("data-exclude") || "";
  return CL_PRODUCTS.filter(function (p) {
    if (p.id === exclude) return false;
    return filter === "todos" || p.goal === filter;
  }).slice(0, limit).map(function (p) { return p.id; });
}

function canHydrateGrid(grid, list) {
  var cards = Array.from(grid.children).filter(function (child) {
    return child.hasAttribute && child.hasAttribute("data-product-id");
  });
  if (cards.length !== list.length) return false;
  return list.every(function (product, index) {
    var card = cards[index];
    return card.getAttribute("data-product-id") === product.id &&
      card.classList.contains("is-promo") === !!clActivePromo(product);
  });
}

function hydrateProductCard(card, product, revealDelay) {
  card.setAttribute("data-hydrated-card", "true");
  card.classList.add("reveal");
  ["reveal-d1", "reveal-d2", "reveal-d3", "reveal-d4", "reveal-d5"].forEach(function (name) {
    card.classList.remove(name);
  });
  if (revealDelay) card.classList.add("reveal-d" + revealDelay);

  var links = card.querySelectorAll(".pcard-img, .pcard-body h2 a, .pcard-body h3 a");
  links.forEach(function (link) {
    link.setAttribute("data-analytics-item", product.id);
    link.setAttribute("data-analytics-item-name", product.name);
    link.setAttribute("data-analytics-item-category", product.goalLabel);
  });

  var action = card.querySelector(".add-btn");
  if (!action || action.dataset.hydratedAction === "true") return;
  var button = document.createElement("button");
  button.type = "button";
  button.className = action.className;
  button.textContent = "Añadir";
  button.setAttribute("aria-label", "Añadir " + product.name + " al carrito");
  button.dataset.hydratedAction = "true";
  button.addEventListener("click", function () { cartAdd(product.id, "uno", 1); });
  action.replaceWith(button);
}

/* ---------- bandas de promoción ---------- */
// Cuenta atrás honesta: sale de la fecha de cierre real de la promoción en el catálogo.
function promoDaysLeft(promo) {
  var ms = promo && promo.end ? promo.end - Date.now() : 0;
  if (!(ms > 0)) return "";
  var days = Math.ceil(ms / 86400000);
  return days <= 1 ? ". Queda 1 día" : ". Quedan " + days + " días";
}

// Una banda anuncia una fórmula (y lleva a su ficha) o un grupo de fórmulas con el
// mismo descuento (y lleva a la tienda). Comparten maqueta: cambian textos, color e imagen.
function promoBand(band, eager) {
  var product = band.product;
  var promo = band.promo;
  var group = band.group;
  var price = clSinglePrice(product);
  var link = makeEl("a", "promo-band" + (group ? " is-group" : ""));
  link.href = group ? "tienda" : encodeURIComponent(product.id);
  link.style.setProperty("--a", group ? group.accent : product.accent);
  link.style.setProperty("--a-dark", group ? group.accentDark : product.accentDark);
  link.setAttribute("aria-label", "Ver " + (group ? group.title.toLowerCase() : product.name) + " con " +
    band.percent + "% de descuento, " + clMoney(price) + " en vez de " + clMoney(product.price) +
    (group ? " cada frasco" : ""));
  if (group) {
    // En la tienda la colección ya está debajo: basta con bajar hasta ella.
    link.addEventListener("click", function (event) {
      var grid = document.querySelector("[data-products-grid]");
      if (!document.body.classList.contains("page-store") || !grid) return;
      event.preventDefault();
      grid.scrollIntoView({ block: "start" });
    });
  }

  var copy = makeEl("div", "promo-band-copy");
  // El descuento vive en la chapa, no en el título: repetirlo en ambos sitios
  // le quita fuerza justo a la cifra que queremos que se lea primero.
  var head = makeEl("div", "promo-band-head");
  head.appendChild(makeEl("span", "promo-band-kicker", "Solo en " + promo.monthLabel));
  head.appendChild(makeEl("span", "promo-band-badge", "−" + band.percent + "%"));
  copy.appendChild(head);
  copy.appendChild(makeEl("h2", "", group ? group.title : product.short));
  var prices = makeEl("p", "promo-band-prices");
  prices.appendChild(makeEl("strong", "", clMoney(price)));
  prices.appendChild(makeEl("del", "", clMoney(product.price)));
  prices.appendChild(makeEl("span", "promo-band-vat", CL_VAT_NOTE));
  copy.appendChild(prices);
  var actions = makeEl("div", "promo-band-actions");
  actions.appendChild(makeEl("span", "promo-band-cta", group ? group.cta : "Ver producto"));
  actions.appendChild(makeEl("span", "promo-band-deadline", "Hasta el " + promo.endsLabel + promoDaysLeft(promo)));
  copy.appendChild(actions);

  // Imagen editorial de tienda (o la composición del grupo, con el mismo fondo y
  // tamaño): casi cuadrada, encaja en la banda mucho mejor que el splash (946×1600).
  var media = makeEl("div", "promo-band-media");
  var image = makeEl("img");
  var imageSmall = group ? group.imageSmall : product.storeSmall;
  image.src = imageSmall;
  image.srcset = imageSmall + " 640w, " + (group ? group.image : product.store) + " 900w";
  image.sizes = "(max-width: 720px) 38vw, 360px";
  image.width = 900;
  image.height = 988;
  image.alt = "";
  // La primera banda va sin lazy: en la tienda queda sobre el pliegue y es el foco.
  if (!eager) image.loading = "lazy";
  image.decoding = "async";
  if (group && group.imageNarrow) {
    // Un frasco suelto aguanta el recorte lateral del móvil; seis frascos en fila, no.
    var picture = makeEl("picture");
    var narrow = makeEl("source");
    narrow.media = "(max-width: 520px)";
    narrow.srcset = group.imageNarrow;
    picture.append(narrow, image);
    media.appendChild(picture);
  } else {
    media.appendChild(image);
  }

  link.append(copy, media);
  return link;
}

// Cada banda anuncia fórmulas concretas: solo tiene sentido mientras alguna siga en
// la rejilla, así que desaparece al filtrar por un objetivo que no incluye ninguna.
function promoBandFitsFilter(band) {
  var grid = document.querySelector("[data-products-grid][data-filter]");
  if (!grid) return true;
  var filter = grid.getAttribute("data-filter") || "todos";
  return filter === "todos" || band.products.some(function (product) { return product.goal === filter; });
}

function renderPromoBand() {
  var mounts = document.querySelectorAll("[data-promo-band]");
  if (!mounts.length) return;
  var bands = clPromoBands().filter(promoBandFitsFilter);
  mounts.forEach(function (mount) {
    var host = mount.querySelector(".wrap") || mount;
    // Solo se sustituye la pila de bandas: el encabezado de la sección (si lo hay) se queda.
    var previous = host.querySelector(".promo-bands");
    if (previous) previous.remove();
    mount.hidden = !bands.length;
    if (!bands.length) return;
    var stack = makeEl("div", "promo-bands");
    bands.forEach(function (band, index) { stack.appendChild(promoBand(band, index === 0)); });
    host.appendChild(stack);
  });
}

function renderGrids() {
  document.querySelectorAll("[data-products-grid]").forEach(function (grid) {
    var list = expectedGridProductIds(grid).map(function (id) { return clFindProduct(id); });
    grid.classList.toggle("is-seven", list.length === 7);
    if (!canHydrateGrid(grid, list)) {
      grid.textContent = "";
      list.forEach(function (p, i) { grid.appendChild(productCard(p, (i % 4) ? (i % 4) : 0)); });
    } else {
      list.forEach(function (p, i) {
        var card = grid.children[i];
        hydrateProductCard(card, p, (i % 4) ? (i % 4) : 0);
      });
    }
    var filterStatus = document.getElementById("filter-status");
    if (filterStatus && grid.hasAttribute("data-filter")) {
      filterStatus.textContent = list.length + (list.length === 1 ? " producto mostrado" : " productos mostrados");
    }
    observeReveals(grid);
    observeLazyImages(grid);
  });
}

/* chips de filtro (tienda) */
function initChips() {
  var bar = document.querySelector("[data-chips]");
  var grid = document.querySelector("[data-products-grid]");
  if (!bar || !grid) return;
  CL_GOALS.forEach(function (g, i) {
    var b = document.createElement("button");
    b.className = "chip" + (i === 0 ? " on" : "");
    b.textContent = g.label;
    b.setAttribute("data-analytics-filter", g.id);
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.addEventListener("click", function () {
      bar.querySelectorAll(".chip").forEach(function (c) {
        c.classList.remove("on");
        c.setAttribute("aria-pressed", "false");
      });
      b.classList.add("on");
      b.setAttribute("aria-pressed", "true");
      grid.setAttribute("data-filter", g.id);
      renderGrids();
      renderPromoBand();
    });
    bar.appendChild(b);
  });
}

/* ---------- reveals ---------- */
var revealObserver = null;
function observeReveals(scope) {
  if (!("IntersectionObserver" in window)) {
    (scope || document).querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          revealObserver.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  }
  (scope || document).querySelectorAll(".reveal:not(.in)").forEach(function (el) { revealObserver.observe(el); });
}

/* ---------- contadores animados (delicados) ---------- */
var countObserver = null;
function animateCount(el) {
  if (el.dataset.counted) return;
  var text = el.textContent.trim();
  var match = text.match(/\d[\d.]*/);
  if (!match) return;
  var raw = match[0];
  var thousands = /\d\.\d{3}/.test(raw);
  var target = parseInt(raw.replace(/\./g, ""), 10);
  if (!isFinite(target) || target <= 0) return;
  el.dataset.counted = "1";
  var prefix = text.slice(0, match.index);
  var suffix = text.slice(match.index + raw.length);
  var fmt = function (n) { return thousands ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : String(n); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { el.textContent = prefix + fmt(target) + suffix; return; }
  var duration = 1100, startTs = null;
  var step = function (ts) {
    if (startTs === null) startTs = ts;
    var p = Math.min((ts - startTs) / duration, 1);
    var eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + fmt(Math.round(target * eased)) + suffix;
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = prefix + fmt(target) + suffix;
  };
  requestAnimationFrame(step);
}
function observeCounters(scope) {
  var nums = (scope || document).querySelectorAll(".stat .num");
  if (!("IntersectionObserver" in window)) { nums.forEach(animateCount); return; }
  if (!countObserver) {
    countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCount(en.target); countObserver.unobserve(en.target); }
      });
    }, { threshold: 0.7 });
  }
  nums.forEach(function (n) { countObserver.observe(n); });
}

/* ---------- menú móvil ---------- */
function openMenu() {
  var m = document.getElementById("mobile-menu");
  if (m) {
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    m.inert = false;
    document.body.classList.add("ui-locked");
    var trigger = document.getElementById("burger");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    document.getElementById("menu-close").focus();
  }
}
function closeMenu() {
  var m = document.getElementById("mobile-menu");
  if (m) {
    var shouldRestoreFocus = m.contains(document.activeElement);
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
    m.inert = true;
    if (!document.getElementById("cart-drawer").classList.contains("open")) document.body.classList.remove("ui-locked");
    var trigger = document.getElementById("burger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (trigger && shouldRestoreFocus) trigger.focus();
  }
}

/* ---------- trabajo agrupado de scroll ---------- */
function createScrollScheduler() {
  var subscribers = [];
  var frame = null;

  function flush() {
    frame = null;
    subscribers.slice().forEach(function (subscriber) { subscriber(); });
  }

  function request() {
    if (frame === null) frame = window.requestAnimationFrame(flush);
  }

  function subscribe(subscriber) {
    if (typeof subscriber !== "function") return function () {};
    subscribers.push(subscriber);
    return function unsubscribe() {
      var index = subscribers.indexOf(subscriber);
      if (index !== -1) subscribers.splice(index, 1);
    };
  }

  return { request: request, subscribe: subscribe };
}

var clScrollScheduler = createScrollScheduler();
window.__CL_SCROLL_SCHEDULER__ = clScrollScheduler;

/* ---------- precarga con intención ---------- */
var MAX_INTENT_PREFETCHES = 4;
var INTENT_PREFETCH_DELAY = 80;
var intentPrefetchedUrls = new Set();
var pendingIntentPrefetches = new WeakMap();

function shouldPrefetchUrl(rawUrl, link) {
  if (!rawUrl || (link && link.hasAttribute("download"))) return false;
  var connection = navigator.connection;
  if (connection && (connection.saveData || connection.effectiveType === "slow-2g" || connection.effectiveType === "2g")) return false;
  var url;
  try { url = new URL(rawUrl, window.location.href); } catch (e) { return false; }
  if (url.origin !== window.location.origin || (url.protocol !== "http:" && url.protocol !== "https:")) return false;
  if (url.username || url.password) return false;
  if (url.hash || url.pathname === window.location.pathname && !url.search) return false;
  if (/\.(?:json|xml|txt|pdf|zip)$/i.test(url.pathname)) return false;
  return true;
}

function prefetchInternalLink(link) {
  if (!link || intentPrefetchedUrls.size >= MAX_INTENT_PREFETCHES || !shouldPrefetchUrl(link.href, link)) return;
  var url = new URL(link.href, window.location.href);
  url.hash = "";
  if (intentPrefetchedUrls.has(url.href)) return;
  intentPrefetchedUrls.add(url.href);
  var hint = document.createElement("link");
  hint.rel = "prefetch";
  hint.as = "document";
  hint.href = url.href;
  document.head.appendChild(hint);
}

function cancelIntentPrefetch(link) {
  var timer = pendingIntentPrefetches.get(link);
  if (timer !== undefined) {
    clearTimeout(timer);
    pendingIntentPrefetches.delete(link);
  }
}

function queueIntentPrefetch(link) {
  if (!link || pendingIntentPrefetches.has(link) || intentPrefetchedUrls.size >= MAX_INTENT_PREFETCHES || !shouldPrefetchUrl(link.href, link)) return;
  var timer = setTimeout(function () {
    pendingIntentPrefetches.delete(link);
    prefetchInternalLink(link);
  }, INTENT_PREFETCH_DELAY);
  pendingIntentPrefetches.set(link, timer);
}

function initNavigationPrefetch() {
  document.addEventListener("pointerover", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link || (event.relatedTarget && link.contains(event.relatedTarget))) return;
    queueIntentPrefetch(link);
  }, { passive: true });
  document.addEventListener("pointerout", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link || (event.relatedTarget && link.contains(event.relatedTarget))) return;
    cancelIntentPrefetch(link);
  }, { passive: true });
  document.addEventListener("focusin", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    queueIntentPrefetch(link);
  }, { passive: true });
  document.addEventListener("focusout", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    cancelIntentPrefetch(link);
  }, { passive: true });
}

/* ---------- datos comerciales desde una sola fuente ---------- */
function initBusinessData() {
  var singleMinimum = clCurrentSingleMinimum();
  var catalogOffer = clCatalogOfferText();
  var whatsappDisplay = clWhatsAppDisplay();
  var instagramHandle = "@" + CL_INSTAGRAM;

  function activateExternalLink(link, url, label) {
    if (!url) {
      link.removeAttribute("href");
      link.removeAttribute("target");
      link.removeAttribute("rel");
      link.removeAttribute("aria-label");
      return;
    }
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (!link.textContent.trim()) link.setAttribute("aria-label", label);
  }

  document.querySelectorAll("[data-single-start]").forEach(function (el) {
    el.textContent = "Desde " + clMoney(singleMinimum);
  });
  // La franja superior mantiene el formato compacto de la marca y toma el umbral
  // desde CL_FREE_SHIPPING para que el valor nunca se desincronice del carrito.
  document.querySelectorAll("[data-free-shipping-banner]").forEach(function (el) {
    el.textContent = "Envío gratis desde " + clFreeShippingLabel().replace(",", ".");
  });
  document.querySelectorAll("[data-vat-note]").forEach(function (el) {
    el.textContent = el.closest(".topbar") ? "IVA incluido" : CL_VAT_NOTE;
  });
  document.querySelectorAll("[data-free-shipping-short]").forEach(function (el) {
    el.textContent = "Envío gratis en compras desde " + clFreeShippingLabel() + ". IVA incluido.";
  });
  document.querySelectorAll("[data-free-shipping-faq]").forEach(function (el) {
    el.textContent = "Sí, enviamos a todo el país. Envío gratis en compras desde " + clFreeShippingLabel() + ". IVA incluido.";
  });
  document.querySelectorAll("[data-vat-faq]").forEach(function (el) {
    el.textContent = "Los precios publicados incluyen IVA y son los vigentes en la tienda. Antes de confirmar tu pedido podrás revisar el total de tu compra.";
  });
  document.querySelectorAll("[data-catalog-offer]").forEach(function (el) {
    el.textContent = catalogOffer;
  });

  var whatsappContactMessage = "Hola Chic&Love, soy ... y quiero más información sobre las gummies.";
  document.querySelectorAll("[data-whatsapp-link]").forEach(function (link) {
    var url = clWhatsAppUrl(link.getAttribute("data-whatsapp-text") || whatsappContactMessage);
    activateExternalLink(link, url, "WhatsApp");
    if (link.hasAttribute("data-whatsapp-label")) link.textContent = "WhatsApp: " + whatsappDisplay;
  });
  document.querySelectorAll("[data-whatsapp-number]").forEach(function (el) {
    el.textContent = whatsappDisplay;
  });
  document.querySelectorAll("[data-instagram-link]").forEach(function (link) {
    activateExternalLink(link, clInstagramUrl(), "Instagram");
    if (link.hasAttribute("data-instagram-label")) link.textContent = "Instagram: " + instagramHandle;
  });
  document.querySelectorAll("[data-instagram-handle]").forEach(function (el) {
    el.textContent = instagramHandle;
  });
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", function () {
  initBusinessData();
  buildCartChrome();
  renderCart();
  renderPromoBand();
  renderGrids();
  initChips();
  observeReveals(document);
  observeCounters(document);
  observeLazyImages(document);

  document.querySelectorAll("[data-editorial-product]").forEach(function (link) {
    var product = clFindProduct(link.getAttribute("data-editorial-product"));
    var price = link.querySelector("[data-editorial-price]");
    if (!product || !price) return;
    var promo = clActivePromo(product);
    var currentPrice = clSinglePrice(product);
    price.textContent = "";
    if (promo) {
      price.appendChild(makeEl("del", "", clMoney(product.price)));
      price.appendChild(makeEl("span", "", clMoney(currentPrice)));
      price.appendChild(makeEl("em", "", "−" + clPromoPercent(product) + "%"));
      link.setAttribute("aria-label", "Ver " + product.name + " por " + clMoney(currentPrice) + ", precio normal " + clMoney(product.price));
    } else {
      price.textContent = clMoney(currentPrice);
      link.setAttribute("aria-label", "Ver " + product.name + " por " + clMoney(currentPrice));
    }
  });

  var header = document.querySelector(".header");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    clScrollScheduler.subscribe(onScroll);
    window.addEventListener("scroll", clScrollScheduler.request, { passive: true });
    onScroll();
  }

  var cartBtn = document.getElementById("cart-open");
  if (cartBtn) {
    cartBtn.setAttribute("aria-expanded", "false");
    cartBtn.setAttribute("aria-controls", "cart-drawer");
    cartBtn.addEventListener("click", openCart);
  }

  var burger = document.getElementById("burger");
  if (burger) {
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-controls", "mobile-menu");
    burger.addEventListener("click", openMenu);
  }
  var menuClose = document.getElementById("menu-close");
  if (menuClose) menuClose.addEventListener("click", closeMenu);
  document.querySelectorAll("#mobile-menu nav a").forEach(function (a) {
    a.addEventListener("click", closeMenu);
  });

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
  initNavigationPrefetch();
});
