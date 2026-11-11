// El dueño no quiere separadores «·» en el sitio ni en el informe semanal: suenan a texto
// generado. Se escribe con frases normales (comas, «y», «para», «/») y, donde hace falta
// separar etiquetas, un filete fino de CSS. Esta prueba impide que vuelvan, también por los
// generadores, el correo de analítica y los mensajes de los workflows.
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { projectRoot } from "../scripts/lib/catalog.mjs";
import { loadPublicFiles } from "./public-files.mjs";

const TEXT = /\.(html|md|txt|json|js|css|xml|webmanifest)$/;

function sources() {
  const published = [...loadPublicFiles()].filter((file) => TEXT.test(file));
  const generators = [
    ...readdirSync(resolve(projectRoot, "scripts")).filter((f) => f.endsWith(".mjs")).map((f) => "scripts/" + f),
    ...readdirSync(resolve(projectRoot, "scripts/lib")).filter((f) => f.endsWith(".mjs")).map((f) => "scripts/lib/" + f)
  ];
  const report = ["scripts/analytics_report.py"];
  const workflows = readdirSync(resolve(projectRoot, ".github/workflows"))
    .filter((f) => /\.ya?ml$/.test(f)).map((f) => ".github/workflows/" + f);
  return [...published, ...generators, ...report, ...workflows];
}

test("ni la web, ni sus generadores, ni el informe semanal usan el separador «·»", () => {
  const offenders = [];
  for (const file of sources()) {
    let text;
    try { text = readFileSync(resolve(projectRoot, file), "utf8"); } catch { continue; }
    text.split("\n").forEach((line, index) => {
      if (line.includes("·")) offenders.push(file + ":" + (index + 1));
    });
  }
  assert.deepEqual(offenders, [], "quedan «·» en:\n" + offenders.join("\n"));
});
