// Única fuente de verdad del dominio del sitio.
//
// El sitio publica URLs absolutas en sitios que no admiten rutas relativas:
// `<link rel="canonical">`, `og:url`, los JSON-LD, `sitemap.xml`, `robots.txt`
// y los gemelos markdown. Escribir el dominio a mano en cada uno de ellos hacía
// imposible cambiarlo, así que se declara una vez en `site.config.json`:
//
//   canonicalOrigin  El dominio que el sitio declara como OFICIAL. Es lo que
//                    acaba en el artefacto publicado, lo que ve Google y lo
//                    único que hay que tocar para mudar el sitio de dominio.
//
//   sourceOrigin     El dominio escrito LITERALMENTE en los archivos del
//                    repositorio. El build lo sustituye por `canonicalOrigin`
//                    al copiar a `dist/`, así que mientras los dos coincidan la
//                    reescritura no hace nada.
//
// Mudarse de dominio es, por tanto, cambiar `canonicalOrigin` y desplegar: el
// sitio se sirve declarando el dominio oficial desde cualquier host que lo
// publique, que es justo lo que Google necesita para consolidar la mudanza. Cuando ya no haga
// falta arrastrar la reescritura, `npm run set-origin <url>` reescribe también
// las fuentes y deja los dos valores iguales otra vez.
import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

import { projectRoot } from "./catalog.mjs";

export const CONFIG_FILE = "site.config.json";

/** Un origen válido es `https://host`, sin barra final ni ruta. */
export function assertOrigin(value, field) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${CONFIG_FILE}: falta "${field}"`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${CONFIG_FILE}: "${field}" no es una URL válida: ${value}`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${CONFIG_FILE}: "${field}" debe usar https: ${value}`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${CONFIG_FILE}: "${field}" debe ser solo el origen, sin ruta: ${value}`);
  }
  if (value.endsWith("/")) {
    throw new Error(`${CONFIG_FILE}: "${field}" no debe terminar en barra: ${value}`);
  }
  return value;
}

/** Una fecha de contenido pública debe ser una fecha ISO real, sin hora. */
export function assertContentModified(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${CONFIG_FILE}: "contentModified" debe ser una fecha ISO YYYY-MM-DD`);
  }
  const date = new Date(value + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${CONFIG_FILE}: "contentModified" no es una fecha válida: ${value}`);
  }
  return value;
}

export function loadSiteConfig() {
  const raw = readFileSync(resolve(projectRoot, CONFIG_FILE), "utf8");
  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${CONFIG_FILE} no es JSON válido: ${error.message}`);
  }

  const canonicalOrigin = assertOrigin(config.canonicalOrigin, "canonicalOrigin");
  const sourceOrigin = assertOrigin(config.sourceOrigin, "sourceOrigin");
  if (config.brandName !== "Chic&Love Ecuador") {
    throw new Error(`${CONFIG_FILE}: "brandName" debe ser "Chic&Love Ecuador"`);
  }
  const contentModified = assertContentModified(config.contentModified);

  const cloudflare = config.cloudflare ?? {};
  if (typeof cloudflare.projectName !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(cloudflare.projectName)) {
    throw new Error(`${CONFIG_FILE}: "cloudflare.projectName" debe ser un nombre de proyecto de Pages`);
  }

  return {
    canonicalOrigin,
    sourceOrigin,
    brandName: config.brandName,
    contentModified,
    cloudflare: {
      projectName: cloudflare.projectName,
      productionBranch: cloudflare.productionBranch ?? "main"
    },
    /** El origen con barra final, que es como se concatena para formar URLs. */
    get base() {
      return canonicalOrigin + "/";
    }
  };
}

/**
 * Sustituye el origen escrito en las fuentes por el que se va a publicar.
 *
 * El dominio aparece de dos formas y las dos importan: como origen completo
 * (`https://host`, en canónicas, JSON-LD y sitemap) y como host a secas, en
 * texto que lee una persona — la ficha de empresa de `/about` y el mensaje del
 * 404 lo nombran así. Se sustituye primero el origen completo; lo que quede del
 * host después es, por definición, una aparición desnuda.
 *
 * Si el origen de origen y el de destino coinciden, no toca nada.
 */
export function rewriteOrigin(text, { from, to }) {
  if (from === to) return text;

  // El repositorio de GitHub se llama igual que el dominio de Pages, pero NO se
  // muda con el sitio: las URLs de github.com (insignias del README, `repository`
  // de package.json, el aviso de seguridad) deben quedar intactas. Se apartan
  // antes de reescribir y se devuelven al final.
  const preserved = [];
  const masked = text.replace(GITHUB_URL, (match) => {
    preserved.push(match);
    return `\u0000github:${preserved.length - 1}\u0000`;
  });

  const rewritten = masked
    .split(from)
    .join(to)
    .split(new URL(from).host)
    .join(new URL(to).host);

  return rewritten.replace(/\u0000github:(\d+)\u0000/g, (_, index) => preserved[Number(index)]);
}

/** URLs del repositorio en GitHub, que nunca se mudan de dominio con el sitio. */
const GITHUB_URL = /https:\/\/github\.com\/[^\s"'()<>\]]+/g;

/** Todas las formas en que un origen puede aparecer escrito, para verificarlo. */
export function originTraces(origin) {
  return [origin, new URL(origin).host];
}

/**
 * El texto sin las URLs de github.com, que `rewriteOrigin` deja intactas a
 * propósito. Comprobar sobre esto evita denunciar como resto del dominio viejo
 * lo que en realidad es el nombre del repositorio.
 */
export function withoutGitHubUrls(text) {
  return text.replace(GITHUB_URL, "");
}

/**
 * URL pública de una página a partir de su nombre de archivo.
 *
 * Las URLs del sitio son LIMPIAS (`/tienda`, no `/tienda.html`). Cloudflare Pages
 * redirige `/tienda.html` a `/tienda` con un 308, así que declarar el `.html` en
 * canónicas, sitemap y JSON-LD entregaba a Google URLs que redirigen: la forma
 * limpia es la única que responde 200 directo.
 *
 * El nombre de ARCHIVO no cambia: `tienda.html` se sigue escribiendo y publicando
 * igual. Lo que cambia es la URL con la que el sitio se nombra a sí mismo.
 */
export function pagePath(file) {
  const name = String(file).replace(/\.html$/, "");
  return name === "index" ? "" : name;
}

/**
 * Archivo que sirve una URL pública: el inverso de `pagePath()`.
 *
 * `""` → `index.html`, `tienda` → `tienda.html`. Una ruta que ya trae extensión
 * (`tienda.md`, `llms.txt`) se devuelve tal cual: solo las páginas se publican
 * sin extensión.
 */
export function pageFile(path) {
  const clean = String(path).replace(/^\//, "");
  if (clean === "") return "index.html";
  return /\.[a-z0-9]+$/i.test(clean) ? clean : clean + ".html";
}

/** Extensiones que el build trata como texto y en las que se reescribe el origen. */
export const TEXT_EXTENSIONS = new Set([
  ".html",
  ".md",
  ".txt",
  ".xml",
  ".json",
  ".js",
  ".css",
  ".svg"
]);

/** Artefactos de texto sin extensión: `extname()` no los reconoce. */
const TEXT_FILENAMES = new Set(["_headers"]);

/** ¿Se reescribe el origen en este archivo del artefacto? */
export function isTextArtifact(entry) {
  return TEXT_EXTENSIONS.has(extname(entry)) || TEXT_FILENAMES.has(basename(entry));
}
