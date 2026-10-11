/* Chic&Love Ecuador — capa de scrollytelling.
   Convierte el scroll en narrativa: cada sección marcada declara qué quiere hacer
   con su progreso (0 → 1) y aquí se traduce a propiedades CSS (--hp, --mp, …) que la
   hoja de estilos usa en transform/opacity. Nada se mueve por JavaScript a mano.

   Depende de products.js (catálogo) y de main.js (carrito, makeEl, programador de
   scroll), así que se carga después de ambos. Sin JavaScript, o con
   «reducir movimiento», todo el contenido queda visible y estático. */
"use strict";

(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scheduler = window.__CL_SCROLL_SCHEDULER__;
  var scrubbers = [];
  var viewportH = window.innerHeight;
  // Misma condición que la hoja de estilos usa para fijar (sticky) promociones, belleza y
  // certificaciones: leerla de una media query evita un getComputedStyle por fotograma.
  var pinQuery = window.matchMedia ? window.matchMedia("(min-width: 1025px) and (min-height: 760px)") : null;
  function pinsOnDesktop() { return !!(pinQuery && pinQuery.matches); }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  /* Las variables de scroll no saltan: cada una persigue su valor objetivo con una
     amortiguación exponencial (constante de ~90 ms). Así una rueda de ratón por pasos o
     un salto de ancla se ven como un movimiento continuo, sin secuestrar el scroll. */
  var SMOOTH_TAU = 90;
  var smoothRecords = new WeakMap();
  var smoothActive = [];
  var smoothFrame = 0;
  var smoothLast = 0;
  function writeVar(record) { record.el.style.setProperty(record.name, record.cur.toFixed(4)); }
  function smoothStep(now) {
    var dt = smoothLast ? Math.min(64, now - smoothLast) : 16;
    smoothLast = now;
    var k = 1 - Math.exp(-dt / SMOOTH_TAU);
    var still = [];
    for (var i = 0; i < smoothActive.length; i++) {
      var r = smoothActive[i];
      var diff = r.target - r.cur;
      if (Math.abs(diff) < 0.0006) { r.cur = r.target; r.active = false; }
      else { r.cur += diff * k; still.push(r); }
      writeVar(r);
    }
    smoothActive = still;
    smoothFrame = still.length ? window.requestAnimationFrame(smoothStep) : 0;
    if (!smoothFrame) smoothLast = 0;
  }
  function setVar(el, name, value) {
    var byName = smoothRecords.get(el);
    if (!byName) { byName = {}; smoothRecords.set(el, byName); }
    var r = byName[name];
    if (!r) {
      // Primera escritura: sin animación, para que la página cargue ya en su sitio.
      r = byName[name] = { el: el, name: name, cur: value, target: value, active: false };
      writeVar(r);
      return;
    }
    r.target = value;
    if (r.active || Math.abs(value - r.cur) < 0.0006) return;
    r.active = true;
    smoothActive.push(r);
    if (!smoothFrame) smoothFrame = window.requestAnimationFrame(smoothStep);
  }

  /* Progreso de un elemento alto con un hijo fijado (sticky): 0 cuando su borde
     superior llega arriba, 1 cuando el inferior sale por abajo. */
  function pinnedProgress(rect) {
    var travel = rect.height - viewportH;
    return travel > 0 ? clamp(-rect.top / travel, 0, 1) : (rect.top <= 0 ? 1 : 0);
  }

  /* Progreso de paso: 0 cuando el elemento asoma por abajo, 1 cuando sale por arriba. */
  function passProgress(rect) {
    return clamp((viewportH - rect.top) / (viewportH + rect.height), 0, 1);
  }

  function addScrubber(el, update) {
    if (!el) return;
    scrubbers.push({ el: el, update: update });
  }

  function runScrubbers() {
    for (var i = 0; i < scrubbers.length; i++) {
      var item = scrubbers[i];
      var rect = item.el.getBoundingClientRect();
      // Fuera de pantalla (con margen) no hay nada que recalcular.
      if (rect.bottom < -viewportH * 0.5 || rect.top > viewportH * 1.5) continue;
      item.update(rect);
    }
  }

  /* ---------- hero: los frascos se separan y la portada se aleja (sin reacción al cursor) ---------- */
  function initHero() {
    var hero = document.querySelector("[data-hero-scrub]");
    if (!hero) return;
    addScrubber(hero, function (rect) {
      setVar(hero, "--hp", clamp(-rect.top / rect.height, 0, 1));
    });
    // La píldora fija de «Desliza» no debe recibir clics cuando ya es invisible.
    var cue = hero.querySelector(".scroll-cue");
    if (cue) addScrubber(hero, function (rect) {
      cue.style.visibility = -rect.top / rect.height > 0.14 ? "hidden" : "";
    });
  }

  /* ---------- manifiesto: las palabras se encienden una a una ---------- */
  function splitWords(container) {
    var words = [];
    function walk(node) {
      Array.from(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var fragment = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { fragment.appendChild(document.createTextNode(part)); return; }
            var span = makeEl("span", "w", part);
            words.push(span);
            fragment.appendChild(span);
          });
          child.replaceWith(fragment);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    }
    walk(container);
    return words;
  }

  function initManifesto() {
    var section = document.querySelector("[data-manifesto]");
    if (!section) return;
    var text = section.querySelector("[data-words]");
    var words = text ? splitWords(text) : [];
    var lit = -1;
    addScrubber(section, function (rect) {
      var p = pinnedProgress(rect);
      setVar(section, "--mp", p);
      // Las palabras terminan de encenderse al 82 %: el resto del tramo es para leer.
      var target = Math.round(clamp(p / 0.82, 0, 1) * words.length) - 1;
      if (target === lit) return;
      for (var i = 0; i < words.length; i++) words[i].classList.toggle("on", i <= target);
      lit = target;
    });
  }

  /* ---------- encuentra tu fórmula: una escena fijada por producto ---------- */
  function sceneFor(product, index, total) {
    var scene = makeEl("article", "fs-scene");
    scene.setAttribute("data-product-id", product.id);
    scene.setAttribute("aria-label", (index + 1) + " de " + total + ": " + product.name);
    var url = encodeURIComponent(product.id);

    var visual = makeEl("div", "fs-visual");
    visual.appendChild(makeEl("span", "fs-num", String(index + 1).padStart(2, "0")));
    visual.appendChild(makeEl("span", "fs-orb"));
    var image = makeEl("img", "fs-bottle");
    image.src = product.splashSmall;
    image.srcset = product.splashSmall + " 640w, " + product.splash + " " + product.splashWidth + "w";
    image.sizes = "(max-width: 720px) 46vw, 420px";
    image.width = product.splashWidth;
    image.height = 1600;
    image.alt = "Frasco de " + product.name;
    image.loading = "lazy";
    image.decoding = "async";
    visual.appendChild(image);

    var copy = makeEl("div", "fs-copy");
    copy.appendChild(makeEl("span", "fs-goal", product.goalLabel));
    var title = makeEl("h3", "fs-name");
    var titleLink = makeEl("a", "", product.name);
    titleLink.href = url;
    title.appendChild(titleLink);
    copy.appendChild(title);
    copy.appendChild(makeEl("p", "fs-tagline", product.tagline));

    var guide = typeof CL_GOAL_GUIDE !== "undefined" ? CL_GOAL_GUIDE[product.goal] : null;
    if (guide) {
      var forWho = makeEl("p", "fs-for");
      forWho.appendChild(makeEl("strong", "", "Elígela si… "));
      forWho.appendChild(document.createTextNode(guide.chooseIf));
      copy.appendChild(forWho);
    }


    var buy = makeEl("div", "fs-buy");
    var price = makeEl("p", "fs-price");
    var promo = clActivePromo(product);
    price.appendChild(makeEl("strong", "", clMoney(clSinglePrice(product))));
    if (promo) {
      price.appendChild(makeEl("del", "", clMoney(product.price)));
      price.appendChild(makeEl("span", "fs-badge", "−" + clPromoPercent(product) + "% en " + promo.monthLabel));
    }
    // Una sola línea de datos: sabor, cuánto dura el frasco (de `perDay`) e IVA.
    var meta = ["Sabor " + product.flavor.toLowerCase()];
    if (typeof clBottleDuration === "function") {
      var duration = clBottleDuration(product);
      meta.push("dura " + (duration.min === duration.max ? "unos " + duration.min : duration.min + "–" + duration.max) + " días");
    }
    meta.push(CL_VAT_NOTE);
    price.appendChild(makeEl("small", "", meta.join(" · ")));
    // Fuera de promoción (o con una que mantenga los packs) se enseña el ahorro por volumen,
    // con los precios tal cual están en el catálogo: nunca un precio por unidad calculado.
    if (typeof clHasPacks === "function" && clHasPacks(product)) {
      price.appendChild(makeEl("span", "fs-packs", "Pack x2 " + clMoney(product.pricePack) + " · Pack x3 " + clMoney(product.pricePack3)));
    }
    buy.appendChild(price);
    var actions = makeEl("div", "fs-actions");
    var add = makeEl("button", "btn btn-primary fs-add", "Añadir al carrito");
    add.type = "button";
    add.setAttribute("aria-label", "Añadir " + product.name + " al carrito");
    add.addEventListener("click", function () { cartAdd(product.id, "uno", 1); });
    var more = makeEl("a", "btn btn-ghost fs-more-link", "Ver ficha");
    more.href = url;
    more.setAttribute("aria-label", "Ver la ficha de " + product.name);
    more.setAttribute("data-analytics-item", product.id);
    more.setAttribute("data-analytics-item-name", product.name);
    more.setAttribute("data-analytics-item-category", product.goalLabel);
    actions.append(add, more);
    buy.appendChild(actions);
    copy.appendChild(buy);

    scene.append(visual, copy);
    return scene;
  }

  // Dos fórmulas comparten objetivo: el carril las distingue por el público del nombre.
  function railLabel(product) {
    if (/\bWomen\b/.test(product.name)) return product.goalLabel + " · mujer";
    if (/\bMen\b/.test(product.name)) return product.goalLabel + " · hombre";
    return product.goalLabel;
  }

  function initFormulaStory() {
    var section = document.querySelector("[data-formula-story]");
    if (!section || typeof CL_PRODUCTS === "undefined") return;
    var products = CL_PRODUCTS.slice();
    var total = products.length;
    var host = section.querySelector("[data-fs-scenes]");
    var rail = section.querySelector("[data-fs-rail]");
    var counter = section.querySelector("[data-fs-index]");
    var totalLabel = section.querySelector("[data-fs-total]");
    var bar = section.querySelector("[data-fs-bar]");
    var pin = section.querySelector(".fs-pin");
    if (totalLabel) totalLabel.textContent = "/ " + String(total).padStart(2, "0");

    var scenes = products.map(function (product, index) {
      var scene = sceneFor(product, index, total);
      host.appendChild(scene);
      return scene;
    });
    var dots = products.map(function (product, index) {
      var item = makeEl("li");
      var button = makeEl("button", "fs-dot");
      button.type = "button";
      button.setAttribute("data-product-id", product.id);
      button.appendChild(makeEl("span", "fs-dot-mark"));
      button.appendChild(makeEl("span", "fs-dot-label", railLabel(product)));
      button.setAttribute("aria-label", "Ver " + product.name);
      button.addEventListener("click", function () { goTo(index); });
      item.appendChild(button);
      rail.appendChild(item);
      return button;
    });

    section.hidden = false;
    document.documentElement.classList.add("has-formula-story");
    // Los frascos de las siete escenas se decodifican en reposo, antes de que hagan falta:
    // así el cambio de escena no espera a decodificar una imagen grande en pleno scroll.
    var warm = function () {
      section.querySelectorAll(".fs-bottle").forEach(function (img) {
        img.loading = "eager";
        if (img.decode) img.decode().catch(function () {});
      });
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 2500 });
    else window.setTimeout(warm, 1200);
    section.style.setProperty("--fs-count", total);
    if (typeof observeLazyImages === "function") observeLazyImages(section);

    var current = -1;
    function activate(index) {
      if (index === current) return;
      current = index;
      var product = products[index];
      pin.style.setProperty("--fs-bg", product.soft);
      pin.style.setProperty("--fs-tint", product.accent);
      scenes.forEach(function (scene, i) {
        scene.classList.toggle("is-active", i === index);
        scene.classList.toggle("is-past", i < index);
        if (!reduceMotion) scene.inert = i !== index;
      });
      dots.forEach(function (dot, i) {
        if (i === index) dot.setAttribute("aria-current", "step");
        else dot.removeAttribute("aria-current");
      });
      if (counter) counter.textContent = String(index + 1).padStart(2, "0");
    }

    function goTo(index) {
      if (reduceMotion) {
        scenes[index].scrollIntoView({ block: "start" });
        return;
      }
      var top = section.getBoundingClientRect().top + window.scrollY;
      var travel = section.offsetHeight - viewportH;
      // Se apunta al centro del tramo de la escena para no caer en el borde.
      window.scrollTo({ top: top + travel * ((index + 0.5) / total), behavior: "smooth" });
    }

    if (reduceMotion) {
      section.classList.add("is-static");
      scenes.forEach(function (scene) { scene.classList.add("is-active"); });
      return;
    }

    // Cada escena tiene dirección propia (#elige-<fórmula>) para compartirla; se
    // actualiza con replaceState, así no llena el historial mientras se hace scroll.
    var pinned = false;
    function sceneHash(index) { return "#elige-" + products[index].id; }
    function syncHash(index) {
      if (!window.history || !window.history.replaceState) return;
      var wanted = pinned ? sceneHash(index) : "";
      var currentHash = window.location.hash;
      // Fuera del tramo fijado solo se limpia un ancla de escena, nunca otra.
      if (!pinned && currentHash.indexOf("#elige-") !== 0) return;
      if (currentHash === wanted) return;
      try { window.history.replaceState(null, "", wanted || window.location.pathname + window.location.search); } catch (e) { /* file:// */ }
    }

    // Con las escenas fijadas, las flechas pasan de fórmula sin tener que hacer scroll.
    document.addEventListener("keydown", function (event) {
      if (!pinned || event.altKey || event.ctrlKey || event.metaKey) return;
      var target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.body.classList.contains("ui-locked")) return;
      var step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 :
        event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      var next = current + step;
      if (next < 0 || next >= total) return;
      event.preventDefault();
      goTo(next);
    });

    activate(0);
    var initial = products.findIndex(function (product) { return window.location.hash === "#elige-" + product.id; });
    if (initial !== -1) {
      // Se espera a que la página termine de colocarse antes de saltar a la escena.
      window.addEventListener("load", function () {
        var top = section.getBoundingClientRect().top + window.scrollY;
        var travel = section.offsetHeight - viewportH;
        window.scrollTo(0, top + travel * ((initial + 0.5) / total));
      }, { once: true });
    }
    addScrubber(section, function (rect) {
      var p = pinnedProgress(rect);
      var exact = p * total;
      var index = clamp(Math.floor(exact), 0, total - 1);
      pinned = rect.top <= 1 && rect.bottom >= viewportH - 1;
      activate(index);
      syncHash(index);
      var active = scenes[index];
      setVar(active, "--lp", clamp(exact - index, 0, 1));
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    });
  }

  /* ---------- ficha: dentro de cada gummy, un activo por escena ---------- */
  function currentProduct() {
    var id = (document.body && document.body.getAttribute("data-product-id")) ||
      new URLSearchParams(window.location.search).get("id") || "";
    return clFindProduct(id) || CL_PRODUCTS[0];
  }

  function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

  function activePanel(name, index, total) {
    var info = clActiveInfo(name);
    var panel = makeEl("article", "as-panel");
    panel.setAttribute("aria-label", (index + 1) + " de " + total + ": " + name);
    panel.appendChild(makeEl("span", "as-kind", capitalize(info.kind)));
    panel.appendChild(makeEl("h3", "as-name", name));
    if (info.aka && info.aka.length) panel.appendChild(makeEl("p", "as-aka", "También: " + info.aka.join(" · ")));
    panel.appendChild(makeEl("p", "as-what", info.what + " " + info.role));
    if (info.wikipedia) {
      var source = makeEl("a", "as-source", "Saber más en Wikipedia");
      source.href = info.wikipedia;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.setAttribute("aria-label", "Saber más sobre " + name + " en Wikipedia (se abre en otra pestaña)");
      panel.appendChild(source);
    }
    return panel;
  }

  function initActivesStory() {
    var section = document.querySelector("[data-actives-story]");
    if (!section || typeof CL_PRODUCTS === "undefined" || typeof clActiveInfo !== "function") return;
    var product = currentProduct();
    var names = product.actives || [];
    var total = names.length;
    if (total < 2) return;
    var orbit = section.querySelector("[data-as-orbit]");
    var host = section.querySelector("[data-as-panels]");
    var counter = section.querySelector("[data-as-index]");
    var totalLabel = section.querySelector("[data-as-total]");
    var bottle = section.querySelector("[data-as-bottle]");

    section.setAttribute("data-product-id", product.id);
    section.style.setProperty("--as-count", total);
    orbit.style.setProperty("--n", total);
    if (totalLabel) totalLabel.textContent = "/ " + String(total).padStart(2, "0");
    if (bottle) {
      bottle.src = product.splashSmall;
      bottle.srcset = product.splashSmall + " 640w, " + product.splash + " " + product.splashWidth + "w";
      bottle.sizes = "(max-width: 900px) 40vw, 360px";
      bottle.width = product.splashWidth;
    }

    var labels = names.map(function (name, index) {
      var item = makeEl("li", "", name);
      item.style.setProperty("--i", index);
      orbit.appendChild(item);
      return item;
    });
    var panels = names.map(function (name, index) {
      var panel = activePanel(name, index, total);
      host.appendChild(panel);
      return panel;
    });
    section.hidden = false;

    if (reduceMotion) {
      section.classList.add("is-static");
      panels.forEach(function (panel) { panel.classList.add("is-active"); });
      return;
    }

    var current = -1;
    function activate(index) {
      if (index === current) return;
      current = index;
      // El activo en escena sube a lo alto de la órbita (−90°).
      orbit.style.setProperty("--as-rot", (-90 - index * 360 / total).toFixed(2) + "deg");
      labels.forEach(function (label, i) { label.classList.toggle("is-active", i === index); });
      panels.forEach(function (panel, i) {
        panel.classList.toggle("is-active", i === index);
        panel.classList.toggle("is-past", i < index);
        panel.inert = i !== index;
      });
      if (counter) counter.textContent = String(index + 1).padStart(2, "0");
    }
    activate(0);
    addScrubber(section, function (rect) {
      var p = pinnedProgress(rect);
      activate(clamp(Math.floor(p * total), 0, total - 1));
      setVar(section, "--ap", p);
    });
  }

  /* ---------- tienda: los filtros acompañan el scroll ---------- */
  function initStickyFilters() {
    var chips = document.querySelector(".page-store [data-chips]");
    var grid = document.querySelector("[data-products-grid][data-filter]");
    if (!chips || !grid) return;
    chips.addEventListener("click", function (event) {
      if (!event.target.closest || !event.target.closest(".chip")) return;
      // Si la barra ya va fijada, al filtrar se vuelve al inicio de la rejilla
      // para no dejar a la persona en medio de una lista que acaba de cambiar.
      window.requestAnimationFrame(function () {
        var siteTop = document.querySelector(".site-top");
        var offset = (siteTop ? siteTop.offsetHeight : 0) + chips.offsetHeight + 24;
        var target = grid.getBoundingClientRect().top + window.scrollY - offset;
        if (window.scrollY > target + 4) window.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  function measureSiteTop() {
    var siteTop = document.querySelector(".site-top");
    if (siteTop) document.documentElement.style.setProperty("--site-top-h", siteTop.offsetHeight + "px");
  }

  /* ---------- estante móvil: cuánto queda por deslizar ---------- */
  function initShelfProgress() {
    var shelf = document.querySelector("#productos [data-products-grid]");
    if (!shelf) return;
    var track = makeEl("div", "shelf-progress");
    track.setAttribute("aria-hidden", "true");
    var fill = makeEl("span");
    track.appendChild(fill);
    shelf.insertAdjacentElement("afterend", track);
    var pending = false;
    function update() {
      pending = false;
      var max = shelf.scrollWidth - shelf.clientWidth;
      var visible = max > 0 ? shelf.clientWidth / shelf.scrollWidth : 1;
      var p = max > 0 ? clamp(shelf.scrollLeft / max, 0, 1) : 0;
      track.classList.toggle("is-idle", max <= 0);
      fill.style.width = (visible * 100).toFixed(2) + "%";
      fill.style.transform = "translateX(" + (p * (1 / visible - 1) * 100).toFixed(2) + "%)";
    }
    shelf.addEventListener("scroll", function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ---------- tarjetas de producto: inclinación 3D y reflejo que siguen al cursor ---------- */
  // Delegado en el documento: las rejillas se repintan al filtrar y las tarjetas nuevas
  // heredan el efecto sin volver a enlazar nada.
  function initCardTilt() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var active = null;
    function reset(card) {
      card.classList.remove("is-tilting");
      ["--rx", "--ry", "--gx", "--gy", "--px", "--py"].forEach(function (name) { card.style.removeProperty(name); });
    }
    document.addEventListener("pointermove", function (event) {
      var card = event.target.closest ? event.target.closest(".pcard") : null;
      if (active && active !== card) { reset(active); active = null; }
      if (!card) return;
      var box = card.getBoundingClientRect();
      var x = clamp((event.clientX - box.left) / box.width, 0, 1);
      var y = clamp((event.clientY - box.top) / box.height, 0, 1);
      card.classList.add("is-tilting");
      card.style.setProperty("--ry", ((x - 0.5) * 9).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg");
      card.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
      card.style.setProperty("--px", ((x - 0.5) * 12).toFixed(1) + "px");
      card.style.setProperty("--py", ((y - 0.5) * 10).toFixed(1) + "px");
      active = card;
    }, { passive: true });
    function release() { if (active) { reset(active); active = null; } }
    // Con la rueda la tarjeta se mueve bajo un cursor quieto (no hay pointermove), y al
    // salir de la ventana no siempre llega un evento al documento: en ambos casos se suelta.
    window.addEventListener("scroll", release, { passive: true });
    document.documentElement.addEventListener("mouseleave", release);
    window.addEventListener("blur", release);
  }

  /* ---------- cinta de mensajes: responde a la velocidad del scroll ---------- */
  // Acelera al bajar rápido, gira al revés al subir y vuelve sola a su ritmo de crucero.
  function initMarqueeVelocity() {
    var track = document.querySelector(".marquee-track");
    if (!track || typeof track.getAnimations !== "function") return null;
    var lastY = window.scrollY;
    var rate = 1;
    var settling = false;
    function animation() { return track.getAnimations()[0]; }
    function settle() {
      var anim = animation();
      if (!anim) { settling = false; return; }
      rate += (1 - rate) * 0.08;
      if (Math.abs(rate - 1) < 0.02) rate = 1;
      anim.playbackRate = rate;
      if (rate !== 1) window.requestAnimationFrame(settle);
      else settling = false;
    }
    return function () {
      var y = window.scrollY;
      var delta = y - lastY;
      lastY = y;
      var anim = animation();
      if (!anim || !delta) return;
      var target = clamp(delta / 6, -6, 6);
      rate = Math.abs(target) > Math.abs(rate) || Math.sign(target) !== Math.sign(rate) ? target : rate;
      if (Math.abs(rate) < 1) rate = rate < 0 ? -1 : 1;
      anim.playbackRate = rate;
      if (!settling) { settling = true; window.requestAnimationFrame(settle); }
    };
  }

  /* ---------- titulares: cada palabra sube desde su propia máscara ---------- */
  // El texto sigue siendo el mismo (solo se envuelve), así que lectores de pantalla y
  // buscadores lo leen igual. Se dispara una vez, al entrar el titular en pantalla.
  function initHeadlineReveal() {
    var heads = Array.from(document.querySelectorAll(
      "main .section-head h2, main .section-head h1, main .split h2, main .faq-aside h2, " +
      "main .cta-copy h2, main .cta-banner > h2, main .about-hero h1"
    ));
    heads.forEach(function (head) {
      var index = 0;
      (function wrap(node) {
        Array.from(node.childNodes).forEach(function (child) {
          if (child.nodeType === 1) { wrap(child); return; }
          if (child.nodeType !== 3) return;
          var fragment = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { fragment.appendChild(document.createTextNode(part)); return; }
            var mask = makeEl("span", "wm");
            var word = makeEl("span", "", part);
            word.style.setProperty("--i", index++);
            mask.appendChild(word);
            fragment.appendChild(mask);
          });
          child.replaceWith(fragment);
        });
      })(head);
      head.classList.add("has-wm");
    });
    // Se comprueba en cada fotograma de scroll (no con IntersectionObserver): así un
    // scroll rápido o un salto por ancla nunca deja un titular sin revelar por encima.
    var pending = heads.slice();
    return function () {
      if (!pending.length) return;
      pending = pending.filter(function (head) {
        if (head.getBoundingClientRect().top < viewportH * 0.88) {
          head.classList.add("is-in");
          return false;
        }
        return true;
      });
    };
  }

  /* ---------- FAQ: seis preguntas a la vista, el resto bajo demanda ---------- */
  // Sin JavaScript se ven todas; aquí solo se pliegan, siguen en el HTML para el FAQPage.
  function initFaqMore() {
    var faq = document.querySelector(".faq-layout .faq");
    if (!faq) return;
    var items = Array.from(faq.querySelectorAll("details"));
    var visible = 6;
    if (items.length <= visible) return;
    items.slice(visible).forEach(function (item) { item.classList.add("is-extra"); });
    var more = makeEl("button", "faq-more", "Ver las " + items.length + " preguntas");
    more.type = "button";
    more.setAttribute("aria-expanded", "false");
    more.addEventListener("click", function () {
      var open = faq.classList.toggle("is-open");
      more.setAttribute("aria-expanded", open ? "true" : "false");
      more.textContent = open ? "Ver menos" : "Ver las " + items.length + " preguntas";
      if (open) items[visible].querySelector("summary").focus();
    });
    faq.appendChild(more);
  }

  /* ---------- parallax de fotografías ---------- */
  function initParallax() {
    document.querySelectorAll(".promo-band-media").forEach(function (media) {
      media.setAttribute("data-parallax", "");
    });
    document.querySelectorAll("[data-parallax]").forEach(function (frame) {
      addScrubber(frame, function (rect) {
        setVar(frame, "--pp", passProgress(rect) * 2 - 1);
      });
    });
  }

  /* ---------- belleza: la foto llega desde el centro, el texto entra y los cuatro puntos
     se encienden uno a uno sobre un hilo que se va llenando ---------- */
  function initBenefits() {
    document.querySelectorAll("[data-benefits]").forEach(initBenefitsSection);
  }
  function initBenefitsSection(section) {
    var items = Array.from(section.querySelectorAll(".feature-list li"));
    var list = section.querySelector(".feature-list");
    var split = section.querySelector(".split");
    if (!items.length || !split || !list) return;
    section.classList.add("is-story");
    var lit = -2;
    addScrubber(section, function (rect) {
      var pinned = pinsOnDesktop();
      var steps;
      if (pinned) {
        var p = pinnedProgress(rect);
        // 0–0,22: la foto se coloca; 0,22–0,92: los puntos; al final, el producto.
        setVar(section, "--bp", p);
        setVar(section, "--bi", ease(clamp(p / 0.22, 0, 1)));
        steps = clamp((p - 0.2) / 0.68, 0, 1) * items.length;
      } else {
        var box = list.getBoundingClientRect();
        steps = clamp((viewportH * 0.72 - box.top) / Math.max(box.height, 1), 0, 1) * items.length;
        setVar(section, "--bi", 1);
      }
      setVar(section, "--bl", steps / items.length);
      var index = Math.min(items.length - 1, Math.floor(steps + 0.15)) - (steps < 0.05 ? 1 : 0);
      if (index === lit) return;
      lit = index;
      items.forEach(function (item, i) { item.classList.toggle("is-lit", i <= index); });
      section.classList.toggle("is-complete", index === items.length - 1);
    });
  }

  /* ---------- nosotros: las tres fotos llegan juntas, como un abanico cerrado, y se abren
     a su sitio mientras la galería entra en pantalla ---------- */
  function initGallery() {
    var gallery = document.querySelector("[data-gallery]");
    if (!gallery) return;
    gallery.classList.add("is-story");
    addScrubber(gallery, function (rect) {
      setVar(gallery, "--gp", ease(clamp((viewportH * 1.02 - rect.top) / (viewportH * 0.78), 0, 1)));
    });
  }

  /* ---------- escenas a dos columnas (Nosotros): la imagen llega desde su lado, el texto
     desde el contrario y sus bloques suben escalonados, todo ligado al scroll. Mismo
     lenguaje que «Belleza» en la portada, sin fijar la sección. ---------- */
  function initSplitStory() {
    document.querySelectorAll("[data-split-story]").forEach(function (section) {
      var split = section.querySelector(".split");
      if (!split) return;
      section.classList.add("is-story");
      addScrubber(section, function (rect) {
        var box = split.getBoundingClientRect();
        // 0 cuando la escena asoma por abajo, 1 cuando su centro llega a ~60 % de la pantalla.
        setVar(section, "--si", ease(clamp((viewportH * 1.02 - box.top) / (viewportH * 0.72), 0, 1)));
      });
    });
  }

  /* ---------- promociones del mes: las bandas se levantan desde un plano inclinado, la
     foto se abre y se tacha el precio anterior (la cifra del descuento es siempre la real).
     main.js las pinta en el mismo DOMContentLoaded; si aún no están, se espera a que lleguen. ---------- */
  function initPromoStory() {
    var section = document.querySelector(".page-home .promo-band-section");
    if (!section) return;
    function setup() {
      var bands = Array.from(section.querySelectorAll(".promo-band"));
      if (!bands.length) return false;
      section.classList.add("is-story");
      setVar(section, "--pn", bands.length);
      var wrap = section.querySelector(".wrap");
      addScrubber(section, function (rect) {
        var pinned = !!wrap && pinsOnDesktop();
        // El encabezado abre la escena; las bandas llegan justo detrás.
        var entry = clamp((viewportH - rect.top) / viewportH, 0, 1);
        setVar(section, "--ph", ease(clamp(entry * 1.3 - 0.05, 0, 1)));
        bands.forEach(function (band, i) {
          var pe;
          if (pinned) {
            var p = pinnedProgress(rect);
            // Entrada antes de fijarse + recorrido fijado, con un pequeño escalonado.
            var before = clamp((viewportH - rect.top) / viewportH, 0, 1);
            pe = clamp(before * 0.85 + p * 1.1 - 0.1 - i * 0.12, 0, 1);
          } else {
            var r = band.getBoundingClientRect();
            pe = clamp((viewportH * 0.98 - r.top) / (viewportH * 0.62), 0, 1);
          }
          setVar(band, "--pe", ease(pe));
        });
      });
      return true;
    }
    if (setup()) return;
    var observer = new MutationObserver(function () {
      if (setup()) { observer.disconnect(); window.dispatchEvent(new Event("scroll")); }
    });
    observer.observe(section, { childList: true, subtree: true });
  }

  /* ---------- certificaciones: la sección se fija y cada sello se estampa en su sitio ---------- */
  function initCertsStory() {
    var section = document.querySelector("#certificaciones");
    if (!section) return;
    var items = Array.from(section.querySelectorAll(".cert-item"));
    var wrap = section.querySelector(".wrap");
    if (!items.length || !wrap) return;
    section.classList.add("is-story");
    addScrubber(section, function (rect) {
      var pinned = pinsOnDesktop();
      var p = pinned ? pinnedProgress(rect) : 0;
      setVar(section, "--cp", p);
      items.forEach(function (item, i) {
        var s;
        if (pinned) {
          // El primer sello cae al fijarse; el último, poco antes de soltar la sección.
          var start = 0.04 + i * 0.12;
          s = clamp((p - start) / 0.16, 0, 1);
        } else {
          var r = item.getBoundingClientRect();
          s = clamp((viewportH * 0.95 - r.top) / (viewportH * 0.4), 0, 1);
        }
        setVar(item, "--s", s);
      });
    });
  }

  /* ---------- tu momento: cada tarjeta se retira cuando la siguiente la cubre ---------- */
  function initStack() {
    var cards = Array.from(document.querySelectorAll("[data-stack-card]"));
    cards.forEach(function (card, index) {
      var next = cards[index + 1];
      if (!next) return;
      addScrubber(card, function (rect) {
        var nextRect = next.getBoundingClientRect();
        var covered = clamp(1 - (nextRect.top - rect.top) / Math.max(rect.height, 1), 0, 1);
        setVar(card, "--sp", covered);
      });
    });
  }

  /* ---------- cine: la foto de comunidad se abre a pantalla completa ---------- */
  function initCinema() {
    var section = document.querySelector("[data-cinema]");
    if (!section) return;
    addScrubber(section, function (rect) {
      var p = pinnedProgress(rect);
      // Durante la entrada (antes de fijarse) la foto ya empieza a crecer.
      var entering = clamp((viewportH - rect.top) / viewportH, 0, 1);
      setVar(section, "--cin", ease(clamp(entering * 0.45 + p * 1.1, 0, 1)));
      setVar(section, "--ctext", ease(clamp((p - 0.3) / 0.35, 0, 1)));
    });
  }

  /* ---------- barra de compra móvil (portada) ---------- */
  function initDock() {
    if (!document.body.classList.contains("page-home")) return;
    var hero = document.querySelector(".hero");
    var story = document.querySelector("[data-formula-story]");
    var footer = document.querySelector(".footer");
    var finalCta = document.querySelector(".cta-editorial");
    var cinema = document.querySelector("[data-cinema] .cinema-copy");
    var dock = makeEl("div", "home-dock");
    var label = makeEl("span", "home-dock-copy");
    label.appendChild(makeEl("small", "", "60 gummies · " + CL_VAT_NOTE));
    label.appendChild(makeEl("strong", "", "Desde " + clMoney(clCurrentSingleMinimum())));
    var cta = makeEl("a", "btn btn-primary", "Elegir mi fórmula");
    cta.href = "tienda";
    dock.append(label, cta);
    document.body.appendChild(dock);

    function inView(el) {
      if (!el) return false;
      var r = el.getBoundingClientRect();
      return r.top < viewportH && r.bottom > 0;
    }
    return function () {
      var pastHero = hero ? hero.getBoundingClientRect().bottom < 0 : window.scrollY > viewportH;
      var hide = (story && !story.hidden && inView(story)) || inView(cinema) || inView(footer) || inView(finalCta);
      dock.classList.toggle("show", pastHero && !hide);
    };
  }

  /* ---------- arranque ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    document.documentElement.classList.add("story-ready");
    var tick = [];
    measureSiteTop();
    initFormulaStory();
    initActivesStory();
    initStickyFilters();
    initShelfProgress();
    initFaqMore();
    var dock = initDock();
    if (dock) tick.push(dock);

    if (!reduceMotion) {
      var marquee = initMarqueeVelocity();
      if (marquee) tick.push(marquee);
      initCardTilt();
      tick.push(initHeadlineReveal());
      initHero();
      initManifesto();
      initParallax();
      initStack();
      initBenefits();
      initGallery();
      initSplitStory();
      initPromoStory();
      initCertsStory();
      initCinema();
    } else {
      document.querySelectorAll("[data-words]").forEach(function (text) { text.classList.add("is-lit"); });
    }

    function frame() {
      runScrubbers();
      tick.forEach(function (fn) { fn(); });
    }
    if (scheduler) {
      scheduler.subscribe(frame);
      window.addEventListener("scroll", scheduler.request, { passive: true });
    } else {
      window.addEventListener("scroll", function () { window.requestAnimationFrame(frame); }, { passive: true });
    }
    window.addEventListener("resize", function () {
      viewportH = window.innerHeight;
      measureSiteTop();
      frame();
    }, { passive: true });
    frame();
  });
})();
