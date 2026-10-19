import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { apriAGodot, eseguiGodot, impostaGodot } from "../src/godot/esegui.ts";
import { installaGodot } from "../src/godot/installa.ts";
import { impostaCartellaTemporanea, nuovaCartellaTemporanea, scriviFileProgetto } from "../src/godot/verifica.ts";
import { registraVideo, valutaCopione } from "../src/godot/video.ts";
import { impostaCartellaMotore } from "../src/motore.ts";
import { CopioneSchema } from "../src/schemi.ts";

// Il recinto di Godot nella fabbrica: su Linux, con HTD_GODOT_UTENTE, Godot gira come un altro utente del sistema.
// Il controllo di sicurezza sul codice è la prima difesa; qui si prova la seconda, come se la prima fosse stata aggirata:
// un progetto esegue di proposito ciò che il controllo vieterebbe (leggere l'ambiente e i file della fabbrica, scriverci,
// lasciare un processo acceso) e deve fallire in tutto. Gira nei controlli su GitHub, come la fabbrica.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const utente = process.env.HTD_GODOT_UTENTE;
const attivo = process.platform === "linux" && Boolean(utente);
const salta = attivo ? false : "solo su Linux con HTD_GODOT_UTENTE, come nella fabbrica";
const cache = process.env.HTD_CACHE ?? path.join(REPO, "lavoro", "cache");

const processiDi = (nome: string) => spawnSync("pgrep", ["-u", nome], { encoding: "utf8" }).stdout.trim();
/** I processi dell'utente di Godot dopo un attimo (il tempo di sparire a quelli appena chiusi). */
async function processiRimasti(nome: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const rimasti = processiDi(nome);
    if (!rimasti) return "";
    await new Promise((r) => setTimeout(r, 100));
  }
  return processiDi(nome);
}

test("recinto: Godot come altro utente non vede l'ambiente né i file della fabbrica, e non lascia processi accesi", { skip: salta, timeout: 15 * 60_000 }, async () => {
  impostaCartellaMotore(path.join(REPO, "motori", "godot"));
  impostaCartellaTemporanea(path.join(cache, "temp"));
  impostaGodot(await installaGodot(path.join(cache, "strumenti")));

  // Un segreto nell'ambiente della fabbrica e uno in un suo file, in una cartella solo sua.
  process.env.HTD_SEGRETO_PROVA = "segreto-di-prova-nell-ambiente";
  const privata = fs.mkdtempSync(path.join(os.tmpdir(), "htd-recinto-"));
  const filePrivato = path.join(privata, "chiave.txt");
  fs.writeFileSync(filePrivato, "segreto-di-prova-nel-file", { mode: 0o600 });

  const progetto = nuovaCartellaTemporanea("recinto");
  const sonda = [
    "extends SceneTree",
    "",
    "",
    "func _init() -> void:",
    '\tprint("HTD_ENV=" + OS.get_environment("HTD_SEGRETO_PROVA"))',
    `\tvar f := FileAccess.open(${JSON.stringify(filePrivato)}, FileAccess.READ)`,
    '\tprint("HTD_FILE=" + (f.get_as_text() if f else "negato"))',
    `\tvar e := FileAccess.open("/proc/${process.pid}/environ", FileAccess.READ)`,
    '\tprint("HTD_PROC=" + (e.get_as_text().substr(0, 40) if e else "negato"))',
    `\tvar w := FileAccess.open(${JSON.stringify(path.join(privata, "scritto.txt"))}, FileAccess.WRITE)`,
    '\tprint("HTD_SCRITTO=" + ("si" if w else "negato"))',
    `\tvar r := FileAccess.open(${JSON.stringify(path.join(REPO, "package.json"))}, FileAccess.WRITE)`,
    '\tprint("HTD_CODICE=" + ("si" if r else "negato"))',
    '\tprint("HTD_PID=" + str(OS.create_process("sleep", ["300"])))',
    '\tprint("HTD_FINE")',
    "\tquit()",
    "",
  ].join("\n");
  scriviFileProgetto(progetto, [{ percorso: "sonda.gd", contenuto: sonda }], "Recinto");
  apriAGodot(progetto);
  const esito = await eseguiGodot(["--headless", "--path", progetto, "-s", "res://sonda.gd"], { timeoutMs: 60_000 });
  const valore = (chiave: string) => esito.output.match(new RegExp(`^${chiave}=(.*)$`, "m"))?.[1]?.trim();

  assert.ok(esito.output.includes("HTD_FINE"), `la sonda è stata eseguita fino in fondo:\n${esito.output.slice(-1500)}`);
  assert.equal(valore("HTD_ENV"), "", "l'ambiente della fabbrica non arriva a Godot");
  assert.equal(valore("HTD_FILE"), "negato", "un file privato della fabbrica non si legge");
  assert.equal(valore("HTD_PROC"), "negato", "l'ambiente del processo della fabbrica non si legge da /proc");
  assert.equal(valore("HTD_SCRITTO"), "negato", "nelle cartelle della fabbrica non si scrive");
  assert.equal(valore("HTD_CODICE"), "negato", "il codice della fabbrica non si cambia");
  assert.ok(Number(valore("HTD_PID")) > 0, "il processo di prova è partito (il controllo di sicurezza qui è aggirato apposta)");
  assert.equal(await processiRimasti(utente!), "", "finita l'esecuzione, nessun processo dell'utente di Godot resta acceso");
  assert.ok(!fs.existsSync(path.join(privata, "scritto.txt")));
  assert.ok(!esito.output.includes("segreto-di-prova"), "nessun segreto nell'output");

  fs.rmSync(privata, { recursive: true, force: true });
  delete process.env.HTD_SEGRETO_PROVA;
});

test("recinto: il video del risultato si registra anche con Godot come altro utente", { skip: salta, timeout: 10 * 60_000 }, async () => {
  const progetto = nuovaCartellaTemporanea("video-recinto");
  const uscita = nuovaCartellaTemporanea("video-recinto-mp4");
  const scena = '[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n\n[node name="Title" type="Label" parent="."]\noffset_right = 200.0\noffset_bottom = 40.0\ntext = "Prova del video"\n';
  scriviFileProgetto(progetto, [{ percorso: "main.tscn", contenuto: scena }], "Video");
  const mp4 = path.join(uscita, "risultato.mp4");
  const copione = CopioneSchema.parse({ scena: "res://main.tscn", durata: 4, soggetti: [{ id: "titolo", cerca: { nome: "Title" }, da: 0.2, a: 3.5, etichetta: "Titolo" }], scritte: [{ testo: "Il titolo", da: 0.2, a: 3.5, soggetto: "titolo" }] });
  const resoconto = await registraVideo({ cartellaProgetto: progetto, copione, fileMp4: mp4 });
  assert.ok(fs.statSync(mp4).size > 1000, "il video è stato scritto, fuori dalla cartella del progetto");
  assert.deepEqual(valutaCopione(copione, resoconto).problemi, [], "le misure arrivano anche da Godot come altro utente");
  await assert.rejects(registraVideo({ cartellaProgetto: progetto, copione, fileMp4: path.join(progetto, "dentro.mp4") }), /fuori dalla cartella del progetto/);
  assert.equal(await processiRimasti(utente!), "", "nessun processo dell'utente di Godot resta acceso");
});
