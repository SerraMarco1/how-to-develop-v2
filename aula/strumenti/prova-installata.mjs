// La prova del programma INSTALLATO (aula/rilascio/win-unpacked, costruito da `npm run installatore`), non dei
// sorgenti: avvia l'eseguibile con una cartella dati temporanea e controlla, dalla finestra, che
//   - il programma parta dal suo app.asar e trovi il pacchetto del motore tra le risorse (il piano del corso);
//   - la finestra sia isolata (niente Node, niente require);
//   - con il ramo `corso` non ancora disponibile l'aula lo dica e non si blocchi.
// Poi verifica le protezioni dell'eseguibile: con ELECTRON_RUN_AS_NODE non diventa un Node.js, e con app.asar alterato
// non parte.
//   node aula/strumenti/prova-installata.mjs

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aula = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cartella = path.join(aula, "rilascio", "win-unpacked");
const eseguibile = path.join(cartella, "How to Develop.exe");
if (!fs.existsSync(eseguibile)) {
  console.error(`Manca ${eseguibile}: prima npm run installatore --workspace aula`);
  process.exit(2);
}
const errori = [];
const ok = (m) => console.log(`✓ ${m}`);
const no = (m) => {
  errori.push(m);
  console.log(`✗ ${m}`);
};
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Il programma vero, con una cartella dati temporanea e la porta di controllo della finestra.
const dati = fs.mkdtempSync(path.join(os.tmpdir(), "htd-installata-"));
const porta = 9300 + Math.floor(Math.random() * 500);
const figlio = spawn(eseguibile, [`--user-data-dir=${dati}`, `--remote-debugging-port=${porta}`], { stdio: "ignore" });
let pagina = null;
for (let i = 0; i < 60 && !pagina; i++) {
  await attendi(500);
  try {
    const elenco = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
    pagina = elenco.find((p) => p.type === "page" && p.url.startsWith("htd://app/")) ?? null;
  } catch {
    // Non ancora pronto.
  }
}
if (!pagina) no("la finestra dell'aula non si è aperta su htd://app/");
else {
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r, e) => {
    ws.onopen = r;
    ws.onerror = e;
  });
  let id = 0;
  const attese = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    attese.get(d.id)?.(d);
  };
  const js = (espressione) =>
    new Promise((r) => {
      const n = ++id;
      attese.set(n, (d) => r(d.result?.result?.value ?? { eccezione: d.result?.exceptionDetails?.exception?.description ?? JSON.stringify(d.error ?? d.result) }));
      ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression: espressione, awaitPromise: true, returnByValue: true } }));
    });
  // L'aula sincronizza all'avvio: si aspetta che abbia finito.
  await attendi(4000);
  const oggi = await js("window.htd.oggi()");
  if (oggi?.totali >= 170) ok(`il piano del corso è letto dal motore installato tra le risorse: ${oggi.totali} lezioni`);
  else no(`il piano non è stato letto: ${JSON.stringify(oggi).slice(0, 300)}`);
  const isolata = await js("typeof require === 'undefined' && typeof process === 'undefined' && typeof window.htd === 'object'");
  if (isolata === true) ok("la finestra non ha Node (niente require, niente process): solo il ponte window.htd");
  else no(`finestra non isolata: ${JSON.stringify(isolata)}`);
  const sinc = await js("window.htd.sincronizza()");
  const fabbrica = oggi?.fabbrica;
  console.log(`   sincronizzazione con il repository vero: ${JSON.stringify(sinc).slice(0, 300)}`);
  console.log(`   stato della fabbrica mostrato: ${JSON.stringify(fabbrica).slice(0, 300)}`);
  if (sinc && typeof sinc === "object" && !("eccezione" in sinc)) ok("con il ramo corso non disponibile l'aula risponde senza bloccarsi");
  else no(`sincronizzazione: ${JSON.stringify(sinc).slice(0, 300)}`);
  const impostazioni = await js("window.htd.impostazioni()");
  if (impostazioni?.versione) ok(`versione del programma: ${impostazioni.versione}`);
  else no(`impostazioni: ${JSON.stringify(impostazioni).slice(0, 200)}`);
  ws.close();
}
figlio.kill();
await attendi(1500);
if (fs.existsSync(path.join(dati, "aula.sqlite"))) ok("i dati sono nella cartella indicata, non in quella dell'utente");
else no("aula.sqlite non è nella cartella dati temporanea");
const veri = path.join(process.env.APPDATA ?? "", "How to Develop");
if (fs.existsSync(veri)) console.log(`   nota: esiste ${veri} (non creata da questa prova se esisteva già)`);

// 2. ELECTRON_RUN_AS_NODE: con la protezione attiva l'eseguibile NON esegue codice come Node.js.
const segno = path.join(dati, "eseguito-come-node.txt");
const comeNode = spawnSync(eseguibile, ["-e", `require("fs").writeFileSync(${JSON.stringify(segno)}, "si")`, `--user-data-dir=${dati}`], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, timeout: 15000 });
if (!fs.existsSync(segno)) ok("con ELECTRON_RUN_AS_NODE l'eseguibile non diventa un Node.js");
else no("con ELECTRON_RUN_AS_NODE l'eseguibile ha eseguito codice arbitrario");
void comeNode;

// 3. app.asar alterato (la finestra o il programma): l'impronta non torna e il programma si chiude da solo appena
//    legge la parte cambiata, senza mostrarla.
const copia = fs.mkdtempSync(path.join(os.tmpdir(), "htd-alterata-"));
for (const [parte, testo] of [["il codice della finestra", "Prima di cominciare"], ["il codice del programma", "Richiesta non ammessa"]]) {
  const dir = path.join(copia, parte.endsWith("finestra") ? "finestra" : "programma");
  fs.cpSync(cartella, dir, { recursive: true });
  const asar = path.join(dir, "resources", "app.asar");
  const contenuto = fs.readFileSync(asar);
  const punto = contenuto.indexOf(Buffer.from(testo));
  if (punto < 0) {
    no(`non trovo il testo da alterare in app.asar (${parte})`);
    continue;
  }
  contenuto[punto] ^= 0x20;
  fs.writeFileSync(asar, contenuto);
  const alterato = spawn(path.join(dir, "How to Develop.exe"), [`--user-data-dir=${path.join(dir, "dati")}`], { stdio: "ignore" });
  let uscita = null;
  alterato.on("exit", (codice) => (uscita = codice));
  for (let i = 0; i < 30 && uscita === null; i++) await attendi(500);
  if (uscita !== null) ok(`con ${parte} alterato in app.asar il programma si chiude da solo (codice ${uscita})`);
  else {
    alterato.kill();
    no(`con ${parte} alterato in app.asar il programma resta aperto`);
  }
}
await attendi(1500);
for (const c of [dati, copia]) fs.rmSync(c, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });

console.log(errori.length ? `\n${errori.length} problemi` : "\nProgramma installato: tutto come previsto");
process.exit(errori.length ? 1 : 0);
