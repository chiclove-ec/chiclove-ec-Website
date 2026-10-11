# Procedencia de editoriales con modelos

Las personas y escenas se generaron el 19 de julio de 2026 con la herramienta integrada de generación de imágenes de OpenAI. Los packshots aportados por el propietario se utilizaron como referencia factual de las formas y los colores reales de las gomitas. Para `editorial-hair-bite.webp` también se utilizó un retrato aportado por el propietario únicamente como referencia de pose, encuadre y energía; la herramienta recibió la instrucción explícita de crear una persona nueva con una identidad diferente.

| Archivo | Descripción de generación |
| --- | --- |
| `cover-lifestyle.webp` | Cuatro amistades latinoamericanas compartiendo un bowl con gomitas azules, borgoña, púrpura oscuro, rojas y verdes fieles a los productos. |
| `editorial-hair.webp` | Mujer afro-latina con cabello rizado sosteniendo una gomita translúcida rojo cereza con forma de oso. |
| `editorial-hair-bite.webp` | Mujer latina con top lavanda, cabello largo y brillante, mordiendo felizmente una gomita translúcida borgoña con forma de oso. |
| `editorial-skin.webp` | Mujer latina con cabello corto mostrando una gomita azul con forma de media luna en un retrato de belleza. |
| `editorial-ritual.webp` | Mujer latina cepillando su cabello largo con un cepillo de madera. |
| `editorial-gummy.webp` | Hombre joven latino con top azul petróleo sosteniendo una taza llena de ositos rojo cereza, medias lunas azules, discos borgoña y verdes, y corazones borgoña de gomita. |

Los archivos finales se exportaron a WebP sin metadatos incrustados. Este registro documenta el origen técnico de las imágenes y evita depender de fotografías de stock o de terceros para los modelos humanos del sitio.

## Composiciones sin generación

`promo-coleccion.webp`, `promo-coleccion-640.webp` y `promo-coleccion-movil.webp` (banda de
la promoción de octubre de 2026) no usan generación de imágenes: son un montaje de material
propio. El fondo y el podio salen de `store-radiant-skin.webp`, con el frasco retirado y el
hueco rellenado con el degradado del propio fondo; los seis frascos se recortaron de
`family-bottles.webp` y se colocaron encima con sombras suaves.

## Retoques sin generación

Los recortes `splash-*.webp` (frascos con líquido de la portada, las escenas de fórmulas y
los activos de cada ficha) se limpiaron a mano por script, sin generación de imágenes: se
quitaron restos del fondo blanco que el recorte original había dejado entre el líquido y
el frasco, y se reconstruyeron las tapas que ese recorte había borrado. En los Sexual
Booster la mitad perdida de la tapa se rehízo reflejando la mitad intacta; en Sleep
Vitamins, con la textura de la misma tapa (es el mismo envase) tomada del recorte de
Sexual Booster. El líquido original se conserva por encima.
