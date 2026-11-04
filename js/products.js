/* Catálogo Chic&Love Ecuador — fuente única de datos del sitio.
   Los precios son editables aquí y se reflejan en todo el sitio. */
"use strict";

const CL_WHATSAPP = "593987591741"; // formato internacional sin espacios
const CL_INSTAGRAM = "chicloveec";
const CL_FREE_SHIPPING = 49.99;
const CL_SERVINGS = 60; // gummies por frasco, igual en todo el catálogo
const CL_VAT_NOTE = "IVA incluido";

/* Datos del distribuidor en Ecuador. Fuente única para pie, páginas legales,
   datos estructurados y gemelos markdown. */
const CL_LEGAL = Object.freeze({
  brand: "Chic&Love Ecuador",
  company: "LIRA LABORATORIOS INDUSTRIALES REPRESENTACIONES Y AGENCIAS S.A.",
  companyShort: "Laboratorios Lira S.A.",
  ruc: "1790336352001",
  address: "José Vinueza E8-152 y Av. Interoceánica, Quito, Pichincha, Ecuador",
  streetAddress: "José Vinueza E8-152 y Av. Interoceánica",
  locality: "Quito",
  region: "Pichincha",
  email: "ventas@laboratorioslira.com",
  phones: Object.freeze(["+593 2 237 9285", "+593 2 237 6425"]),
  returnDays: 15
});

function clFooterLegal() {
  return CL_LEGAL.brand + ". Distribuido por " + CL_LEGAL.companyShort +
    ". RUC " + CL_LEGAL.ruc + ". " + CL_LEGAL.locality + ", Ecuador.";
}
const CL_PRODUCT_PRICING = Object.freeze({
  price: 29.99,
  pricePack: 49.99,
  pricePack3: 74.99
});

/* Promociones temporales por producto. La ventana se evalúa en hora de Ecuador
   (UTC-5), así entra y sale a la vez para todo el mundo sin importar la zona horaria del
   visitante; al cerrarse, el sitio vuelve solo al precio de catálogo.
   `singleOnly` retira los packs mientras dure: al precio promocional dejarían de
   ahorrar frente a comprar frascos sueltos.
   `group` junta en una sola banda de promoción las fórmulas que comparten descuento
   (ver CL_PROMO_GROUPS); sin `group`, la fórmula tiene banda propia. */
/* Calendario 2026: precios finales solicitados, sin recalcularlos con porcentajes.
   Cada producto comparte las tres ventanas consecutivas e inmutables. */
const CL_PROMO_CALENDAR = Object.freeze([
  Object.freeze({
    monthLabel: "noviembre",
    endsLabel: "26 de noviembre",
    price: 23.99,
    singleOnly: true,
    group: "coleccion",
    start: Date.parse("2026-11-01T00:00:00-05:00"),
    end: Date.parse("2026-11-27T00:00:00-05:00"),
    priceValidUntil: "2026-11-26"
  }),
  Object.freeze({
    monthLabel: "noviembre",
    campaignLabel: "Black Days",
    endsLabel: "30 de noviembre",
    price: 20.99,
    singleOnly: true,
    group: "coleccion",
    start: Date.parse("2026-11-27T00:00:00-05:00"),
    end: Date.parse("2026-12-01T00:00:00-05:00"),
    priceValidUntil: "2026-11-30"
  }),
  Object.freeze({
    monthLabel: "diciembre",
    campaignLabel: "Cyber Days",
    endsLabel: "2 de diciembre",
    price: 18.00,
    singleOnly: true,
    group: "coleccion",
    start: Date.parse("2026-12-01T00:00:00-05:00"),
    end: Date.parse("2026-12-03T00:00:00-05:00"),
    priceValidUntil: "2026-12-02"
  })
]);

const CL_PROMOS = Object.freeze({
  "radiant-skin": CL_PROMO_CALENDAR,
  "hair-nails-forte": CL_PROMO_CALENDAR,
  "vinagre-de-manzana": CL_PROMO_CALENDAR,
  "sleep-vitamins": CL_PROMO_CALENDAR,
  "sexual-booster-women": CL_PROMO_CALENDAR,
  "sexual-booster-men": CL_PROMO_CALENDAR,
  "anti-stress": CL_PROMO_CALENDAR
});

/* Bandas compartidas: las fórmulas de un mismo grupo deben tener la misma promoción
   (precio y fechas), porque la banda anuncia un único precio. `label` es el nombre
   corto de la franja superior. La imagen es la composición de los frascos del grupo
   sobre el fondo de las fotos de tienda; `imageNarrow` es su versión vertical para
   móvil, donde el hueco de la imagen es alto y estrecho y recortaría los laterales. */
const CL_PROMO_GROUPS = Object.freeze({
  coleccion: Object.freeze({
    title: "Toda la colección",
    label: "toda la colección",
    cta: "Ver la colección",
    image: "assets/img/promo-coleccion.webp",
    imageSmall: "assets/img/promo-coleccion-640.webp",
    imageNarrow: "assets/img/promo-coleccion-movil.webp",
    accent: "#8C6FC9",
    accentDark: "#6A4FA8"
  })
});

const CL_PRODUCTS = [
  {
    id: "hair-nails-forte",
    perDay: 2,
    name: "Hair & Nails Forte",
    short: "Hair & Nails",
    tagline: "Cabello más fuerte. Uñas de acero.",
    desc: "La fórmula forte con biotina, ashwagandha y extracto de semilla de calabaza que frena la caída y acelera el crecimiento desde la raíz.",
    accent: "#8C6FC9",
    accentDark: "#6A4FA8",
    soft: "#F1EBFB",
    ...CL_PRODUCT_PRICING,
    flavor: "Arándanos",
    badges: ["Sin gluten", "Sin lactosa", "Vegano"],
    bottle: "assets/img/bottle-hair-nails.webp",
    splash: "assets/img/splash-hair-nails.webp",
    splashSmall: "assets/img/splash-hair-nails-640.webp",
    store: "assets/img/store-hair-nails.webp",
    storeSmall: "assets/img/store-hair-nails-640.webp",
    hero: "assets/img/hero-hair-nails.webp",
    heroSmall: "assets/img/hero-hair-nails-640.webp",
    splashWidth: 1160,
    goal: "cabello",
    goalLabel: "Cabello y uñas",
    benefits: [
      "Previene y frena la caída, acelera el crecimiento y engrosa la fibra capilar.",
      "Activa la microcirculación del cuero cabelludo: más nutrientes a los folículos pilosos.",
      "Crecimiento y fuerza visibles en cabello y uñas.",
      "El grupo de vitaminas B aumenta el flujo de sangre al cuero cabelludo para un pelo fuerte y brillante."
    ],
    actives: ["Biotina", "Vitamina B12", "Ácido fólico", "Vitamina A", "Vitamina D", "Ashwagandha", "Zinc"],
    dose: "2 gummies al día después de la comida."
  },
  {
    id: "radiant-skin",
    perDay: 2,
    name: "Radiant Skin Vitamins",
    short: "Radiant Skin",
    tagline: "Tu piel, en modo glow.",
    desc: "Colágeno, coenzima Q10 y biotina en una gummy que ilumina, hidrata y devuelve la elasticidad a tu piel desde adentro.",
    accent: "#E88998",
    accentDark: "#B44F64",
    soft: "#FBEBEE",
    ...CL_PRODUCT_PRICING,
    flavor: "Frutos rojos",
    badges: ["Sin gluten", "Sin lactosa"],
    bottle: "assets/img/bottle-radiant-skin.webp",
    splash: "assets/img/splash-radiant-skin.webp",
    splashSmall: "assets/img/splash-radiant-skin-640.webp",
    store: "assets/img/store-radiant-skin.webp",
    storeSmall: "assets/img/store-radiant-skin-640.webp",
    hero: "assets/img/hero-radiant-skin.webp",
    heroSmall: "assets/img/hero-radiant-skin-640.webp",
    splashWidth: 946,
    goal: "piel",
    goalLabel: "Piel radiante",
    benefits: [
      "Potencia la luminosidad y vitalidad de la piel.",
      "El colágeno y la coenzima Q10 mejoran la elasticidad y combaten los signos de la edad.",
      "La biotina fortalece la barrera cutánea y aporta un glow saludable.",
      "Piel perfecta: hidratación y firmeza desde el interior."
    ],
    actives: ["Colágeno", "Coenzima Q10", "Biotina", "Vitamina C", "Vitamina E"],
    dose: "2 gummies al día después de la comida."
  },
  {
    id: "vinagre-de-manzana",
    perDay: [1, 2],
    name: "Vinagre de Manzana",
    short: "Vinagre",
    tagline: "Digestión ligera.",
    desc: "Vinagre de manzana con extracto de jengibre: glucosa estable, digestión y control de peso — sin el sabor ácido del vinagre.",
    accent: "#35B34A",
    accentDark: "#1D712D",
    soft: "#E9F7EC",
    ...CL_PRODUCT_PRICING,
    flavor: "Manzana",
    badges: ["Sin gluten", "Sin lactosa", "Vegano"],
    bottle: "assets/img/bottle-acv.webp",
    splash: "assets/img/splash-acv.webp",
    splashSmall: "assets/img/splash-acv-640.webp",
    store: "assets/img/store-acv.webp",
    storeSmall: "assets/img/store-acv-640.webp",
    hero: "assets/img/hero-acv.webp",
    heroSmall: "assets/img/hero-acv-640.webp",
    splashWidth: 1118,
    goal: "digestion",
    goalLabel: "Digestión y balance",
    benefits: [
      "Ayuda a mantener estables los niveles de glucosa en sangre y facilita la digestión.",
      "Efecto probiótico que favorece la generación de bacterias saludables en el tracto intestinal.",
      "Regula la digestión y la microbiota, y reduce la hinchazón.",
      "Contribuye al control de peso y ayuda a absorber minerales y vitaminas."
    ],
    actives: ["Vinagre de manzana", "Extracto de jengibre"],
    dose: "2 gummies en ayunas, o 1 gummy después de la comida."
  },
  {
    id: "sleep-vitamins",
    perDay: [1, 3],
    name: "Sleep Vitamins",
    short: "Sleep",
    tagline: "Duerme profundo. Despierta increíble.",
    desc: "Melatonina + vitamina B6 para conciliar el sueño rápido y disfrutar un descanso reparador que regenera piel y cabello mientras duermes.",
    accent: "#4FA8D8",
    accentDark: "#256A92",
    soft: "#E8F4FB",
    ...CL_PRODUCT_PRICING,
    flavor: "Fresa",
    badges: ["Sin gluten", "Sin lactosa", "Vegano"],
    bottle: "assets/img/bottle-sleep.webp",
    splash: "assets/img/splash-sleep.webp",
    splashSmall: "assets/img/splash-sleep-640.webp",
    store: "assets/img/store-sleep.webp",
    storeSmall: "assets/img/store-sleep-640.webp",
    hero: "assets/img/hero-sleep.webp",
    heroSmall: "assets/img/hero-sleep-640.webp",
    splashWidth: 955,
    goal: "sueno",
    goalLabel: "Sueño reparador",
    benefits: [
      "Ayuda a conciliar el sueño de manera rápida.",
      "Sueño reparador y profundo, noche tras noche.",
      "Protege la piel y el cabello del envejecimiento celular.",
      "Melatonina + B6: regenera las defensas de piel y pelo contra el estrés oxidativo."
    ],
    actives: ["Melatonina", "Vitamina B6"],
    dose: "1–3 gummies al día antes de dormir según tu patrón de sueño."
  },
  {
    id: "sexual-booster-women",
    perDay: 2,
    audience: "female",
    audienceLabel: "Mujeres adultas",
    name: "Sexual Booster Women",
    short: "Booster Her",
    tagline: "Enciende tu energía.",
    desc: "Maca y damiana 100% naturales que estabilizan tus canales de energía, estimulan la libido y reducen el estrés.",
    accent: "#B3538F",
    accentDark: "#8C3A6E",
    soft: "#F7EAF2",
    ...CL_PRODUCT_PRICING,
    flavor: "Cereza",
    badges: ["Sin gluten", "Sin lactosa", "Vegano"],
    bottle: "assets/img/bottle-sexual-w.webp",
    splash: "assets/img/splash-sexual-w.webp",
    splashSmall: "assets/img/splash-sexual-w-640.webp",
    store: "assets/img/store-sexual-w.webp",
    storeSmall: "assets/img/store-sexual-w-640.webp",
    hero: "assets/img/hero-sexual-w.webp",
    heroSmall: "assets/img/hero-sexual-w-640.webp",
    splashWidth: 1235,
    goal: "energia",
    goalLabel: "Energía íntima",
    benefits: [
      "Aumenta la libido y potencia el bienestar sexual.",
      "Mantiene en condiciones óptimas la ovulación.",
      "Impulso de energía y menos niveles de estrés.",
      "Maca y damiana: ingredientes activos 100% naturales."
    ],
    actives: ["Maca", "Damiana", "Ashwagandha"],
    dose: "2 gummies al día después del desayuno."
  },
  {
    id: "sexual-booster-men",
    perDay: 2,
    audience: "male",
    audienceLabel: "Hombres adultos",
    name: "Sexual Booster Men",
    short: "Booster Him",
    tagline: "Rendimiento al máximo.",
    desc: "Maca y fenogreco para mejorar el rendimiento, la calidad del esperma y la fertilidad — energía estable todo el día.",
    accent: "#2E7FC2",
    accentDark: "#1F5C90",
    soft: "#E8F1FA",
    ...CL_PRODUCT_PRICING,
    flavor: "Cereza",
    badges: ["Sin gluten", "Sin lactosa", "Vegano"],
    bottle: "assets/img/bottle-sexual-m.webp",
    splash: "assets/img/splash-sexual-m.webp",
    splashSmall: "assets/img/splash-sexual-m-640.webp",
    store: "assets/img/store-sexual-m.webp",
    storeSmall: "assets/img/store-sexual-m-640.webp",
    hero: "assets/img/hero-sexual-m.webp",
    heroSmall: "assets/img/hero-sexual-m-640.webp",
    splashWidth: 1100,
    goal: "energia",
    goalLabel: "Energía íntima",
    benefits: [
      "Aumenta la libido y el rendimiento sexual.",
      "Mejora la calidad del esperma e incrementa la fertilidad.",
      "Estabiliza los canales de energía con maca.",
      "Ingredientes activos 100% naturales."
    ],
    actives: ["Maca", "Fenogreco", "Zinc", "L-arginina"],
    dose: "2 gummies al día después del desayuno."
  },
  {
    id: "anti-stress",
    perDay: 2,
    name: "Anti-Stress Gummies",
    short: "Anti-Stress",
    tagline: "Serenidad para días intensos.",
    desc: "Ashwagandha, melisa y ginseng que regulan el cortisol para aliviar el estrés y la ansiedad, y ayudarte a fluir con el cambio.",
    accent: "#2B4FC7",
    accentDark: "#1D3894",
    soft: "#E9EDFA",
    ...CL_PRODUCT_PRICING,
    flavor: "Naranja",
    badges: ["Sin gluten", "Sin lactosa", "Vegano"],
    bottle: "assets/img/bottle-antistress.webp",
    splash: "assets/img/splash-antistress.webp",
    splashSmall: "assets/img/splash-antistress-640.webp",
    store: "assets/img/store-antistress.webp",
    storeSmall: "assets/img/store-antistress-640.webp",
    hero: "assets/img/hero-antistress.webp",
    heroSmall: "assets/img/hero-antistress-640.webp",
    splashWidth: 939,
    goal: "calma",
    goalLabel: "Calma y enfoque",
    benefits: [
      "Alivia estados de estrés y ansiedad.",
      "Favorece la relajación y la calma mental.",
      "Ayuda a adaptarte a situaciones de estrés o de cambio.",
      "La ashwagandha, planta adaptógena, regula los niveles de cortisol."
    ],
    actives: ["Ashwagandha", "Melisa", "Ginseng"],
    dose: "2 gummies al día durante períodos altos de estrés y/o ansiedad."
  }
];

/* Glosario de activos. Es la fuente única de la capa semántica del catálogo: de aquí
   salen /ingredientes.md, el `activeIngredient` de los datos estructurados y los
   `DefinedTerm` que enlazan cada activo con su entidad en Wikidata y Wikipedia.

   `wikipedia` y `wikidata` son identificadores EXTERNOS verificados uno a uno: sirven
   para que un modelo desambigüe «maca» o «melisa» sin adivinar. Si se añade un activo
   nuevo hay que comprobar su URL antes de escribirla — una prueba exige que todo activo
   del catálogo aparezca aquí, pero ninguna puede comprobar que la URL siga viva.

   Las descripciones son DESCRIPTIVAS a propósito: qué es el activo y con qué se asocia.
   Las promesas comerciales viven en `benefits` de cada producto, no aquí. */
const CL_ACTIVES = Object.freeze({
  "Biotina": Object.freeze({
    kind: "vitamina",
    aka: ["Vitamina B7", "Vitamina B8", "Biotin"],
    what: "Vitamina hidrosoluble del grupo B.",
    role: "Se asocia al mantenimiento normal del cabello, la piel y las mucosas.",
    wikipedia: "https://es.wikipedia.org/wiki/Biotina",
    wikidata: "https://www.wikidata.org/wiki/Q181354"
  }),
  "Vitamina B12": Object.freeze({
    kind: "vitamina",
    aka: ["Cobalamina"],
    what: "Vitamina hidrosoluble del grupo B.",
    role: "Interviene en la formación normal de glóbulos rojos y en el metabolismo energético.",
    wikipedia: "https://es.wikipedia.org/wiki/Vitamina_B12",
    wikidata: "https://www.wikidata.org/wiki/Q187706"
  }),
  "Ácido fólico": Object.freeze({
    kind: "vitamina",
    aka: ["Vitamina B9", "Folato"],
    what: "Forma sintética del folato, vitamina del grupo B.",
    role: "Participa en la división celular y en la síntesis de aminoácidos.",
    wikipedia: "https://es.wikipedia.org/wiki/%C3%81cido_f%C3%B3lico",
    wikidata: "https://www.wikidata.org/wiki/Q127060"
  }),
  "Vitamina A": Object.freeze({
    kind: "vitamina",
    aka: ["Retinol"],
    what: "Vitamina liposoluble.",
    role: "Contribuye al mantenimiento normal de la piel y de la visión.",
    wikipedia: "https://es.wikipedia.org/wiki/Vitamina_A",
    wikidata: "https://www.wikidata.org/wiki/Q18225"
  }),
  "Vitamina D": Object.freeze({
    kind: "vitamina",
    aka: ["Colecalciferol", "Vitamina D3"],
    what: "Vitamina liposoluble.",
    role: "Participa en la absorción del calcio y en el funcionamiento del sistema inmunitario.",
    wikipedia: "https://es.wikipedia.org/wiki/Vitamina_D",
    wikidata: "https://www.wikidata.org/wiki/Q175621"
  }),
  "Ashwagandha": Object.freeze({
    kind: "extracto botánico",
    aka: ["Withania somnifera", "Ginseng indio", "Bufera"],
    what: "Raíz de la medicina ayurvédica, clasificada como adaptógeno.",
    role: "Se emplea tradicionalmente para acompañar periodos de estrés.",
    wikipedia: "https://es.wikipedia.org/wiki/Withania_somnifera",
    wikidata: "https://www.wikidata.org/wiki/Q852660"
  }),
  "Zinc": Object.freeze({
    kind: "mineral",
    aka: ["Cinc"],
    what: "Mineral esencial.",
    role: "Contribuye al mantenimiento normal del cabello, las uñas y la piel, y a la fertilidad normal.",
    wikipedia: "https://es.wikipedia.org/wiki/Zinc",
    wikidata: "https://www.wikidata.org/wiki/Q758"
  }),
  "Colágeno": Object.freeze({
    kind: "proteína",
    aka: ["Collagen"],
    what: "Proteína estructural mayoritaria de la piel y el tejido conectivo. El de esta fórmula es de origen bovino, y es la única excepción vegana del catálogo.",
    role: "Se toma como aporte proteico asociado a la firmeza y la elasticidad de la piel.",
    wikipedia: "https://es.wikipedia.org/wiki/Col%C3%A1geno",
    wikidata: "https://www.wikidata.org/wiki/Q26868"
  }),
  "Coenzima Q10": Object.freeze({
    kind: "cofactor",
    aka: ["Ubiquinona", "CoQ10"],
    what: "Molécula presente en las mitocondrias de las células.",
    role: "Participa en la producción de energía celular y actúa como antioxidante.",
    wikipedia: "https://es.wikipedia.org/wiki/Coenzima_Q10",
    wikidata: "https://www.wikidata.org/wiki/Q321285"
  }),
  "Vitamina C": Object.freeze({
    kind: "vitamina",
    aka: ["Ácido ascórbico"],
    what: "Vitamina hidrosoluble.",
    role: "Contribuye a la formación normal de colágeno y protege las células del daño oxidativo.",
    wikipedia: "https://es.wikipedia.org/wiki/Vitamina_C",
    wikidata: "https://www.wikidata.org/wiki/Q199678"
  }),
  "Vitamina E": Object.freeze({
    kind: "vitamina",
    aka: ["Tocoferol"],
    what: "Vitamina liposoluble.",
    role: "Protege las células frente al daño oxidativo.",
    wikipedia: "https://es.wikipedia.org/wiki/Vitamina_E",
    wikidata: "https://www.wikidata.org/wiki/Q141180"
  }),
  "Vinagre de manzana": Object.freeze({
    kind: "fermentado",
    aka: ["Vinagre de sidra de manzana", "Apple cider vinegar", "ACV"],
    what: "Vinagre de la fermentación del zumo de manzana; su componente principal es el ácido acético.",
    role: "Se toma tradicionalmente como acompañamiento de la digestión y del control del apetito.",
    wikipedia: "https://es.wikipedia.org/wiki/Vinagre_de_sidra_de_manzana",
    wikidata: "https://www.wikidata.org/wiki/Q618322"
  }),
  "Extracto de jengibre": Object.freeze({
    kind: "extracto botánico",
    aka: ["Zingiber officinale", "Jengibre"],
    what: "Extracto del rizoma del jengibre.",
    role: "Se usa tradicionalmente para el bienestar digestivo.",
    wikipedia: "https://es.wikipedia.org/wiki/Zingiber_officinale",
    wikidata: "https://www.wikidata.org/wiki/Q35625"
  }),
  "Melatonina": Object.freeze({
    kind: "hormona",
    aka: ["N-acetil-5-metoxitriptamina"],
    what: "Hormona que el cuerpo produce al anochecer y que regula el ciclo de sueño y vigilia.",
    role: "Se asocia a reducir el tiempo necesario para conciliar el sueño.",
    wikipedia: "https://es.wikipedia.org/wiki/Melatonina",
    wikidata: "https://www.wikidata.org/wiki/Q180912"
  }),
  "Vitamina B6": Object.freeze({
    kind: "vitamina",
    aka: ["Piridoxina"],
    what: "Vitamina hidrosoluble del grupo B.",
    role: "Participa en el metabolismo de las proteínas y en el funcionamiento normal del sistema nervioso.",
    wikipedia: "https://es.wikipedia.org/wiki/Vitamina_B6",
    wikidata: "https://www.wikidata.org/wiki/Q205130"
  }),
  "Maca": Object.freeze({
    kind: "extracto botánico",
    aka: ["Lepidium meyenii", "Maca andina"],
    what: "Raíz andina cultivada en la puna de Perú y Bolivia.",
    role: "Se emplea tradicionalmente como apoyo de la energía y de la libido.",
    wikipedia: "https://es.wikipedia.org/wiki/Lepidium_meyenii",
    wikidata: "https://www.wikidata.org/wiki/Q795158"
  }),
  "Damiana": Object.freeze({
    kind: "extracto botánico",
    aka: ["Turnera diffusa"],
    what: "Arbusto de Centroamérica y el Caribe.",
    role: "Se usa tradicionalmente como tónico asociado a la libido.",
    wikipedia: "https://es.wikipedia.org/wiki/Damiana",
    wikidata: "https://www.wikidata.org/wiki/Q16238103"
  }),
  "Fenogreco": Object.freeze({
    kind: "extracto botánico",
    aka: ["Trigonella foenum-graecum", "Alholva"],
    what: "Semilla usada como especia y como planta medicinal.",
    role: "Se emplea tradicionalmente como apoyo de la vitalidad masculina.",
    wikipedia: "https://es.wikipedia.org/wiki/Trigonella_foenum-graecum",
    wikidata: "https://www.wikidata.org/wiki/Q133205"
  }),
  "L-arginina": Object.freeze({
    kind: "aminoácido",
    aka: ["Arginina"],
    what: "Aminoácido semiesencial.",
    role: "Es precursor del óxido nítrico, implicado en el flujo sanguíneo.",
    wikipedia: "https://es.wikipedia.org/wiki/Arginina",
    wikidata: "https://www.wikidata.org/wiki/Q173670"
  }),
  "Melisa": Object.freeze({
    kind: "extracto botánico",
    aka: ["Melissa officinalis", "Toronjil", "Hierba limón"],
    what: "Planta aromática de la familia de la menta.",
    role: "Se usa tradicionalmente para favorecer la calma.",
    wikipedia: "https://es.wikipedia.org/wiki/Melissa_officinalis",
    wikidata: "https://www.wikidata.org/wiki/Q148396"
  }),
  "Ginseng": Object.freeze({
    kind: "extracto botánico",
    aka: ["Panax ginseng", "Ginseng coreano"],
    what: "Raíz de la medicina tradicional de Asia oriental, clasificada como adaptógeno.",
    role: "Se emplea tradicionalmente como apoyo de la energía y de la concentración.",
    wikipedia: "https://es.wikipedia.org/wiki/Panax_ginseng",
    wikidata: "https://www.wikidata.org/wiki/Q182881"
  })
});

/* Guía de decisión por objetivo: la pregunta que responde cada familia de fórmulas y
   cuándo elegirla. De aquí sale /guia-de-eleccion.md, que es la página que un agente
   cita cuando alguien pregunta «¿cuál me sirve para X?». Toda clave debe existir como
   `goal` de algún producto — hay una prueba que lo exige en los dos sentidos. */
const CL_GOAL_GUIDE = Object.freeze({
  cabello: Object.freeze({
    question: "¿Qué tomo para la caída del cabello o las uñas quebradizas?",
    chooseIf: "Notas más pelo del normal en el cepillo, el cabello quebradizo, o uñas que se parten y crecen despacio.",
    keywords: ["caída del cabello", "cabello quebradizo", "uñas frágiles", "crecimiento del cabello", "biotina"]
  }),
  piel: Object.freeze({
    question: "¿Qué tomo para la piel apagada o con pérdida de firmeza?",
    chooseIf: "Buscas luminosidad, hidratación y elasticidad trabajadas desde dentro, no solo con cosmética.",
    keywords: ["piel apagada", "elasticidad", "colágeno bebible", "glow", "antiedad"]
  }),
  digestion: Object.freeze({
    question: "¿Qué tomo para la hinchazón o la digestión pesada?",
    chooseIf: "Te sientes hinchada o hinchado después de comer, o quieres acompañar un plan de control de peso.",
    keywords: ["hinchazón", "digestión pesada", "control de peso", "vinagre de manzana", "apetito"]
  }),
  sueno: Object.freeze({
    question: "¿Qué tomo para dormir mejor?",
    chooseIf: "Tardas en conciliar el sueño o te despiertas sin sensación de descanso.",
    keywords: ["insomnio ocasional", "conciliar el sueño", "descanso", "melatonina", "jet lag"]
  }),
  energia: Object.freeze({
    question: "¿Qué tomo para la libido y la energía íntima?",
    chooseIf: "Buscas apoyo de la libido y de la energía. Hay una fórmula para mujeres y otra para hombres: no son intercambiables.",
    keywords: ["libido", "energía íntima", "deseo", "maca", "vitalidad"]
  }),
  calma: Object.freeze({
    question: "¿Qué tomo para el estrés o la ansiedad del día a día?",
    chooseIf: "Atraviesas una temporada de estrés alto o de tensión sostenida y quieres acompañarla.",
    keywords: ["estrés", "ansiedad leve", "cortisol", "ashwagandha", "concentración"]
  })
});

const CL_GOALS = [
  { id: "todos", label: "Todos" },
  { id: "cabello", label: "Cabello y uñas" },
  { id: "piel", label: "Piel" },
  { id: "digestion", label: "Digestión" },
  { id: "sueno", label: "Sueño" },
  { id: "energia", label: "Energía íntima" },
  { id: "calma", label: "Calma" }
];

/* Duración del frasco en días, derivada de `perDay` y `CL_SERVINGS`. Devuelve
   `{ min, max }`: iguales cuando la pauta es fija, distintos cuando es un rango. */
function clBottleDuration(product) {
  var perDay = product.perDay;
  var range = Object.prototype.toString.call(perDay) === "[object Array]" ? perDay : [perDay, perDay];
  return {
    min: Math.floor(CL_SERVINGS / Math.max.apply(null, range)),
    max: Math.floor(CL_SERVINGS / Math.min.apply(null, range))
  };
}

function clActiveInfo(name) {
  var info = CL_ACTIVES[name];
  if (!info) throw new Error("Activo sin ficha en CL_ACTIVES: " + name);
  return info;
}

function clFindProduct(id) {
  return CL_PRODUCTS.find(function (p) { return p.id === id; }) || null;
}

function clCatalogMinimum(field) {
  return Math.min.apply(null, CL_PRODUCTS.map(function (product) { return product[field]; }));
}

function clCurrentSingleMinimum(now) {
  return Math.min.apply(null, CL_PRODUCTS.map(function (product) { return clSinglePrice(product, now); }));
}

function clWhatsAppDisplay() {
  if (/^593\d{9}$/.test(CL_WHATSAPP)) {
    return "+" + CL_WHATSAPP.slice(0, 3) + " " + CL_WHATSAPP.slice(3, 5) + " " + CL_WHATSAPP.slice(5, 8) + " " + CL_WHATSAPP.slice(8);
  }
  return "+" + CL_WHATSAPP;
}

function clWhatsAppUrl(message) {
  if (!/^\d{8,15}$/.test(CL_WHATSAPP)) return "";
  return "https://wa.me/" + CL_WHATSAPP + (message ? "?text=" + encodeURIComponent(message) : "");
}

function clInstagramUrl() {
  return "https://www.instagram.com/" + encodeURIComponent(CL_INSTAGRAM);
}

function clActivePromo(product, now) {
  var promos = product && CL_PROMOS[product.id];
  if (!promos) return null;
  var timestamp = now instanceof Date ? now.getTime() : (typeof now === "number" ? now : Date.now());
  return promos.find(function (promo) {
    return timestamp >= promo.start && timestamp < promo.end;
  }) || null;
}

// Próxima apertura o cierre absoluto: también funciona antes de la primera campaña.
function clNextPromoBoundary(now) {
  var timestamp = now instanceof Date ? now.getTime() : (typeof now === "number" ? now : Date.now());
  var next = Infinity;
  Object.keys(CL_PROMOS).forEach(function (id) {
    CL_PROMOS[id].forEach(function (promo) {
      if (promo.start > timestamp) next = Math.min(next, promo.start);
      if (promo.end > timestamp) next = Math.min(next, promo.end);
    });
  });
  return Number.isFinite(next) ? next : null;
}

function clSinglePrice(product, now) {
  var promo = clActivePromo(product, now);
  return promo ? promo.price : product.price;
}

// Porcentaje mostrado: se deriva de los precios reales para que nunca los contradiga.
function clPromoPercent(product, now) {
  var promo = clActivePromo(product, now);
  return promo ? Math.round((1 - promo.price / product.price) * 100) : 0;
}

function clHasPacks(product, now) {
  var promo = clActivePromo(product, now);
  return !promo || !promo.singleOnly;
}

function clPromotedProducts(now) {
  return CL_PRODUCTS.filter(function (product) { return clActivePromo(product, now); });
}

/* Bandas de promoción vivas, de mayor a menor descuento: una por fórmula sin `group`
   y una por grupo. Cada banda lleva sus productos (la tienda la oculta cuando el filtro
   no deja ninguno a la vista) y el primero de ellos, del que salen precio y porcentaje. */
function clPromoBands(now) {
  var bands = [];
  clPromotedProducts(now).forEach(function (product) {
    var promo = clActivePromo(product, now);
    var group = promo.group ? CL_PROMO_GROUPS[promo.group] : null;
    if (promo.group && !group) throw new Error("Grupo de promoción sin ficha en CL_PROMO_GROUPS: " + promo.group);
    var band = group && bands.find(function (known) { return known.groupId === promo.group; });
    if (band) {
      band.products.push(product);
      return;
    }
    bands.push({
      groupId: promo.group || "",
      group: group,
      product: product,
      products: [product],
      promo: promo,
      percent: clPromoPercent(product, now)
    });
  });
  return bands.sort(function (a, b) { return b.percent - a.percent; });
}

/* Oferta de la franja superior: una mención por banda («Radiant Skin −40% y toda la
   colección −25% en octubre») o, sin promoción, los packs. La pinta main.js y la
   escribe el generador en el HTML, para que quien no ejecuta JavaScript no lea una
   promo caducada. */
function clCatalogOfferText(now) {
  var bands = clPromoBands(now);
  if (!bands.length) {
    return "Packs x2 por " + clMoney(clCatalogMinimum("pricePack")) + " y x3 por " +
      clMoney(clCatalogMinimum("pricePack3")) + ".";
  }
  var parts = bands.map(function (band) {
    return (band.group ? band.group.label : band.product.short) + " −" + band.percent + "%";
  });
  var offer = parts.length > 1 ? parts.slice(0, -1).join(", ") + " y " + parts[parts.length - 1] : parts[0];
  return offer + " en " + (bands[0].promo.campaignLabel || bands[0].promo.monthLabel);
}

function clBestSingleBundle(product, quantity, now) {
  var qty = Math.min(Math.max(parseInt(quantity, 10) || 0, 0), 99);
  var singleCents = Math.round(clSinglePrice(product, now) * 100);
  if (!clHasPacks(product, now)) {
    return { total: (singleCents * qty) / 100, savings: 0, singles: qty, packs2: 0, packs3: 0 };
  }
  var pack2Cents = Math.round(product.pricePack * 100);
  var pack3Cents = Math.round(product.pricePack3 * 100);
  var best = null;

  for (var packs3 = 0; packs3 <= Math.floor(qty / 3); packs3 += 1) {
    for (var packs2 = 0; packs2 <= Math.floor((qty - packs3 * 3) / 2); packs2 += 1) {
      var singles = qty - packs3 * 3 - packs2 * 2;
      var totalCents = packs3 * pack3Cents + packs2 * pack2Cents + singles * singleCents;
      var packedBottles = packs3 * 3 + packs2 * 2;
      if (!best || totalCents < best.totalCents || (totalCents === best.totalCents && packedBottles > best.packedBottles)) {
        best = {
          totalCents: totalCents,
          packedBottles: packedBottles,
          singles: singles,
          packs2: packs2,
          packs3: packs3
        };
      }
    }
  }

  return {
    total: best.totalCents / 100,
    savings: (singleCents * qty - best.totalCents) / 100,
    singles: best.singles,
    packs2: best.packs2,
    packs3: best.packs3
  };
}

function clMoney(n) {
  return "$" + n.toFixed(2);
}

function clFreeShippingLabel() {
  return "$" + CL_FREE_SHIPPING.toFixed(2).replace(".", ",");
}
