# Analítica e informe de marketing

**Goal:** Medir con precisión el recorrido consentido del catálogo a WhatsApp y entregar a marketing un correo legible con detalle suficiente para profundizar.

**Architecture:** Mantener JavaScript estático y Python estándar. Eventos con contexto estable y parámetros permitidos; informes GA4 agregados con resumen semanal, comparación anterior y detalle de 28 días. Correo con tablas compatibles y exportaciones CSV adjuntas.

**Decisiones:** La petición «No pares» autoriza ejecución continua con las convenciones actuales. El contacto comercial sigue siendo marketing@laboratorioslira.com. No hay compras confirmadas en esta web: WhatsApp mide intención. Respetar consentimiento, exclusión de datos personales, límites de parámetros y coste de observadores.

**Alternativas:** Recoger indiscriminadamente cada clic produce ruido y riesgo de datos personales; añadir un almacén de sesiones requiere infraestructura ajena. Se amplía la arquitectura existente con eventos semánticos, exposiciones reales y exportación agregada.

## Task 1: Medición fiable

- [x] Añadir pruebas ejecutables de consentimiento, contexto, URLs limpias, aceptación tardía, exposición, scroll, revocación y aperturas de WhatsApp.
- [x] Ejecutarlas y comprobar el fallo antes de implementar.
- [x] Ampliar `js/analytics.js`, `js/main.js`, `js/product-page.js`: adquisición segura, navegación, FAQ, secciones, listas, variantes, cantidades, tiempos visibles, rendimiento y fallos técnicos acotados.
- [x] Corregir cantidades efectivamente añadidas y checkout; evitar duplicados y conservar página inicial tras aceptar.
- [x] Pasar pruebas de eventos.

## Task 2: Informe profundo y limpio

- [x] Añadir pruebas de consultas, filtros, paginación, metadatos, cálculos sin datos, escape HTML/CSV y MIME.
- [x] Ejecutarlas y comprobar fallos.
- [x] Ampliar `scripts/analytics_report.py`: fuentes/medios, campañas, entradas, páginas, dispositivos, ciudades, horarios, eventos por página y parámetros disponibles por metadata; límites explícitos, advertencias y detalle CSV.
- [x] Renovar el correo con indicadores comparables, intención comercial, tasas con denominadores claros, tablas y barras HTML, texto alternativo completo y CSV agregados. No interpretar acciones como embudo secuencial ni valor como ingresos.
- [x] Pasar pruebas de informe.

## Task 3: Validación e integración

- [x] Actualizar README, privacidad y caché de scripts.
- [x] Ejecutar `npm run check`, generación idempotente y pruebas reales en navegador, incluyendo móvil y vistas del correo.
- [x] Revisión independiente de las modificaciones y correcciones verificadas.
- [x] Dejar cambios listos; comprobar acceso a configuración y publicación existente sin revelar secretos ni enviar correos de prueba no solicitados.

## Review focus

- Aceptar después de cargar no debe perder el producto ni la lista; rechazar no debe cargar proveedores.
- No enviar querystrings, contenido libre ni mensajes de WhatsApp; limpiar también valores automáticos de gtag.
- Un bloqueador de ventanas no genera intención de lead; `noopener` no permite usar un retorno nulo como señal de fallo.
- Una dimensión opcional sin registrar no debe impedir el correo; una consulta fallida no debe convertirse en un cero.
- Una tabla truncada o sometida a umbrales debe declararlo; los porcentajes usan unidades y periodos compatibles.

## Evidencia de cierre de la implementación

- `npm run check`: 241 pruebas correctas; generación de catálogo idempotente.
- Pruebas de navegador: aceptación tardía, ficha única, catálogo filtrado, escena activa de portada y móvil sin desbordamiento.
- Correo HTML con barras de tendencia y tablas accesibles; datos reales de GA4 reensamblados desde los CSV de la validación, 59.389 bytes.
- Consultas reales sin envío: https://github.com/chiclove-ec/chiclove-ec-Website/actions/runs/42434421104
- Revisión independiente completada y hallazgos corregidos con pruebas.
- GA4 configurado: diez dimensiones, métrica de tiempos, objetivo de intención, retención de eventos de 14 meses y protección de URLs.

## Integración pendiente

La PR https://github.com/chiclove-ec/chiclove-ec-Website/pull/49 sigue pendiente de autorización para fusionarse en `main`. La publicación de la web y la activación del nuevo correo semanal no se consideran completadas hasta la fusión y su verificación en producción. No se han enviado correos de prueba.
