import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { projectRoot } from "../scripts/lib/catalog.mjs";

function clockAt(iso) {
  let now = Date.parse(iso);
  let timer;
  let refreshes = 0;
  const listeners = {};
  const listen = (type, fn) => { listeners[type] = fn; };
  const context = vm.createContext({
    Date: class extends Date { static now() { return now; } },
    document: { addEventListener: listen, hidden: false },
    window: { addEventListener: listen },
    setTimeout: (fn, delay) => { timer = { fn, delay }; return 1; },
    clearTimeout: () => { timer = undefined; }
  });
  for (const file of ["js/products.js", "js/main.js"]) {
    vm.runInContext(readFileSync(resolve(projectRoot, file), "utf8"), context);
  }
  context.refreshPromotionState = () => { refreshes++; };
  context.initPromoClock();
  return { context, listeners, get timer() { return timer; }, get refreshes() { return refreshes; }, setNow: (iso) => { now = Date.parse(iso); } };
}

test("una pestaña abierta conmuta a medianoche y rearma el siguiente cierre", () => {
  const clock = clockAt("2026-11-26T23:59:59.000-05:00");
  assert.equal(clock.timer.delay, 1000);
  clock.setNow("2026-11-27T00:00:00-05:00");
  clock.timer.fn();
  assert.equal(clock.refreshes, 1);
  assert.equal(clock.timer.delay, 4 * 86400000);
  clock.listeners.focus();
  assert.equal(clock.refreshes, 1, "el foco no duplica cambios ni animaciones");
});

test("una pestaña suspendida recupera la campaña vigente y el cierre final", () => {
  const clock = clockAt("2026-11-25T12:00:00-05:00");
  clock.setNow("2026-12-01T10:00:00-05:00");
  clock.listeners.visibilitychange();
  assert.equal(clock.refreshes, 1);
  clock.setNow("2026-12-03T00:00:00-05:00");
  clock.listeners.pageshow();
  assert.equal(clock.refreshes, 2);
  assert.equal(clock.timer, undefined);
});

test("los temporizadores lejanos se limitan sin anticipar la primera promoción", () => {
  const clock = clockAt("2026-09-01T00:00:00-05:00");
  assert.equal(clock.timer.delay, 2147483647);
  clock.timer.fn();
  assert.equal(clock.refreshes, 0);
  clock.setNow("2026-11-01T00:00:00-05:00");
  clock.listeners.focus();
  assert.equal(clock.refreshes, 1);
});

test("el HTML con descuento de la campaña anterior se vuelve a pintar", () => {
  const { context } = clockAt("2026-11-27T00:00:00-05:00");
  const product = vm.runInContext('CL_PRODUCTS[0]', context);
  let price = "$23.99";
  const card = {
    hasAttribute: () => true,
    getAttribute: () => product.id,
    classList: { contains: () => true },
    querySelector: () => ({ textContent: price })
  };
  const grid = { children: [card] };
  assert.equal(context.canHydrateGrid(grid, [product]), false, "no conserva el precio de noviembre en Black Days");
  price = "$20.99";
  assert.equal(context.canHydrateGrid(grid, [product]), true, "el HTML vigente se hidrata sin reconstruir");
});
