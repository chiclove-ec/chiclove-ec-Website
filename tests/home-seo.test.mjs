import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { projectRoot } from "../scripts/lib/catalog.mjs";

const read = (file) => readFileSync(resolve(projectRoot, file), "utf8");

test("la portada identifica claramente la tienda de vitaminas y sus productos", () => {
  const html = read("index.html");

  assert.match(html, /<title>Chic&amp;Love Ecuador — Vitaminas y complementos en gummies<\/title>/);
  assert.match(
    html,
    /<meta name="description" content="Tienda oficial en Ecuador de complementos alimenticios en formato gummy: vitaminas para cabello, piel, sueño, digestión, energía y calma\. Envíos a todo el país\.\">/
  );
  assert.match(
    html,
    /<meta property="og:description" content="Complementos alimenticios en formato gummy para cabello, piel, sueño, digestión, energía y calma\. Compra en la tienda oficial de Ecuador\.\">/
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/chiclove-ec\.com\/assets\/img\/share-wide\.jpg">/
  );
  assert.match(
    html,
    /<meta name="twitter:image" content="https:\/\/chiclove-ec\.com\/assets\/img\/share-wide\.jpg">/
  );
  assert.match(html, /"image":"https:\/\/chiclove-ec\.com\/assets\/img\/share-square\.jpg"/);
  assert.match(html, /<meta property="og:image:alt" content="Colección de frascos de vitaminas y gummies Chic&amp;Love">/);
  assert.match(html, /<h1>Vitaminas y complementos alimenticios en <span class="accent-word">gummies<\/span><\/h1>/);
  assert.doesNotMatch(html, /productos de moda y estilo|nueva colección de productos de moda/i);
});

test("la portada prioriza solo la imagen hero del primer render", () => {
  const html = read("index.html");
  const preloads = [...html.matchAll(/<link rel="preload" as="image"[^>]*>/g)].map(([tag]) => tag);
  assert.equal(preloads.length, 1, "la portada no debe precargar imágenes de tarjetas o secciones inferiores");
  assert.match(
    preloads[0],
    /href="assets\/img\/splash-hair-nails-640\.webp"[^>]*imagesrcset="assets\/img\/splash-hair-nails-640\.webp 640w, assets\/img\/splash-hair-nails\.webp 1107w"[^>]*imagesizes="\(max-width: 720px\) 58vw, \(max-width: 1024px\) 330px, 455px"[^>]*fetchpriority="high"/
  );
});
