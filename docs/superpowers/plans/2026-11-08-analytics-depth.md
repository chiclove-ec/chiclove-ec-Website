# Analítica e informe de marketing

**Goal:** Medir con precisión el recorrido consentido del catálogo a WhatsApp y entregar a marketing un correo legible con detalle suficiente para profundizar.

**Architecture:** Mantener JavaScript estático y Python estándar. Eventos con contexto estable y parámetros permitidos; informes GA4 agregados con resumen semanal, comparación anterior y detalle de 28 días. Correo con tablas compatibles y exportaciones CSV adjuntas.

**Decisiones:** La petición «No pares» autoriza ejecución continua con las convenciones actuales. El contacto comercial sigue siendo marketing@laboratorioslira.com. No hay compras confirmadas en esta web: WhatsApp mide intención. Respetar consentimiento, exclusión de datos personales, límites de parámetros y coste de observadores.

**Alternativas:** Recoger indiscriminadamente cada clic produce ruido y riesgo de datos personales; añadir un almacén de sesiones requiere infraestructura ajena. Se amplía la arquitectura existente con eventos semánticos, exposiciones reales y exportación agregada.

## Task 1: Medición fiable

- [ ] Añadir pruebas ejecutables de consentimiento, contexto, URLs limpias, aceptación tardía, exposición, scroll, revocación y aperturas de WhatsApp.
- [ ] Ejecutarlas y comprobar el fallo antes de implementar.
- [ ] Ampliar `js/analytics.js`, `js/main.js`, `js/product-page.js`: adquisición segura, navegación, FAQ, secciones, listas, variantes, cantidades, tiempos visibles, rendimiento y fallos técnicos acotados.
- [ ] Corregir cantidades efectivamente añadidas y checkout; evitar duplicados y conservar página inicial tras aceptar.
- [ ] Pasar pruebas de eventos.

## Task 2: Informe profundo y limpio

- [ ] Añadir pruebas de consultas, filtros, paginación, metadatos, cálculos sin datos, escape HTML/CSV y MIME.
- [ ] Ejecutarlas y comprobar fallos.
- [ ] Ampliar `scripts/analytics_report.py`: fuentes/medios, campañas, entradas, páginas, dispositivos, ciudades, horarios, eventos por página y parámetros disponibles por metadata; límites explícitos, advertencias y detalle CSV.
- [ ] Renovar el correo con indicadores comparables, intención comercial, tasas con denominadores claros, tablas y barras HTML, texto alternativo completo y CSV agregados. No interpretar acciones como embudo secuencial ni valor como ingresos.
- [ ] Pasar pruebas de informe.

## Task 3: Validación e integración

- [ ] Actualizar README, privacidad y caché de scripts.
- [ ] Ejecutar `npm run check`, generación idempotente y pruebas reales en navegador, incluyendo móvil y vistas del correo.
- [ ] Revisión independiente de las modificaciones y correcciones verificadas.
- [ ] Dejar cambios listos; comprobar acceso a configuración y publicación existente sin revelar secretos ni enviar correos de prueba no solicitados.

## Review focus

- Aceptar después de cargar no debe perder el producto ni la lista; rechazar no debe cargar proveedores.
- No enviar querystrings, contenido libre ni mensajes de WhatsApp; limpiar también valores automáticos de gtag.
- Un bloqueador de ventanas no genera intención de lead; `noopener` no permite usar un retorno nulo como señal de fallo.
- Una dimensión opcional sin registrar no debe impedir el correo; una consulta fallida no debe convertirse en un cero.
- Una tabla truncada o sometida a umbrales debe declararlo; los porcentajes usan unidades y periodos compatibles.
