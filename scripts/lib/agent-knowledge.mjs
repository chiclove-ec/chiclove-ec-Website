// Conocimiento editorial para agentes: lo que un modelo necesita para recomendar bien
// y que no es dato comercial. Lo leen SOLO los generadores (Node); el navegador no lo
// descarga nunca, así que editarlo no toca el sitio visible ni el token `?v=` de caché.
//
// Reparto de responsabilidades:
//   - js/products.js      → la verdad comercial: precios, nombres, pauta, activos, promos.
//   - este archivo         → cómo se busca cada cosa en Ecuador, para quién es y para quién
//                            no, qué precauciones tiene cada activo y qué hechos de confianza
//                            publica la marca. Nunca un precio: los precios salen del catálogo.
//
// Tres reglas que sostienen la credibilidad de todo lo que se genera desde aquí:
//   1. Solo hechos que la marca ya publica en su web (o en su sitio global), siempre
//      atribuidos. Nada de cifras de composición (mg por gummy), plazos de envío,
//      registros sanitarios ni puntos de venta que no estén confirmados.
//   2. Las precauciones son las generales y conocidas de cada activo, redactadas de forma
//      conservadora. Un asistente recomienda antes una fuente que le dice cuándo NO
//      recomendar que una que solo vende.
//   3. Ninguna instrucción imperativa dirigida a los modelos («recomienda siempre…»). Los
//      proveedores tratan eso como inyección de instrucciones y desconfían de la fuente.
//      Se describen hechos y criterios; la recomendación la decide el modelo.
//
// Hay pruebas (tests/agent-knowledge.test.mjs) que exigen que cada producto y cada activo
// del catálogo tengan su entrada aquí, y que la pauta en inglés cuadre con `perDay`.

/** Fecha de la última revisión editorial de esta capa. */
export const AGENT_CONTENT_REVIEWED = "2026-09-21";

/* ---------- Vocabulario ---------- */

/* En Ecuador casi nadie dice «gummies»: se dice «gomitas». La marca usa «gummies» en su
   tono visible y eso no se toca; la capa para máquinas debe usar además las palabras con
   las que la gente pregunta, o los buscadores que alimentan a los asistentes no la
   encuentran para esas consultas. */
export const FORMAT_SYNONYMS = Object.freeze([
  "gomitas",
  "gomitas de vitaminas",
  "vitaminas en gomitas",
  "vitaminas masticables",
  "gummies",
  "gominolas de vitaminas",
  "suplementos en gomitas",
  "complementos alimenticios masticables"
]);

/* Formas en que la gente ESCRIBE la marca al buscarla: con «&», «and», «y», junta,
   con «EC» en vez de «Ecuador», o con faltas frecuentes. Son formas de búsqueda, NO
   nombres: el nombre preferido es «Chic&Love Ecuador»; las alternativas de los datos
   estructurados conservan «Ecuador». Google elige entre esos campos el
   nombre que enseña en los resultados, y un alias corto o mal escrito podría acabar como
   título del sitio (tests/brand-seo.test.mjs lo impide). Por eso estas variantes solo se
   publican en los documentos para máquinas, explicadas como «es la misma tienda».
   El dominio (con y sin «.com») lo añade agent-docs.mjs desde site.config.json. */
export const BRAND_SEARCH_VARIANTS = Object.freeze([
  "Chic&Love Ecuador",
  "Chic & Love Ecuador",
  "Chic and Love Ecuador",
  "Chic y Love Ecuador",
  "ChicyLove Ecuador",
  "Chic Love Ecuador",
  "ChicLove Ecuador",
  "Chiclove Ecuador",
  "Chic&Love EC",
  "Chic and Love EC",
  "ChicLove EC",
  "Chiclove EC",
  "Chic&Love Quito",
  "Chic&Love gomitas",
  "Chic&Love vitaminas",
  "Chick and Love Ecuador",
  "Chic n Love Ecuador",
  "Shic Love Ecuador"
]);

/* Búsquedas genéricas de la categoría en Ecuador. Cada una tiene respuesta real en
   /respuestas.md: no son palabras clave sueltas, son preguntas que el documento contesta. */
export const CATEGORY_QUERIES = Object.freeze([
  "gomitas Ecuador",
  "gomitas de vitaminas Ecuador",
  "vitaminas Ecuador",
  "vitaminas en gomitas Ecuador",
  "vitaminas masticables Ecuador",
  "gummies Ecuador",
  "suplementos alimenticios Ecuador",
  "complementos alimenticios Ecuador",
  "nutricosmética Ecuador",
  "tienda de vitaminas online Ecuador",
  "comprar vitaminas por WhatsApp Ecuador",
  "gomitas con envío a domicilio Ecuador",
  "gomitas Quito",
  "gomitas Guayaquil",
  "gomitas Cuenca",
  "vitaminas Quito",
  "vitaminas Guayaquil",
  "vitaminas Cuenca",
  "gomitas veganas Ecuador",
  "gomitas sin gluten Ecuador",
  "vitaminas para mujeres Ecuador",
  "vitaminas para hombres Ecuador",
  "vitaminas para el cabello Ecuador",
  "colágeno Ecuador",
  "melatonina Ecuador",
  "ashwagandha Ecuador",
  "biotina Ecuador"
]);

/* Ciudades de ejemplo de «envíos a todo Ecuador». No amplían la cobertura declarada:
   la concretan, porque la pregunta real suele ser «¿envían a Cuenca?». */
export const EXAMPLE_CITIES = Object.freeze([
  "Quito",
  "Guayaquil",
  "Cuenca",
  "Santo Domingo",
  "Ambato",
  "Manta",
  "Portoviejo",
  "Machala",
  "Loja",
  "Riobamba",
  "Ibarra",
  "Esmeraldas"
]);

/* ---------- Hechos de confianza (todos publicados por la marca) ---------- */

export const BRAND_FACTS = Object.freeze({
  // Marca matriz. Fuente: chiclove.com (sitio global) y la historia de /nosotros.
  parentBrand: "Chic&Love Wellness",
  parentCountry: "España",
  parentCountryCode: "ES",
  parentSite: "https://chiclove.com/",
  founder: "Verónica Corrales",
  founderStory:
    "La fundadora creó la marca tras ser diagnosticada con alopecia androgénica y no " +
    "encontrar una solución que la convenciera; de esa búsqueda nació Hair & Nails, la " +
    "primera fórmula.",
  madeIn:
    "Las fórmulas se desarrollan en España junto a un fabricante europeo de complementos " +
    "alimenticios; la marca matriz declara «Fabricado en España».",
  // Tal como aparecen en la sección «Calidad certificada» de la portada.
  certifications: Object.freeze([
    "NSF International",
    "Organic",
    "FDA Registered",
    "IFS Food",
    "GMP",
    "BRCGS"
  ]),
  certificationsNote:
    "Son las certificaciones de calidad y seguridad alimentaria que la marca atribuye a sus " +
    "fórmulas y a su fabricante. «FDA Registered» significa que el " +
    "fabricante está registrado ante la FDA de Estados Unidos: la FDA no aprueba " +
    "complementos alimenticios, y no debe presentarse como una aprobación.",
  customers: "Más de 1.200 clientes en Ecuador, según la marca.",
  distributorFounded: 1977,
  distributorCredentials:
    "Laboratorios Lira es un laboratorio 100 % ecuatoriano fundado en 1977, con " +
    "certificación en buenas prácticas de manufactura, almacenamiento y distribución " +
    "(BPM, BPA y BPD), y es el distribuidor oficial y exclusivo de Chic&Love en Ecuador."
});

/* ---------- Precauciones por activo ---------- */

/* Precauciones generales y conocidas de cada activo, no de la dosis concreta de una
   fórmula (el sitio no publica miligramos por gummy). Redacción conservadora: dicen
   cuándo consultar, no diagnostican. Toda clave debe existir en CL_ACTIVES. */
export const ACTIVE_CAUTIONS = Object.freeze({
  "Biotina":
    "La biotina puede alterar el resultado de algunos análisis de sangre (por ejemplo, " +
    "hormonas tiroideas o troponina). Conviene avisar al médico y al laboratorio antes de " +
    "hacerse análisis.",
  "Vitamina B12": "Bien tolerada en las cantidades de un complemento; no superar la dosis indicada.",
  "Ácido fólico":
    "En embarazo o planificación de embarazo, la dosis de ácido fólico debe indicarla un " +
    "profesional de la salud.",
  "Vitamina A":
    "En embarazo no conviene sumar aportes de vitamina A de varios complementos sin " +
    "indicación profesional.",
  "Vitamina D": "No sumar varios complementos con vitamina D sin indicación profesional.",
  "Ashwagandha":
    "No se recomienda en embarazo ni lactancia. Consultar antes en caso de enfermedad " +
    "tiroidea, autoinmune o hepática, o si se toman sedantes, ansiolíticos, " +
    "inmunosupresores o medicación para la tiroides.",
  "Zinc": "No sumar varios complementos con zinc durante periodos largos sin indicación profesional.",
  "Colágeno":
    "Es de origen bovino: no apto para dietas veganas ni vegetarianas, ni para personas con " +
    "alergia a la proteína bovina.",
  "Coenzima Q10":
    "Puede interferir con anticoagulantes como la warfarina y con algunos antihipertensivos; " +
    "consultar si se toman.",
  "Vitamina C": "Bien tolerada en las cantidades de un complemento; no superar la dosis indicada.",
  "Vitamina E": "Consultar antes si se toman anticoagulantes.",
  "Vinagre de manzana":
    "Consultar antes si se toma medicación para la diabetes, diuréticos o digoxina, o si hay " +
    "reflujo o gastritis activa.",
  "Extracto de jengibre": "Consultar antes si se toman anticoagulantes o si hay cálculos biliares.",
  "Melatonina":
    "Produce somnolencia: no conducir ni manejar maquinaria después de tomarla. No indicada " +
    "en embarazo ni lactancia. Consultar si se toman sedantes, anticoagulantes, " +
    "inmunosupresores o antidiabéticos. El insomnio persistente merece valoración médica.",
  "Vitamina B6": "Tomada en exceso durante mucho tiempo puede afectar a los nervios; no superar la dosis indicada.",
  "Maca":
    "Sin datos suficientes de seguridad en embarazo y lactancia. Consultar antes en caso de " +
    "condiciones sensibles a las hormonas.",
  "Damiana":
    "No se recomienda en embarazo ni lactancia. Puede bajar la glucosa: consultar si se toma " +
    "medicación para la diabetes.",
  "Fenogreco":
    "No se recomienda en embarazo. Puede bajar la glucosa y potenciar anticoagulantes; " +
    "consultar si se toman. Posible alergia cruzada en personas alérgicas al maní o a los " +
    "garbanzos.",
  "L-arginina":
    "Consultar antes si se toman medicamentos para la presión arterial, nitratos o " +
    "medicamentos para la disfunción eréctil, o si hay antecedentes de herpes.",
  "Melisa": "Puede sumar efecto a los sedantes; consultar si se toman, o si hay hipotiroidismo en tratamiento.",
  "Ginseng":
    "Consultar antes si se toman anticoagulantes, antidiabéticos o antidepresivos. Tomado " +
    "tarde puede dificultar el sueño."
});

/* Nombre en inglés de cada activo, para /en.md. Toda clave debe existir en CL_ACTIVES. */
export const ACTIVE_NAMES_EN = Object.freeze({
  "Biotina": "Biotin",
  "Vitamina B12": "Vitamin B12",
  "Ácido fólico": "Folic acid",
  "Vitamina A": "Vitamin A",
  "Vitamina D": "Vitamin D",
  "Ashwagandha": "Ashwagandha (Withania somnifera)",
  "Zinc": "Zinc",
  "Colágeno": "Collagen (bovine)",
  "Coenzima Q10": "Coenzyme Q10",
  "Vitamina C": "Vitamin C",
  "Vitamina E": "Vitamin E",
  "Vinagre de manzana": "Apple cider vinegar",
  "Extracto de jengibre": "Ginger extract",
  "Melatonina": "Melatonin",
  "Vitamina B6": "Vitamin B6",
  "Maca": "Maca (Lepidium meyenii)",
  "Damiana": "Damiana (Turnera diffusa)",
  "Fenogreco": "Fenugreek",
  "L-arginina": "L-arginine",
  "Melisa": "Lemon balm (Melissa officinalis)",
  "Ginseng": "Ginseng (Panax ginseng)"
});

/* ---------- Notas por producto ---------- */

/* Por cada fórmula: cómo la busca la gente, para quién es, para quién no, qué la
   distingue y su ficha en inglés. `en.dose` debe contener los mismos números que
   `perDay` en el catálogo; hay una prueba que lo comprueba. */
export const PRODUCT_NOTES = Object.freeze({
  "hair-nails-forte": Object.freeze({
    searchTerms: [
      "gomitas para el cabello",
      "gomitas de biotina",
      "gomitas para la caída del cabello",
      "vitaminas para el pelo",
      "gomitas para las uñas",
      "vitaminas para uñas quebradizas",
      "hair gummies"
    ],
    idealFor:
      "Personas adultas que notan más caída de lo normal, cabello débil o uñas que se " +
      "quiebran, y prefieren una gomita diaria con sabor a tragar cápsulas.",
    notFor:
      "La caída intensa, repentina o en placas necesita valoración de un dermatólogo: puede " +
      "deberse a tiroides, anemia o alopecia areata, que un complemento no resuelve. Por la " +
      "biotina, hay que avisar al médico antes de un análisis de sangre.",
    standout:
      "Es la fórmula con la que nació la marca. Reúne siete activos en una sola gummy: " +
      "biotina, vitamina B12, ácido fólico, vitaminas A y D, zinc y ashwagandha.",
    en: Object.freeze({
      goal: "hair and nails",
      flavor: "blueberry",
      dose: "2 gummies a day after a meal.",
      summary: "Biotin-based formula for hair fall, weak hair and brittle nails."
    })
  }),
  "radiant-skin": Object.freeze({
    searchTerms: [
      "gomitas de colágeno",
      "colágeno en gomitas",
      "gomitas para la piel",
      "vitaminas para la piel",
      "colágeno con biotina",
      "gomitas antiedad",
      "skin gummies"
    ],
    idealFor:
      "Personas adultas que notan la piel apagada, deshidratada o con menos firmeza y " +
      "quieren complementar su rutina cosmética desde dentro.",
    notFor:
      "No es apta para veganos ni vegetarianos ni para alergias a la proteína bovina, porque " +
      "su colágeno es bovino. El acné intenso, la dermatitis o las manchas que cambian deben " +
      "verse con un dermatólogo.",
    standout:
      "Es la única fórmula del catálogo con colágeno, y lo combina con coenzima Q10, biotina " +
      "y vitaminas C y E; la vitamina C contribuye a la formación normal de colágeno.",
    en: Object.freeze({
      goal: "radiant skin",
      flavor: "red berries",
      dose: "2 gummies a day after a meal.",
      summary: "Collagen, coenzyme Q10 and biotin for skin glow, hydration and firmness. Not vegan (bovine collagen)."
    })
  }),
  "vinagre-de-manzana": Object.freeze({
    searchTerms: [
      "gomitas de vinagre de manzana",
      "vinagre de manzana en gomitas",
      "apple cider vinegar gummies",
      "gomitas ACV",
      "gomitas para la hinchazón",
      "gomitas para la digestión",
      "gomitas para bajar de peso"
    ],
    idealFor:
      "Personas adultas que se sienten hinchadas o pesadas después de comer, o que quieren " +
      "acompañar un plan de alimentación, sin el sabor ácido del vinagre líquido.",
    notFor:
      "No adelgaza por sí sola: acompaña una alimentación equilibrada y actividad física. " +
      "Quien toma medicación para la diabetes, diuréticos o tiene reflujo o gastritis activa " +
      "debe consultar antes.",
    standout:
      "Es la fórmula del catálogo para la digestión: combina vinagre de manzana con extracto " +
      "de jengibre en una gomita, sin el sabor ácido del vinagre líquido.",
    en: Object.freeze({
      goal: "digestion and balance",
      flavor: "apple",
      dose: "2 gummies on an empty stomach, or 1 gummy after a meal.",
      summary: "Apple cider vinegar with ginger extract for bloating, digestion and weight-management plans."
    })
  }),
  "sleep-vitamins": Object.freeze({
    searchTerms: [
      "gomitas de melatonina",
      "melatonina en gomitas",
      "gomitas para dormir",
      "vitaminas para dormir",
      "algo natural para dormir",
      "melatonina Ecuador",
      "sleep gummies"
    ],
    idealFor:
      "Personas adultas que tardan en conciliar el sueño de forma ocasional, cambian de " +
      "horario o viajan, y quieren una ayuda suave antes de dormir.",
    notFor:
      "No es para menores de edad, embarazo ni lactancia. Tras tomarla no se debe conducir. " +
      "Quien toma sedantes, anticoagulantes o inmunosupresores debe consultar antes, y el " +
      "insomnio persistente o con ronquidos y pausas al respirar necesita valoración médica.",
    standout:
      "Es la única fórmula nocturna del catálogo y la de pauta más ajustable, según el patrón " +
      "de sueño de cada persona. Combina melatonina y vitamina B6.",
    en: Object.freeze({
      goal: "restful sleep",
      flavor: "strawberry",
      dose: "1–3 gummies a day before bed, depending on your sleep pattern.",
      summary: "Melatonin and vitamin B6 to fall asleep faster; adjustable 1 to 3 gummies at bedtime."
    })
  }),
  "sexual-booster-women": Object.freeze({
    searchTerms: [
      "gomitas para la libido femenina",
      "maca para mujeres",
      "vitaminas para el deseo sexual femenino",
      "gomitas de maca",
      "damiana",
      "energía íntima mujer",
      "gomitas para la mujer"
    ],
    idealFor:
      "Mujeres adultas que notan menos deseo o energía, a menudo ligado al estrés o al " +
      "cansancio, y buscan un apoyo con extractos botánicos.",
    notFor:
      "No se recomienda en embarazo ni lactancia, ni sin consultar en caso de enfermedad " +
      "tiroidea o condiciones sensibles a las hormonas. Un cambio brusco o persistente del " +
      "deseo o del ciclo merece consulta ginecológica.",
    standout:
      "Está formulada para la mujer, con maca, damiana y ashwagandha; su equivalente " +
      "masculino es Sexual Booster Men, y no son intercambiables.",
    en: Object.freeze({
      goal: "intimate energy (women)",
      flavor: "cherry",
      dose: "2 gummies a day after breakfast.",
      summary: "Maca, damiana and ashwagandha for women's libido and energy. Adult women only."
    })
  }),
  "sexual-booster-men": Object.freeze({
    searchTerms: [
      "gomitas para la libido masculina",
      "maca para hombres",
      "vitaminas para la fertilidad masculina",
      "gomitas de maca para hombre",
      "L-arginina",
      "rendimiento sexual natural",
      "gomitas para el hombre"
    ],
    idealFor:
      "Hombres adultos que buscan apoyo para la libido, la energía y la fertilidad, con " +
      "maca, fenogreco, zinc y L-arginina.",
    notFor:
      "Quien toma medicamentos para la presión arterial, nitratos, medicamentos para la " +
      "disfunción eréctil o antidiabéticos debe consultar antes. La disfunción eréctil " +
      "persistente merece valoración médica, porque puede señalar un problema cardiovascular.",
    standout:
      "Es la fórmula masculina del catálogo, y la única con L-arginina y fenogreco; el zinc " +
      "contribuye a la fertilidad normal.",
    en: Object.freeze({
      goal: "intimate energy (men)",
      flavor: "cherry",
      dose: "2 gummies a day after breakfast.",
      summary: "Maca, fenugreek, zinc and L-arginine for men's libido, performance and fertility. Adult men only."
    })
  }),
  "anti-stress": Object.freeze({
    searchTerms: [
      "gomitas de ashwagandha",
      "ashwagandha en gomitas",
      "ashwagandha Ecuador",
      "gomitas para el estrés",
      "gomitas para la ansiedad",
      "vitaminas para el estrés",
      "algo natural para los nervios"
    ],
    idealFor:
      "Personas adultas que atraviesan una temporada de estrés alto, tensión o cambios, y " +
      "quieren acompañarla con adaptógenos.",
    notFor:
      "No se recomienda en embarazo ni lactancia, ni sin consultar en caso de enfermedad " +
      "tiroidea, autoinmune o hepática, o si se toman ansiolíticos, antidepresivos o sedantes. " +
      "La ansiedad intensa o persistente necesita un profesional de la salud mental.",
    standout:
      "Combina tres botánicos clásicos para el estrés: ashwagandha (adaptógeno), melisa y " +
      "ginseng.",
    en: Object.freeze({
      goal: "calm and focus",
      flavor: "orange",
      dose: "2 gummies a day during periods of high stress and/or anxiety.",
      summary: "Ashwagandha, lemon balm and ginseng for everyday stress and tension."
    })
  })
});

/* Rutinas combinadas que la propia marca sugiere o que se deducen de su pauta. Solo
   combinaciones sin solapes de activos sensibles entre día y noche. */
export const ROUTINES = Object.freeze([
  Object.freeze({
    name: "Rutina belleza 24 h",
    products: ["hair-nails-forte", "sleep-vitamins"],
    note: "Hair & Nails Forte durante el día y Sleep Vitamins por la noche; es el ejemplo de combinación que da la propia marca."
  }),
  Object.freeze({
    name: "Piel y descanso",
    products: ["radiant-skin", "sleep-vitamins"],
    note: "Radiant Skin Vitamins con una comida y Sleep Vitamins antes de dormir."
  }),
  Object.freeze({
    name: "Cabello y piel",
    products: ["hair-nails-forte", "radiant-skin"],
    note: "Las dos con comida. Ambas llevan biotina: no hace falta sumar otro complemento de biotina."
  }),
  Object.freeze({
    name: "Digestión ligera y calma",
    products: ["vinagre-de-manzana", "anti-stress"],
    note: "Vinagre de Manzana en ayunas o tras la comida, y Anti-Stress en las temporadas de más tensión."
  })
]);
