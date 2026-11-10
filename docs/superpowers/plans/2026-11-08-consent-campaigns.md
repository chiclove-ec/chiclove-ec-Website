# Consentimiento de analítica y medición de campañas

El diagnóstico oficial de Google de tasa 0 % se activa por `ad_user_data` siempre rechazado. La analítica estaba concedida correctamente, pero el banner no ofrecía la finalidad publicitaria. El usuario eligió explícitamente añadir medición de campañas opcional.

## Contrato aprobado

- Tres acciones claras: Rechazar, Solo analítica, Analítica y campañas.
- Antes de elegir: cuatro permisos de Consent Mode v2 rechazados y ninguna carga de proveedores.
- Solo analítica: `analytics_storage=granted`; los otros tres rechazados.
- Analítica y campañas: `analytics_storage`, `ad_storage` y `ad_user_data` concedidos; `ad_personalization` rechazado. La personalización y Google Signals siguen desactivados.
- Preferencias v2 persistidas atómicamente y compatibilidad con la elección antigua. Nunca ampliar un consentimiento previo a campañas.
- Al visitante que aceptó la versión antigua se le ofrece la nueva opción conservando su permiso analítico. Un rechazo previo se respeta sin volver a mostrar el banner automáticamente.
- Actualizaciones completas de las cuatro señales antes de configurar Google y al cambiar, revocar o sincronizar pestañas.
- Retirar campañas elimina cookies `_gcl_*`; rechazar todo elimina también cookies analíticas y detiene eventos.

## Ejecución

- [x] Ver fallar pruebas de defaults, finalidades, persistencia, migración y revocación.
- [x] Implementar en `js/analytics.js`, ajustar el banner móvil y actualizar privacidad, README y caché.
- [x] Ejecutar pruebas, generación idempotente y revisión independiente.
- [ ] Verificar en navegador las tres opciones y la persistencia; publicar la corrección y comparar las señales reales de Google.

El diagnóstico de Google usa datos procesados: no fingir consentimiento ni prometer que una alerta histórica se borre al instante. Fuentes: https://support.google.com/analytics/answer/14681508 y https://developers.google.com/tag-platform/security/guides/consent .

Validación local: 251 pruebas correctas, 23 de eventos/consentimiento, navegador a 1280/390/320 px sin desbordamiento, cookies y dos pestañas comprobadas. La revisión detectó retirada heredada y restauración bfcache; ambos casos quedaron cubiertos por pruebas RED→GREEN.
