# Que el carrito termine en pedido: desbloqueo, fricción y confianza

**Problema:** las visitas ven productos, los añaden y abren el carrito, pero no llegan pedidos por
WhatsApp ni pagos. El dueño percibe además desconfianza hacia la marca.

**Objetivo:** que quien abre el carrito pueda enviar el pedido sin obstáculos, sepa qué pasa después y
confíe lo suficiente para pagar. No se pierde nada de lo que ya tiene el sitio: estética, promociones,
catálogo, capa para agentes y privacidad.

**Fecha límite útil:** Black Days empieza el **27 de noviembre de 2026** (`CL_PROMO_CALENDAR`). Es la
ventana de más tráfico del año. Las fases 0 y 1 deberían estar publicadas antes del 20 de noviembre para
tener una semana de datos limpios antes de esa fecha.

**Historial:** diagnóstico inicial el 8 de noviembre de 2026; revisado en producción el **10 de
noviembre de 2026**, después de publicar las PR #49 (analítica) y #50 (consentimiento).

**Estado (10 de noviembre de 2026):** las fases 0 y 1 están implementadas en la rama
`codex/checkout-sin-friccion`, salvo lo que depende del dueño (P0.2) y la prueba en teléfonos reales
(P0.3). Las vigila `tests/checkout-conversion.test.mjs`, y se verificaron en navegador a 320×568,
320×640, 360×640, 375×667, 360×780, 390×844, 430×932, 768×1024, 1024×768, 1280×800 y 1440×900:

- con el consentimiento sin decidir, ni el botón del carrito ni la barra fija de la ficha quedan
  tapados;
- WhatsApp recibe el mensaje nuevo, el plan B aparece y «Copiar pedido» copia el mismo texto;
- no hay desbordamiento horizontal.

La fase 2 sigue pendiente de las decisiones del negocio.

---

## 1. Qué dicen los datos (y qué no)

Fuente: GA4, vista previa del informe semanal sin envío de correo
([run 42911508697](https://github.com/chiclove-ec/chiclove-ec-Website/actions/runs/42911508697)),
del 12 de octubre al 8 de noviembre de 2026. **Solo cuenta a quien aceptó la analítica.**

| Paso | Personas (28 días) | Eventos |
| --- | --- | --- |
| Visitas con consentimiento | 36 (61 sesiones) | — |
| Ven una ficha (`view_item`) | 14 | 33 |
| Añaden al carrito (`add_to_cart`) | **4** | 13 |
| Abren el carrito (`view_cart`) | **4** | 16 |
| Pasan a WhatsApp (`begin_checkout`) | 0 | 0 |

- **Móvil:** 29 de 36 personas (81 %). Ordenador: 7 personas, pero 23 de 61 sesiones (38 %).
- **Origen:** directo 22 sesiones, redes sociales sin pago 22 (Facebook 11, Instagram 11), Google 15 y
  un primer anuncio de Facebook (`fb / paid`, 1 sesión). Navegador integrado de Android (Instagram o
  Facebook): 7 sesiones.
- **Ciudades:** Quito 18 personas y Guayaquil 9, es decir, 27 de 36 (75 %).
- **Productos añadidos:** Radiant Skin (7 unidades), Hair & Nails (3) y Vinagre (3), siempre en frasco
  suelto.

### Lo que esto permite concluir

1. **«Nadie pasa a WhatsApp» no estaba medido.** `begin_checkout` no se pudo registrar nunca hasta la
   PR #49, publicada el 8 de noviembre: `window.open` con `noopener` devuelve `null`. El 10 de noviembre
   se comprobó en producción que ya se registra (`add_to_cart → view_cart → begin_checkout →
   generate_lead`).
2. **Cuatro personas no bastan para medir una tasa de abandono.** Si una de cada tres terminara el pedido
   con normalidad, ver 0 de 4 seguiría pasando una de cada cinco veces. Hay además señales de pruebas
   internas: una sola persona hizo 8 `remove_from_cart` en una semana, y Quito suma 41 sesiones de 18
   personas, en la misma ciudad que la empresa. No está claro que el tráfico interno esté filtrado.
3. **Lo que GA4 no ve es lo más grave.** Quien no decide en el aviso de privacidad no aparece en la
   analítica. Ese grupo tiene el botón de compra tapado (punto 2.1). No se sabe cuántas personas son:
   Cloudflare sí lo sabe (visitas totales sin cookies).
4. **El volumen es muy bajo.** Con unas 36 personas medidas al mes, incluso un checkout perfecto daría
   pocos pedidos. Arreglar el checkout es necesario, pero no basta: Black Days necesita tráfico.

---

## 2. Problemas comprobados

Todo lo de esta sección se verificó el 10 de noviembre de 2026 en https://chiclove-ec.com con Playwright
(Chrome, sin enviar datos a Google ni a Clarity) o se leyó en el código de `main`.

### 2.1 El aviso de privacidad tapa el botón de compra · BLOQUEANTE

`.cl-consent-banner` va fijo abajo con `z-index: 1000`; el carrito (`.cart-drawer`) tiene `z-index: 90`.
Mientras no se pulse ninguna opción, el aviso queda encima de «Finalizar pedido por WhatsApp». Desde la PR
#50 tiene tres botones y es **más alto que el 8 de noviembre**.

Resultado de `elementFromPoint` sobre el centro y los extremos de `#cart-checkout`, con el
consentimiento sin decidir:

| Pantalla | Alto del aviso | Botón del carrito | Barra fija «Añadir» de la ficha |
| --- | --- | --- | --- |
| 320×640 | 255 px | **tapado del todo** | **tapada** |
| 390×844 | 237 px | **tapado del todo** | **tapada** |
| 430×932 | 237 px | **tapado del todo** | **tapada** |
| 768×1024 | 179 px | tapado en parte (centro e izquierda) | — |
| 1024×768 y 1280×800 | 179 px | tapado en el centro | — |
| 1440×900 | 179 px | libre | — |

En la captura a 390 px se ve el total ($23,99 + envío) y, debajo, el aviso. **El botón verde no
aparece.** Además, al abrir el carrito, el foco del teclado queda atrapado dentro del carrito
(`trapDialogFocus`) y el aviso es inalcanzable con el tabulador. Los navegadores integrados de Instagram
y Facebook pueden olvidar la elección guardada en `localStorage`, así que el aviso vuelve a salir.

### 2.2 El mensaje de WhatsApp parece un formulario

Mensaje real con 2 frascos (356 caracteres):

```text
Hola Chic&Love, quiero hacer este pedido:


*PEDIDO*


*Anti-Stress Gummies*
2 frascos - *$47.98*
Promo −20% aplicada


*TOTAL: $47.98* + envío (IVA incluido)
Los precios publicados incluyen IVA. Confirmaremos disponibilidad, dirección de entrega y datos para la transferencia.


*DATOS DE ENTREGA*
Nombre:
Teléfono:
Cédula / RUC:
Email:
Ciudad:
Dirección:
```

- Pide **seis datos personales**, entre ellos cédula, correo y dirección, a un número desconocido y antes
  de que la tienda haya contestado.
- El teléfono sobra: la tienda lo ve en el chat.
- Para rellenarlo hay que editar, línea por línea, un texto largo en el cuadro de WhatsApp del móvil. Los
  saltos de línea dobles lo alargan todavía más.
- Ninguna prueba cubre el contenido del mensaje.

### 2.3 El costo total es una incógnita, y la promo deja dos frascos sin envío gratis

- El carrito dice «$47.98 + envío». **Ninguna página da el importe del envío ni el plazo.** La ficha
  promete «Entrega rápida» sin un plazo que la respalde. /terms: «el costo de envío se te indica al
  confirmar».
- Con las promos de frasco suelto (`singleOnly`), dos frascos ya no llegan al envío gratis de $49,99:

| Periodo | 2 frascos | Faltan para el envío gratis |
| --- | --- | --- |
| Noviembre ($23,99) | $47,98 | $2,01 |
| **Black Days ($20,99)** | $41,98 | **$8,01** |
| Cyber Days ($18,00) | $36,00 | $13,99 |
| Sin promo (pack x2) | $49,99 | — (envío gratis) |

  Sin promo, el pack x2 tenía envío gratis. Con la promo, dos frascos pagan un envío de importe
  desconocido y el carrito empuja a comprar un tercero por $2,01. Según cuánto cueste ese envío, la promo
  puede salir más cara que el precio normal.

### 2.4 Solo se puede pagar por transferencia anticipada

- Única forma de pago: transferencia a una cuenta que se comunica por WhatsApp, antes del despacho
  (/terms, /about, ficha y portada).
- No se dice a nombre de quién está la cuenta.
- La portada lo vende como ventaja («Paga con transferencia»).

### 2.5 La empresa real no aparece donde se decide la compra

Vende **Laboratorios Lira S.A.** (RUC 1790336352001, José Vinueza E8-152, Quito, dos teléfonos fijos, en
`CL_LEGAL`). Es lo más creíble que tiene la marca y solo aparece en el pie, en /about y en /terms. No
aparece en el carrito ni en la ficha. /contact sí avisa de suplantaciones: «verifícalo aquí antes de
transferir dinero».

### 2.6 Afirmaciones de confianza sin respaldo visible

- «+1.200 clientes felices en Ecuador» sin una sola reseña en el sitio.
- Seis sellos (NSF, Organic UE, FDA Registered, IFS, GMP, BRCGS) sin fabricante, número ni enlace para
  comprobarlos.
- No se ve la **notificación sanitaria ARCSA** en ninguna página.

### 2.7 En ordenador, WhatsApp añade una pantalla intermedia

`wa.me` lleva a `api.whatsapp.com/send`, que muestra «Open app» y «Continue to WhatsApp Web». Quien no
tiene WhatsApp Web vinculado tiene que escanear un código QR con el móvil. Ese es el 38 % de las
sesiones. El perfil de empresa sí está bien configurado: aparece «Chic Love Ecuador».

### 2.8 El carrito no explica qué pasa después ni tiene plan B

- Botón: «Finalizar pedido por WhatsApp». Suena a compromiso cerrado.
- Nota: «Antes de confirmar podrás revisar el total de tu compra». No explica que todavía no se paga,
  quién responde ni cuándo.
- Si WhatsApp no se abre (navegador integrado, ordenador sin la app, ventana bloqueada), solo aparece un
  aviso efímero. No hay número visible ni forma de copiar el pedido.

---

## 3. Hipótesis (sin comprobar; cómo comprobarlas)

| # | Hipótesis | Plausibilidad | Cómo comprobarla |
| --- | --- | --- | --- |
| H1 | Gran parte de las visitas móviles nunca pulsa el aviso y por eso no puede comprar | Alta | Comparar las visitas totales de Cloudflare Web Analytics con los usuarios de GA4 de la misma semana |
| H2 | Entre quienes sí ven el botón, el freno principal es pagar por adelantado a una marca nueva | Alta | Preguntar en el seguimiento de 24 h (fase 3); medir el cambio al ofrecer link de pago o contra entrega |
| H3 | El envío de importe desconocido frena carritos de menos de $49,99 | Alta | Comparar el valor de los carritos que pasan a WhatsApp antes y después de publicar la tarifa |
| H4 | El navegador integrado de Instagram/Facebook no abre la app de WhatsApp con `about:blank` + `location.replace` | Media | Probar en teléfonos reales (iPhone y Android, Instagram y Facebook) y medir `checkout_error` |
| H5 | Parte de los carritos de GA4 son pruebas del equipo | Media | Filtro de tráfico interno en GA4 por IP de la oficina |
| H6 | La venta se pierde **después** de enviar el mensaje (tiempo de respuesta, pago) | Desconocida | Contar chats «Pedido web» y pedidos pagados (fase 3) |
| H7 | El cuello de botella real es el tráfico, no el checkout | Alta | Visitas totales de Cloudflare; volumen de Black Days |

### Contexto externo que respalda H2 y H3

- [Baymard Institute](https://baymard.com/lists/cart-abandonment-rate): el abandono medio documentado de
  carritos es del 70,22 %. Entre los motivos durante el checkout están los costos extra demasiado altos
  (40 %), la entrega demasiado lenta (20 %), la desconfianza al dar datos de pago (19 %), no poder
  calcular el costo total por adelantado (12 %) y la falta de formas de pago (9 %).
- [Estudio de Transacciones No Presenciales CECE–UEES, publicado por Vistazo el 4 de febrero de
  2025](https://www.vistazo.com/portafolio/economia/whatsapp-aplicacion-preferida-ecuatorianos-realizar-compras-linea-GE8732594):
  WhatsApp es la app preferida para comprar en línea en Ecuador (74 %). Los medios de pago preferidos son
  la tarjeta de crédito (44 %) y la de débito (31 %); el efectivo contra entrega y los depósitos tienen
  menos peso. Una compradora citada: «Siempre me guío por los comentarios previos».

Conclusión: **WhatsApp como canal es correcto en Ecuador.** Lo que falla es todo lo que lo rodea: el
botón tapado, el mensaje-formulario, el costo desconocido y una forma de pago que no es la preferida y
exige confiar a ciegas.

---

## 4. Plan priorizado

Orden: primero lo que bloquea (seguro y barato), luego lo que quita fricción (barato y sin decisiones del
negocio) y después lo que da confianza (mayor impacto potencial, pero depende del dueño).

| Prioridad | Acción | Base | Impacto | Esfuerzo | Depende de |
| --- | --- | --- | --- | --- | --- |
| **P0.1** | El aviso de privacidad nunca tapa una acción de compra | Comprobado (2.1) | Bloqueante | Bajo | — |
| **P0.2** | Contar pedidos reales y visitas totales | Comprobado (1) | Necesario para medir | Bajo | Dueño |
| **P0.3** | Plan B si WhatsApp no se abre + prueba en teléfonos reales | 2.7, 2.8, H4 | Medio-alto | Bajo | — |
| **P1.1** | Mensaje corto, sin formulario | Comprobado (2.2) | Alto | Bajo | — |
| **P1.2** | «Así sigue tu pedido» y botón «Enviar pedido» | Comprobado (2.8) | Alto | Bajo | — |
| **P1.3** | Empresa y devoluciones visibles en carrito y ficha | Comprobado (2.5) | Medio | Bajo | — |
| **P2.1** | Envío: tarifa y plazo visibles; envío gratis coherente con la promo | Comprobado (2.3) + H3 | Alto | Bajo técnico | Decisión 1, 2 |
| **P2.2** | Pago con tarjeta por link y/o contra entrega en Quito y Guayaquil | 2.4 + H2 + CECE | Muy alto | Medio | Decisión 3 |
| **P2.3** | Cuenta a nombre de la empresa y aviso antifraude en el carrito | 2.4 | Medio | Bajo | Decisión 4 |
| **P2.4** | Confianza verificable: ARCSA, sellos, «+1.200», reseñas reales | Comprobado (2.6) | Medio | Medio | Decisión 5, 6 |
| **P2.5** | Horario y tiempo de respuesta publicados | 2.8 | Medio | Bajo | Decisión 7 |
| **P3** | Embudo semanal, seguimiento a 24 h y comparación antes/después | H6 | Medio | Bajo | Operación |

### Fase 0 — Desbloquear y poder medir (esta semana, sin decisiones del negocio)

- [x] **P0.1 · Prueba primero:** con el consentimiento sin decidir, a 320, 390, 430, 768,
  1024 y 1280 px, `elementFromPoint` en el centro y en los extremos de `#cart-checkout` devuelve el propio
  botón. Lo mismo para el botón de `.pd-sticky.show` en móvil.
- [x] **P0.1 · El aviso no tapa nunca una acción de compra:**
  - con el carrito o el menú abiertos (`body.ui-locked`), el aviso se oculta y vuelve al cerrarlos.
    Ocultarlo no cambia nada legalmente: sin decisión no se carga ningún proveedor;
  - en las fichas, con `.pd-sticky.show`, el aviso se coloca por encima de la barra;
  - mientras el aviso está abierto, el pie de la página tiene margen inferior para que los datos
    legales se lean por encima;
  - se mantienen el texto y las **tres** opciones de la PR #50 (Rechazar, Solo analítica,
    Analítica y campañas), con el mismo orden y peso. No hizo falta una versión compacta: el aviso
    ya no coincide con ninguna acción de compra;
  - mismos tokens, radios, píldoras y altura táctil de 44 px; sin desbordamiento horizontal a 320 px.
- [ ] **P0.2 · Contar lo que GA4 no ve** (el dueño, sin código):
  - etiqueta «Pedido web» en WhatsApp Business para cada chat que empiece por «quiero hacer este
    pedido», y una hoja semanal con tres columnas: chats «Pedido web», pedidos pagados y valor pagado;
  - visitas totales de la semana en Cloudflare (Web Analytics o métricas de Pages), para estimar qué
    parte del tráfico es invisible en GA4 (H1);
  - filtro de tráfico interno en GA4 por la IP de la oficina y de quien prueba el sitio (H5).
- [x] **P0.3 · Plan B en el carrito:** tras pulsar el botón, el pie del carrito muestra «¿No se abrió
  WhatsApp? Escríbenos al +593…» con:
  - **Copiar pedido:** `navigator.clipboard`, y si no está, `execCommand`; el mismo texto del mensaje;
  - **Abrir de nuevo:** un enlace `<a>` real con el pedido, que los navegadores integrados sí siguen.

  Sirve para ordenadores sin la app y para navegadores integrados. No hace falta un evento nuevo: se
  mide como `button_click` (`element_id=cart-copy-order`) y `whatsapp_click`
  (`link_context=cart_fallback`), sin contenido del mensaje (regla 11).
- [ ] **P0.3 · Prueba en teléfonos reales,** antes de Black Days: Safari en iPhone, Chrome en Android y
  los navegadores integrados de Instagram y Facebook, abriendo desde la bio y desde un anuncio. Debe
  abrirse **la app** de WhatsApp con el mensaje. Si alguno se queda en la página «Open app», en móvil hay
  que navegar en la misma pestaña o con un enlace `<a>` real y enviar el evento antes de salir.
- [x] Subir el token `?v=` en todas las páginas (`20261110-1`), `npm run check` en verde y la skill
  `verify` a 320, 390 y 768 px.

### Fase 1 — Quitar fricción al paso a WhatsApp (sin decisiones del negocio)

- [x] **P1.1 · Mensaje corto, sin formulario.** Solo pedido, total y una pregunta. WhatsApp deja el
  cursor al final del texto: el único dato que se pide va en la última línea, para que baste con
  escribirlo.

  ```text
  Hola Chic&Love, quiero hacer este pedido:

  2 frascos de *Anti-Stress Gummies*: $47.98 (promo −20%)

  *Total: $47.98* más envío, IVA incluido
  ¿Me confirman disponibilidad y el costo de envío? Mi ciudad es:
  ```

  Nombre, dirección, cédula (solo si hace falta para la factura) y correo se piden en la conversación,
  cuando la tienda ya ha respondido. Sin emojis en la URL (regla 9). Prueba nueva: el mensaje lleva
  producto, cantidad, precio vigente (promo incluida) y total, y **no** lleva campos de datos personales.
- [x] **P1.2 · «Así sigue tu pedido», en el carrito, encima del botón** (tres líneas, mismos tokens):
  1. Se abre WhatsApp con tu pedido ya escrito. Solo envíalo.
  2. Te confirmamos disponibilidad y costo de envío en horario laboral («y entrega» cuando el
     envío es gratis; el horario laboral sale de /contact).
  3. Pagas por transferencia solo cuando confirmemos tu pedido.

  El 11 de noviembre se reescribieron a petición del dueño. El texto anterior («enviarlo no tiene
  costo») hacía pensar que el envío era gratis, y los separadores «·» del mensaje y de la línea
  del vendedor se sustituyeron por frases normales.

  Sustituye a «Antes de confirmar podrás revisar el total de tu compra». En pantallas de 720 px de
  alto o menos, los pasos van justo debajo del botón, para que el botón se vea sin desplazar.
- [x] **P1.2 · Texto del botón:** «Enviar pedido por WhatsApp» en lugar de «Finalizar pedido por
  WhatsApp». «Finalizar pedido» aparece también en el FAQ visible de la portada, en /contact, /terms,
  /about y /privacy, y en `scripts/gen-products.mjs` y `scripts/lib/agent-docs.mjs`. Hay que cambiarlo en
  todos los sitios y ejecutar `npm run gen` (regla 2). En el texto legal del carrito, «Al enviar tu
  pedido aceptas…».
- [x] **P1.3 · La empresa a la vista donde se decide.** En el pie del carrito y en `.pd-assurance`:
  «Vende Laboratorios Lira S.A., laboratorio ecuatoriano desde 1977. RUC 1790336352001.», con
  `clSellerLine()` desde `CL_LEGAL`, y el enlace «Comprueba nuestro WhatsApp en
  laboratorioslira.com» (`CL_LEGAL.whatsappVerifyUrl`). Fuentes: laboratorioslira.com/conocenos
  («Se constituyó en septiembre de 1977») y laboratorioslira.com/chic-and-love, que publica este
  mismo número como «Contacto Ventas Directas». Se mide como `navigation_click` con
  `link_context=seller_verify`. En la ficha va debajo de `.pd-assurance` (`data-seller-line`).
  En móvil se ve aunque `.pd-assurance` siga oculto.
- [x] **P1.3 · Salida de bajo compromiso:** píldora «¿Dudas? Pregúntanos» en la cabecera del carrito,
  junto a cerrar, sin restar altura al pie. Es `data-whatsapp-link` con
  `data-analytics-context="cart_help"`.
- [x] **«Entrega rápida» → «Envío a todo el Ecuador»** con el umbral de envío gratis
  (`data-free-shipping-short`), hasta tener un plazo real (P2.1).

### Fase 2 — Confianza y costo total (necesita decisiones del negocio; publicar antes del 27 de noviembre)

Cada punto se publica solo si es verdad y se puede comprobar. Nada inventado: sin reseñas falsas, sin
plazos ni certificaciones sin fuente (`CLAUDE.md`).

- [ ] **P2.1 · Envío concreto:** tarifa (por ejemplo, Quito / Guayaquil / resto del país), plazo habitual
  y transportista con número de guía, en `js/products.js`. Sustituye a «+ envío» y a «se indica al
  confirmar» en el carrito, la ficha, /terms y la capa para agentes (`npm run gen`).
- [ ] **P2.1 · Envío gratis coherente con la promo,** antes de Black Days. Hay dos opciones:
  - **«Envío gratis desde 2 frascos»:** se entiende de inmediato y vale en todas las ventanas;
  - umbral **≤ $36,00** durante las promos.

  El umbral vive en `CL_FREE_SHIPPING` y en el `ShippingService` de los datos estructurados: cambiarlo
  afecta a ambos, y las pruebas de datos estructurados lo vigilan.
- [ ] **P2.2 · Una forma de pago que no exija confiar a ciegas.** Es la palanca más fuerte, y el 75 % de
  los compradores ecuatorianos prefiere tarjeta (CECE–UEES). En orden de impacto:
  - **link de pago con tarjeta enviado por WhatsApp** (Payphone, Datafast, Kushki, De Una u otra
    pasarela local). No integra nada en la web: la CSP y la lista blanca no cambian;
  - **contra entrega en Quito y Guayaquil**, que suman el 75 % de las visitas medidas, si el
    transportista recauda;
  - la transferencia sigue disponible para quien la prefiera.

  Una vez decidido, cambiar «Paga con transferencia» en portada, ficha, /terms, /about y la capa para
  agentes. /terms dice hoy «No solicitamos datos de tarjeta en ningún momento ni por ningún canal», y
  /about, «ninguna página pide datos de tarjeta». Con un link de pago, la de /about sigue siendo cierta,
  pero la de /terms ya no. Hay que **reescribirla** («los datos de tarjeta solo se introducen en la página
  de la pasarela; nunca te los pediremos por chat»), no borrarla: es un aviso antifraude.
- [ ] **P2.3 · Si se paga por transferencia:** decir **a nombre de quién** está la cuenta (razón social y
  RUC) y añadir en el carrito «Solo pagamos a cuentas de Laboratorios Lira S.A. Nunca a cuentas
  personales», enlazado a /contact.
- [ ] **P2.4 · Factura electrónica del SRI:** si se emite, decirlo en el carrito y en /terms.
- [ ] **P2.4 · Notificación sanitaria ARCSA** de cada fórmula, en la ficha, como dato de `CL_PRODUCTS`
  (sale también en `catalog.json` y en el markdown).
- [ ] **P2.4 · Sellos verificables:** nombrar al fabricante y enlazar o numerar cada sello. Retirar los que
  no se puedan demostrar, sobre todo «Organic UE».
- [ ] **P2.4 · «+1.200 clientes felices»:** respaldarla (registro de ventas) o retirarla.
- [ ] **P2.4 · Prueba social real:** pedir reseña por WhatsApp a cada cliente tras la entrega, completar el
  perfil de Google Business Profile y publicar en la ficha reseñas reales con nombre de pila, ciudad y
  fecha, con permiso. Solo entonces se relaja `tests/structured-data.test.mjs` (ver el gotcha de
  `aggregateRating`).
- [ ] **P2.5 · Atención:** horario real en el carrito («Respondemos de lunes a viernes de … a …»).
  WhatsApp Business con horario, dirección, web y catálogo, y un saludo automático que diga quién atiende
  y cuándo responde.

### Fase 3 — Medir y recuperar

- [ ] **Embudo semanal de tres números comparables:** `begin_checkout` en GA4 (ya funciona), chats
  «Pedido web» y pedidos pagados. Dice en qué tramo se pierde la venta: en la web, en el chat o en el pago.
- [ ] **Seguimiento único y amable a las 24 h** a quien escribió y no pagó, con una pregunta abierta
  sobre qué le frenó (alimenta H2 y H3).
- [ ] **Comparar dos semanas antes y dos después de cada fase.** No hay tráfico para pruebas A/B. Ojo: lo
  que arregla P0.1 **no se verá en GA4**, porque esas visitas no dieron consentimiento. Solo lo mostrarán
  los chats «Pedido web».

---

## 5. Cómo se mide el éxito

| Métrica | Fuente | Hoy | Objetivo razonable |
| --- | --- | --- | --- |
| Botón de compra visible con el aviso sin decidir | Prueba automática | 0 de 3 móviles | 6 de 6 anchos |
| `begin_checkout` / `view_cart` (personas con consentimiento) | GA4 | Sin datos (medible desde el 8 de noviembre) | Línea base en 2 semanas |
| Chats «Pedido web» por semana | WhatsApp Business | Sin contar | Línea base y luego en subida |
| Pedidos pagados / chats «Pedido web» | Hoja semanal | Sin contar | Línea base |
| `button_click` `cart-copy-order` + `whatsapp_click` `cart_fallback` + `checkout_error` | GA4 | — | Revelan fallos de apertura |

Con este volumen, los porcentajes van a saltar mucho de una semana a otra. Hay que mirar conteos
absolutos y tendencias de varias semanas, no una tasa suelta.

---

## 6. Qué no cambia

La estética y el sistema de diseño (tokens, radios, píldoras, `.reveal`); el catálogo, los precios y las
promociones automáticas; WhatsApp como canal de venta; las tres opciones del consentimiento y que
rechazar no cargue proveedores; la capa para agentes; las reglas de analítica (solo contexto agregado,
nunca mensaje, teléfono ni dirección; `begin_checkout` no es `purchase`).

## 7. Alternativas descartadas

- **Formulario de datos en la web antes de WhatsApp:** añade un paso, recoge datos personales en el sitio
  y obliga a revisar privacidad. Va en contra de lo que se busca.
- **Pasarela de pago integrada en la web:** cambia la CSP, añade dependencias y responsabilidades sobre
  los datos de tarjeta. Un link de pago por WhatsApp da el mismo beneficio sin tocar la web.
- **Contadores de urgencia, «quedan 3 unidades» o reseñas de ejemplo:** son falsos o no verificables,
  dañan la confianza que se intenta construir y van contra las reglas del repositorio.
- **Pruebas A/B:** no hay tráfico suficiente. Se compara antes y después.

## 8. Decisiones pendientes del negocio

Ordenadas por impacto, antes del 20 de noviembre:

1. Tarifa de envío y plazo habitual por zona, y transportista.
2. Envío gratis durante las promos: ¿«desde 2 frascos» o umbral ≤ $36?
3. ¿Link de pago con tarjeta (qué pasarela) y/o contra entrega en Quito y Guayaquil?
4. ¿A nombre de quién está la cuenta de la transferencia? ¿Se emite factura electrónica?
5. Número de notificación sanitaria ARCSA de cada fórmula.
6. ¿De dónde sale «+1.200 clientes»? ¿Qué sellos se pueden documentar y con qué número o enlace?
7. Horario real de atención por WhatsApp y quién responde.

## 9. Foco de revisión

- Ningún elemento fijo puede tapar `#cart-checkout` ni `.pd-sticky` en ningún ancho, con el
  consentimiento sin decidir, aceptado o rechazado.
- El paso a WhatsApp abre la app en teléfonos reales, incluidos los navegadores integrados, y se mide una
  sola vez. Un bloqueo de ventana no cuenta como lead.
- El mensaje sigue llevando producto, cantidad, precio vigente (promo incluida) y total, sin emojis y sin
  datos personales en la analítica.
- Cada dato de confianza nuevo sale de `js/products.js` y tiene fuente; nada se publica «por si acaso».
