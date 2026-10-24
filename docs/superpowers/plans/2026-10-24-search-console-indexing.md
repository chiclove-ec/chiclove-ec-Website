# Indexación técnica sin cambios visibles

Objetivo autorizado: corregir los problemas técnicos verificables, conservar íntegros el diseño, el contenido visible, el catálogo y las condiciones comerciales, y fusionar en GitHub tras pasar los controles. Ninguna intervención garantiza posiciones ni obliga a Google a indexar.

## Evidencia y decisiones

- Search Console (informe del 16/10): 11 indexadas; contacto, tienda y Sexual Booster Women descubiertas sin rastrear. Las cinco exclusiones por redirección son variantes correctas del dominio o de `.html`.
- Productos y fichas de comerciantes (23/10): cero elementos no válidos. No se inventarán existencias, reseñas, tiempos de entrega ni costes de devolución para eliminar avisos opcionales.
- Producción: `/producto?id=…` responde con una plantilla genérica y espera a JavaScript; los gemelos `.md` no declaran su HTML canónico por HTTP; el testigo HTML de verificación redirige.
- Se conserva la arquitectura estática y la negociación markdown. Las correcciones se aplican en el servidor, sin tocar HTML público, CSS, scripts del navegador ni imágenes. Los productos inexistentes reciben el 404 existente.
- Se trabaja en una copia aislada de la versión actual de GitHub: el checkout del escritorio está atrasado y sus lecturas Git se bloquean. No se sobrescribe ese trabajo local.

## Tareas

- [x] 1. Reproducir con pruebas: URLs heredadas válidas redirigen permanentemente en un salto, IDs ausentes/desconocidos/ambiguos devuelven 404 y el testigo responde directamente. Generar la lista permitida desde el catálogo; compartir el comportamiento entre Cloudflare y el servidor de pruebas. Mantener parámetros ajenos a `id` y no redirigir a destinos proporcionados por el visitante.
- [x] 2. Probar y añadir cabeceras canónicas para los gemelos markdown, tanto directos como negociados. Conservar los enlaces alternativos y la negociación, y aplicar `noindex` y `Vary` coherentes al 404. No canonicalizar documentos independientes hacia páginas no equivalentes.
- [x] 3. Verificar generación idempotente, suite completa, todas las URLs e imágenes del sitemap, metadatos, robots, contenido estático, enlaces y ausencia de cambios visibles. Registrar resultados y límites en un informe interno.
- [ ] 4. Revisión independiente del diff, PR con checks obligatorios, merge autorizado y comprobación del despliegue. En Search Console, comprobar las tres pendientes en vivo, solicitar su indexación y actualizar el sitemap una vez. La aceptación de solicitudes no se confundirá con indexación completada.

## Foco de revisión

GET y HEAD; IDs repetidos, desconocidos y maliciosos; parámetros de campañas; ausencia de redirecciones abiertas; códigos HTTP reales; preservación de cabeceras de seguridad y de `Vary`; canónicas absolutas correctas; documentos markdown independientes; testigo exacto; build con lista blanca; HTML y recursos visuales sin cambios. La suite inicial pasa: 199 pruebas.

## Resultado de implementación y revisión

- Nueve pruebas de regresión primero fallaron y luego pasaron; suite completa: 208/208. Generación idempotente y build de Cloudflare correctos.
- Auditoría HTTP pública: 14 páginas y 8 imágenes del sitemap con 200 directo; canónicas propias, H1 único, JSON-LD válido y páginas legítimas sin noindex.
- Navegador: carrito, apertura de WhatsApp, filtros 7/1/2, ficha heredada, promoción y relacionados correctos; menús 320/390 sin desbordamiento ni errores JavaScript.
- Ninguna diferencia en HTML público, markdown público, CSS, JavaScript del navegador, imágenes, catálogo o sitemap frente a la base 41452b9.
- Revisión independiente: se detectó que ASSETS normaliza `/404.html`; corregido a `/404`, con prueba que reprodujo el fallo y pasó después. Sin otros hallazgos importantes.
- La prueba en vivo de Google confirma que tienda y Sexual Booster Women se pueden indexar; Google aceptó ambas solicitudes de indexación. La inspección de contacto y los controles tras publicar continúan como cierre operativo de esta tarea.
- Las cinco exclusiones por redirección son correctas. Cero errores críticos de productos/comerciantes; los avisos opcionales requieren hechos comerciales o reseñas reales. Core Web Vitals no tiene aún datos de campo suficientes.
