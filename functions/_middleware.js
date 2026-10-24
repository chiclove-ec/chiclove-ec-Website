// Cloudflare Pages Function: negociación de contenido `Accept: text/markdown`.
//
// Cloudflare Pages es el único destino de despliegue del proyecto, y el único de los
// hosts soportados capaz de negociar por cabecera (Netlify y Vercel no; ver README).
// La lógica vive en scripts/lib/markdown-negotiation.mjs para poder testearla.
import {
  MARKDOWN_CONTENT_TYPE,
  negotiationHeaders,
  planResponse,
  prefersMarkdown
} from "../scripts/lib/markdown-negotiation.mjs";
import { legacyProductRoute, mergeVary, searchHeaders } from "../scripts/lib/search-indexing.mjs";
import { VERIFICATION_FILES } from "../scripts/lib/search-routes.mjs";

// Los enlaces de recuperación salen del origen de la propia petición: así el
// mensaje sigue siendo correcto en cualquier dominio o preview, sin configurar nada.
function notAcceptableBody(origin) {
  return [
    "# 406 Not Acceptable",
    "",
    "Este recurso solo existe como `text/html` y `text/markdown`.",
    "Repite la petición con `Accept: text/markdown` o `Accept: text/html`.",
    "",
    "- Índice para agentes: " + origin + "/llms.txt",
    "- Mapa del sitio: " + origin + "/sitemap.xml",
    ""
  ].join("\n");
}

function withNegotiationHeaders(headers, markdownPath) {
  const merged = new Headers(headers);
  for (const [key, value] of Object.entries(negotiationHeaders(markdownPath))) {
    merged.set(key, key === "Vary" ? mergeVary(merged.get(key), value) : value);
  }
  return merged;
}

export async function onRequest(context) {
  const response = await respond(context);
  return new Response(context.request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: searchHeaders(new URL(context.request.url), response.status, response.headers)
  });
}

async function respond(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  if (request.method === "GET" || request.method === "HEAD") {
    // Google debe poder leer el testigo exacto sin la normalización .html de Pages.
    if (Object.hasOwn(VERIFICATION_FILES, url.pathname)) {
      return new Response(request.method === "HEAD" ? null : VERIFICATION_FILES[url.pathname], {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=0, must-revalidate",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "X-Robots-Tag": "noindex"
        }
      });
    }
    const legacy = legacyProductRoute(url);
    if (legacy?.location) return new Response(null, { status: legacy.status, headers: { Location: legacy.location } });
    if (legacy?.status === 404) {
      const markdown = prefersMarkdown(request.headers.get("accept"));
      const asset = await env.ASSETS.fetch(new URL(markdown ? "/404.md" : "/404", url).toString());
      const headers = withNegotiationHeaders(asset.headers, "/404.md");
      headers.set("Content-Type", markdown ? MARKDOWN_CONTENT_TYPE : "text/html; charset=utf-8");
      return new Response(request.method === "HEAD" ? null : asset.body, { status: 404, headers });
    }
  }
  const plan = planResponse({
    pathname: url.pathname,
    accept: request.headers.get("accept")
  });

  if (plan.kind === "passthrough") {
    const response = await next();
    // El 404 también se negocia: un agente que pide markdown recibe /404.md.
    if (response.status === 404 && prefersMarkdown(request.headers.get("accept"))) {
      const notFound = await env.ASSETS.fetch(new URL("/404.md", url).toString());
      if (notFound.ok) {
        const headers = withNegotiationHeaders(notFound.headers, "/404.md");
        headers.set("Content-Type", MARKDOWN_CONTENT_TYPE);
        return new Response(request.method === "HEAD" ? null : notFound.body, {
          status: 404,
          headers
        });
      }
    }
    return response;
  }

  if (plan.kind === "notAcceptable") {
    return new Response(notAcceptableBody(new URL(request.url).origin), {
      status: 406,
      headers: withNegotiationHeaders(
        {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "no-referrer"
        },
        plan.markdownPath
      )
    });
  }

  if (plan.kind === "markdown") {
    const asset = await env.ASSETS.fetch(new URL(plan.markdownPath, url).toString());
    if (asset.ok) {
      const headers = withNegotiationHeaders(asset.headers, plan.markdownPath);
      headers.set("Content-Type", MARKDOWN_CONTENT_TYPE);
      return new Response(request.method === "HEAD" ? null : asset.body, {
        status: 200,
        headers
      });
    }
    // Si el gemelo markdown faltara, es preferible servir el HTML que fallar.
  }

  const response = await next();
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withNegotiationHeaders(response.headers, plan.markdownPath)
  });
}
