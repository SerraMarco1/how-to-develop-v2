import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assetCorsoRiferiti, percorsoMotore } from "../motore.ts";
import { dentroCartella } from "../percorsi.ts";
import { eVerificaAmbiente, type Verifica } from "../schemi.ts";
import { controllaFileLezione, controllaGDScript, descriviViolazioni } from "../sicurezza.ts";
import { eseguiGodot, importaProgetto, togliCartella } from "./esegui.ts";
import { costruisciProjectGodot, leggiFileProgetto, leggiProjectGodot, leggiScena, scriptEffettivo, tipoEffettivo, traduciUid, type Scena } from "./progetto.ts";
import { riparaScriptVerifica } from "./ripara.ts";

// Il verificatore: controlla un progetto Godot rispetto alle verifiche di un esercizio.
// Lavora SEMPRE su una copia temporanea: la cartella di chi studia non viene mai modificata.
// Prima di eseguire qualunque codice arrivato con una lezione (script di verifica, file di una soluzione) lo passa al
// controllo di sicurezza: se non lo supera, non lo esegue.

/** `origine: "verifica"` = il problema è nello script di verifica; "sicurezza" = codice rifiutato dal controllo di sicurezza. */
export type Controllo = { descrizione: string; superato: boolean; dettaglio?: string; origine?: "verifica" | "sicurezza" };

/**
 * Vero se due esecuzioni hanno fallito gli stessi controlli, senza contare i numeri misurati (cambiano un po' a ogni
 * esecuzione). Falso vuol dire che le verifiche danno esiti diversi sullo stesso progetto: dipendono dal caso o dal tempo.
 */
export function stessiFallimenti(a: Controllo[], b: Controllo[]): boolean {
  const falliti = (c: Controllo[]) => c.filter((x) => !x.superato).map((x) => x.descrizione.replace(/-?\d+(?:\.\d+)?/g, "#")).join("\n");
  return falliti(a) === falliti(b);
}

export type EsitoVerifica = {
  superato: boolean;
  controlli: Controllo[];
  outputGodot?: string;
  /** Risultato della prova di avvio (solo se richiesta): ogni file si carica e la scena principale parte. */
  avvio?: Controllo[];
  /** Le cause probabili che la base di verifica ha riconosciuto quando qualcosa non va (es. uno script non attaccato). */
  indizi?: string[];
};

// ─────────────────────────── Impostazioni del verificatore ───────────────────────────

let cartellaTemporanea = path.join(os.tmpdir(), "how-to-develop");
type ControlliAmbiente = (verifiche: Verifica[], cartellaProgetto?: string) => Promise<Controllo[]>;
let controlliAmbiente: ControlliAmbiente | null = null;

/** Dove creare le copie temporanee dei progetti. */
export function impostaCartellaTemporanea(cartella: string): void {
  cartellaTemporanea = cartella;
}

/** Chi sa leggere lo stato di Godot sul PC (solo l'aula). Senza, le verifiche di ambiente vengono saltate. */
export function impostaControlliAmbiente(funzione: ControlliAmbiente): void {
  controlliAmbiente = funzione;
}

export function nuovaCartellaTemporanea(prefisso: string): string {
  fs.mkdirSync(cartellaTemporanea, { recursive: true });
  return fs.mkdtempSync(path.join(cartellaTemporanea, `${prefisso}-`));
}

// ─────────────────────────── Copie dei progetti ───────────────────────────

const CARTELLE_IGNORATE = new Set([".godot", ".git", ".import", "htd", "build", "export", "node_modules"]);
const DIMENSIONE_MASSIMA = 300 * 1024 * 1024;

/** Copia un progetto (solo file e cartelle veri: i collegamenti simbolici vengono saltati). */
export function copiaProgetto(sorgente: string, destinazione: string): void {
  let totale = 0;
  const copia = (da: string, a: string) => {
    fs.mkdirSync(a, { recursive: true });
    for (const voce of fs.readdirSync(da, { withFileTypes: true })) {
      if (voce.isDirectory() && CARTELLE_IGNORATE.has(voce.name)) continue;
      const origine = path.join(da, voce.name);
      const fine = path.join(a, voce.name);
      if (voce.isDirectory()) copia(origine, fine);
      else if (voce.isFile()) {
        totale += fs.statSync(origine).size;
        if (totale > DIMENSIONE_MASSIMA) throw new Error("Il progetto è troppo grande da verificare (oltre 300 MB)");
        fs.copyFileSync(origine, fine);
      }
    }
  };
  copia(sorgente, destinazione);
}

/**
 * Scrive i file di un progetto in una cartella, con project.godot (se manca) e icon.svg. Gli asset del corso citati
 * dai file vengono copiati dal pacchetto del motore. I percorsi devono restare dentro la cartella.
 */
export function scriviFileProgetto(cartella: string, file: { percorso: string; contenuto: string }[], nome: string): void {
  for (const f of file) {
    const destinazione = dentroCartella(cartella, f.percorso);
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    fs.writeFileSync(destinazione, f.contenuto);
  }
  if (!fs.existsSync(path.join(cartella, "project.godot"))) {
    const scena = file.find((f) => f.percorso.endsWith(".tscn"))?.percorso;
    fs.writeFileSync(path.join(cartella, "project.godot"), costruisciProjectGodot({ nome, scenaPrincipale: scena }).testo);
  }
  if (!fs.existsSync(path.join(cartella, "icon.svg"))) fs.copyFileSync(percorsoMotore("harness", "icon.svg"), path.join(cartella, "icon.svg"));
  for (const asset of assetCorsoRiferiti(file.map((f) => f.contenuto).join("\n"))) {
    const destinazione = dentroCartella(cartella, asset.relativo);
    if (fs.existsSync(destinazione)) continue;
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    fs.copyFileSync(asset.origine, destinazione);
  }
}

// ─────────────────────────── Controlli senza Godot ───────────────────────────

function cercaNodo(scena: Scena, nomeOPercorso: string) {
  return scena.nodi.find((n) => n.percorso === nomeOPercorso || n.nome === nomeOPercorso);
}

function controlloStatico(cartella: string, v: Verifica): Controllo | null {
  const d = (predefinita: string) => v.descrizione || predefinita;
  switch (v.tipo) {
    case "progetto_godot": {
      const testo = leggiFileProgetto(cartella, "project.godot");
      if (!testo) return { descrizione: d("Esiste un progetto Godot"), superato: false, dettaglio: "project.godot non trovato nella cartella" };
      const features = leggiProjectGodot(testo).application?.["config/features"] ?? "";
      const versione = features.match(/"(\d+\.\d+)"/)?.[1];
      const ok = versione === undefined || versione.startsWith("4.");
      return { descrizione: d("Esiste un progetto Godot 4"), superato: ok, dettaglio: ok ? `Progetto trovato${versione ? ` (Godot ${versione})` : ""}` : `Il progetto è stato creato con Godot ${versione}, serve Godot 4.7` };
    }
    case "file_esiste": {
      const ok = leggiFileProgetto(cartella, v.percorso) !== null;
      return { descrizione: d(`Esiste il file ${v.percorso}`), superato: ok, dettaglio: ok ? undefined : `${v.percorso} non trovato` };
    }
    case "nodo": {
      const testo = leggiFileProgetto(cartella, v.scena);
      if (!testo) return { descrizione: d(`La scena ${v.scena} contiene un ${v.tipoNodo}`), superato: false, dettaglio: `Scena ${v.scena} non trovata` };
      const scena = leggiScena(testo);
      const tipo = (n: Scena["nodi"][number]) => tipoEffettivo(cartella, scena, n);
      const trovato = scena.nodi.find((n) => {
        if (tipo(n) !== v.tipoNodo) return false;
        if (v.nome && n.nome !== v.nome) return false;
        if (v.genitore) {
          const genitore = n.genitore === "." ? scena.nodi[0] : n.genitore ? cercaNodo(scena, n.genitore) : undefined;
          if (!genitore || (genitore.nome !== v.genitore && tipo(genitore) !== v.genitore)) return false;
        }
        return true;
      });
      const presenti = scena.nodi.map((n) => `${n.nome} (${tipo(n) ?? "tipo sconosciuto"}${n.istanzaDi ? ", istanza" : ""})`).join(", ");
      return {
        descrizione: d(`La scena ${v.scena} contiene un nodo ${v.tipoNodo}${v.nome ? ` chiamato "${v.nome}"` : ""}${v.genitore ? ` figlio di ${v.genitore}` : ""}`),
        superato: Boolean(trovato),
        dettaglio: trovato ? undefined : `Nodi presenti: ${presenti || "nessuno"}`,
      };
    }
    case "script_collegato": {
      const testo = leggiFileProgetto(cartella, v.scena);
      if (!testo) return { descrizione: d(`Il nodo ${v.nodo} ha uno script`), superato: false, dettaglio: `Scena ${v.scena} non trovata` };
      const scena = leggiScena(testo);
      const nodo = cercaNodo(scena, v.nodo);
      const script = nodo ? scriptEffettivo(cartella, scena, nodo) : null;
      return {
        descrizione: d(`Il nodo ${v.nodo} in ${v.scena} ha uno script collegato`),
        superato: Boolean(script),
        dettaglio: !nodo ? `Nodo ${v.nodo} non trovato. Nodi presenti: ${scena.nodi.map((n) => n.nome).join(", ")}` : script ? `Script: ${script}` : "Nessuno script collegato",
      };
    }
    case "azione_input": {
      const testo = leggiFileProgetto(cartella, "project.godot") ?? "";
      const ok = /^ui_[a-z_]+$/.test(v.nome) || Boolean(leggiProjectGodot(testo).input?.[v.nome]);
      return { descrizione: d(`Esiste l'azione di input "${v.nome}"`), superato: ok, dettaglio: ok ? undefined : "Aggiungila in Project → Project Settings → Input Map" };
    }
    case "impostazione": {
      const testo = leggiFileProgetto(cartella, "project.godot") ?? "";
      const grezzo = leggiProjectGodot(testo)[v.sezione]?.[v.chiave];
      const descrizione = d(`Impostazione ${v.sezione}/${v.chiave}${v.contiene ? ` contiene "${v.contiene}"` : ""}`);
      if (grezzo === undefined) return { descrizione, superato: false, dettaglio: "Impostazione non presente" };
      // L'editor scrive spesso uid://… al posto del percorso (es. la scena principale): si confronta il file a cui punta.
      const { valore, sconosciuti } = traduciUid(cartella, grezzo);
      const ok = !v.contiene || valore.includes(v.contiene) || grezzo.includes(v.contiene);
      const perso = sconosciuti.length ? ` (nessun file del progetto ha ${sconosciuti.join(", ")}: è stato cancellato, o spostato fuori dall'editor di Godot?)` : "";
      return { descrizione, superato: ok, dettaglio: `Valore attuale: ${valore.slice(0, 120)}${perso}` };
    }
    case "testo_in_file": {
      const testo = leggiFileProgetto(cartella, v.percorso);
      let regola: RegExp;
      try {
        regola = new RegExp(v.regex, "m");
      } catch {
        return { descrizione: d(`Il file ${v.percorso} contiene il testo richiesto`), superato: false, dettaglio: "Espressione di verifica non valida", origine: "verifica" };
      }
      // Un file enorme con un'espressione scritta male potrebbe bloccare la verifica: si guarda al massimo il primo mezzo mega.
      const ok = testo !== null && regola.test(testo.slice(0, 500_000));
      return { descrizione: d(`Il file ${v.percorso} contiene il codice richiesto`), superato: ok, dettaglio: testo === null ? `${v.percorso} non trovato` : undefined };
    }
    case "script_godot":
    case "godot_aperto":
    case "progetto_in_elenco":
    case "impostazione_editor":
      return null;
  }
}

// ─────────────────────────── Controlli con Godot ───────────────────────────

/** Le righe d'errore più utili dell'output di Godot, senza i percorsi del PC (contengono il nome dell'utente). */
export function erroriGodot(output: string): string {
  const pulite = output
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .filter((r) => r.trim() && !/^\[\s*\d+%\s*\]/.test(r.trim()) && !r.startsWith("Godot Engine v") && !r.startsWith("---") && !r.startsWith("HTD_RESULT"));
  const errori = pulite.filter((r) => /error|errore|parse|invalid|failed|cannot|not found|identifier|at:/i.test(r));
  return nascondiPercorsiPersonali((errori.length ? errori : pulite).slice(0, 12).join("\n")).slice(0, 1500);
}

/** Toglie dal testo la cartella dell'utente e quella temporanea, che contengono il suo nome. */
export function nascondiPercorsiPersonali(testo: string): string {
  let t = testo;
  for (const p of [cartellaTemporanea, os.tmpdir(), os.homedir()]) {
    if (!p || p.length < 4) continue;
    t = t.replaceAll(p, "~").replaceAll(p.replaceAll("\\", "/"), "~");
  }
  return t;
}

const SCRIPT_FUMO = 'extends "res://htd/htd_test.gd"\n\n\nfunc _run_tests() -> void:\n\tawait smoke_test()\n';

type ScriptVerifica = { descrizione: string; codice: string };

/** Esegue uno script di verifica già scritto nel progetto (htd/<nomeFile>) e traduce il risultato in controlli. */
async function eseguiScriptVerifica(cartella: string, nomeFile: string, v: ScriptVerifica): Promise<{ controlli: Controllo[]; indizi: string[]; output: string }> {
  const controlli: Controllo[] = [];
  const indizi: string[] = [];
  // La base di verifica si chiude da sola dopo 25 secondi: questo limite scatta solo se Godot stesso si blocca.
  const esito = await eseguiGodot(["--headless", "--path", cartella, "-s", `res://htd/${nomeFile}`], { timeoutMs: 45_000, cwd: cartella });
  const riga = esito.output.split(/\r?\n/).findLast((r) => r.startsWith("HTD_RESULT "));
  if (!riga) {
    const colpaVerifica = esito.output.includes(`res://htd/${nomeFile}`) && /Parse Error|Failed to load script|Compile Error/i.test(esito.output);
    controlli.push({
      descrizione: v.descrizione || "Esecuzione del progetto in Godot",
      superato: false,
      origine: colpaVerifica ? "verifica" : undefined,
      dettaglio: esito.scadutoTempo ? "Godot non ha terminato entro 45 secondi" : `${colpaVerifica ? "Lo script di verifica non è GDScript valido" : "Il progetto non si è avviato correttamente"}:\n${erroriGodot(esito.output)}`,
    });
    return { controlli, indizi, output: esito.output };
  }
  try {
    const risultato = JSON.parse(riga.slice("HTD_RESULT ".length)) as { checks: { id: string; passed: boolean; message: string }[]; hints?: unknown };
    if (!Array.isArray(risultato.checks) || risultato.checks.length === 0) controlli.push({ descrizione: v.descrizione, superato: false, origine: "verifica", dettaglio: "La verifica non ha eseguito controlli (non chiama mai check())" });
    for (const c of risultato.checks ?? []) {
      const interno = c.id === "htd_script_error" || c.id === "htd_timeout";
      controlli.push({ descrizione: String(c.message).replace(/^HTD_\w+ /, "").slice(0, 2000), superato: c.passed === true, origine: interno ? "verifica" : undefined });
    }
    const erroriScript = esito.output.match(/SCRIPT ERROR[^\n]*(\n\s+at: [^\n]*)?/g);
    if (erroriScript && risultato.checks.every((c) => c.passed)) controlli.push({ descrizione: "Nessun errore durante l'esecuzione", superato: false, dettaglio: nascondiPercorsiPersonali(erroriScript.slice(0, 3).join("\n")) });
    if (Array.isArray(risultato.hints)) indizi.push(...risultato.hints.filter((h): h is string => typeof h === "string").slice(0, 5).map((h) => h.slice(0, 1000)));
  } catch {
    controlli.push({ descrizione: v.descrizione, superato: false, dettaglio: "Risultato della verifica illeggibile" });
  }
  return { controlli, indizi, output: esito.output };
}

async function controlliGodot(cartella: string, verifiche: ScriptVerifica[], fumo: boolean): Promise<{ controlli: Controllo[]; fumo?: Controllo[]; indizi: string[]; output: string }> {
  const controlli: Controllo[] = [];
  const indizi = new Set<string>();
  // Tutto ciò che serve alle esecuzioni si scrive PRIMA che Godot parta: da lì in poi la cartella è anche di Godot (nel
  // cloud gira come un altro utente) e la fabbrica non ci scrive più (vedi apriAGodot).
  fs.mkdirSync(path.join(cartella, "htd"), { recursive: true });
  fs.copyFileSync(percorsoMotore("harness", "htd_test.gd"), path.join(cartella, "htd", "htd_test.gd"));
  if (fumo) fs.writeFileSync(path.join(cartella, "htd", "fumo.gd"), riparaScriptVerifica(SCRIPT_FUMO));
  verifiche.forEach((v, indice) => fs.writeFileSync(path.join(cartella, "htd", `verifica_${indice + 1}.gd`), riparaScriptVerifica(v.codice)));
  const importazione = await importaProgetto(cartella);
  let outputTotale = importazione.output;
  let controlliFumo: Controllo[] | undefined;
  if (fumo) {
    const esito = await eseguiScriptVerifica(cartella, "fumo.gd", { descrizione: "Il progetto si carica e si avvia senza errori", codice: SCRIPT_FUMO });
    controlliFumo = esito.controlli;
    outputTotale += `\n--- prova di avvio ---\n${esito.output}`;
  }
  for (const [indice, v] of verifiche.entries()) {
    const nomeFile = `verifica_${indice + 1}.gd`;
    const esito = await eseguiScriptVerifica(cartella, nomeFile, v);
    controlli.push(...esito.controlli);
    for (const i of esito.indizi) indizi.add(i);
    outputTotale += `\n--- ${nomeFile} ---\n${esito.output}`;
  }
  return { controlli, fumo: controlliFumo, indizi: [...indizi], output: outputTotale };
}

// ─────────────────────────── Punto d'ingresso ───────────────────────────

export type SorgenteVerifica =
  /** La cartella del progetto di chi studia: il suo codice è suo, non viene controllato; le verifiche sì. */
  | { tipo: "cartella"; percorso: string }
  /** File arrivati con una lezione (soluzione di riferimento, codice incollato): controllati come le verifiche. */
  | { tipo: "file"; file: { percorso: string; contenuto: string }[]; daLezione: boolean }
  /** Nessun progetto da leggere: solo verifiche di ambiente. */
  | { tipo: "ambiente" };

/** I problemi di sicurezza del codice di una lezione che il verificatore dovrebbe eseguire. */
export function controlloSicurezza(verifiche: Verifica[], file: { percorso: string; contenuto: string }[] = []): string[] {
  const problemi = descriviViolazioni(controllaFileLezione(file));
  verifiche.forEach((v, i) => {
    if (v.tipo === "script_godot") problemi.push(...descriviViolazioni(controllaGDScript(`verifica ${i + 1}`, v.codice)));
  });
  return problemi;
}

/**
 * Verifica una cartella di progetto (o un insieme di file) rispetto alle verifiche indicate.
 * Con `provaAvvio` carica anche ogni scena e script e avvia la scena principale (per le soluzioni di riferimento).
 * Le verifiche di ambiente valgono solo per una cartella vera o per la sorgente "ambiente".
 */
export async function verifica(sorgente: SorgenteVerifica, verifiche: Verifica[], opzioni: { provaAvvio?: boolean } = {}): Promise<EsitoVerifica> {
  const diAmbiente = verifiche.filter(eVerificaAmbiente);
  const ambiente = async (cartella?: string) => (controlliAmbiente && diAmbiente.length ? controlliAmbiente(diAmbiente, cartella) : []);
  if (sorgente.tipo === "ambiente") {
    const controlli = await ambiente();
    return { superato: controlli.length > 0 && controlli.every((c) => c.superato), controlli };
  }

  const sicurezza = controlloSicurezza(verifiche, sorgente.tipo === "file" && sorgente.daLezione ? sorgente.file : []);
  if (sicurezza.length > 0) {
    const controlli = sicurezza.map((p): Controllo => ({ descrizione: "Codice della lezione rifiutato dal controllo di sicurezza", superato: false, dettaglio: p, origine: "sicurezza" }));
    return { superato: false, controlli, avvio: opzioni.provaAvvio ? controlli : undefined };
  }

  const temp = nuovaCartellaTemporanea("verifica");
  try {
    const controlli: Controllo[] = [];
    if (sorgente.tipo === "cartella") {
      controlli.push(...(await ambiente(sorgente.percorso)));
      if (!fs.existsSync(sorgente.percorso)) {
        return {
          superato: false,
          controlli: [
            { descrizione: "Cartella del progetto", superato: false, dettaglio: `Non trovo un progetto in ${sorgente.percorso}\nCrea il progetto in quella cartella, oppure scrivi qui la cartella in cui l'hai creato (quella che contiene project.godot).` },
            ...controlli,
          ],
        };
      }
      copiaProgetto(sorgente.percorso, temp);
    } else {
      scriviFileProgetto(temp, sorgente.file, "Verifica");
    }
    for (const v of verifiche) {
      const c = controlloStatico(temp, v);
      if (c) controlli.push(c);
    }
    const scriptGodot = verifiche.filter((v): v is Extract<Verifica, { tipo: "script_godot" }> => v.tipo === "script_godot");
    let outputGodot: string | undefined;
    let avvio: Controllo[] | undefined;
    let indizi: string[] = [];
    if ((scriptGodot.length > 0 || opzioni.provaAvvio) && fs.existsSync(path.join(temp, "project.godot"))) {
      const esito = await controlliGodot(temp, scriptGodot, Boolean(opzioni.provaAvvio));
      controlli.push(...esito.controlli);
      outputGodot = esito.output;
      avvio = esito.fumo;
      indizi = esito.indizi;
    } else if (scriptGodot.length > 0) {
      controlli.push({ descrizione: "Esecuzione in Godot", superato: false, dettaglio: "Manca project.godot: non è un progetto Godot" });
    }
    const superato = controlli.length > 0 && controlli.every((c) => c.superato);
    return { superato, controlli, outputGodot, avvio, indizi: superato ? [] : indizi };
  } finally {
    togliCartella(temp);
  }
}
