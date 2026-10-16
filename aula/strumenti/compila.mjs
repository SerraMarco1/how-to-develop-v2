// Compila l'aula: il programma (main), il ponte (preload) e la finestra (renderer).
//   node strumenti/compila.mjs               per provarla
//   node strumenti/compila.mjs --produzione  per l'installatore

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import react from "@vitejs/plugin-react";
import { build as costruisciFinestra } from "vite";

const aula = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const produzione = process.argv.includes("--produzione");
const uscita = path.join(aula, "out");
fs.rmSync(uscita, { recursive: true, force: true });

const comune = { bundle: true, platform: "node", format: "cjs", target: "node24", external: ["electron"], sourcemap: produzione ? false : "inline", logLevel: "warning", legalComments: "none" };
await build({ ...comune, entryPoints: [path.join(aula, "src", "main", "index.ts")], outfile: path.join(uscita, "main.cjs") });
await build({ ...comune, entryPoints: [path.join(aula, "src", "preload", "index.ts")], outfile: path.join(uscita, "preload.cjs") });

await costruisciFinestra({
  configFile: false,
  root: path.join(aula, "src", "renderer"),
  base: "./",
  plugins: [react()],
  logLevel: "warn",
  build: { outDir: path.join(uscita, "renderer"), emptyOutDir: true, modulePreload: { polyfill: false }, sourcemap: !produzione, minify: produzione, assetsInlineLimit: 0 },
});
console.log(`Aula compilata in ${uscita}${produzione ? " (produzione)" : ""}`);
