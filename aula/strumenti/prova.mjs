// Lancia la prova completa dell'aula (aula/test/prova-aula.ts) dentro l'aula vera.
//   node aula/strumenti/prova.mjs <cartella del ramo corso da servire>
// Prepara un finto GitHub che serve quella cartella come ramo `corso`, compila l'aula e la prova, avvia Electron con
// una cartella dati temporanea e aspetta il risultato.

import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const aula = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(aula, "..");
const corso = path.resolve(process.argv[2] ?? path.join(repo, "lavoro", "corso-locale"));
if (!fs.existsSync(path.join(corso, "catalogo.json"))) {
  console.error(`Nel ramo corso ${corso} non c'è catalogo.json`);
  process.exit(2);
}

// Un finto GitHub: l'API dice la revisione del ramo, «raw» serve i file a quella revisione.
let revisione = crypto.randomBytes(20).toString("hex");
let alterato = false;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/__altera") {
    alterato = true;
    revisione = crypto.randomBytes(20).toString("hex");
    res.writeHead(204).end();
    return;
  }
  if (req.method === "POST" && url.pathname === "/__ripristina") {
    alterato = false;
    revisione = crypto.randomBytes(20).toString("hex");
    res.writeHead(204).end();
    return;
  }
  if (url.pathname === "/api/repos/SerraMarco1/how-to-develop-v2/commits/corso") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ sha: revisione }));
    return;
  }
  const m = url.pathname.match(/^\/raw\/SerraMarco1\/how-to-develop-v2\/([0-9a-f]{40})\/(.+)$/);
  if (!m || m[1] !== revisione) {
    res.writeHead(404).end();
    return;
  }
  const file = path.resolve(corso, decodeURIComponent(m[2]));
  if (!file.startsWith(corso + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  let dati = fs.readFileSync(file);
  // Alterazione: il catalogo annuncia una versione nuova della prima lezione, ma il file servito è un altro (come se
  // qualcuno lo avesse cambiato per strada). L'aula deve scartarlo e tenere la versione che ha.
  if (alterato && m[2] === "catalogo.json") {
    const c = JSON.parse(dati.toString("utf8"));
    c.lezioni[0] = { ...c.lezioni[0], versione: c.lezioni[0].versione + 1, sha256: crypto.createHash("sha256").update("versione falsa").digest("hex") };
    dati = Buffer.from(JSON.stringify(c));
  }
  if (alterato && m[2].startsWith("lezioni/")) dati = Buffer.from(dati.toString("utf8").replace("Godot", "Godot!"));
  res.writeHead(200).end(dati);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const indirizzo = `http://127.0.0.1:${server.address().port}`;

execFileSync(process.execPath, [path.join(aula, "strumenti", "compila.mjs")], { stdio: "inherit" });
const driver = path.join(aula, "out", "prova-aula.mjs");
await build({ entryPoints: [path.join(aula, "test", "prova-aula.ts")], bundle: true, platform: "node", format: "esm", target: "node24", outfile: driver, external: ["electron"], logLevel: "warning" });

const dati = fs.mkdtempSync(path.join(os.tmpdir(), "htd-aula-prova-"));
const electron = path.join(repo, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");
const ambiente = { ...process.env };
delete ambiente.ELECTRON_RUN_AS_NODE;
const figlio = spawn(electron, [aula], {
  stdio: "inherit",
  env: { ...ambiente, HTD_DATI_AULA: dati, HTD_API_GITHUB: `${indirizzo}/api`, HTD_RAW_GITHUB: `${indirizzo}/raw`, HTD_PROVA_AULA: driver, HTD_PROVA_CORSO: corso, HTD_PROVA_SERVER: indirizzo, HTD_PROVA_SCHERMATE: path.join(repo, "lavoro", "schermate"), HTD_STRUMENTI_AULA: path.join(repo, "lavoro", "cache", "strumenti"), HTD_PROVA_V1: process.env.HTD_PROVA_V1 ?? path.resolve(repo, "..", "How_to_develop", "data", "how-to-develop.db") },
});
const codice = await new Promise((ok) => figlio.on("exit", ok));
server.close();
// Le copie temporanee: tolte (dentro c'erano anche le chiavi importate, cifrate).
fs.rmSync(dati, { recursive: true, force: true });
process.exit(codice ?? 1);
