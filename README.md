# Chic&Love Ecuador — Sitio web

[![CI](https://github.com/chiclove-ec/chiclove-ec-Website/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/chiclove-ec/chiclove-ec-Website/actions/workflows/ci.yml)

Sitio estático (HTML/CSS/JS vanilla, sin dependencias de runtime ni de build) para la marca de
gummies de vitaminas **Chic&Love Ecuador** — <https://chiclove-ec.com>.
Diseño minimalista/futurista inspirado en lusetabeauty.com.

Sin backend: el catálogo vive en un archivo, el carrito en `localStorage` y el pedido se
entrega por WhatsApp. Todo lo derivado (fichas de producto, markdown, datos estructurados)
se **genera** desde ese catálogo, y la suite de pruebas falla si alguna copia se desvía.

> **Empezar:** `npm run gen && npm run check` deja el repositorio regenerado, probado y
> con el artefacto público en `dist/`. No hace falta `npm install`: no hay dependencias.

## Estructura

El sitio se sirve desde la raíz del repositorio: cada página vive en un archivo
propio y `dist/` (el único artefacto publicable) se arma copiando por lista blanca.

### Páginas

| Archivo | Qué es |
|---|---|
| `index.html` | Landing: hero, bestsellers, beneficios, ritual, certificaciones y FAQ |
| `tienda.html` | Catálogo completo con filtros por objetivo |
| `<slug>.html` | **Página canónica de cada producto** (`hair-nails-forte`, `radiant-skin`, `vinagre-de-manzana`, `sleep-vitamins`, `sexual-booster-women`, `sexual-booster-men`, `anti-stress`), generada desde el catálogo con `Product` JSON-LD |
| `producto.html?id=<slug>` | Página heredada: sigue funcionando y canonicaliza a la URL nueva. Es además la **plantilla** de la que `gen-products.mjs` deriva las fichas |
| `nosotros.html` | Historia y filosofía de la marca |
| `about.html`, `contact.html`, `privacy.html`, `terms.html` | Páginas de confianza: identidad de la empresa, atención al cliente, privacidad y condiciones de venta (`/about`, `/contact`, `/privacy`, `/terms`) |
| `404.html` | 404 real con rutas de recuperación para personas y agentes |

### Código

| Archivo | Qué es |
|---|---|
| `js/products.js` | **Catálogo: nombres, precios, textos, colores — edita aquí** |
| `js/main.js` | Navegación, carrito (localStorage) y checkout por WhatsApp |
| `js/product-page.js` | Render de la página de producto |
| `js/story.js` | Scrollytelling: escenas fijadas (fórmulas en la portada, activos en cada ficha), parallax y barra de compra móvil |
| `js/analytics.js` | Consentimiento y eventos de analítica (GA4) |
| `js/frame-guard.js` | Guard anti-frame para hosts sin cabeceras configurables |
| `css/styles.css` | Todos los estilos |
| `assets/img/` | Imágenes optimizadas de producto con fondo transparente |
| `functions/_middleware.js` | Negociación `Accept: text/markdown` (solo Cloudflare Pages; se activa con `deploy-cloudflare.yml`) |

### Contenido para máquinas

| Archivo | Qué es |
|---|---|
| `llms.txt` | Índice del sitio para agentes, con cuándo usarlo (formato llmstxt.org, generado) |
| `agents.md` | Instrucciones para agentes: identidad, límites y cómo leer el sitio (generado) |
| `llms-full.txt` | Todo el markdown del sitio en un archivo (generado) |
| `catalog.json` | **El catálogo entero tipado en una sola petición** (generado): precios y packs, pauta, duración del frasco, activos con su entidad de Wikidata, empresa y límites de uso |
| `guia-de-eleccion.md` | Guía de decisión por objetivo y tabla comparativa de las siete fórmulas (generado) |
| `ingredientes.md` | Glosario de los activos: qué es cada uno, sus precauciones, en qué producto está y su entidad en Wikidata y Wikipedia (generado) |
| `respuestas.md` | **Preguntas y respuestas con el vocabulario de Ecuador** («gomitas de biotina», «¿envían a Cuenca?», «¿es confiable?»), cada una citable por sí sola (generado) |
| `en.md` | Resumen en inglés de la tienda, las fórmulas, los precios y la seguridad (generado) |
| `e59aa493000e0bbda378ca10f82a051a.txt` | Clave pública de IndexNow; la usa `scripts/indexnow.mjs`. **No renombrar** |
| `*.md` | Gemelo markdown de cada página, incluido `404.md` |
| `robots.txt`, `sitemap.xml` | Rastreo y páginas indexables |
| `.well-known/security.txt` | Canal de reporte de vulnerabilidades (RFC 9116) |
| `googlee70d0e2c8fe95f2c.html` | Testigo de verificación de Google Search Console. **No borrar ni sacar del build** |

### Herramientas y configuración

| Archivo | Qué es |
|---|---|
| `scripts/build.mjs` | Build por lista blanca hacia `dist/`, por proveedor |
| `scripts/gen-products.mjs`, `scripts/gen-jsonld.mjs` | Generadores desde el catálogo y el FAQ visible (`npm run gen`) |
| `scripts/serve.mjs`, `scripts/lib/` | Servidor local fiel a producción y lógica compartida (catálogo, negociación) |
| `scripts/analytics_report.py` | Informe semanal de GA4 por correo (sin dependencias) |
| `tests/` | Suite de `node:test` (`npm test`) |
| `.github/workflows/` | CI, aviso a IndexNow tras cada publicación de Cloudflare, catálogo por fecha, recuperación manual de Cloudflare e informe semanal |
| `site.config.json` | **El dominio del sitio y el proyecto de Cloudflare — fuente única** |
| `_headers`, `vercel.json`, `netlify.toml`, `wrangler.toml` | Cabeceras y configuración por proveedor de hosting |
| `scripts/lib/site-config.mjs`, `scripts/set-origin.mjs` | Carga del dominio y mudanza permanente a otro |
| `.editorconfig`, `.gitattributes`, `.nvmrc` | Convenciones de formato, finales de línea y versión de Node |
| `CONTRIBUTING.md`, `CLAUDE.md` | Flujo de trabajo del repositorio, para personas y para agentes |
| `SECURITY.md`, `LICENSE` | Política de reporte de vulnerabilidades y licencia propietaria |
| `docs/` | Documentación de diseño y desarrollo: estándares canónicos de UI/UX y arquitectura (`docs/estandares-de-diseno-y-desarrollo.md`), promociones mensuales y diseño histórico |

## Cómo verlo

```bash
npm run build          # genera dist/
npm run serve          # sirve dist/ en http://localhost:8765 como producción
```

`scripts/serve.mjs` reproduce el comportamiento de producción: rutas sin extensión
(`/about` → `about.html`), 404 real y negociación `Accept: text/markdown`. Para inspeccionar
el árbol de trabajo sin build sirve también `python3 -m http.server 8765`, pero ahí las rutas
sin extensión y el 404 no se comportan como en producción.

## Pruebas

```bash
npm test
```

Cubre la negociación de contenido (valores q, 406, `Vary`), el formato de `llms.txt`, la
existencia y coherencia de los gemelos markdown con el catálogo, el contenido mínimo de las
páginas de confianza, el 404 recuperable, el sitemap, la lista blanca del build y los códigos
de estado y tipos de contenido de cada endpoint publicado.

Dos pruebas cuidan que el sitio no se contradiga a sí mismo: los datos estructurados deben
coincidir con el texto visible y con el catálogo, y **ningún texto puede afirmar que no hay
analítica mientras `js/analytics.js` esté incluido** en las páginas.

`tests/deployment-consistency.test.mjs` cuida lo que se escribe más de una vez: que la CSP
sea idéntica en `_headers`, `vercel.json` y el `<meta>` de cada página, que toda referencia
interna exista **y** esté en la lista blanca del build, que la lista blanca no arrastre
archivos borrados, que el token `?v=` de cache-busting sea el mismo en todas las páginas y
que `security.txt` no haya caducado.

`tests/site-origin.test.mjs` cuida el dominio: que `site.config.json` sea válido, que el
código no lo incruste, que nada publicado nombre un dominio ajeno, que la reescritura mueva
tanto `https://dominio` como el host suelto **sin** tocar las URLs del repositorio en GitHub,
que el build reescriba el artefacto entero, que `wrangler.toml` cuadre con la configuración y
que toda acción de GitHub esté anclada a un SHA.

## Integración continua

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ci.yml` | En cada pull request (check obligatorio de `main`) y en cada push a `main` | `npm test`, `npm run build:cloudflare` y comprueba que `npm run gen` no deje diferencias |
| `indexnow.yml` | En cada push a `main` | Espera a que el check «Cloudflare Pages» del commit quede en verde y avisa a IndexNow |
| `refresh-catalog.yml` | 00:07 de Ecuador, con dos reintentos | Regenera lo derivado cuando una promoción abre o cierra, y lo fusiona por PR |
| `deploy-cloudflare.yml` | Manual | Vía de recuperación con CI y Wrangler; la publicación normal la hace la integración Git nativa de Cloudflare, sin dos despliegues automáticos |
| `weekly-analytics-report.yml` | Lunes 09:00 (Ecuador) | Envía por correo el informe de GA4 |

Las acciones están ancladas por SHA y Dependabot propone sus actualizaciones una vez al mes
(`.github/dependabot.yml`). El proyecto no tiene dependencias de npm ni de Python.

Antes de empujar, el atajo local equivalente es:

```bash
npm run gen && npm run check   # regenera, construye dist/ y ejecuta la suite
```

## Contenido para agentes

- **`/llms.txt`** — índice en formato [llmstxt.org](https://llmstxt.org): resumen, cómo llamar
  al sitio, cuándo usarlo (y cuándo no) y enlaces a todo el contenido en markdown. Se **genera**
  desde el catálogo: cuando se escribía a mano se desvió y anunciaba un precio distinto del de
  `agents.md`, y para un modelo dos cifras del mismo dato son motivo para desconfiar del resto.
- **`/catalog.json`** — el catálogo entero **tipado**, para un agente que quiera datos y no prosa:
  precios y packs, pauta diaria, cuánto dura un frasco, activos con su identificador de Wikidata,
  datos de la empresa y los límites de uso, en una sola petición. No es una API: documento
  estático, sin stock en tiempo real y sin escrituras. Se declara en el `<head>` del catálogo con
  `<link rel="alternate" type="application/json">` y como `DataFeed` en los datos estructurados.
- **`/guia-de-eleccion.md`** — la pregunta con la que llega la gente («¿cuál me sirve para X?»)
  respondida objetivo por objetivo, con tabla comparativa de las siete fórmulas.
- **`/ingredientes.md`** — qué es cada activo, cómo se llama también, sus precauciones, en qué
  fórmulas está y su entidad en **Wikidata** y Wikipedia, para que «maca» o «melisa» se
  resuelvan a la especie correcta sin inferirla del contexto.
- **`/respuestas.md`** — lo que se pregunta en Ecuador, con sus palabras: la marca dice
  «gummies», pero en Ecuador se busca «gomitas», y antes esa palabra no aparecía en ningún texto
  del sitio. Una respuesta por necesidad y por activo, más compra, envío, confianza y seguridad.
  Un asistente recupera trozos, no documentos: cada respuesta nombra producto, precio vigente,
  país, enlace y distribuidor, y se sostiene sola.
- **`/en.md`** — resumen en inglés, para expatriados, turistas y modelos que razonan en inglés.
- **Para quién es y para quién no** — cada ficha markdown abre con un «Resumen para citar», dice
  para quién es la fórmula, cuándo no lo es y las precauciones de cada activo. Un asistente
  recomienda antes una fuente que le dice cuándo NO recomendar que una que solo vende.
- **IndexNow** — `node scripts/indexnow.mjs` avisa a Bing y compañía de las URL nuevas tras un
  despliegue (el buscador de ChatGPT y Copilot se apoya en Bing). Ejecútalo después de publicar
  cambios de contenido; `--dry-run` enseña lo que enviaría.
- **FAQ por ficha** — cada gemelo markdown de producto cierra las preguntas previas a la compra
  (para qué sirve, cómo se toma, cuánto dura el frasco, precio y envío, si es vegano, qué activos
  lleva, contraindicaciones, cómo se pide, devoluciones) con datos salidos del catálogo.
- **`/agents.md`** — archivo de instrucciones autocontenido para agentes que buscan uno:
  identidad, casos de uso, límites explícitos y cómo leer el sitio.
- **`/llms-full.txt`** — todo el markdown del sitio en un solo archivo, con la URL de origen
  de cada sección, para cargarlo de una sola vez.
- **Gemelos markdown** — cada página HTML tiene su `.md` en la misma ruta
  (`/tienda.html` → `/tienda.md`, `/about` → `/about.md`), declarado con
  `<link rel="alternate" type="text/markdown">`.
- **`robots.txt`** — rastreo permitido explícitamente para 33 rastreadores, **CCBot incluido**:
  es el de Common Crawl, el corpus público del que parten casi todos los modelos de lenguaje, y
  por tanto la vía por la que el sitio llega a los datos de entrenamiento y no solo al buscador
  de un asistente. Con él van GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
  Google-CloudVertexBot, Applebot-Extended, Meta-ExternalFetcher, MistralAI-User, Ai2Bot y
  compañía, más punteros a todos los artefactos para máquinas.
- **Entidades enlazadas** — `Organization.knowsAbout` declara cada activo como `DefinedTerm` con
  su `sameAs` a Wikidata, y cada ficha publica su propio `DefinedTermSet`. Es lo que permite a un
  modelo anclar el catálogo a entidades que ya conoce.
- **Idioma y región** — cada página indexable declara `hreflang="es-EC"` y `x-default` hacia su
  propia canónica, más `geo.region` (`EC-P`) y `geo.placename`: el sitio se presenta como la
  edición ecuatoriana, que es la única.
- **404 recuperable** — `404.html` responde 404 real con enlaces a `/llms.txt`, `/sitemap.xml`
  y las secciones principales; `404.md` es su versión markdown.
- **Datos estructurados** — `FAQPage` en la portada, `CollectionPage`+`ItemList` en la tienda,
  `["Product","DietarySupplement"]` por producto —el tipo que schema.org tiene para un complemento
  alimenticio, con `activeIngredient`, `recommendedIntake`, `safetyConsideration`,
  `targetPopulation` y `audience` en propiedades propias— con `Offer`, `shippingDetails` y
  `hasMerchantReturnPolicy`. La oferta es **una sola** (el frasco suelto) para que ningún buscador
  anuncie el precio de un pack como si fuera el del producto: la escalera de precios va en
  `additionalProperty` y en `catalog.json`. Y `AboutPage`/`ContactPage` en las páginas de
  confianza. Van estáticos en el HTML (la CSP impide inyectarlos por JS) y `npm test` falla si
  dejan de coincidir con el catálogo o con el texto visible de la página.
- **Política de devoluciones** — devolución o cambio dentro de los 15 días posteriores a recibir
  el pedido, con el frasco cerrado y su sello intacto; los pedidos dañados, incompletos o
  equivocados se resuelven por WhatsApp. Está en `/terms`, `/contact#devoluciones`, en el FAQ de
  la portada, en `/about`, en los markdown y como `MerchantReturnFiniteReturnWindow`
  (`merchantReturnDays: 15`) en cada oferta.

Todo lo derivado se regenera con **`npm run gen`**: `gen:products` escribe las páginas de
producto, sus `.md`, `index.md`, `tienda.md`, `agents.md` y `llms-full.txt` desde el catálogo;
`gen:jsonld` reescribe el `FAQPage` de la portada (desde su propio FAQ visible) y los
`ItemList`/`CollectionPage` de portada y tienda. **Reejecútalo al tocar `js/products.js` o el
FAQ de la portada**; ambos generadores son idempotentes.

### Negociación `Accept: text/markdown`

`acceptmarkdown.com` exige responder `text/markdown` al negociar, `Vary: Accept`, `406` ante
tipos no soportados y respetar los valores q. Eso necesita lógica en el servidor y
un host de estáticos puro no la permite: sin cabeceras propias ni código en el borde. Cloudflare
Pages sí (ver abajo); aun así el sitio publica los `.md` en URLs propias, los declara con `rel="alternate"`
y lo dice explícitamente en `llms.txt` y `agents.md`, para que un agente no pierda tiempo
negociando.

| Proveedor | Gemelos `.md` | Negociación por `Accept` |
|---|---|---|
| Cloudflare Pages (producción) | sí | **sí**, vía `functions/_middleware.js` |
| Netlify | sí | no sin una edge function equivalente |
| Vercel | sí | no: `has.value` usa RE2, sin lookahead para los valores q |

`functions/_middleware.js` y `scripts/lib/markdown-negotiation.mjs` están escritos y probados,
y la publicación normal a Cloudflare Pages ocurre por la integración Git nativa; el workflow
`deploy-cloudflare.yml` queda disponible como vía manual de recuperación y siempre pasa por CI.
Ver *Despliegue automático*.

El middleware construye sus enlaces de recuperación a partir del origen de la propia
petición, así que sigue siendo correcto en cualquier dominio o preview.

## Cómo funciona la compra

No hay backend: el carrito vive en `localStorage` y "Finalizar pedido" abre
WhatsApp con el pedido ya redactado (productos, cantidades y total).
Para cambiar el número, edita `CL_WHATSAPP` en `js/products.js`.

## Analítica y reportes

`js/analytics.js` está incluido en todas las páginas. Google Analytics 4 ya está configurado y la
web pide consentimiento antes de cargarlo. Registra visitas, productos vistos, filtros, clics de
contacto con contexto de página, carrito, inicio de checkout, intención de lead por WhatsApp y
preguntas frecuentes, sin enviar nombres, teléfonos, mensajes ni el contenido del carrito. El
evento `generate_lead` sólo se emite cuando se abre correctamente la ventana de WhatsApp; no
representa una compra confirmada. El archivo `googlee70d0e2c8fe95f2c.html` mantiene la
verificación de Google Search Console para los informes de impresiones y clics de búsqueda.

### Informe automático de los lunes

El workflow `.github/workflows/weekly-analytics-report.yml` genera y envía cada lunes a las
09:00 de Ecuador un correo HTML a `marketing@laboratorioslira.com`. Incluye la semana cerrada
anterior, comparación con la semana previa y una ventana consolidada de las últimas cuatro
semanas: visitantes, sesiones, vistas, interacción, eventos, páginas, productos, canales,
dispositivos, países y gráficas SVG.

No requiere una plataforma de pago ni dependencias de Python: usa la GA4 Data API gratuita,
OpenSSL disponible en el runner de GitHub Actions y el SMTP de una cuenta de correo que
controle la empresa. El informe solo envía datos agregados y no guarda datos personales ni
informes dentro del repositorio.

Para activarlo una sola vez, configura estos secretos en **Settings → Secrets and variables →
Actions → New repository secret**:

| Secreto | Contenido |
|---|---|
| `GA4_PROPERTY_ID` | ID numérico de la propiedad GA4 |
| `GA4_SERVICE_ACCOUNT_JSON` | JSON completo de una cuenta de servicio con acceso Viewer a la propiedad |
| `REPORT_SMTP_USER` | Cuenta desde la que se enviará el correo |
| `REPORT_SMTP_PASSWORD` | Contraseña SMTP o contraseña de aplicación |
| `REPORT_SMTP_HOST` | Opcional; por defecto `smtp.gmail.com` |
| `REPORT_SMTP_PORT` | Opcional; por defecto `465` |
| `REPORT_FROM_EMAIL` | Opcional; por defecto usa `REPORT_SMTP_USER` |

La cuenta de servicio debe tener acceso de solo lectura en **GA4 → Administrar → Administración
de accesos de la propiedad**, y el proyecto de Google Cloud debe tener habilitada la GA4 Data
API. Ambas funciones son gratuitas dentro de sus cuotas. Para Gmail se recomienda usar una
contraseña de aplicación; para un correo corporativo se pueden usar sus datos SMTP. El workflow
ejecuta primero un preflight que valida todos los secretos, la clave PEM, el puerto SMTP, la zona
horaria y que el destinatario siga siendo `marketing@laboratorioslira.com`, sin imprimir valores
secretos.

El workflow también puede lanzarse manualmente desde **Actions → Weekly analytics report → Run
workflow** sin esperar al lunes: primero valida la configuración y solo consulta GA4 y envía el
correo si el preflight pasa. Nunca pongas estas credenciales en HTML, JavaScript, el repositorio
ni `js/analytics.js`.

## Editar datos comerciales

Todo el catálogo está en `js/products.js`. `CL_PRODUCT_PRICING` controla el
precio por frasco, el pack x2 y el pack x3 para todos los productos. `CL_PRODUCTS`
contiene nombres, beneficios, activos, colores e imágenes.
El mismo archivo concentra `CL_WHATSAPP`, `CL_INSTAGRAM`, `CL_FREE_SHIPPING` y
`CL_VAT_NOTE` / `CL_VAT_SENTENCE` (el aviso de IVA incluido).
Los HTML no repiten esos valores.
Los cambios se reflejan automáticamente en portada, tienda, tarjetas, detalle,
carrito, enlaces de contacto y pedido de WhatsApp.

Los gemelos markdown y los datos estructurados sí llevan los valores escritos, porque los lee
un agente sin JavaScript: tras editar el catálogo o abrir una promoción ejecuta `npm run gen` y `npm test`
(hay pruebas que fallan si un precio publicado ya no está en el catálogo).

## Promociones temporales

`CL_PROMOS` en `js/products.js` guarda las promociones por producto, indexadas por
id. La especificación técnica detallada y el procedimiento mensual paso a paso se
encuentran en [`docs/promociones-mensuales.md`](docs/promociones-mensuales.md).

Cada entrada define el precio promocional, la ventana (`start` / `end`, en hora
de Ecuador) y los textos que se muestran. `singleOnly: true` retira los packs
mientras dure: a precio promocional costarían más que comprar frascos sueltos, y
los packs que ya estuvieran guardados en un carrito se convierten a frascos. Una
prueba (`tests/promotions.test.mjs`) exige `singleOnly` exactamente cuando 2 o 3
frascos sueltos al precio de promo cuestan lo mismo o menos que el pack.

Portada y tienda anuncian cada promoción en una banda (`data-promo-band`), de mayor
a menor descuento, con estética compacta, kicker («Solo en <mes>»), badge de descuento,
precios y fotografía editorial. Una fórmula sin `group` tiene banda propia, con su
foto de tienda, y lleva a su ficha. Las que comparten `group` (mismo precio y mismas
fechas) se anuncian juntas en una sola banda definida en `CL_PROMO_GROUPS` —título,
color e imagen— que lleva a la tienda. La imagen del grupo `coleccion` es una
composición de los frascos sobre el fondo de las fotos de tienda, con una versión
vertical para móvil. En las secciones de producto (bestsellers, catálogo y relacionados),
las fórmulas con descuento muestran sus etiquetas distintivas: borde `.is-promo`,
chapa de porcentaje `.pcard-promo-tag`, precio anterior tachado, línea con el mes y
píldora de ahorro. En su ficha individual, se activa `#pd-promo` y la variante con descuento.


La promoción **entra y sale sola** en las fechas indicadas. La web visible cambia
en el navegador a la hora exacta (00:00 de Ecuador), sin desplegar nada. Lo
generado lleva los precios escritos: los datos estructurados, los gemelos
markdown, `catalog.json`, `llms.txt` y la franja superior del HTML. Eso lo pone al
día `.github/workflows/refresh-catalog.yml`, que corre a las 00:07 de Ecuador y
reintenta a las 02:37 y a las 08:07:

1. `npm run refresh` regenera con la fecha del día y, si algo cambió, adelanta
   `contentModified` para que `dateModified` y el sitemap avisen a los buscadores.
2. Pasa la suite, sube lo regenerado a la rama `auto/catalogo-<fecha>` y abre el PR.
3. Cumple los dos checks obligatorios de `main`. El de CI lo ejecuta él mismo
   —los tres pasos de `ci.yml`, sobre el commit exacto que sube— y lo publica como
   estado de ese commit: lo que hace el `GITHUB_TOKEN` no dispara `ci.yml`, y un CI
   lanzado a mano no se asocia al PR. El de Cloudflare Pages llega al construirse
   la rama. Con los dos en verde, fusiona ese mismo commit.
4. Cloudflare publica el push a `main`; el workflow lanza además `indexnow.yml`, que
   avisa a los buscadores en cuanto Cloudflare termina.

Si no llega al final, deja la rama y un issue con el enlace para abrir el PR a
mano. Para abrir el PR necesita una opción del repositorio: *Settings → Actions →
General → Workflow permissions → «Allow GitHub Actions to create and approve pull
requests»*. Lo mismo se puede hacer a mano, y también simular cualquier fecha:

```bash
npm run refresh                                       # con la fecha de hoy
npm run refresh -- --now=2026-11-01T00:00:00-05:00    # cómo quedará al cerrar octubre
```

Desde Actions, *Run workflow* con el campo `simular` hace un simulacro: regenera y
pasa la suite con esa fecha, y ensaya el circuito del PR (permisos, checks,
espera) con un commit vacío que cierra sin fusionar. El commit es vacío porque CI y
Cloudflare comprueban con el reloj real: con el contenido de otra fecha fallarían
siempre.

## Build seguro

No publiques la raíz del repositorio: contiene documentación y artefactos locales que
no forman parte de la web. El build copia mediante una lista blanca únicamente HTML,
CSS, JavaScript e imágenes a `dist/`:

```bash
npm run build
```

El contenido de `dist/` es el único artefacto que se debe publicar.

## El dominio del sitio

El sitio publica URLs absolutas donde no caben las relativas: `rel="canonical"`,
`og:url`, los JSON-LD, `sitemap.xml`, `robots.txt` y los gemelos markdown. Todas
salen de **un solo sitio**, [`site.config.json`](site.config.json):

```json
{
  "canonicalOrigin": "https://chiclove-ec.com",
  "sourceOrigin": "https://chiclove-ec.com",
  "cloudflare": { "projectName": "chiclove-ec", "productionBranch": "main" }
}
```

| Campo | Qué significa |
|---|---|
| `canonicalOrigin` | El dominio **oficial**: el que acaba en el artefacto publicado y el que ve Google. Es lo único que hay que tocar para mudar el sitio |
| `sourceOrigin` | El dominio escrito **literalmente** en los archivos del repositorio. El build lo sustituye por `canonicalOrigin` al copiar a `dist/` |
| `cloudflare.projectName` | El proyecto de Cloudflare Pages. `wrangler.toml` debe coincidir (hay una prueba) |

Mientras los dos orígenes coincidan, la reescritura no hace nada. El código
(generadores, pruebas, middleware) **nunca** escribe el dominio a mano: lo lee de
aquí, y una prueba falla si alguien lo vuelve a incrustar.

### Cambiar de dominio

Cambia `canonicalOrigin` y despliega. Nada más:

```json
{ "canonicalOrigin": "https://chiclove.ec", "sourceOrigin": "https://chiclove-ec.com", ... }
```

A partir de ese commit el sitio se publica declarando el dominio nuevo, también
mientras el viejo siga apuntando a Cloudflare. Eso es exactamente lo que Google
necesita para consolidar la mudanza: el sitio viejo sigue respondiendo, pero dice
que la dirección buena es la nueva.

Para probarlo sin tocar el repositorio:

```bash
npm run build -- --origin=https://chiclove.ec   # o SITE_ORIGIN=... npm run build
```

El build **falla** si tras reescribir queda algún archivo nombrando el dominio
anterior: una sola canónica olvidada mandaría a Google al sitio equivocado.

Cuando la mudanza sea definitiva y no quieras seguir arrastrando la reescritura,
reescribe también las fuentes:

```bash
npm run set-origin https://chiclove.ec -- --dry-run   # qué cambiaría
npm run set-origin https://chiclove.ec                # hacerlo
npm run gen && npm run check                          # regenerar y comprobar
```

Deja `sourceOrigin` y `canonicalOrigin` iguales otra vez. Ojo con dos cosas que
el script ya resuelve: el dominio aparece también **como host suelto** en texto
visible (la ficha de empresa de `/about`, el mensaje del 404), y las URLs de
`github.com` **no** se mudan — son del repositorio
(`chiclove-ec/chiclove-ec-Website`), no del sitio.

Después del cambio quedan dos pasos fuera del repositorio: apuntar el DNS y, en
Google Search Console, dar de alta la propiedad nueva y usar **Cambio de
dirección** desde la anterior.

## Despliegue automático

El sitio se publica **solo en Cloudflare Pages** (<https://chiclove-ec.com>; `www` redirige ahí).
Cada merge o push a `main` dispara un build en Cloudflare, que **no publica si la
suite falla**; en ese caso sigue servida la versión anterior, así que el sitio no
se cae.

| Destino | Mecanismo | Estado |
|---|---|---|
| Cloudflare Pages | Integración Git nativa de Cloudflare | **En producción.** Construye y publica en cada push a `main` |
| GitHub Pages | — | **Retirado.** Las condiciones de GitHub no lo admiten como hosting de una tienda |

GitHub Pages está desactivado en *Settings → Pages* y no existe ningún workflow que
publique allí. `tests/cloudflare-deploy-workflow.test.mjs` falla si alguien vuelve a
añadir las acciones de Pages, el objetivo `github-pages` del build o `.nojekyll`.

### Cómo está montado Cloudflare Pages

Cloudflare no despliega por GitHub Actions, sino por su **integración Git nativa**:
la GitHub App *Cloudflare Workers and Pages* está instalada en la organización con
acceso **solo** a este repositorio, y cada push a `main` dispara un build en
Cloudflare.

| Ajuste | Valor |
|---|---|
| Proyecto | `chiclove-ec` (el de `cloudflare.projectName`; `wrangler.toml` debe coincidir) |
| Repositorio | `chiclove-ec/chiclove-ec-Website`, rama de producción `main` |
| Framework preset | *None* |
| Comando de build | `npm test && npm run build:cloudflare` |
| Directorio de salida | `dist` |
| Directorio raíz | `/` — ahí vive `functions/`, que Cloudflare compila aparte |
| Node | el de `.nvmrc` |

La suite va **dentro** del comando de build a propósito: si `npm test` falla, el
build falla y Cloudflare no publica. `ci.yml` ejecuta los mismos pasos en cada PR
como check obligatorio de `main`, antes de que el merge llegue a Cloudflare.

`deploy-cloudflare.yml` sigue en el repositorio como vía manual de recuperación
(despliegue directo con Wrangler). Las credenciales `CLOUDFLARE_API_TOKEN` y
`CLOUDFLARE_ACCOUNT_ID` están guardadas como secretos para esa vía, pero el workflow
no escucha `push` y no compite con la integración Git nativa.

### Por qué Cloudflare

Un host de estáticos puro **no deja definir cabeceras HTTP ni ejecutar código en
el borde**. Cloudflare Pages sí, y eso desbloquea dos cosas que el repositorio ya
tiene escritas y probadas:

- **`_headers`** aplica de verdad la CSP, HSTS, `X-Frame-Options`,
  `Permissions-Policy` y el aislamiento entre orígenes. La CSP por `<meta>` y el
  guard anti-frame quedan como defensa adicional.
- **`functions/_middleware.js`** responde a `Accept: text/markdown` con `Vary`,
  `406` y valores q, como pide acceptmarkdown.com. Vive en `functions/` en la
  raíz del repositorio, **no** dentro de `dist/`: Cloudflare lo compila aparte y
  el build lo mantiene fuera del artefacto público a propósito.

## Otros destinos y comprobación posterior

Además de Cloudflare, el build tiene objetivo propio para otros proveedores, por si
algún día hiciera falta mudarse; todos publican el mismo `dist/`:

| Proveedor | Cómo | Cabeceras HTTP | Negociación `Accept` |
|---|---|---|---|
| **Cloudflare Pages** *(producción)* | `npm run build:cloudflare`, salida `dist` | `_headers`, completas | **Sí**, `functions/_middleware.js` |
| **Netlify** | Importa el repositorio; `netlify.toml` hace el resto | `_headers`, completas | No sin una edge function equivalente |
| **Vercel** | Importa el repositorio; `vercel.json` hace el resto | En `vercel.json`, completas | No: `has.value` usa RE2, sin lookahead para los valores q |

### Comprobar un despliegue

Sustituye el dominio por el que acabes de publicar:

```bash
SITE=https://chiclove-ec.com

# Lo público responde 200
for p in / /tienda.html /about /contact /privacy /llms.txt /agents.md /llms-full.txt /tienda.md; do
  printf "%-16s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$SITE$p")"
done

# Lo privado y lo inexistente responden 404
for p in /README.md /site.config.json /wrangler.toml /package.json /docs/ /ruta-inexistente; do
  printf "%-20s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$SITE$p")"
done

# El dominio declarado es el que toca
curl -s "$SITE/" | grep -o 'rel="canonical" href="[^"]*"'
curl -sI "$SITE/tienda.md" | grep -i content-type      # text/markdown
```

Si `.md` no saliera como `text/markdown`, los agentes siguen leyéndolo igual (el
contenido es texto plano) y `llms.txt` ya avisa de cómo pedirlo.

## Estándares de diseño y desarrollo

La especificación canónica y exhaustiva para mantener la estética uniforme, el sistema de diseño
y la calidad del código se encuentra en [`docs/estandares-de-diseno-y-desarrollo.md`](docs/estandares-de-diseno-y-desarrollo.md).

Principios clave que todo agente y desarrollador debe seguir:
- **Estética editorial, cálida y dopaminérgica:** Uso exclusivo de los tokens oficiales de `css/styles.css`
  (`--paper` #f7f4ef, `--card` #fffdfb, `--ink` #111112, `--muted` #716a63, `--line` rgba(19, 19, 19, 0.09)
  y los acentos de las 7 fórmulas).
- **Tipografía de sistema:** `ui-rounded`/`system-ui` fluido con `clamp()`. Sin Google Fonts para respetar
  la CSP y maximizar la velocidad.
- **Sin estilos inline:** La CSP no permite `unsafe-inline`. Toda variación visual se apoya en clases de utilidad.
- **Mobile-First estricto:** Cero desbordamiento horizontal (`scrollWidth - clientWidth === 0`) verificado en 320px y 390px.
- **Verificación obligatoria:** Ejecución de `npm run gen && npm run check` antes de cualquier commit o pull request.

## Seguridad

- CSP cerrada por defecto (`default-src 'none'`), sin `unsafe-inline` ni `unsafe-eval`,
  con `object-src`/`base-uri`/`form-action`/`frame-ancestors` en `'none'`. Los únicos
  orígenes de terceros permitidos son los de Google Analytics y Clarity, y solo se
  contactan tras el consentimiento. `npm test` comprueba que la misma CSP esté escrita
  en `_headers`, en `vercel.json` y en el `<meta>` de cada página.
- Cabeceras HTTP para CSP, clickjacking, MIME sniffing, referrer, permisos del
  navegador, HTTPS e aislamiento entre orígenes (`_headers` y `vercel.json`).
- Guard visual anti-frame como defensa adicional en hosts sin cabeceras configurables.
- Build de despliegue por lista blanca: documentación, logs, capturas y configuración
  interna no llegan al artefacto público.
- Canal de reporte de vulnerabilidades estándar en `/.well-known/security.txt`.
- El `id` de producto de la URL se valida contra el catálogo (whitelist); nunca
  se inyecta contenido de la URL o del usuario en el DOM.
- Enlaces externos con `rel="noopener noreferrer"`.
- Carrito: los datos de `localStorage` se limitan, revalidan, normalizan y consolidan
  contra el catálogo al cargar.
- El sitio no recoge correos ni pide datos personales en sus formularios; la analítica es opcional
  y solo se carga después del consentimiento. El pedido se entrega directamente a WhatsApp solo
  cuando la persona pulsa el botón de checkout.
- Los precios publicados incluyen IVA y son los vigentes en la tienda. Al no existir backend,
  la persona que atienda WhatsApp confirma disponibilidad, dirección de entrega y datos de la
  transferencia antes de despachar.
