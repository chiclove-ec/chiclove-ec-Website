// Reglas HTTP compartidas por producción y el servidor de verificación.
// Solo APIs web: este módulo se ejecuta también en Cloudflare Pages.
import { MARKDOWN_TWINS, markdownTwinFor } from "./markdown-negotiation.mjs";
import { PRODUCT_PATHS } from "./search-routes.mjs";

/** null fuera de la ruta heredada; 404 si no identifica una fórmula única. */
export function legacyProductRoute(url) {
  if (!/^\/producto(?:\.html)?\/?$/.test(url.pathname)) return null;
  const ids = url.searchParams.getAll("id");
  if (ids.length !== 1 || !Object.hasOwn(PRODUCT_PATHS, ids[0])) return { status: 404 };
  const params = new URLSearchParams(url.searchParams);
  params.delete("id");
  const query = params.toString();
  return { status: 301, location: PRODUCT_PATHS[ids[0]] + (query ? "?" + query : "") };
}

/** Conserva las dimensiones de caché que añadió el servidor antes de negociar. */
export function mergeVary(...values) {
  const tokens = values.filter(Boolean).flatMap((value) => value.split(",").map((token) => token.trim()));
  if (tokens.includes("*")) return "*";
  return [...new Map(tokens.filter(Boolean).map((token) => [token.toLowerCase(), token])).values()].join(", ");
}

/** Las representaciones markdown equivalentes consolidan su URL en el HTML. */
export function searchHeaders(url, status, headers) {
  const result = new Headers(headers);
  if (status === 404) {
    result.set("X-Robots-Tag", "noindex");
    result.set("Vary", mergeVary(result.get("Vary"), "Accept, Accept-Encoding"));
    return result;
  }
  if (status !== 200 || !result.get("Content-Type")?.startsWith("text/markdown")) return result;
  const markdown = url.pathname.endsWith(".md") ? url.pathname : markdownTwinFor(url.pathname);
  const page = Object.entries(MARKDOWN_TWINS).find(([, twin]) => twin === markdown)?.[0];
  if (!page) return result; // Los documentos independientes conservan su identidad.
  const path = page === "/index.html" ? "/" : page.slice(0, -5);
  const canonical = `<${new URL(path, url).href}>; rel="canonical"`;
  const previous = result.get("Link");
  result.set("Link", previous ? previous + ", " + canonical : canonical);
  return result;
}
