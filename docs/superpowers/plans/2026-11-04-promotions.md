# Promociones noviembre, Black Days y Cyber Days

**Objetivo:** publicar las tres campañas de 2026 conservando el diseño, las imágenes, las clases y las animaciones existentes de septiembre y octubre.
**Fuente:** solicitud del usuario y `docs/promociones-mensuales.md`. Catálogo único en `js/products.js`, sin dependencias nuevas.

## Condiciones

- 1–26 noviembre: siete fórmulas a $23.99, −20%.
- 27–30 noviembre: Black Days, siete fórmulas a $20.99, −30%.
- 1–2 diciembre: Cyber Days, siete fórmulas a $18.00, −40%.
- Inicio inclusivo y cierre exclusivo a las 00:00 de Ecuador (UTC−5). Sin anticipar campañas. Desde el 3 de diciembre vuelven precios y packs normales.
- Reutilizar la banda agrupada y fotos actuales, tarjetas, fichas, franja superior y animaciones; cambiar solamente datos y textos de campaña.
- Retirar packs durante las campañas porque cuestan más que los frascos sueltos.
- Mantener la actualización diaria de HTML, JSON-LD y markdown mediante el workflow existente.

## Plan

- [x] Probar primero precios, porcentajes, grupos, packs y cada frontera de fecha; admitir campañas consecutivas por producto sin solapamiento.
- [x] Implementar los tres periodos y textos de campaña en la fuente única; comprobar que el HTML servido en el periodo anterior se actualiza correctamente al cargar.
- [x] Actualizar sin recargar las pestañas abiertas al cruzar una frontera o recuperar el foco, incluyendo carrito, fichas y precios editoriales; conservar filtros, cantidades y animaciones.
- [x] Regenerar con la fecha real, subir la versión de recursos y documentar el calendario.
- [x] Verificar toda la suite, generación idempotente y navegación real en escritorio y móvil, con simulación de cada campaña y cierre.
- [ ] Revisar el cambio completo, abrir PR, esperar CI, fusionar a main y verificar publicación.

## Puntos de revisión

Precios exactos en centavos, fronteras UTC−5 desde otras zonas horarias, HTML de una campaña anterior, pestañas suspendidas, packs guardados, carrito/WhatsApp y animaciones tras el cambio de campaña.

## Verificación realizada

- Base antes de editar: 210 pruebas aprobadas.
- Calendario y reloj: se observaron los fallos iniciales y las pruebas pasaron después de implementar.
- `npm run check`: 220 pruebas aprobadas con el reloj real y al generar para el 31 de octubre, 27 de noviembre, 1 de diciembre y 3 de diciembre.
- Navegador Chrome: 22 escenarios, siete fichas por periodo, portada y tienda en 320, 390 y 1440 px; cero errores JavaScript y cero desbordamiento horizontal.
- Cambio por temporizador a medianoche desde UTC+14: sin recarga y con el precio correcto.
- Navegador: menú móvil, movimiento reducido, carrito y WhatsApp, packs guardados, cantidades, filtros y animaciones de bandas tras cambiar la campaña.
- Se conserva la hoja de estilos y todas las imágenes originales.
- El workflow `refresh-catalog.yml` existente está activo y conserva su programación y reintentos.
