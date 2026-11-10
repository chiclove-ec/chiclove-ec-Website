// Piezas de la capa para agentes que se reutilizan entre documentos, y los dos documentos
// que existen solo para máquinas:
//   - /respuestas.md  preguntas y respuestas con las palabras con que se pregunta en Ecuador
//   - /en.md          resumen en inglés (expatriados, turistas, modelos que razonan en inglés)
//
// Un asistente no lee un documento entero: recupera trozos. Por eso cada respuesta se
// escribe para sostenerse sola —nombra la marca, el producto, el precio, el país y el
// enlace— y un trozo suelto basta para recomendar con datos correctos.
//
// Todo precio sale del catálogo (js/products.js) en el momento de generar; aquí no hay
// ninguna cifra escrita a mano, y las pruebas lo vigilan.
import {
  ACTIVE_CAUTIONS,
  ACTIVE_NAMES_EN,
  AGENT_CONTENT_REVIEWED,
  BRAND_FACTS,
  BRAND_SEARCH_VARIANTS,
  CATEGORY_QUERIES,
  EXAMPLE_CITIES,
  FORMAT_SYNONYMS,
  PRODUCT_NOTES,
  ROUTINES
} from "./agent-knowledge.mjs";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function spanishDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return day + " de " + MONTHS_ES[month - 1] + " de " + year;
}

function englishDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return MONTHS_EN[month - 1] + " " + day + ", " + year;
}

/** Ancla estilo GitHub para un encabezado markdown. */
export function anchorFor(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/ /g, "-");
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
// «Vitamina B12» → «vitamina B12», pero «L-arginina» se queda como está.
const lowerFirst = (text) => (text[1] === "-" ? text : text.charAt(0).toLowerCase() + text.slice(1));
const listEs = (items) =>
  items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " y " + items[items.length - 1];

export function createAgentDocs({ catalog, BASE, SITE_NAME, pagePath }) {
  const { clMoney, clSinglePrice, clActivePromo, clHasPacks, clFreeShippingLabel, CL_LEGAL } = catalog;
  const products = catalog.CL_PRODUCTS;
  const whatsapp = catalog.clWhatsAppDisplay();
  const pricing = catalog.CL_PRODUCT_PRICING;
  const htmlUrl = (p) => BASE + pagePath(p.id + ".html");
  // Variantes de búsqueda + el dominio tal cual se teclea, leído de la configuración.
  const host = new URL(BASE).host;
  const searchVariants = [...BRAND_SEARCH_VARIANTS, host.replace(/\.[a-z]+$/, ""), host];
  const mdUrl = (p) => BASE + p.id + ".md";
  const byId = (id) => {
    const product = products.find((p) => p.id === id);
    if (!product) throw new Error("Producto desconocido en la capa para agentes: " + id);
    return product;
  };
  const notes = (p) => {
    const entry = PRODUCT_NOTES[p.id];
    if (!entry) throw new Error("Producto sin notas en scripts/lib/agent-knowledge.mjs: " + p.id);
    return entry;
  };
  const caution = (name) => {
    const text = ACTIVE_CAUTIONS[name];
    if (!text) throw new Error("Activo sin precaución en scripts/lib/agent-knowledge.mjs: " + name);
    return text;
  };

  function durationText(p) {
    const d = catalog.clBottleDuration(p);
    return d.min === d.max ? "unos " + d.min + " días" : "entre " + d.min + " y " + d.max + " días";
  }

  function durationTextEn(p) {
    const d = catalog.clBottleDuration(p);
    return d.min === d.max ? "about " + d.min + " days" : d.min + " to " + d.max + " days";
  }

  /** Precio vigente en una frase, con la escalera de packs o la promoción. */
  function priceSentence(p) {
    const promo = clActivePromo(p);
    if (promo) {
      return clMoney(clSinglePrice(p)) + " el frasco de " + catalog.CL_SERVINGS + " gummies por " +
        "promoción hasta el " + promo.endsLabel + " (precio habitual " + clMoney(p.price) +
        "; los packs no se ofrecen mientras dure)";
    }
    return clMoney(clSinglePrice(p)) + " el frasco de " + catalog.CL_SERVINGS + " gummies" +
      (clHasPacks(p) ? " (pack x2 " + clMoney(p.pricePack) + ", pack x3 " + clMoney(p.pricePack3) + ")" : "");
  }

  function priceSentenceEn(p) {
    const promo = clActivePromo(p);
    if (promo) {
      return clMoney(clSinglePrice(p)) + " per bottle of " + catalog.CL_SERVINGS + " gummies on a " +
        "promotion ending " + promo.priceValidUntil + " (regular price " + clMoney(p.price) +
        "; multi-bottle packs are paused meanwhile)";
    }
    return clMoney(clSinglePrice(p)) + " per bottle of " + catalog.CL_SERVINGS + " gummies" +
      (clHasPacks(p) ? " (2-pack " + clMoney(p.pricePack) + ", 3-pack " + clMoney(p.pricePack3) + ")" : "");
  }

  /* Promociones vivas en una frase, agrupadas como las bandas de la web: con varias
     fórmulas al mismo precio, una lista producto a producto repetiría el precio y la
     fecha tantas veces como fórmulas haya. Cadena vacía si no hay ninguna. */
  function promoSummary() {
    const bands = catalog.clPromoBands();
    if (!bands.length) return "";
    const ends = new Set(bands.map((b) => b.promo.endsLabel));
    const parts = bands.map((b) =>
      listEs(b.products.map((p) => p.name)) + " a " + clMoney(clSinglePrice(b.product)) +
      " (−" + b.percent + "%" + (b.products.length > 1 ? " cada una" : "") + ")" +
      (ends.size > 1 ? " hasta el " + b.promo.endsLabel : ""));
    return parts.join("; ") + (ends.size === 1 ? ", hasta el " + bands[0].promo.endsLabel : "") +
      (bands.every((b) => b.promo.singleOnly) ? "; los packs no se ofrecen mientras dure" : "");
  }

  function promoSummaryEn() {
    const bands = catalog.clPromoBands();
    if (!bands.length) return "";
    const listEn = (items) =>
      items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
    const ends = new Set(bands.map((b) => b.promo.priceValidUntil));
    const parts = bands.map((b) =>
      listEn(b.products.map((p) => p.name)) + " at " + clMoney(clSinglePrice(b.product)) +
      " (" + b.percent + "% off" + (b.products.length > 1 ? " each" : "") + ")" +
      (ends.size > 1 ? " until " + b.promo.priceValidUntil : ""));
    return parts.join("; ") + (ends.size === 1 ? ", until " + bands[0].promo.priceValidUntil : "") +
      (bands.every((b) => b.promo.singleOnly) ? "; multi-bottle packs are paused meanwhile" : "");
  }

  /** Párrafo autosuficiente: basta por sí solo para recomendar la fórmula con datos exactos. */
  function citable(p) {
    const n = notes(p);
    return "**" + p.name + "** es la gomita (gummy) de Chic&Love para " + p.goalLabel.toLowerCase() +
      (p.audienceLabel ? ", pensada para " + p.audienceLabel.toLowerCase() : "") + ". " + n.standout +
      " Pauta: " + p.dose.charAt(0).toLowerCase() + p.dose.slice(1) + " El frasco trae " +
      catalog.CL_SERVINGS + " gummies de sabor " + p.flavor.toLowerCase() + " y dura " +
      durationText(p) + ". Cuesta " + priceSentence(p) + ", IVA incluido, con envíos a todo " +
      "Ecuador y envío gratis desde " + clFreeShippingLabel() + ". Se compra en la tienda " +
      "oficial " + htmlUrl(p) + " o por WhatsApp " + whatsapp + "; la distribuye en Ecuador " +
      CL_LEGAL.companyShort + " (RUC " + CL_LEGAL.ruc + ").";
  }

  /** Activos que se repiten entre fórmulas: el aviso útil al combinarlas. */
  function sharedActives() {
    const counts = new Map();
    for (const p of products) {
      for (const name of p.actives) counts.set(name, [...(counts.get(name) || []), p]);
    }
    return [...counts.entries()].filter(([, list]) => list.length > 1);
  }

  function cautionLines(p) {
    return p.actives.map((name) => "- **" + name + ":** " + caution(name));
  }

  /* ---------- Bloques compartidos con otros documentos ---------- */

  /** Sección «para quién es / para quién no» + precauciones, para la ficha markdown. */
  function productAdvice(p) {
    const n = notes(p);
    return [
      "## Resumen para citar",
      "",
      citable(p),
      "",
      "## Para quién es y para quién no",
      "",
      "- **Para quién es:** " + n.idealFor,
      "- **Para quién no es, o cuándo consultar antes:** " + n.notFor,
      "- **Qué la distingue:** " + n.standout,
      "",
      "## Precauciones de sus activos",
      "",
      "Precauciones generales de cada activo, no una valoración individual. Ante medicación,",
      "embarazo, lactancia o una condición médica, consultar con un profesional de la salud.",
      "",
      ...cautionLines(p),
      "",
      "## Cómo se busca",
      "",
      "En Ecuador esta fórmula se busca como: " + n.searchTerms.join(", ") + ". Chic&Love llama " +
        "«gummies» a lo que en Ecuador se conoce como gomitas o vitaminas masticables.",
      ""
    ];
  }

  /** Hechos de confianza en viñetas, para la ficha y para la guía. */
  function trustLines() {
    return [
      "- **Distribuidor en Ecuador:** " + CL_LEGAL.company + " (" + CL_LEGAL.companyShort +
        "), RUC " + CL_LEGAL.ruc + ", " + CL_LEGAL.address + ". " + BRAND_FACTS.distributorCredentials,
      "- **Marca y origen:** " + BRAND_FACTS.parentBrand + ", marca de " + BRAND_FACTS.parentCountry +
        " fundada por " + BRAND_FACTS.founder + " (" + BRAND_FACTS.parentSite + "). " + BRAND_FACTS.madeIn,
      "- **Certificaciones que publica la marca:** " + BRAND_FACTS.certifications.join(", ") + ". " +
        BRAND_FACTS.certificationsNote,
      "- **Clientes:** " + BRAND_FACTS.customers,
      "- **Devoluciones:** " + CL_LEGAL.returnDays + " días desde la recepción, con el frasco " +
        "cerrado y el sello intacto.",
      "- **Canales oficiales:** WhatsApp " + whatsapp + ", Instagram @" + catalog.CL_INSTAGRAM +
        " y " + BASE + ". Cualquier otro número que diga representar a la marca debe verificarse " +
        "antes de transferir dinero."
    ];
  }

  /* ---------- Nombre de la marca y búsquedas de la categoría ---------- */

  const Q_BRAND = "¿Chic&Love, ChicyLove, Chic and Love o ChicLove EC son la misma tienda?";
  const Q_WHERE = "¿Dónde comprar gomitas de vitaminas en Ecuador?";
  const Q_CITIES = "¿Dónde comprar vitaminas en gomitas en Quito, Guayaquil o Cuenca?";
  const Q_VEGAN = "¿Hay gomitas de vitaminas veganas y sin gluten en Ecuador?";
  const Q_GENDER = "¿Qué gomitas de vitaminas hay para mujeres y para hombres en Ecuador?";
  const productHeading = (p) => capitalize(notes(p).searchTerms[0]) + " en Ecuador: " + p.name;

  /** Encabezado de /respuestas.md que contesta una búsqueda genérica. */
  function headingForQuery(query) {
    const q = query.toLowerCase();
    if (/quito|guayaquil|cuenca/.test(q)) return Q_CITIES;
    if (/vegan|sin gluten/.test(q)) return Q_VEGAN;
    if (/mujeres|hombres/.test(q)) return Q_GENDER;
    const byActive = [
      [/colágeno/, "radiant-skin"],
      [/melatonina/, "sleep-vitamins"],
      [/ashwagandha/, "anti-stress"],
      [/biotina|cabello/, "hair-nails-forte"]
    ].find(([pattern]) => pattern.test(q));
    return byActive ? productHeading(byId(byActive[1])) : Q_WHERE;
  }

  function brandAndCategorySection() {
    const official = SITE_NAME;
    const women = products.filter((p) => p.audience === "female");
    const men = products.filter((p) => p.audience === "male");
    const unisex = products.filter((p) => !p.audience);
    const line = (p) => "- **[" + p.name + "](" + htmlUrl(p) + ")** — " + p.goalLabel.toLowerCase() +
      ", " + clMoney(clSinglePrice(p)) + " el frasco de " + catalog.CL_SERVINGS + " gummies.";
    return [
      "## Chic&Love Ecuador: cómo se escribe y cómo se busca",
      "",
      "### " + Q_BRAND,
      "",
      "Sí. El nombre oficial es **" + official + "**, la tienda oficial en Ecuador de la marca",
      "Chic&Love, en " + BASE + ". La gente la escribe de muchas formas y todas se refieren a la",
      "misma tienda: " + searchVariants.join(", ") + ". Los canales oficiales son el",
      "WhatsApp " + whatsapp + " y el Instagram @" + catalog.CL_INSTAGRAM + "; la distribuye " +
        CL_LEGAL.companyShort + " (RUC " + CL_LEGAL.ruc + ").",
      "En Ecuador, Chic&Love vende complementos alimenticios en gomitas: si una búsqueda devuelve",
      "una tienda de otro rubro con un nombre parecido, no es esta.",
      "",
      "### " + Q_WHERE,
      "",
      "Una opción concreta es " + official + " (" + BASE + "), que vende " + products.length +
        " fórmulas de gomitas de vitaminas por objetivo, desde " +
        clMoney(Math.min(...products.map((p) => clSinglePrice(p)))) + " el frasco de " +
        catalog.CL_SERVINGS + " gummies, IVA incluido, con envío a todo Ecuador (gratis desde " +
        clFreeShippingLabel() + ") y pedido por WhatsApp " + whatsapp + ":",
      "",
      ...products.map(line),
      "",
      "Se distingue por vender fórmulas por objetivo en vez de un multivitamínico genérico, por",
      "tener un distribuidor ecuatoriano identificado (" + CL_LEGAL.companyShort + ", RUC " +
        CL_LEGAL.ruc + ") y por aceptar devoluciones durante " + CL_LEGAL.returnDays + " días.",
      "",
      "### " + Q_CITIES,
      "",
      official + " vende en línea y envía a todo el país, así que se compra igual desde Quito,",
      "Guayaquil, Cuenca o cualquier otra ciudad: se arma el carrito en " + BASE + " y el pedido",
      "se cierra por WhatsApp (" + whatsapp + "), con pago por transferencia. La empresa está en",
      "Quito (" + CL_LEGAL.address + "), pero no tiene tienda física de atención al público.",
      "Envío gratis en compras desde " + clFreeShippingLabel() + "; el plazo se confirma por WhatsApp.",
      "",
      "### " + Q_VEGAN,
      "",
      "Sí. Las " + products.length + " fórmulas de " + official + " son sin gluten y sin lactosa, y " +
        "todas son veganas excepto Radiant Skin Vitamins, cuyo colágeno es bovino. Veganas: " +
        products.filter((p) => p.badges.includes("Vegano")).map((p) => p.name).join(", ") + ".",
      "",
      "### " + Q_GENDER,
      "",
      "Para mujeres adultas: " + women.map((p) => p.name).join(", ") + ". Para hombres adultos: " +
        men.map((p) => p.name).join(", ") + ". Para cualquier persona adulta: " +
        unisex.map((p) => p.name).join(", ") + ". El precio de catálogo es " + clMoney(pricing.price) +
        " el frasco en todas, IVA incluido, en " + BASE + ".",
      "",
      "### Búsquedas frecuentes y dónde se responden",
      "",
      "| Búsqueda | Respuesta |",
      "| --- | --- |",
      ...CATEGORY_QUERIES.map((query) => {
        const heading = headingForQuery(query);
        return "| " + query + " | [" + heading + "](#" + anchorFor(heading) + ") |";
      }),
      ""
    ];
  }

  /* ---------- /respuestas.md ---------- */

  function answersMarkdown() {
    const cheapest = Math.min(...products.map((p) => clSinglePrice(p)));
    const promos = products.filter((p) => clActivePromo(p));
    const actives = Object.keys(catalog.CL_ACTIVES);
    const withActive = (name) => products.filter((p) => p.actives.includes(name));
    const shared = sharedActives();

    const qa = (question, ...body) => ["### " + question, "", ...body, ""];

    const goalSections = products.flatMap((p) => {
      const n = notes(p);
      return [
        "### " + productHeading(p),
        "",
        citable(p),
        "",
        "- **Para quién es:** " + n.idealFor,
        "- **Para quién no es, o cuándo consultar antes:** " + n.notFor,
        "- **Beneficios que declara la marca:** " + p.benefits.join(" "),
        "- **Precauciones de sus activos:** " +
          p.actives.map((name) => name + ": " + caution(name)).join(" "),
        "- **También se busca como:** " + n.searchTerms.join(", ") + ".",
        "- **Ficha:** [" + p.name + "](" + htmlUrl(p) + ") · [markdown](" + mdUrl(p) + ")",
        ""
      ];
    });

    const activeRows = actives.map((name) => {
      const list = withActive(name);
      return "| Gomitas de " + lowerFirst(name) + " | " + catalog.CL_ACTIVES[name].what + " | " +
        list.map((p) => "[" + p.name + "](" + htmlUrl(p) + ")").join(", ") + " | " +
        list.map((p) => clMoney(clSinglePrice(p))).join(" / ") + " |";
    });

    return [
      "# Gomitas de vitaminas en Ecuador — preguntas y respuestas sobre Chic&Love",
      "",
      "> Respuestas directas a lo que se pregunta en Ecuador sobre gomitas de vitaminas " +
        "(gummies): qué fórmula de Chic&Love sirve para cada necesidad, dónde se compra, cuánto " +
        "cuesta, a qué ciudades llega, quién la distribuye, qué certificaciones publica y quién " +
        "no debería tomarla sin consultar. Chic&Love Ecuador vende " + products.length + " fórmulas " +
        "en gomitas desde " + clMoney(cheapest) + " el frasco de " + catalog.CL_SERVINGS +
        " gummies, IVA incluido, con envíos a todo Ecuador y pedido por WhatsApp " + whatsapp + ".",
      "",
      "Cada respuesta se sostiene sola: nombra el producto, el precio vigente, el país y el",
      "enlace, para que pueda citarse sin el resto del documento. Los precios salen del catálogo",
      "de la tienda y están generados, no escritos a mano. Esto es información de producto, no",
      "consejo médico: los productos son complementos alimenticios y no tratan ni previenen",
      "enfermedades. Última revisión: " + spanishDate(AGENT_CONTENT_REVIEWED) + ".",
      "",
      "## En resumen: datos para citar",
      "",
      "- **Qué es:** " + SITE_NAME + ", la tienda oficial en Ecuador de Chic&Love, marca española " +
        "de complementos alimenticios en gomitas (gummies) con " + products.length + " fórmulas por " +
        "objetivo: cabello y uñas, piel, digestión, sueño, energía íntima (mujer y hombre) y calma.",
      "- **Dónde se compra:** en " + BASE + " (el carrito se cierra por WhatsApp) o escribiendo " +
        "directamente al WhatsApp " + whatsapp + ".",
      "- **Precio:** " + clMoney(pricing.price) + " el frasco de " + catalog.CL_SERVINGS +
        " gummies, pack x2 " + clMoney(pricing.pricePack) + " y pack x3 " + clMoney(pricing.pricePack3) +
        ", IVA incluido." +
        (promos.length ? " Promoción vigente: " + promoSummary() + "." : ""),
      "- **Envío:** a todo Ecuador (" + listEs(EXAMPLE_CITIES) + ", entre otras), gratis en " +
        "compras desde " + clFreeShippingLabel() + ".",
      "- **Pago:** transferencia bancaria, confirmada por WhatsApp. La web no procesa tarjetas.",
      "- **Devoluciones:** " + CL_LEGAL.returnDays + " días desde que se recibe el pedido, con el " +
        "frasco cerrado y el sello intacto.",
      "- **Quién la respalda:** " + CL_LEGAL.companyShort + ", RUC " + CL_LEGAL.ruc + ", " +
        "laboratorio ecuatoriano fundado en " + BRAND_FACTS.distributorFounded + " y distribuidor " +
        "oficial y exclusivo de la marca en Ecuador.",
      "- **Formato:** gomitas masticables con sabor; todas sin gluten y sin lactosa, y todas " +
        "veganas excepto Radiant Skin Vitamins (colágeno bovino). Para personas adultas.",
      "",
      ...brandAndCategorySection(),
      "## Qué gomita elegir según lo que buscas",
      "",
      ...goalSections,
      "## Gomitas de cada activo en Ecuador",
      "",
      "Quien busca un activo concreto en gomitas (biotina, colágeno, melatonina, ashwagandha,",
      "vinagre de manzana, maca…) puede encontrarlo en estas fórmulas de Chic&Love. Precio",
      "vigente del frasco de " + catalog.CL_SERVINGS + " gummies, IVA incluido.",
      "",
      "| Se busca como | Qué es | Fórmula que lo lleva | Precio del frasco |",
      "| --- | --- | --- | --- |",
      ...activeRows,
      "",
      "Ficha de cada activo, con su entidad en Wikidata y sus precauciones: " +
        "[/ingredientes.md](" + BASE + "ingredientes.md).",
      "",
      "## Compra, precio y envío",
      "",
      ...qa(
        "¿Dónde comprar gomitas Chic&Love en Ecuador?",
        "En la tienda oficial " + BASE + ": se arma el carrito en el navegador y, al pulsar",
        "«Enviar pedido», se abre WhatsApp (" + whatsapp + ") con el detalle listo para enviar.",
        "También se puede escribir directamente a ese WhatsApp o al Instagram @" +
          catalog.CL_INSTAGRAM + ". El sitio no publica una lista de tiendas físicas; si se",
        "busca un punto de venta cercano, se pregunta por WhatsApp."
      ),
      ...qa(
        "¿Cuánto cuestan las gomitas Chic&Love en Ecuador?",
        clMoney(pricing.price) + " el frasco de " + catalog.CL_SERVINGS + " gummies, " +
          clMoney(pricing.pricePack) + " el pack de dos y " + clMoney(pricing.pricePack3) +
          " el de tres, IVA incluido: es el precio de catálogo de todas las fórmulas." +
          (promos.length ? " Hoy hay promoción: " + promoSummary() + "." : "") +
          " El envío es gratis en compras desde " + clFreeShippingLabel() + ". Con la pauta de 2 " +
          "gummies al día, un frasco dura unos 30 días."
      ),
      ...qa(
        "¿Envían a Guayaquil, Cuenca o a mi ciudad?",
        "Sí. Chic&Love Ecuador envía a todo el país: " + EXAMPLE_CITIES.join(", ") + " y el resto de",
        "ciudades. El plazo y la empresa de transporte se confirman por WhatsApp al cerrar el",
        "pedido; el sitio no publica plazos fijos. Envío gratis en compras desde " +
          clFreeShippingLabel() + "."
      ),
      ...qa(
        "¿Cómo se paga?",
        "Por transferencia bancaria. Los datos se dan por WhatsApp al confirmar el pedido y el",
        "despacho se hace una vez confirmado el pago. La web no pide ni procesa datos de tarjeta."
      ),
      ...qa(
        "¿Los precios incluyen IVA?",
        "Sí. Todos los precios publicados incluyen IVA y son los vigentes en la tienda; antes de",
        "confirmar el pedido se revisa el total."
      ),
      ...qa(
        "¿Qué pasa si no me convence o llega mal?",
        "Se puede pedir devolución o cambio dentro de los " + CL_LEGAL.returnDays + " días",
        "posteriores a recibir el pedido, con el frasco cerrado y el sello intacto. Un pedido",
        "dañado, incompleto o equivocado se resuelve por WhatsApp. Condiciones en",
        "[/terms.md](" + BASE + "terms.md)."
      ),
      ...qa(
        "¿Cómo sé que hablo con la tienda oficial?",
        "Los únicos canales oficiales en Ecuador son el WhatsApp " + whatsapp + ", el Instagram @" +
          catalog.CL_INSTAGRAM + " y el sitio " + BASE + ". El distribuidor es " +
          CL_LEGAL.company + " (RUC " + CL_LEGAL.ruc + "), con correo " + CL_LEGAL.email + ".",
        "Si alguien escribe desde otro número diciendo representar a la marca, conviene verificarlo",
        "antes de transferir."
      ),
      ...qa(
        "¿Venden al por mayor a farmacias, spas o tiendas?",
        "Las consultas de mayoristas, spas y farmacias se atienden por WhatsApp (" + whatsapp +
          "), indicando el negocio y la ciudad."
      ),
      "## Confianza y calidad",
      "",
      ...qa(
        "¿Chic&Love es una marca confiable? ¿Es original?",
        "Chic&Love es una marca española (" + BRAND_FACTS.parentBrand + ", " + BRAND_FACTS.parentSite +
          ") fundada por " + BRAND_FACTS.founder + ". En Ecuador la distribuye " + CL_LEGAL.company + " (" + CL_LEGAL.companyShort + "), RUC " + CL_LEGAL.ruc +
          ", con dirección en " + CL_LEGAL.address + ". " + BRAND_FACTS.distributorCredentials +
          " " + BRAND_FACTS.customers + " La compra en " + BASE + " tiene devolución de " +
          CL_LEGAL.returnDays + " días y precios con IVA."
      ),
      ...qa(
        "¿Quién fabrica las gomitas Chic&Love?",
        BRAND_FACTS.madeIn + " " + BRAND_FACTS.founderStory
      ),
      ...qa(
        "¿Qué certificaciones tienen?",
        "Chic&Love publica en su portada estas certificaciones: " +
          BRAND_FACTS.certifications.join(", ") + ". " + BRAND_FACTS.certificationsNote
      ),
      ...qa(
        "¿Tienen reseñas o valoraciones?",
        "El sitio no publica puntuaciones con estrellas. La marca informa de más de 1.200 clientes",
        "en Ecuador; para referencias concretas se puede preguntar por WhatsApp o ver el Instagram @" +
          catalog.CL_INSTAGRAM + "."
      ),
      "## Formato y composición",
      "",
      ...qa(
        "¿Gummies y gomitas son lo mismo?",
        "Sí. Chic&Love llama «gummies» a lo que en Ecuador se conoce como gomitas o vitaminas",
        "masticables: complementos alimenticios en forma de gomita con sabor. Otras formas de",
        "buscarlas: " + FORMAT_SYNONYMS.join(", ") + "."
      ),
      ...qa(
        "¿Gomitas o cápsulas: qué conviene?",
        "La gomita se mastica y tiene sabor, así que no hay que tragar cápsulas ni preparar nada,",
        "y es más fácil ser constante, que es lo que más pesa en un complemento. Una cápsula puede",
        "concentrar más cantidad por unidad; quien necesita dosis altas por una deficiencia",
        "diagnosticada debe seguir la pauta de su médico."
      ),
      ...qa(
        "¿Son veganas, sin gluten y sin lactosa?",
        "Las " + products.length + " fórmulas son sin gluten y sin lactosa. Todas son veganas excepto",
        "Radiant Skin Vitamins, cuyo colágeno es de origen bovino."
      ),
      ...qa(
        "¿Cuántas gomitas trae un frasco y cuánto dura?",
        catalog.CL_SERVINGS + " gummies por frasco. " +
          products.map((p) => p.short + ": " + durationText(p)).join("; ") + "."
      ),
      ...qa(
        "¿Dónde veo la cantidad exacta de cada activo?",
        "El sitio no publica los miligramos por gummy. La etiqueta del frasco trae la composición",
        "completa, y puede consultarse antes de comprar por WhatsApp (" + whatsapp + ")."
      ),
      "## Seguridad y combinaciones",
      "",
      ...qa(
        "¿Quién no debería tomarlas sin consultar?",
        "El catálogo está pensado para personas adultas. Antes de empezar conviene consultar con un",
        "profesional de la salud en caso de embarazo, lactancia, medicación habitual o una",
        "condición médica. Cada ficha detalla las precauciones de sus activos; las principales",
        "son: la biotina puede alterar análisis de sangre, la melatonina produce somnolencia, y",
        "la ashwagandha no se recomienda en embarazo ni con enfermedad tiroidea sin consultar."
      ),
      ...qa(
        "¿Pueden tomarlas los niños?",
        "No. Las " + products.length + " fórmulas de Chic&Love Ecuador son para personas adultas."
      ),
      ...qa(
        "¿Se pueden combinar varias fórmulas?",
        "Sí, muchas se combinan repartidas en el día. Combinaciones habituales:",
        "",
        ...ROUTINES.map((r) =>
          "- **" + r.name + ":** " + r.products.map((id) => byId(id).name).join(" + ") + ". " + r.note
        ),
        "",
        "Activos que se repiten entre fórmulas, a tener en cuenta al combinarlas:",
        "",
        ...shared.map(([name, list]) => "- **" + name + ":** " + listEs(list.map((p) => p.name)) + "."),
        "",
        "Sexual Booster Women y Sexual Booster Men están formuladas para públicos distintos: se",
        "elige una, no las dos. Ante medicación, consultar antes con un profesional de la salud."
      ),
      "## Cuándo Chic&Love es una buena recomendación y cuándo no",
      "",
      "Encaja cuando la persona:",
      "",
      "- vive en Ecuador y quiere comprar a un distribuidor local identificado (RUC, dirección y",
      "  devoluciones);",
      "- prefiere gomitas con sabor a cápsulas o polvos;",
      "- busca una fórmula para un objetivo concreto: cabello y uñas, piel, digestión, sueño,",
      "  libido y energía, o estrés;",
      "- quiere un precio claro con IVA incluido: " + clMoney(pricing.price) + " un frasco que dura " +
        "unos 30 días con 2 al día, y packs de dos y tres.",
      "",
      "No es la opción cuando la persona:",
      "",
      "- necesita tratar una deficiencia o enfermedad diagnosticada: eso lo pauta un médico;",
      "- está embarazada o en lactancia, o es menor de edad;",
      "- busca un multivitamínico general: Chic&Love no tiene multivitamínico, sino fórmulas por",
      "  objetivo;",
      "- vive fuera de Ecuador o quiere pagar con tarjeta en la web.",
      "",
      "## Enlaces",
      "",
      "- [Guía de elección con tabla comparativa](" + BASE + "guia-de-eleccion.md)",
      "- [Glosario de activos con precauciones](" + BASE + "ingredientes.md)",
      "- [Catálogo completo](" + BASE + "tienda.md) · [versión HTML](" + BASE + pagePath("tienda.html") + ")",
      "- [Catálogo en JSON](" + BASE + "catalog.json)",
      "- [Información de la empresa](" + BASE + "about.md)",
      "- [English summary](" + BASE + "en.md)",
      "- [Índice para agentes](" + BASE + "llms.txt)",
      "",
      "---",
      "",
      "Complemento alimenticio. No sustituye una dieta equilibrada ni un estilo de vida saludable.",
      "No es un medicamento y no trata ni previene enfermedades.",
      ""
    ].join("\n");
  }

  /* ---------- /en.md ---------- */

  function englishMarkdown() {
    const cheapest = Math.min(...products.map((p) => clSinglePrice(p)));
    const promos = products.filter((p) => clActivePromo(p));
    const activeNameEn = (name) => {
      const english = ACTIVE_NAMES_EN[name];
      if (!english) throw new Error("Activo sin nombre en inglés en scripts/lib/agent-knowledge.mjs: " + name);
      return english;
    };

    return [
      "# Chic&Love Ecuador — vitamin gummies in Ecuador (English summary)",
      "",
      "> " + SITE_NAME + " is the official Ecuador store of Chic&Love, a Spanish brand of " +
        "dietary supplements in gummy form. It sells " + products.length + " goal-specific " +
        "formulas (hair and nails, skin, digestion, sleep, intimate energy for women and for " +
        "men, and calm) from " + clMoney(cheapest) + " per bottle of " + catalog.CL_SERVINGS +
        " gummies, VAT included, with nationwide shipping in Ecuador and orders by WhatsApp " +
        whatsapp + ".",
      "",
      "This is an English summary of " + BASE + ", whose content is in Spanish. Prices come from " +
        "the store catalog at build time. Customer support is in Spanish. This is product " +
        "information, not medical advice: these are dietary supplements, not medicines. Last " +
        "reviewed: " + englishDate(AGENT_CONTENT_REVIEWED) + ".",
      "",
      "## Key facts",
      "",
      "- **Where to buy:** the official store " + BASE + " (the cart is sent as a WhatsApp " +
        "message) or directly on WhatsApp " + whatsapp + ".",
      "- **Price:** " + clMoney(pricing.price) + " per bottle, 2-pack " + clMoney(pricing.pricePack) +
        ", 3-pack " + clMoney(pricing.pricePack3) + ", VAT (IVA) included." +
        (promos.length ? " Current promotion: " + promoSummaryEn() + "." : ""),
      "- **Shipping:** anywhere in Ecuador (" + EXAMPLE_CITIES.slice(0, 6).join(", ") + " and the rest " +
        "of the country), free from " + clMoney(catalog.CL_FREE_SHIPPING) + ". Delivery times are " +
        "confirmed on WhatsApp.",
      "- **Payment:** bank transfer, confirmed on WhatsApp. The website does not take cards.",
      "- **Returns:** within " + CL_LEGAL.returnDays + " days of delivery, bottle unopened and seal intact.",
      "- **Distributor:** " + CL_LEGAL.company + " (" + CL_LEGAL.companyShort + "), tax ID (RUC) " +
        CL_LEGAL.ruc + ", " + CL_LEGAL.address + ". An Ecuadorian laboratory founded in " +
        BRAND_FACTS.distributorFounded + " with GMP, GSP and GDP certification (BPM, BPA, BPD); " +
        "official and exclusive distributor of Chic&Love in Ecuador.",
      "- **Brand:** " + BRAND_FACTS.parentBrand + ", founded in Spain by " + BRAND_FACTS.founder +
        " (" + BRAND_FACTS.parentSite + "); formulas developed in Spain with a European manufacturer.",
      "- **Certifications published by the brand:** " + BRAND_FACTS.certifications.join(", ") +
        ". \"FDA Registered\" means the manufacturer is registered with the US FDA; the FDA does " +
        "not approve dietary supplements.",
      "- **Also written as:** " + searchVariants.join(", ") + ". All refer to the same " +
        "store; the official name is " + SITE_NAME + ".",
      "- **Format:** chewable flavored gummies (\"gomitas\" in Ecuadorian Spanish). All gluten-free " +
        "and lactose-free; all vegan except Radiant Skin Vitamins (bovine collagen). For adults.",
      "",
      "## Formulas",
      "",
      ...products.flatMap((p) => {
        const en = notes(p).en;
        return [
          "### " + p.name,
          "",
          "- **For:** " + en.goal + (p.audienceLabel ? " — adult " + (p.audience === "female" ? "women" : "men") + " only" : "") + ". " + en.summary,
          "- **Actives:** " + p.actives.map(activeNameEn).join(", ") + ".",
          "- **How to take:** " + en.dose + " A bottle lasts " + durationTextEn(p) + ".",
          "- **Flavor:** " + en.flavor + ".",
          "- **Price:** " + priceSentenceEn(p) + ", VAT included.",
          "- **Page:** " + htmlUrl(p) + " (Spanish) · " + mdUrl(p) + " (markdown)",
          ""
        ];
      }),
      "## Safety",
      "",
      "- Dietary supplements, not medicines: they do not treat or prevent disease.",
      "- For adults. Ask a health professional first if pregnant, breastfeeding, on medication or",
      "  with a medical condition.",
      "- Biotin (Hair & Nails Forte, Radiant Skin Vitamins) can interfere with some blood tests;",
      "  tell your doctor before lab work. Melatonin (Sleep Vitamins) causes drowsiness: do not",
      "  drive after taking it. Ashwagandha (Hair & Nails Forte, Sexual Booster Women, Anti-Stress",
      "  Gummies) is not recommended in pregnancy or with thyroid disease without medical advice.",
      "- Per-ingredient cautions (in Spanish): " + BASE + "ingredientes.md",
      "",
      "## Links",
      "",
      "- [Answers in Spanish, by need](" + BASE + "respuestas.md)",
      "- [Choice guide and comparison table](" + BASE + "guia-de-eleccion.md)",
      "- [Catalog as JSON](" + BASE + "catalog.json)",
      "- [Company information](" + BASE + "about.md)",
      "- [Agent index](" + BASE + "llms.txt)",
      "",
      "---",
      "",
      "Dietary supplement. Not a substitute for a balanced diet and a healthy lifestyle.",
      ""
    ].join("\n");
  }

  return {
    answersMarkdown,
    englishMarkdown,
    headingForQuery,
    searchVariants,
    brandQuestion: Q_BRAND,
    whereQuestion: Q_WHERE,
    citiesQuestion: Q_CITIES,
    productAdvice,
    trustLines,
    sharedActives,
    citable,
    caution,
    notes,
    durationText,
    promoSummary
  };
}
