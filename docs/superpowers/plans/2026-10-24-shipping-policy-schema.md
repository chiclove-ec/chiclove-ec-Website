# Corregir la condición del envío gratuito en los datos estructurados

El usuario autorizó corregir todos los problemas técnicos de Search Console, sin cambiar estética ni contenido visible, verificar y fusionar en GitHub. Esta corrección continúa la auditoría del PR #37.

## Causa comprobada

`OfferShippingDetails.shippingRate.value = 0` anuncia envío gratuito. El umbral `eligibleTransactionVolume.minPrice` se había colocado en `OfferShippingDetails`, que no admite esa propiedad. Google documenta las condiciones por importe mediante `Organization.hasShippingService → ShippingService.shippingConditions → ShippingConditions.orderValue.minValue`.

Fuentes oficiales consultadas el 24/10/2026:

- https://developers.google.com/search/docs/appearance/structured-data/shipping-policy
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- https://schema.org/eligibleTransactionVolume

## Implementación acotada

- [x] Probar primero que los $49,99 condicionan realmente la gratuidad, que importes inferiores no reciben una tarifa inventada y que todos los productos heredan la misma política de la tienda.
- [x] Generar una única definición compartida de `ShippingService` desde `CL_FREE_SHIPPING`. Publicarla bajo la Organization de portada y el vendedor de las fichas, con el mismo identificador. Retirar la anulación incorrecta `Offer.shippingDetails`; el envío estándar se declara en la organización, como recomienda Google.
- [x] Mantener inalterados los cuerpos HTML, títulos, descripciones, estilos, scripts del navegador, imágenes, precios, promociones y documentos públicos. No añadir stock, reseñas, plazos ni tarifas de envío bajo el mínimo.
- [ ] Ejecutar generación idempotente y suite completa; revisión independiente; PR con los controles obligatorios, merge autorizado, comprobación pública y prueba en vivo de Google.

## Foco de revisión

Límite inclusivo de $49,99, destino solo Ecuador, moneda USD, coste cero solo dentro de la condición, ausencia de tarifas o tiempos inventados, vendedor e identificadores consistentes, ninguna anulación incondicional por producto y cambios limitados a JSON-LD dentro del head.

La consulta de Search Console que estaba bloqueada ya se completó mediante el navegador conectado: no se detecta ningún problema de seguridad ni ninguna acción manual.

Verificación local: los tests de datos estructurados fallaron con el marcado anterior y pasan con el nuevo; suite completa 209/209. Generación idempotente. En los ocho HTML cambiados, al retirar los bloques JSON-LD ambos archivos son idénticos, incluidos el cuerpo y el resto del head.
