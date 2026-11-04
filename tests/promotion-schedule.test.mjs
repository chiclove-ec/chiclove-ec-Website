import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadCatalog } from "../scripts/lib/catalog.mjs";

const periods = [
  { start: "2026-11-01T00:00:00-05:00", end: "2026-11-27T00:00:00-05:00", price: 23.99, percent: 20, label: "noviembre", until: "2026-11-26" },
  { start: "2026-11-27T00:00:00-05:00", end: "2026-12-01T00:00:00-05:00", price: 20.99, percent: 30, label: "Black Days", until: "2026-11-30" },
  { start: "2026-12-01T00:00:00-05:00", end: "2026-12-03T00:00:00-05:00", price: 18, percent: 40, label: "Cyber Days", until: "2026-12-02" }
];

for (const period of periods) {
  test(`${period.label}: precio exacto y siete productos en toda la ventana`, () => {
    for (const now of [Date.parse(period.start), Date.parse(period.start) + 86400000, Date.parse(period.end) - 1]) {
      const catalog = loadCatalog({ now });
      assert.equal(catalog.CL_PRODUCTS.length, 7);
      for (const product of catalog.CL_PRODUCTS) {
        assert.equal(catalog.clSinglePrice(product), period.price, `${product.id} a ${new Date(now).toISOString()}`);
        assert.equal(catalog.clPromoPercent(product), period.percent);
        assert.equal(catalog.clHasPacks(product), false);
        assert.equal(catalog.clActivePromo(product).priceValidUntil, period.until);
        for (const qty of [1, 2, 3, 7]) {
          assert.equal(catalog.clBestSingleBundle(product, qty).total, Math.round(period.price * 100) * qty / 100);
        }
      }
      const bands = catalog.clPromoBands();
      assert.equal(bands.length, 1);
      assert.equal(bands[0].products.length, 7);
      assert.equal(bands[0].percent, period.percent);
      assert.equal(catalog.clCatalogOfferText(), `toda la colección −${period.percent}% en ${period.label}`);
      assert.equal(catalog.clNextPromoBoundary(), Date.parse(period.end));
    }
  });
}

test("no se anticipan las campañas y desde el 3 de diciembre vuelven los packs", () => {
  for (const now of [Date.parse(periods[0].start) - 1, Date.parse(periods[2].end), Date.parse("2027-11-27T00:00:00-05:00")]) {
    const catalog = loadCatalog({ now });
    assert.equal(catalog.clPromoBands().length, 0);
    for (const product of catalog.CL_PRODUCTS) {
      assert.equal(catalog.clActivePromo(product), null);
      assert.equal(catalog.clSinglePrice(product), 29.99);
      assert.equal(catalog.clHasPacks(product), true);
    }
    assert.match(catalog.clCatalogOfferText(), /^Packs x2/);
  }
});

test("el próximo cambio usa instantes absolutos y no se repite una frontera pasada", () => {
  const catalog = loadCatalog({ now: Date.parse(periods[0].start) - 1 });
  for (const period of periods) {
    assert.equal(catalog.clNextPromoBoundary(Date.parse(period.start) - 1), Date.parse(period.start));
    assert.equal(catalog.clNextPromoBoundary(new Date(period.start)), Date.parse(period.end));
  }
  assert.equal(catalog.clNextPromoBoundary(Date.parse(periods[2].end)), null);
});
