/* Chic&Love — página de producto: renderiza el detalle desde el catálogo.
   El id llega por ?id= y se valida contra CL_PRODUCTS (whitelist);
   nunca se inyecta contenido de la URL en el DOM. */
"use strict";

(function initProductPage() {
  var params = new URLSearchParams(window.location.search);
  // La página dedicada (/<id>) lleva el id en el body; la antigua /producto usa ?id=
  var pageId = (document.body && document.body.getAttribute("data-product-id")) || params.get("id") || "";
  var product = clFindProduct(pageId);

  // id inválido o ausente → primer producto del catálogo como fallback amable
  if (!product) {
    product = CL_PRODUCTS[0];
    try {
      window.history.replaceState(null, "", product.id);
    } catch (e) { /* file:// puede restringir replaceState */ }
  }

  var state = { variant: "uno", qty: 1 };

  // Tema de acento por producto
  document.documentElement.style.setProperty("--a", product.accent);
  document.documentElement.style.setProperty("--a-dark", product.accentDark);
  document.documentElement.style.setProperty("--a-soft", product.soft);

  document.title = product.name + " — Chic&Love Ecuador";
  var pdDescription = document.getElementById("pd-description");
  if (pdDescription) pdDescription.content = product.desc + " Sabor " + product.flavor.toLowerCase() + ", 60 gummies. Envíos a todo Ecuador.";
  var canonicalUrl = "https://chiclove-ec.com/" + product.id;
  document.getElementById("pd-canonical").href = canonicalUrl;
  document.getElementById("pd-og-title").content = product.name + " — Chic&Love Ecuador";
  document.getElementById("pd-og-description").content = product.tagline + " " + product.desc;
  document.getElementById("pd-og-url").content = canonicalUrl;
  document.getElementById("pd-og-image").content = "https://chiclove-ec.com/" + product.hero;
  var pdOgImageAlt = document.getElementById("pd-og-image-alt");
  if (pdOgImageAlt) pdOgImageAlt.content = "Frasco de " + product.name;
  var pdTwImage = document.getElementById("pd-tw-image");
  if (pdTwImage) pdTwImage.content = "https://chiclove-ec.com/" + product.hero;

  // Textos (todo con textContent: cero riesgo de inyección)
  document.getElementById("pd-crumb").textContent = product.name;
  document.getElementById("pd-goal").textContent = product.goalLabel;
  document.getElementById("pd-name").textContent = product.name;
  document.getElementById("pd-tagline").textContent = product.tagline;
  document.getElementById("pd-desc").textContent = product.desc;
  document.getElementById("pd-flavor").textContent = "Sabor " + product.flavor.toLowerCase();
  document.getElementById("pd-dose").textContent = product.dose;
  var pdDuration = document.getElementById("pd-duration");
  if (pdDuration) {
    var duration = clBottleDuration(product);
    pdDuration.textContent = "Un frasco dura " + (duration.min === duration.max
      ? "unos " + duration.min
      : "entre " + duration.min + " y " + duration.max) + " días";
  }

  var img = document.getElementById("pd-img");
  img.src = product.hero;
  img.srcset = product.heroSmall + " 640w, " + product.hero + " 1080w";
  img.sizes = "(max-width: 720px) 70vw, (max-width: 1024px) 440px, 500px";
  img.alt = "Frasco de " + product.name;
  document.getElementById("pd-sticky-img").src = product.bottle;
  document.getElementById("pd-sticky-img").alt = product.name;
  document.getElementById("pd-sticky-name").textContent = product.short;

  var badges = document.getElementById("pd-badges");
  badges.textContent = "";
  product.badges.forEach(function (b) {
    var s = document.createElement("span");
    s.textContent = b;
    badges.appendChild(s);
  });

  // Las listas llegan ya rellenas desde el HTML generado: hay que vaciarlas antes de
  // volver a pintarlas o cada entrada saldría duplicada.
  var benefits = document.getElementById("pd-benefits");
  benefits.textContent = "";
  product.benefits.forEach(function (b) {
    var li = document.createElement("li");
    li.textContent = b;
    benefits.appendChild(li);
  });

  var actives = document.getElementById("pd-actives");
  actives.textContent = "";
  product.actives.forEach(function (a) {
    var s = document.createElement("span");
    s.textContent = a;
    actives.appendChild(s);
  });

  // Variantes
  var singlePrice = clSinglePrice(product);
  var promo = clActivePromo(product);
  var saveSingle = product.price - singlePrice;
  var originalPack2 = product.price * 2;
  var originalPack3 = product.price * 3;
  var savePack2 = originalPack2 - product.pricePack;
  var savePack3 = originalPack3 - product.pricePack3;
  var variants = [
    { key: "uno", name: "1 frasco", sub: promo ? "Antes " + clMoney(product.price) + ", ahorras " + clMoney(saveSingle) : "60 gummies para 1 mes", price: singlePrice, badge: promo ? "−" + clPromoPercent(product) + "%" : "" }
  ];
  // Durante una promo de solo frasco los packs no se ofrecen: costarían más que
  // comprar la misma cantidad de frascos sueltos al precio promocional.
  if (clHasPacks(product)) {
    variants.push(
      { key: "pack", name: "Pack x2 frascos", sub: "Antes " + clMoney(originalPack2), price: product.pricePack, badge: "Ahorra " + clMoney(savePack2) },
      { key: "pack3", name: "Pack x3 frascos", sub: "Antes " + clMoney(originalPack3), price: product.pricePack3, badge: "Ahorra " + clMoney(savePack3) }
    );
  }
  var vBox = document.getElementById("pd-variants");

  var promoNote = document.getElementById("pd-promo");
  if (promoNote) {
    promoNote.hidden = !promo;
    promoNote.textContent = promo ? "Promo hasta el " + promo.endsLabel : "";
  }
  // En los dos sentidos: el HTML puede venir de antes de que una promo abriera o cerrara.
  var buyLabel = document.querySelector(".pd-buy-label");
  if (buyLabel) buyLabel.textContent = variants.length === 1 ? "Tu presentación" : "Elige tu presentación";

  function chooseVariant(index, restoreFocus) {
    state.variant = variants[index].key;
    renderVariants();
    updateBuy();
    if (restoreFocus) vBox.querySelectorAll(".variant-opt")[index].focus();
  }

  function renderVariants() {
    vBox.textContent = "";
    variants.forEach(function (v, index) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "variant-opt" + (v.key !== "uno" ? " featured" : "") + (state.variant === v.key ? " on" : "");
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", state.variant === v.key ? "true" : "false");
      b.tabIndex = state.variant === v.key ? 0 : -1;

      var left = document.createElement("span");
      var nm = document.createElement("span");
      nm.className = "v-name";
      nm.textContent = v.name;
      if (v.badge) {
        var sv = document.createElement("span");
        sv.className = "save";
        sv.textContent = v.badge;
        nm.appendChild(sv);
      }
      var sub = document.createElement("span");
      sub.className = "v-sub";
      sub.textContent = v.sub;
      left.append(nm, document.createElement("br"), sub);

      var priceBox = document.createElement("span");
      priceBox.className = "v-price-box";
      var pr = document.createElement("span");
      pr.className = "v-price";
      pr.textContent = clMoney(v.price);
      var vat = document.createElement("span");
      vat.className = "v-vat";
      vat.textContent = CL_VAT_NOTE;
      priceBox.append(pr, vat);

      b.append(left, priceBox);
      b.addEventListener("click", function () {
        chooseVariant(index, true);
      });
      b.addEventListener("keydown", function (event) {
        var next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % variants.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + variants.length) % variants.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = variants.length - 1;
        else return;
        event.preventDefault();
        chooseVariant(next, true);
      });
      vBox.appendChild(b);
    });
  }

  function currentPrice() {
    if (state.variant === "pack3") return product.pricePack3;
    return state.variant === "pack" ? product.pricePack : clSinglePrice(product);
  }

  function currentTotal() {
    if (state.variant === "uno") return clBestSingleBundle(product, state.qty).total;
    return currentPrice() * state.qty;
  }

  function updateBuy() {
    var chosen = state.variant === "pack3" ? "Pack x3" : (state.variant === "pack" ? "Pack x2" : "1 frasco");
    if (state.variant === "uno" && state.qty > 1 && !clHasPacks(product)) chosen = state.qty + " frascos";
    else if (state.variant === "uno" && state.qty === 2) chosen = "2 frascos, pack x2 aplicado";
    else if (state.variant === "uno" && state.qty === 3) chosen = "3 frascos, pack x3 aplicado";
    else if (state.variant === "uno" && state.qty > 3) chosen = state.qty + " frascos, descuento por packs aplicado";
    document.getElementById("pd-qty").textContent = String(state.qty);
    document.getElementById("pd-add-price").textContent = clMoney(currentTotal());
    document.getElementById("pd-sticky-price").textContent = clMoney(currentTotal());
    document.getElementById("pd-sticky-variant").textContent = state.variant === "uno" ? chosen : chosen + (state.qty > 1 ? " por " + state.qty : "");
  }

  document.getElementById("pd-qminus").addEventListener("click", function () {
    state.qty = Math.max(1, state.qty - 1);
    updateBuy();
  });
  document.getElementById("pd-qplus").addEventListener("click", function () {
    state.qty = Math.min(99, state.qty + 1);
    updateBuy();
  });
  document.getElementById("pd-add").addEventListener("click", function () {
    cartAdd(product.id, state.variant, state.qty);
  });
  document.getElementById("pd-sticky-add").addEventListener("click", function () {
    cartAdd(product.id, state.variant, state.qty);
  });

  renderVariants();
  updateBuy();
  if (window.clAnalytics) {
    window.clAnalytics.track("view_item", {
      item_id: product.id,
      item_name: product.name,
      price: clSinglePrice(product),
      currency: "USD",
      items: [{
        item_id: product.id,
        item_name: product.name,
        item_category: product.goalLabel,
        price: clSinglePrice(product),
        quantity: 1
      }]
    });
  }

  var sticky = document.getElementById("pd-sticky");
  var buyBox = document.querySelector(".pd-buy");
  if (sticky && buyBox) {
    var relatedSection = document.querySelector(".related");
    function updateSticky() {
      var buyBoxPassed = buyBox.getBoundingClientRect().bottom < 0;
      var purchaseContextEnded = relatedSection && relatedSection.getBoundingClientRect().top <= window.innerHeight * 0.22;
      var shouldShow = buyBoxPassed && !purchaseContextEnded;
      sticky.classList.toggle("show", shouldShow);
      sticky.setAttribute("aria-hidden", shouldShow ? "false" : "true");
      sticky.inert = !shouldShow;
    }
    var scheduler = window.__CL_SCROLL_SCHEDULER__;
    var queueStickyUpdate = scheduler
      ? function () { scheduler.request(); }
      : function () { window.requestAnimationFrame(updateSticky); };
    if (scheduler) scheduler.subscribe(updateSticky);
    window.addEventListener("scroll", queueStickyUpdate, { passive: true });
    window.addEventListener("resize", queueStickyUpdate);
    updateSticky();
  }

  // Relacionados: excluir el producto actual y re-renderizar
  var related = document.getElementById("related-grid");
  if (related) {
    related.setAttribute("data-exclude", product.id);
    renderGrids();
  }
}());
