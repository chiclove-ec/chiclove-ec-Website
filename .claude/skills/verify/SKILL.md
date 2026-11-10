---
name: verify
description: Cómo lanzar y verificar el sitio Chic&Love end-to-end
---

# Verificar el sitio Chic&Love

Sitio estático con build por lista blanca. Superficie: navegador.

## Comprobación rápida (sin navegador)

```bash
npm run gen     # no debe dejar diferencias en git
npm run check   # build:cloudflare + la suite completa de node:test
```

Cubre CSP idéntica en las tres copias, referencias internas, lista blanca del
build, cache-busting, datos estructurados contra el catálogo, gemelos markdown,
negociación de contenido, sitemap, `security.txt`, la configuración del dominio
y su reescritura en el build.

Para probar un dominio distinto sin tocar el repositorio:

```bash
npm run build -- --origin=https://otro.dominio && npm run serve
```

## Lanzar el sitio como producción

```bash
cd "/Users/danilomonge/Desktop/Own Projects/Chic&Love Website"
npm run build && npm run serve    # http://localhost:8765
```

`scripts/serve.mjs` sirve `dist/` reproduciendo producción: rutas sin extensión
(`/about` → `about.html`), 404 real y negociación `Accept: text/markdown`.
`python3 -m http.server 8765` sobre la raíz también sirve para mirar el árbol de
trabajo, pero ahí las rutas sin extensión y el 404 **no** se comportan igual.

## Manejar (Playwright + Chrome instalado)

`playwright-core` (npm) con `chromium.launch({ channel: "chrome", headless: true })`.
No requiere descargar navegadores.

Flujos que importan:
- index: 7 tarjetas; "Añadir" abre el drawer del carrito y sube el badge.
- Checkout: clic en `#cart-checkout` abre popup `wa.me`/`api.whatsapp.com` con el pedido
  (sin campos de datos personales) y muestra el plan B `#cart-fallback`; «Copiar pedido»
  copia el mismo texto (concede `clipboard-read`/`clipboard-write` al contexto).
- Aviso de privacidad **sin decidir** (no lo aceptes antes): con el carrito abierto,
  `elementFromPoint` sobre el centro y los bordes de `#cart-checkout` devuelve el botón en
  320×640, 390×844 y 1280×800; en la ficha móvil, lo mismo para `#pd-sticky-add`.
- tienda: 7 tarjetas; chips filtran (Sueño→1, Energía→2).
- `/anti-stress.html` (URL canónica): variantes cambian precio; relacionados
  excluyen el producto; el JSON-LD `Product` trae oferta e InStock.
- `producto.html?id=anti-stress` (heredada): sigue funcionando y canonicaliza a
  `/anti-stress.html`.
- Móvil 320px y 390px: burger abre menú; `document.documentElement.scrollWidth - document.documentElement.clientWidth` debe ser exactamente 0.
- Uniformidad visual: verificar que se respetan los tokens y principios de [`docs/estandares-de-diseno-y-desarrollo.md`](../../../docs/estandares-de-diseno-y-desarrollo.md) (paleta `--paper`/`--card`/`--ink`, botones en píldora, micro-interacciones hover).

## Gotchas

- Los `.reveal` son invisibles hasta hacer scroll (IntersectionObserver). Para
  screenshots full-page: primero `document.documentElement.style.scrollBehavior = "auto"`
  y scrollear en pasos hasta el fondo, luego capturar.
- La CSP por meta no admite `frame-ancestors` (ruido de consola si se agrega);
  en Cloudflare lo aplica `_headers` y en cualquier otro host lo cubre `js/frame-guard.js`.
- No usar estilos inline en HTML: la CSP no lleva `unsafe-inline` en style-src.
- La analítica no carga hasta que se acepta el consentimiento: para probar los
  eventos hay que aceptar el banner primero.

