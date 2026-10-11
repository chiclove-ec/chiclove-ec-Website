import { access, cp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertOrigin,
  isTextArtifact,
  loadSiteConfig,
  originTraces,
  rewriteOrigin,
  withoutGitHubUrls
} from "./lib/site-config.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const outputDir = join(projectRoot, "dist");
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const target = targetArg ? targetArg.slice("--target=".length) : "generic";
const validTargets = new Set(["generic", "netlify", "cloudflare", "vercel"]);

if (!validTargets.has(target)) {
  throw new Error(`Target de despliegue no válido: ${target}`);
}

if (basename(outputDir) !== "dist" || dirname(outputDir) !== projectRoot) {
  throw new Error("Ruta de salida insegura; se canceló el build.");
}

// El dominio publicado sale de site.config.json. `--origin=` (o SITE_ORIGIN) lo
// sobrescribe para un build puntual —una preview, una prueba— sin tocar el repo.
const siteConfig = loadSiteConfig();
const originArg = process.argv.find((arg) => arg.startsWith("--origin="));
const requestedOrigin = originArg ? originArg.slice("--origin=".length) : process.env.SITE_ORIGIN;
const publishOrigin = requestedOrigin
  ? assertOrigin(requestedOrigin, originArg ? "--origin" : "SITE_ORIGIN")
  : siteConfig.canonicalOrigin;

const publicFiles = [
  ".well-known/security.txt",
  "404.html",
  "404.md",
  "googlee70d0e2c8fe95f2c.html",
  // Clave de IndexNow (Bing y otros): el buscador la lee aquí para aceptar los avisos
  // de scripts/indexnow.mjs. No es un secreto.
  "e59aa493000e0bbda378ca10f82a051a.txt",
  "index.html",
  "index.md",
  "nosotros.html",
  "nosotros.md",
  "about.html",
  "about.md",
  "contact.html",
  "contact.md",
  "privacy.html",
  "privacy.md",
  "terms.html",
  "terms.md",
  "producto.html",
  "hair-nails-forte.html",
  "hair-nails-forte.md",
  "radiant-skin.html",
  "radiant-skin.md",
  "vinagre-de-manzana.html",
  "vinagre-de-manzana.md",
  "sleep-vitamins.html",
  "sleep-vitamins.md",
  "sexual-booster-women.html",
  "sexual-booster-women.md",
  "sexual-booster-men.html",
  "sexual-booster-men.md",
  "anti-stress.html",
  "anti-stress.md",
  "llms.txt",
  "llms-full.txt",
  "agents.md",
  "ai.txt",
  "catalog.json",
  "guia-de-eleccion.md",
  "ingredientes.md",
  "respuestas.md",
  "en.md",
  "robots.txt",
  "sitemap.xml",
  "tienda.html",
  "tienda.md",
  "css/styles.css",
  "js/frame-guard.js",
  "js/analytics.js",
  "js/main.js",
  "js/product-page.js",
  "js/products.js",
  "js/story.js",
  "assets/img/blueberries.webp",
  "assets/img/cert-nsf.webp",
  "assets/img/cert-organic.webp",
  "assets/img/cert-fda.webp",
  "assets/img/cert-ifs.webp",
  "assets/img/cert-gmp.webp",
  "assets/img/cert-brcgs.webp",
  "assets/img/lira.webp",
  "assets/img/bottle-acv.webp",
  "assets/img/bottle-antistress.webp",
  "assets/img/bottle-hair-nails.webp",
  "assets/img/bottle-radiant-skin.webp",
  "assets/img/bottle-sexual-m.webp",
  "assets/img/bottle-sexual-w.webp",
  "assets/img/bottle-sleep.webp",
  "assets/img/cover-lifestyle.webp",
  "assets/img/cta-radiant.webp",
  "assets/img/family-bottles.webp",
  "assets/img/family-bottles-640.webp",
  "assets/img/promo-coleccion.webp",
  "assets/img/promo-coleccion-640.webp",
  "assets/img/promo-coleccion-movil.webp",
  "assets/img/store-hair-nails.webp",
  "assets/img/store-hair-nails-640.webp",
  "assets/img/store-radiant-skin.webp",
  "assets/img/store-radiant-skin-640.webp",
  "assets/img/store-acv.webp",
  "assets/img/store-acv-640.webp",
  "assets/img/store-sleep.webp",
  "assets/img/store-sleep-640.webp",
  "assets/img/store-antistress.webp",
  "assets/img/store-antistress-640.webp",
  "assets/img/store-sexual-w.webp",
  "assets/img/store-sexual-w-640.webp",
  "assets/img/store-sexual-m.webp",
  "assets/img/store-sexual-m-640.webp",
  "assets/img/hero-hair-nails.webp",
  "assets/img/hero-hair-nails-640.webp",
  "assets/img/hero-radiant-skin.webp",
  "assets/img/hero-radiant-skin-640.webp",
  "assets/img/hero-acv.webp",
  "assets/img/hero-acv-640.webp",
  "assets/img/hero-sleep.webp",
  "assets/img/hero-sleep-640.webp",
  "assets/img/hero-antistress.webp",
  "assets/img/hero-antistress-640.webp",
  "assets/img/hero-sexual-w.webp",
  "assets/img/hero-sexual-w-640.webp",
  "assets/img/hero-sexual-m.webp",
  "assets/img/hero-sexual-m-640.webp",
  "assets/img/editorial-hair.webp",
  "assets/img/editorial-hair-960.webp",
  "assets/img/editorial-hair-bite.webp",
  "assets/img/editorial-hair-bite-960.webp",
  "assets/img/editorial-gummy.webp",
  "assets/img/editorial-gummy-960.webp",
  "assets/img/editorial-ritual.webp",
  "assets/img/editorial-ritual-960.webp",
  "assets/img/editorial-skin.webp",
  "assets/img/editorial-skin-960.webp",
  "assets/img/favicon.svg",
  "assets/img/logo-dark.png",
  "assets/img/logo-white.png",
  "assets/img/splash-acv.webp",
  "assets/img/splash-acv-640.webp",
  "assets/img/splash-antistress.webp",
  "assets/img/splash-antistress-640.webp",
  "assets/img/splash-hair-nails.webp",
  "assets/img/splash-hair-nails-640.webp",
  "assets/img/splash-radiant-skin.webp",
  "assets/img/splash-radiant-skin-640.webp",
  "assets/img/splash-sexual-m.webp",
  "assets/img/splash-sexual-m-640.webp",
  "assets/img/splash-sexual-w.webp",
  "assets/img/splash-sexual-w-640.webp",
  "assets/img/splash-sleep.webp",
  "assets/img/splash-sleep-640.webp"
];

async function safeSource(entry) {
  const source = join(projectRoot, entry);
  const resolved = await realpath(source);
  const relativePath = relative(projectRoot, resolved);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`La entrada pública sale del proyecto: ${entry}`);
  }
  if (resolved !== resolve(source)) {
    throw new Error(`La entrada pública contiene un enlace simbólico: ${entry}`);
  }
  return source;
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

// `_headers` se publica solo donde el proveedor lo aplica, pero se trata igual
// que el resto: también se le reescribe el origen y también se verifica.
const artifacts = [...publicFiles];
if (target === "netlify" || target === "cloudflare" || target === "generic") {
  artifacts.push("_headers");
}

let rewritten = 0;
for (const entry of artifacts) {
  const destination = join(outputDir, entry);
  const source = await safeSource(entry);
  await mkdir(dirname(destination), { recursive: true });

  if (isTextArtifact(entry)) {
    const original = await readFile(source, "utf8");
    const published = rewriteOrigin(original, {
      from: siteConfig.sourceOrigin,
      to: publishOrigin
    });
    if (published !== original) rewritten += 1;
    await writeFile(destination, published);
    continue;
  }

  await cp(source, destination, {
    // `dist/` acaba de limpiarse; permitir reemplazo hace el build estable
    // si el sistema conserva temporalmente una entrada del build anterior.
    force: true
  });
}

// Si se publicó en otro dominio, ningún archivo puede seguir nombrando el viejo:
// una sola canónica olvidada manda a Google al sitio equivocado.
if (publishOrigin !== siteConfig.sourceOrigin) {
  for (const entry of artifacts) {
    if (!isTextArtifact(entry)) continue;
    const published = withoutGitHubUrls(await readFile(join(outputDir, entry), "utf8"));
    for (const trace of originTraces(siteConfig.sourceOrigin)) {
      if (published.includes(trace)) {
        throw new Error(`${entry} conserva "${trace}" tras la reescritura del dominio`);
      }
    }
  }
}

// functions/ y tests/ son código de despliegue/verificación: Cloudflare compila
// functions/ desde la raíz del repositorio y nunca deben acabar en el artefacto público.
const forbidden = [
  "README.md",
  "SECURITY.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "package.json",
  "vercel.json",
  "netlify.toml",
  "wrangler.toml",
  ".wrangler",
  "site.config.json",
  ".git",
  ".github",
  "docs",
  "output",
  ".agents",
  ".claude",
  ".superpowers",
  ".netlify",
  ".worktrees",
  ".playwright-cli",
  "functions",
  "tests",
  "scripts"
];
for (const entry of forbidden) {
  try {
    await access(join(outputDir, entry));
    throw new Error(`El artefacto contiene un archivo privado: ${entry}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const originNote =
  publishOrigin === siteConfig.sourceOrigin
    ? ""
    : ` (reescrito desde ${siteConfig.sourceOrigin} en ${rewritten} archivos)`;
console.log(`Build seguro para ${target} en ${publishOrigin}${originNote}: ${outputDir}`);
