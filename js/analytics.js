/* Chic&Love — analítica opcional y respetuosa con el consentimiento.
   Completa los identificadores cuando estén creadas las propiedades:
   - GA4: formato G-XXXXXXXXXX
   - Microsoft Clarity: identificador del proyecto
   Solo se envían interacciones consentidas y datos del catálogo público. */
"use strict";

(function initAnalytics() {
  var config = {
    ga4MeasurementId: "G-9QHN0YJKJW",
    clarityProjectId: ""
  };
  var CONSENT_KEY = "cl_analytics_consent_v1";
  var state = {
    consent: readConsent(),
    toolsStarted: false,
    gaReady: false,
    pending: [],
    pageViewSent: false,
    productViewSent: false,
    observed: new WeakMap(),
    impressions: new Set(),
    scrollMarks: new Set(),
    activeSeconds: 0,
    timeMarks: new Set(),
    lastActivity: Date.now()
  };
  var EVENT_NAMES = new Set(("page_view whatsapp_click instagram_click select_item filter_select open_menu faq_open " +
    "view_item view_item_list view_cart add_to_cart remove_from_cart begin_checkout generate_lead checkout_error " +
    "navigation_click button_click section_view scroll_depth engagement_milestone variant_select quantity_change " +
    "performance_timing technical_error").split(" "));
  var PARAMS = new Set(("page_title page_path page_location page_referrer page_type item_id item_name item_variant " +
    "currency value quantity price items_count method link_type link_context link_path link_domain element_id filter_id " +
    "item_list_id item_list_name section_id faq_id percent_scrolled active_seconds metric_name metric_value " +
    "error_type interaction_type previous_quantity items").split(" "));

  function safeToken(value) {
    return /^[a-z0-9][a-z0-9_. -]{0,99}$/i.test(value || "") ? value : "";
  }

  function safePath(path) {
    path = (path || "/").replace(/\.html$/, "").replace(/\/$/, "") || "/";
    if (path === "/index") return "/";
    return /^\/(?:tienda|about|contact|privacy|terms|nosotros|producto|hair-nails-forte|radiant-skin|vinagre-de-manzana|sleep-vitamins|sexual-booster-women|sexual-booster-men|anti-stress)?$/.test(path) ? path : "/404";
  }

  function pageContext() {
    var path = safePath(window.location.pathname);
    return { page_path: path, page_type: path === "/" ? "home" : path === "/tienda" ? "catalog" :
      /hair-nails|radiant-skin|vinagre|sleep-vitamins|sexual-booster|anti-stress|producto/.test(path) ? "product" : path === "/404" ? "not_found" : "information" };
  }

  function cleanReferrer() {
    try {
      var url = new URL(document.referrer);
      return /^https?:$/.test(url.protocol) ? url.origin + (url.origin === window.location.origin ? safePath(url.pathname) : "/") : "";
    } catch (e) { return ""; }
  }

  function googleDefaults() {
    var params = { page_location: window.location.origin + pageContext().page_path, page_referrer: cleanReferrer() };
    var query = new URLSearchParams(window.location.search);
    var campaigns = { utm_source: "campaign_source", utm_medium: "campaign_medium", utm_campaign: "campaign_name",
      utm_id: "campaign_id", utm_content: "campaign_content" };
    Object.keys(campaigns).forEach(function (key) {
      var value = query.get(key) || "";
      // Etiquetas de campaña, nunca búsquedas libres ni identificadores largos.
      if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(value) || /\d{7}/.test(value)) return;
      if (value) params[campaigns[key]] = value;
    });
    return params;
  }

  function validGaId(id) {
    return /^G-[A-Z0-9-]+$/i.test(String(id || ""));
  }

  function validClarityId(id) {
    return /^[a-z0-9]+$/i.test(String(id || ""));
  }

  function hasConfiguredTool() {
    return validGaId(config.ga4MeasurementId) || validClarityId(config.clarityProjectId);
  }

  function readConsent() {
    try { return window.localStorage.getItem(CONSENT_KEY) || ""; } catch (e) { return ""; }
  }

  function saveConsent(value) {
    try { window.localStorage.setItem(CONSENT_KEY, value); } catch (e) { /* modo privado */ }
  }

  function loadScript(src, attributeName) {
    var script = document.createElement("script");
    script.async = true;
    script.src = src;
    if (attributeName) script.setAttribute("data-cl-analytics", attributeName);
    document.head.appendChild(script);
  }

  function startGoogleAnalytics() {
    if (!validGaId(config.ga4MeasurementId)) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window["ga-disable-" + config.ga4MeasurementId] = false;
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500
    });
    window.gtag("js", new Date());
    window.gtag("set", googleDefaults());
    window.gtag("config", config.ga4MeasurementId, Object.assign(googleDefaults(), {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    }));
    loadScript(
      "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(config.ga4MeasurementId),
      "ga4"
    );
    window.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    state.gaReady = true;
  }

  function startClarity() {
    if (!validClarityId(config.clarityProjectId)) return;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    loadScript("https://www.clarity.ms/tag/" + encodeURIComponent(config.clarityProjectId), "clarity");
  }

  function cleanParams(params) {
    var clean = {};
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (!PARAMS.has(key)) return;
      if (key === "items" && Array.isArray(value)) {
        clean.items = value.slice(0, 20).map(function (item) {
          item = item || {};
          var safeItem = {};
          ["item_id", "item_name", "item_category", "item_variant", "item_brand", "item_list_id", "item_list_name"].forEach(function (itemKey) {
            if (typeof item[itemKey] === "string" && item[itemKey].length <= 120) safeItem[itemKey] = item[itemKey];
          });
          ["price", "quantity", "index", "discount"].forEach(function (itemKey) {
            if (typeof item[itemKey] === "number" && Number.isFinite(item[itemKey])) safeItem[itemKey] = item[itemKey];
          });
          return safeItem;
        }).filter(function (item) { return item.item_id || item.item_name; });
        return;
      }
      if (typeof value === "string") {
        if (value.length <= 100) clean[key] = value;
      } else if ((typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean") {
        clean[key] = value;
      }
    });
    return clean;
  }

  function send(name, params) {
    if (state.consent !== "granted" || !EVENT_NAMES.has(name)) return false;
    var payload = cleanParams(Object.assign({}, params, pageContext()));
    payload.transport_type = "beacon";
    if (state.gaReady && window.gtag) {
      window.gtag("event", name, payload);
      return true;
    }
    if (validGaId(config.ga4MeasurementId)) {
      state.pending.push({ name: name, params: payload });
      return true;
    }
    return false;
  }

  function flush() {
    if (!state.gaReady || !window.gtag) return;
    state.pending.splice(0).forEach(function (item) { window.gtag("event", item.name, item.params); });
  }

  function pageView() {
    if (state.pageViewSent || state.consent !== "granted") return;
    var sent = send("page_view", {
      page_title: document.title,
      page_path: pageContext().page_path,
      page_location: window.location.origin + pageContext().page_path,
      page_referrer: cleanReferrer()
    });
    if (sent) state.pageViewSent = true;
  }

  function linkContext(target) {
    var declared = target.getAttribute("data-analytics-context") || "";
    if (/^[a-z0-9_-]{1,40}$/i.test(declared)) return declared.toLowerCase();
    return target.closest && target.closest("[data-product-id]") ? "product" : "site";
  }

  function trackClicks() {
    document.addEventListener("click", function (event) {
      var target = event.target && event.target.closest ? event.target.closest("a, button") : null;
      if (!target) return;
      if (target.matches("[data-whatsapp-link]")) send("whatsapp_click", {
        link_type: "contact",
        link_context: linkContext(target),
        page_path: pageContext().page_path
      });
      if (target.matches("[data-instagram-link]")) send("instagram_click", { link_type: "social" });
      var itemId = target.getAttribute("data-analytics-item");
      if (itemId) {
        send("select_item", {
          item_id: itemId,
          item_list_id: listId(target),
          item_name: target.getAttribute("data-analytics-item-name") || undefined,
          items: [{
            item_id: itemId,
            item_name: target.getAttribute("data-analytics-item-name") || undefined,
            item_category: target.getAttribute("data-analytics-item-category") || undefined,
            item_list_id: listId(target),
            index: itemIndex(target),
            quantity: 1
          }]
        });
      }
      var filterId = target.getAttribute("data-analytics-filter");
      if (filterId) send("filter_select", { filter_id: filterId });
      if (target.id === "burger") send("open_menu", {});
      if (target.tagName === "A" && !target.matches("[data-whatsapp-link], [data-instagram-link], [data-analytics-item]")) {
        try {
          var url = new URL(target.getAttribute("href"), window.location.href);
          if (/^https?:$/.test(url.protocol) && !/wa\.me$|whatsapp\.com$/.test(url.hostname)) send("navigation_click", {
            link_type: url.origin === window.location.origin ? "internal" : "external",
            link_path: url.origin === window.location.origin ? safePath(url.pathname) : undefined,
            link_domain: url.hostname, link_context: linkContext(target), element_id: safeToken(target.id)
          });
        } catch (e) { /* enlace no navegable */ }
      }
      if (target.tagName === "BUTTON" && /^(pd-|cart-|faq-)/.test(target.id || "")) send("button_click", { element_id: safeToken(target.id) });
    }, true);

    document.addEventListener("toggle", function (event) {
      if (event.target.matches && event.target.matches("details[open]")) send("faq_open", {
        faq_id: "faq_" + (Array.from(document.querySelectorAll("details")).indexOf(event.target) + 1)
      });
    }, true);
  }

  function removeBanner() {
    var banner = document.getElementById("cl-consent-banner");
    if (banner) banner.remove();
  }

  function activate() {
    state.lastActivity = Date.now();
    if (state.toolsStarted) {
      window["ga-disable-" + config.ga4MeasurementId] = false;
      if (window.gtag) window.gtag("consent", "update", { analytics_storage: "granted" });
      if (window.clarity) window.clarity("consent", true);
      pageView();
      measureContent();
      return;
    }
    state.toolsStarted = true;
    startGoogleAnalytics();
    startClarity();
    flush();
    pageView();
    measureContent();
    startBehavior();
  }

  function setConsent(value) {
    state.consent = value;
    saveConsent(value);
    removeBanner();
    if (value === "granted") activate();
    else {
      window["ga-disable-" + config.ga4MeasurementId] = true;
      state.pending = [];
      state.activeSeconds = 0;
      if (exposureObserver) { exposureObserver.disconnect(); exposureObserver = null; }
      state.observed = new WeakMap();
      if (window.gtag) window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
      if (window.clarity) window.clarity("consent", false);
      // Elimina las cookies propias de GA4 también en el dominio raíz.
      (document.cookie || "").split(";").forEach(function (entry) {
        var key = entry.split("=")[0].trim();
        if (!/^_ga(?:_|$)|^_gid$|^_gat/.test(key)) return;
        var base = key + "=; Max-Age=0; path=/; SameSite=Lax";
        document.cookie = base;
        var parts = window.location.hostname.split(".");
        while (parts.length > 1) {
          document.cookie = base + "; domain=." + parts.join(".");
          parts.shift();
        }
      });
    }
  }

  function listId(target) {
    if (target.matches && target.matches(".fs-scene") || target.closest && target.closest(".fs-scene")) return "home_story";
    var grid = target.closest && target.closest("[data-products-grid]");
    if (grid && (grid.id === "related-grid" || grid.hasAttribute("data-exclude"))) return "related";
    return grid ? (grid.hasAttribute("data-filter") ? "catalog_" + (safeToken(grid.getAttribute("data-filter")) || "todos") : "featured") : "related";
  }

  function itemIndex(target) {
    var card = target.closest && target.closest("[data-product-id]");
    return card && card.parentElement ? Math.max(0, Array.from(card.parentElement.children).indexOf(card)) : 0;
  }

  function catalogItem(product, extra) {
    return Object.assign({ item_id: product.id, item_name: product.name, item_category: product.goalLabel,
      item_brand: "Chic&Love", price: typeof clSinglePrice === "function" ? clSinglePrice(product) : product.price, quantity: 1 }, extra);
  }

  var exposureObserver;
  function storyViews() {
    if (state.consent !== "granted" || typeof clFindProduct !== "function") return;
    document.querySelectorAll(".fs-scene.is-active[data-product-id]").forEach(function (scene) {
      if (!scene.classList.contains("is-active")) return;
      var rect = scene.getBoundingClientRect();
      if (rect.bottom <= window.innerHeight * .25 || rect.top >= window.innerHeight * .75) return;
      var id = scene.getAttribute("data-product-id"), key = "home_story:" + id;
      var product = clFindProduct(id);
      if (product && !state.impressions.has(key)) {
        send("view_item_list", { item_list_id: "home_story", items: [catalogItem(product, { item_list_id: "home_story", index: itemIndex(scene) })] });
        state.impressions.add(key);
      }
    });
  }

  function measureContent() {
    if (state.consent !== "granted") return;
    if (!state.productViewSent && pageContext().page_type === "product" && typeof clFindProduct === "function") {
      var id = document.body.getAttribute("data-product-id") || new URLSearchParams(window.location.search).get("id");
      var product = clFindProduct(id);
      if (product) {
        send("view_item", { currency: "USD", value: catalogItem(product).price, items: [catalogItem(product)] });
        state.productViewSent = true;
      }
    }
    storyViews();
    if (!("IntersectionObserver" in window)) return;
    if (!exposureObserver) exposureObserver = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || state.consent !== "granted") return;
        var target = entry.target;
        if (target.matches && target.matches(".fs-scene")) { storyViews(); return; }
        var id = target.getAttribute("data-product-id");
        if (id && entry.intersectionRatio < .25) return;
        if (!id && entry.intersectionRect && entry.intersectionRect.height < Math.min(150, window.innerHeight * .25)) return;
        var key = id ? listId(target) + ":" + id : "section:" + target.id;
        if (state.impressions.has(key)) return;
        if (id && typeof clFindProduct === "function") {
          var product = clFindProduct(id);
          if (product) send("view_item_list", { item_list_id: listId(target), items: [catalogItem(product, { item_list_id: listId(target), index: itemIndex(target) })] });
        } else send("section_view", { section_id: safeToken(target.id) });
        state.impressions.add(key);
      });
    }, { threshold: [0, .01, .25] });
    document.querySelectorAll("[data-products-grid] [data-product-id], .fs-scene[data-product-id], main section[id]").forEach(function (node) {
      var context = listId(node);
      if (state.observed.get(node) !== context) {
        if (state.observed.has(node)) exposureObserver.unobserve(node);
        state.observed.set(node, context); exposureObserver.observe(node);
      }
    });
  }

  function startBehavior() {
    ["pointerdown", "keydown", "scroll"].forEach(function (name) {
      window.addEventListener(name, function () { state.lastActivity = Date.now(); }, { passive: true });
    });
    window.addEventListener("scroll", function () {
      if (state.consent !== "granted") return;
      var height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight || 0);
      if (height <= window.innerHeight) return;
      var percent = Math.min(100, (window.scrollY + window.innerHeight) / height * 100);
      [25, 50, 75, 90, 100].forEach(function (mark) {
        if (percent >= mark && !state.scrollMarks.has(mark)) {
          send("scroll_depth", { percent_scrolled: mark }); state.scrollMarks.add(mark);
        }
      });
    }, { passive: true });
    window.setInterval(function () {
      if (state.consent !== "granted" || document.visibilityState !== "visible" || Date.now() - state.lastActivity > 30000) return;
      state.activeSeconds += 1;
      [10, 30, 60, 120, 300].forEach(function (mark) {
        if (state.activeSeconds >= mark && !state.timeMarks.has(mark)) {
          send("engagement_milestone", { active_seconds: mark }); state.timeMarks.add(mark);
        }
      });
    }, 1000);
    if ("MutationObserver" in window) new window.MutationObserver(measureContent).observe(document.body, { childList: true, subtree: true });
    var errors = 0;
    window.addEventListener("error", function (event) {
      if (state.consent === "granted" && errors++ < 5) send("technical_error", { error_type: event.target && event.target !== window ? "resource_error" : "script_error" });
    }, true);
    window.addEventListener("unhandledrejection", function () {
      if (state.consent === "granted" && errors++ < 5) send("technical_error", { error_type: "promise_error" });
    });
    function navigationTiming() {
      if (!window.performance) return;
      var nav = window.performance.getEntriesByType("navigation")[0];
      if (!nav) return;
      [["ttfb", nav.responseStart], ["dom_ready", nav.domContentLoadedEventEnd], ["load", nav.loadEventEnd]].forEach(function (metric) {
        if (metric[1] > 0) send("performance_timing", { metric_name: metric[0], metric_value: Math.round(metric[1]) });
      });
    }
    if (document.readyState === "complete") navigationTiming();
    else window.addEventListener("load", function () { window.setTimeout(navigationTiming, 0); });
  }

  function showBanner() {
    if (!hasConfiguredTool() || document.getElementById("cl-consent-banner")) return;
    var banner = document.createElement("aside");
    banner.id = "cl-consent-banner";
    banner.className = "cl-consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Preferencias de privacidad");
    var title = document.createElement("strong");
    title.textContent = "Tu privacidad importa";
    var copy = document.createElement("p");
    copy.textContent = "Con tu permiso medimos visitas, navegación, productos e interacción para mejorar tu experiencia. No recogemos datos de contacto ni conversaciones.";
    var actions = document.createElement("div");
    actions.className = "cl-consent-actions";
    var reject = document.createElement("button");
    reject.type = "button";
    reject.className = "btn btn-ghost";
    reject.textContent = "Rechazar";
    reject.addEventListener("click", function () { setConsent("denied"); });
    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "btn btn-primary";
    accept.textContent = "Aceptar analítica";
    accept.addEventListener("click", function () { setConsent("granted"); });
    actions.append(reject, accept);
    banner.append(title, copy, actions);
    document.body.appendChild(banner);
  }

  window.clAnalytics = {
    track: send,
    openPreferences: showBanner,
    consentState: function () { return state.consent; }
  };

  if (state.consent === "granted") activate();
  else if (state.consent !== "denied") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showBanner);
    else showBanner();
  }
  trackClicks();
  document.querySelectorAll("[data-privacy-settings]").forEach(function (button) {
    button.addEventListener("click", showBanner);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pageView);
  document.addEventListener("DOMContentLoaded", measureContent);
  document.addEventListener("cl:catalogrender", measureContent);
  document.addEventListener("cl:storyview", storyViews);
  window.addEventListener("storage", function (event) {
    if (event.key === CONSENT_KEY && event.newValue !== state.consent) setConsent(event.newValue === "granted" ? "granted" : "denied");
  });
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    state.pageViewSent = false;
    state.productViewSent = false;
    pageView();
    measureContent();
  });
}());
