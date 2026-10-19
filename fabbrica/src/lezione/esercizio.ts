import { costruisciProjectGodot, leggiProjectGodot, percorsoRes, TASTI_VALIDI, type ProgettoGodot } from "@htd/condiviso/godot/progetto.ts";
import { controllaFormaGDScript, controllaScena, pulisciContenuto, riparaGDScript, riparaScena, riparaScriptVerifica } from "@htd/condiviso/godot/ripara.ts";
import { differenzeRighe } from "@htd/condiviso/differenze.ts";
import { erroriGodot, stessiFallimenti, verifica, type Controllo } from "@htd/condiviso/godot/verifica.ts";
import { elencoAssetCorso, leggiFileMotore, percorsiSempreDisponibili } from "@htd/condiviso/motore.ts";
import { percorsoRelativo } from "@htd/condiviso/percorsi.ts";
import { eVerificaAmbiente, type Esercizio, type FileProgetto, type Progetto } from "@htd/condiviso/schemi.ts";
import { controllaFileLezione, controllaGDScript, descriviViolazioni } from "@htd/condiviso/sicurezza.ts";
import { documentazioneHarness, prompt } from "../ai/prompt.ts";
import { nomiSbagliati } from "./qualita.ts";

// Un esercizio scritto da un modello passa da qui due volte:
// 1. `preparaEsercizio` lo mette in forma (nomi, percorsi, indentazione) e scrive project.godot;
// 2. `validaEsercizio` controlla che sia coerente, che il codice sia sicuro e che la soluzione superi davvero le
//    verifiche in Godot (e che le verifiche falliscano sul lavoro non fatto).

type Modalita = Esercizio["modalita"];

// ─────────────────────────── Istruzioni per i modelli ───────────────────────────

type Ricetta = { id: string; quando: string; titolo: string; spiegazione: string; scena: string };

function ricette(): Ricetta[] {
  try {
    return (JSON.parse(leggiFileMotore("ricette.json")) as { ricette: Ricetta[] }).ricette;
  } catch {
    return [];
  }
}

function ricettePer(contesto: string): string {
  const adatte = ricette().filter((r) => {
    try {
      return new RegExp(r.quando, "i").test(contesto);
    } catch {
      return false;
    }
  });
  if (adatte.length === 0) return "Nessuna ricetta particolare per questo esercizio.";
  const recinto = "```";
  return adatte.slice(0, 2).map((r) => `#### ${r.titolo}\n${r.spiegazione}\n${recinto}\n${r.scena.trim()}\n${recinto}`).join("\n\n");
}

/** Se la lezione parla dell'argomento dell'esempio, il modello tende a ricopiarlo: si mostra l'altro esempio. */
function esempioPer(modalita: Modalita, contesto: string): string {
  if (modalita === "progetto" && /CharacterBody|move_and_slide|get_axis|get_vector|moviment|muover/i.test(contesto)) return "progetto-2";
  return modalita;
}

/** Descrizione degli asset del corso per i prompt. */
export function assetPerPrompt(): string {
  return [
    "- res://icon.svg — icona di Godot, 128x128 pixel: presente in ogni progetto, è l'immagine di prova da usare di solito",
    ...elencoAssetCorso().map((a) => `- res://assets/${a.file} — ${a.descrizione}`),
    'Gli asset in res://assets/ fanno parte del "pacchetto del corso": se un esercizio li usa, la consegna deve dire di copiare dentro la cartella del progetto la cartella `assets` che si trova in `_asset-del-corso`, nella cartella del corso (quella che contiene le cartelle dei progetti).',
    "Non esistono altri file: niente font, modelli 3D o altre immagini. Un esercizio non può richiederne altri.",
  ].join("\n");
}

type ImpostazioneEditor = { chiave: string; dove: string; predefinito: string; esempio: string };

export function impostazioniEditor(): ImpostazioneEditor[] {
  try {
    return (JSON.parse(leggiFileMotore("impostazioni-editor.json")) as { impostazioni: ImpostazioneEditor[] }).impostazioni;
  } catch {
    return [];
  }
}

export function impostazioniEditorPerPrompt(): string {
  return impostazioniEditor().map((i) => `  - \`${i.chiave}\` — Editor Settings → ${i.dove} (predefinito ${i.predefinito}; per esempio "contiene": "${i.esempio}")`).join("\n");
}

/** Le regole che il codice di una lezione deve rispettare: le stesse del controllo di sicurezza. */
const REGOLE_SICUREZZA = [
  "Regole di sicurezza (il codice che le viola viene rifiutato automaticamente):",
  "- niente rete (HTTPRequest, TCP, UDP, WebSocket…), niente Expression, niente GDScript.new() o codice scritto in un testo;",
  "- di OS si usano solo funzioni innocue come OS.get_name() o OS.has_feature(): niente execute, shell_open, variabili d'ambiente, cartelle del PC;",
  "- i file si indicano solo con percorsi res:// o user:// che restano dentro il progetto: niente percorsi assoluti né \"..\" nei percorsi dei file;",
  "- niente Engine.get_singleton, ClassDB.instantiate, str_to_var, set_script; niente script scritti dentro le scene (sub_resource GDScript).",
].join("\n");

/** Le istruzioni complete di una modalità, con l'esercizio di esempio e le ricette adatte al `contesto`. */
export function istruzioniModalita(modalita: Modalita, opzioni: { test?: boolean; contesto?: string } = {}): string {
  return `${prompt(`modalita-${modalita}`, {
    ricette: ricettePer(opzioni.contesto ?? ""),
    harness: documentazioneHarness(),
    asset: assetPerPrompt(),
    tasti: TASTI_VALIDI,
    impostazioni_editor: impostazioniEditorPerPrompt(),
    esempio: leggiFileMotore("esempi", `${esempioPer(modalita, opzioni.contesto ?? "")}.json`).trim(),
  })}\n\n${REGOLE_SICUREZZA}`;
}

/** L'esercizio come lo vede il modello: senza gli id e senza il project.godot scritto dalla piattaforma. */
export function esercizioPerPrompt(e: Esercizio): string {
  const { id: _id, tipo: _tipo, ...resto } = e;
  return JSON.stringify({ ...resto, soluzione: { ...e.soluzione, file: e.soluzione.file.filter((f) => f.percorso !== "project.godot") } });
}

// ─────────────────────────── Preparazione ───────────────────────────

function nomeCartella(testo: string): string {
  return (
    testo
      .normalize("NFD")
      .replace(/[^\x00-\x7f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "progetto"
  );
}

function progettoDaFile(testo: string): ProgettoGodot {
  const dati = leggiProjectGodot(testo);
  const senzaVirgolette = (v?: string) => v?.trim().replace(/^"|"$/g, "") ?? "";
  return {
    nome: senzaVirgolette(dati.application?.["config/name"]),
    scenaPrincipale: senzaVirgolette(dati.application?.["run/main_scene"]),
    azioni: Object.keys(dati.input ?? {}).map((nome) => ({ nome, tasti: [] })),
    autoload: Object.entries(dati.autoload ?? {}).map(([nome, percorso]) => ({ nome, percorso: senzaVirgolette(percorso).replace(/^\*/, "") })),
  };
}

/** Mette in forma un esercizio appena scritto da un modello: id, cartella, percorsi, indentazione, project.godot. */
export function preparaEsercizio(grezzo: Esercizio, id: string, tipo: Esercizio["tipo"]): Esercizio {
  const e: Esercizio = structuredClone(grezzo);
  e.id = id;
  e.tipo = tipo;
  if (e.modalita === "previsioni") {
    e.verifiche = [];
    e.partenza = undefined;
    e.soluzione = { ...e.soluzione, file: [], progetto: undefined, cambiati: [], rimossi: [] };
    e.previsioni = e.previsioni.map((p, j) => ({ ...p, id: `${id}p${j + 1}`, codice: riparaGDScript(p.codice), risposta: "" }));
    return e;
  }
  e.previsioni = [];
  e.verifiche = e.verifiche.map((v) => (v.tipo === "script_godot" ? { ...v, codice: riparaScriptVerifica(v.codice) } : v));
  if (e.verifiche.some((v) => v.tipo === "godot_aperto" && v.finestra)) e.verifiche = e.verifiche.filter((v) => v.tipo !== "godot_aperto" || v.finestra);
  if (e.modalita === "ambiente") {
    e.partenza = undefined;
    e.soluzione = { ...e.soluzione, file: [], progetto: undefined };
    e.verifiche = e.verifiche.filter((v) => eVerificaAmbiente(v) && v.tipo !== "progetto_in_elenco");
    return e;
  }
  if (e.modalita === "codice") e.verifiche = e.verifiche.filter((v) => !eVerificaAmbiente(v));
  if (e.modalita === "progetto") e.cartella = nomeCartella(e.cartella || e.titolo || id);
  if (e.modalita === "codice") e.fileCodice = percorsoRes(/\.gd$/.test(e.fileCodice ?? "") ? e.fileCodice! : "solution.gd");
  const finito = mettiInFormaProgetto(e.soluzione.file, e.soluzione.progetto, e.titolo, e.modalita === "progetto");
  e.verifiche = e.verifiche.map((v) => (v.tipo === "godot_aperto" && v.finestra === "editor" ? { ...v, progetto: finito.progetto.nome } : v));
  e.soluzione = { ...e.soluzione, ...finito };
  if (e.partenza && e.modalita === "progetto") {
    e.partenza = mettiInFormaProgetto(e.partenza.file, { ...finito.progetto, ...(e.partenza.progetto ?? {}), nome: finito.progetto.nome }, e.titolo, true);
  } else {
    e.partenza = undefined;
  }
  return e;
}

/** Mette in forma i file di un progetto scritto da un modello e ne costruisce project.godot dalle impostazioni dichiarate. */
export function mettiInFormaProgetto(grezzi: FileProgetto[], dichiarato: Progetto | null | undefined, titolo: string, conScenaPrincipale: boolean): { file: FileProgetto[]; progetto: Progetto } {
  let percorsi = grezzi.map((f) => ({ ...f, percorso: percorsoRelativo(f.percorso) }));
  const interno = percorsi.find((f) => f.percorso.endsWith("/project.godot"));
  if (interno) {
    const prefisso = interno.percorso.slice(0, -"project.godot".length);
    if (percorsi.every((f) => f.percorso.startsWith(prefisso))) percorsi = percorsi.map((f) => ({ ...f, percorso: f.percorso.slice(prefisso.length) }));
  }
  const file = new Map<string, string>();
  let progettoScritto: string | null = null;
  for (const f of percorsi) {
    if (!f.percorso || f.percorso.startsWith(".godot/") || f.percorso.endsWith(".import") || f.percorso === "icon.svg") continue;
    if (f.percorso === "project.godot") progettoScritto = f.contenuto;
    else if (f.percorso.endsWith(".gd")) file.set(f.percorso, riparaGDScript(f.contenuto));
    else if (f.percorso.endsWith(".tscn")) file.set(f.percorso, riparaScena(f.contenuto));
    else file.set(f.percorso, pulisciContenuto(f.contenuto));
  }
  const recuperato = progettoScritto ? progettoDaFile(progettoScritto) : {};
  const progetto: Progetto = {
    nome: dichiarato?.nome || recuperato.nome || titolo,
    scenaPrincipale: dichiarato?.scenaPrincipale || recuperato.scenaPrincipale || "",
    azioni: dichiarato?.azioni?.length ? dichiarato.azioni : (recuperato.azioni ?? []),
    autoload: dichiarato?.autoload?.length ? dichiarato.autoload : (recuperato.autoload ?? []),
    impostazioni: dichiarato?.impostazioni ?? [],
  };
  if (conScenaPrincipale && !progetto.scenaPrincipale) {
    const scene = [...file.keys()].filter((p) => p.endsWith(".tscn"));
    const scelta = scene.find((p) => p === "main.tscn") ?? (scene.length === 1 ? scene[0] : undefined);
    if (scelta) progetto.scenaPrincipale = percorsoRes(scelta);
  }
  if (progetto.scenaPrincipale) progetto.scenaPrincipale = percorsoRes(progetto.scenaPrincipale);
  return { progetto, file: [{ percorso: "project.godot", contenuto: costruisciProjectGodot(progetto).testo }, ...[...file].map(([percorso, contenuto]) => ({ percorso, contenuto }))] };
}

// ─────────────────────────── Valori liberi ───────────────────────────
//
// Chi studia può scrivere una soluzione giusta con valori diversi da quelli della soluzione di riferimento, dovunque
// il testo dell'esercizio non li imponga: una velocità, una durata, un numero di vite. Il 17 ottobre la verifica del
// sottomarino (lezione 1.4) teneva premuto «giù» per tre secondi e poi voleva il sottomarino sul fondale: con la
// velocità della soluzione (250) ci arrivava, con quella scelta da chi studiava (150) no, e un lavoro giusto risultava
// sbagliato. Per accorgersene prima di pubblicare, le verifiche girano anche su una VARIANTE della soluzione con quei
// valori dimezzati: devono passare anche lì.
// Lo stesso giorno la verifica della lezione 1.11 risultò bocciare a caso la sua stessa soluzione (il gioco mette le
// stelle in punti casuali): per questo le verifiche girano anche una seconda volta sulla soluzione, che deve passare
// di nuovo. Un esito che cambia da un'esecuzione all'altra boccerebbe a caso anche il lavoro di chi studia.

/** L'inizio dei problemi di verifiche fragili. */
export const VERIFICHE_FRAGILI = "VERIFICHE FRAGILI";
/** L'inizio dei problemi di esercizi che usano funzioni che il corso non ha ancora spiegato (vedi problemaNonSpiegato). */
export const NON_SPIEGATO = "NON SPIEGATO";

/**
 * Vero se restano solo problemi «minori»: verifiche fragili o funzioni non spiegate. Sono gli unici che non fermano un
 * pezzo quando le correzioni finiscono: il pezzo è giusto, esce con un avviso, e toglierlo farebbe più danno.
 */
export function soloProblemiMinori(problemi: string[]): boolean {
  return problemi.length > 0 && problemi.every((p) => p.startsWith(VERIFICHE_FRAGILI) || p.startsWith(NON_SPIEGATO));
}

const AVVISO_FRAGILE = "Le verifiche dell'esercizio";
const AVVISO_NON_SPIEGATO = "Attenzione: l'esercizio";

/** L'avviso nella lezione per un esercizio uscito con verifiche fragili (lo toglie chi poi le corregge). */
export function avvisoFragile(titolo: string): string {
  return `${AVVISO_FRAGILE} "${titolo}" possono bocciare un lavoro giusto (se scegli valori diversi da quelli della soluzione dove la consegna non li fissa, o per caso): se ti succede, usa «Segnala un errore».`;
}

/** Gli avvisi nella lezione per un esercizio uscito con problemi minori. */
export function avvisiMinori(titolo: string, problemi: string[]): string[] {
  const avvisi: string[] = [];
  if (problemi.some((p) => p.startsWith(VERIFICHE_FRAGILI))) avvisi.push(avvisoFragile(titolo));
  const nonSpiegato = problemi.find((p) => p.startsWith(NON_SPIEGATO));
  if (nonSpiegato) {
    const nomi = [...nonSpiegato.split("\n")[0].matchAll(/`[\w.]+\(\)`/g)].map((m) => m[0]);
    avvisi.push(`${AVVISO_NON_SPIEGATO} "${titolo}" usa ${nomi.join(", ")}, che le lezioni fin qui non hanno spiegato: prima di cominciare cercalo nella documentazione o chiedi al tutor.`);
  }
  return avvisi;
}

/** Vero se l'avviso riguarda i problemi minori dell'esercizio con quel titolo (per toglierlo quando sono corretti). */
export function eAvvisoMinoreDi(titolo: string, avviso: string): boolean {
  return (avviso.startsWith(AVVISO_FRAGILE) || avviso.startsWith(AVVISO_NON_SPIEGATO)) && avviso.includes(`"${titolo}"`);
}

/** Il problema da correggere quando la stessa soluzione, eseguita un'altra volta, non supera più le verifiche. */
export function problemaInstabili(controlli: Controllo[]): string {
  return [
    `${VERIFICHE_FRAGILI}: le verifiche danno esiti diversi sulla stessa soluzione. Eseguita un'altra volta, non le supera più: dipendono dal caso (numeri casuali, posizioni di partenza casuali) o dal tempo, e boccerebbero a caso anche un lavoro giusto. Controlli falliti in quell'esecuzione:`,
    elencoControlli(controlli),
    "Correggi le VERIFICHE, non la soluzione: metti i nodi nello stato che ti serve DOPO averli aggiunti alla scena (`_ready()` può spostarli in un punto casuale), non contare su valori casuali e lascia margini sui tempi.",
  ].join("\n");
}

/**
 * Le verifiche di un esercizio la cui soluzione le ha appena superate: rieseguite sulla stessa soluzione (devono
 * passare di nuovo) e poi sulla variante lecita (vedi problemaValoriLiberi). Il problema da correggere, o null.
 */
export async function problemaVerificheFragili(e: Esercizio, opzioni: { soloVerifiche?: boolean } = {}): Promise<string | null> {
  if ((e.modalita === "progetto" || e.modalita === "codice") && e.verifiche.some((v) => v.tipo === "script_godot")) {
    const ancora = await verifica({ tipo: "file", file: e.soluzione.file, daLezione: true }, e.verifiche);
    if (!ancora.superato) return problemaInstabili(ancora.controlli);
  }
  return problemaValoriLiberi(e, opzioni);
}

/** Una variabile o costante di uno script con un numero come valore iniziale: `var speed: float = 250.0`, `const LIVES := 3`. */
const DICHIARAZIONE_NUMERICA = /^((?:@export\w*(?:\([^)]*\))?\s+)?(?:static\s+)?(?:var|const)\s+(\w+)\s*(?::\s*(?:int|float)\s*)?:?=\s*)(-?\d+(?:\.\d+)?)(\s*(?:#.*)?)$/;

/** I numeri scritti nel testo dell'esercizio (titolo, consegna, passi, suggerimenti), senza segno. */
function numeriNelTesto(e: Esercizio): Set<number> {
  const testo = [e.titolo, e.consegna, ...e.passiGuida, ...e.suggerimenti].join("\n");
  return new Set([...testo.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Math.abs(Number(m[0].replace(",", ".")))));
}

/** La metà di un numero scritto in GDScript, nello stesso tipo: "250.0" → "125.0", "3" → "2". */
function dimezza(testo: string): string {
  const valore = Number(testo);
  if (!testo.includes(".")) return String(Math.round(valore / 2) || Math.sign(valore));
  const meta = Number((valore / 2).toPrecision(6));
  return Number.isInteger(meta) ? meta.toFixed(1) : String(meta);
}

/**
 * La soluzione con dimezzati i valori iniziali delle variabili e costanti numeriche degli script che il testo
 * dell'esercizio non nomina (0 e 1 restano: di solito sono un punto di partenza, non una scelta). Null se non ce ne sono.
 */
export function varianteLecita(e: Esercizio): { file: FileProgetto[]; cambi: string[] } | null {
  const nelTesto = numeriNelTesto(e);
  const cambi: string[] = [];
  const file = e.soluzione.file.map((f) => {
    if (!f.percorso.endsWith(".gd")) return f;
    const righe = f.contenuto.split("\n").map((riga) => {
      const m = riga.replace(/\r$/, "").match(DICHIARAZIONE_NUMERICA);
      const valore = m ? Math.abs(Number(m[3])) : 0;
      if (!m || valore === 0 || valore === 1 || nelTesto.has(valore)) return riga;
      const nuovo = dimezza(m[3]);
      cambi.push(`${f.percorso}: \`${m[2]}\` da ${m[3]} a ${nuovo}`);
      return `${m[1]}${nuovo}${m[4]}`;
    });
    return { ...f, contenuto: righe.join("\n") };
  });
  return cambi.length ? { file, cambi } : null;
}

/**
 * Le verifiche eseguite sulla variante lecita della soluzione: il problema da correggere se la bocciano, null se la
 * accettano o se non c'è niente da cambiare. Le verifiche che non leggono valori (nodi, azioni, file) non si rieseguono.
 */
export async function problemaValoriLiberi(e: Esercizio, opzioni: { soloVerifiche?: boolean } = {}): Promise<string | null> {
  if ((e.modalita !== "progetto" && e.modalita !== "codice") || !e.verifiche.some((v) => v.tipo === "script_godot" || v.tipo === "testo_in_file")) return null;
  const variante = varianteLecita(e);
  if (!variante) return null;
  const esito = await verifica({ tipo: "file", file: variante.file, daLezione: true }, e.verifiche);
  if (esito.superato) return null;
  return [
    `${VERIFICHE_FRAGILI}: le verifiche bocciano una soluzione giusta. Nella soluzione sono cambiati solo valori che il testo dell'esercizio non impone, quindi chi lo fa può sceglierli diversi:`,
    ...variante.cambi.slice(0, 8).map((c) => `  - ${c}`),
    "Con questi valori non passano più:",
    elencoControlli(esito.controlli),
    "Correggi le VERIFICHE, non la soluzione: devono accettare qualunque valore che la consegna lascia libero. Per esempio: prima di misurare un movimento metti il nodo in un punto noto (`nodo.position = Vector2(400, 300)`); per controllare un limite porta il nodo oltre il limite e tieni premuta l'azione per pochi frame, invece di aspettare che ci arrivi da solo in un tempo fisso; confronta con valori letti dal gioco (`get_prop` legge anche le costanti) invece che scritti nella verifica." +
      (opzioni.soloVerifiche ? "" : " Se invece uno di quei valori fa davvero parte del compito, scrivilo in cifre nella consegna."),
  ].join("\n");
}

// ─────────────────────────── Validazione ───────────────────────────

const VERIFICHE_DI_CONTENUTO = new Set(["file_esiste", "nodo", "script_collegato", "testo_in_file", "script_godot", "azione_input"]);
const PROGETTO_VUOTO = [{ percorso: "project.godot", contenuto: costruisciProjectGodot({ nome: "Vuoto" }).testo }];

function elencoControlli(controlli: Controllo[]): string {
  return controlli
    .filter((c) => !c.superato)
    .map((c) => `  - ${c.origine === "verifica" ? "[ERRORE NELLO SCRIPT DI VERIFICA] " : c.origine === "sicurezza" ? "[RIFIUTATO DAL CONTROLLO DI SICUREZZA] " : ""}${c.descrizione}${c.dettaglio ? `: ${c.dettaglio}` : ""}`)
    .join("\n");
}

function nomiGiaPresenti(file: FileProgetto[] | undefined): Set<string> {
  const nomi = new Set<string>();
  for (const f of file ?? []) {
    nomi.add((f.percorso.split("/").pop() ?? f.percorso).toLowerCase());
    if (f.percorso.endsWith(".tscn")) for (const m of f.contenuto.matchAll(/^\[node name="([^"]+)"/gm)) nomi.add(m[1].toLowerCase());
  }
  return nomi;
}

/** Il codice dell'esercizio che arriverà sul PC di chi studia, controllato con le regole di sicurezza. */
export function problemiDiSicurezza(e: Esercizio): string[] {
  const problemi = [
    ...descriviViolazioni(controllaFileLezione(e.soluzione.file)),
    ...descriviViolazioni(controllaFileLezione(e.partenza?.file ?? [])).map((p) => `progetto di partenza, ${p}`),
  ];
  e.verifiche.forEach((v, i) => {
    if (v.tipo === "script_godot") problemi.push(...descriviViolazioni(controllaGDScript(`verifica ${i + 1}`, v.codice)));
  });
  e.previsioni.forEach((p, i) => problemi.push(...descriviViolazioni(controllaGDScript(`previsione ${i + 1}`, p.codice))));
  for (const i of [...(e.soluzione.progetto?.impostazioni ?? []), ...(e.partenza?.progetto?.impostazioni ?? [])]) {
    const { problemi: p } = costruisciProjectGodot({ impostazioni: [i] });
    problemi.push(...p);
  }
  return [...new Set(problemi)].map((p) => `controllo di sicurezza — ${p}`);
}

function problemiDiForma(e: Esercizio, prima?: FileProgetto[]): string[] {
  const p: string[] = [...problemiDiSicurezza(e)];
  if (e.consegna.trim().length < 40) p.push("la consegna è troppo breve: deve dire con precisione cosa fare");
  const testi = [e.consegna, ...e.passiGuida, ...e.suggerimenti, e.soluzione.spiegazione].join("\n");
  if (/screenshot|schermata da caricare|cattura (dello|la) schermo|foto dello schermo/i.test(testi)) {
    p.push("la consegna (o i passi, i suggerimenti, la soluzione) chiede uno screenshot: non esiste modo di caricarlo. Togli ogni richiesta di screenshot: il lavoro viene verificato dalla piattaforma leggendo i file e lo stato di Godot");
  }
  if (/\b(lo|dello|allo) studente\b/i.test(`${e.consegna}\n${e.passiGuida.join("\n")}`)) p.push('la consegna e i passi si rivolgono a chi fa l\'esercizio dandogli del tu: togli "lo studente"');
  for (const nome of nomiSbagliati(testi)) p.push(`nome dell'editor sbagliato — ${nome}`);

  if (e.modalita === "previsioni") {
    if (e.previsioni.length < 3) p.push(`un esercizio "prevedi" ha da 4 a 6 voci in \`previsioni\` (ce ne sono ${e.previsioni.length})`);
    for (const [i, v] of e.previsioni.entries()) {
      if (!/func\s+run\s*\(/.test(v.codice)) p.push(`la previsione ${i + 1} deve contenere \`func run():\`, che restituisce il valore su cui si chiede la previsione`);
      if (/\brand[fi]?(_range)?\s*\(|\brandomize\s*\(|\bInput\.|\bTime\.|\bOS\./.test(v.codice)) p.push(`la previsione ${i + 1} usa numeri casuali, input o tempo: il risultato deve essere sempre lo stesso`);
    }
    return p;
  }
  if (e.modalita === "ambiente") {
    if (e.verifiche.length === 0) return [...p, 'in modalità "ambiente" serve almeno una verifica `godot_aperto` o `impostazione_editor`'];
    const note = impostazioniEditor();
    for (const v of e.verifiche) {
      if (v.tipo !== "impostazione_editor") continue;
      const nota = note.find((i) => i.chiave === v.chiave);
      if (!nota) p.push(`la verifica \`impostazione_editor\` usa la chiave "${v.chiave}", che non è tra quelle utilizzabili: ${note.map((i) => i.chiave).join(", ")}`);
      else if (!v.contiene?.trim() || v.contiene.trim() === nota.predefinito) p.push(`la verifica \`impostazione_editor\` su "${v.chiave}" deve chiedere in \`contiene\` un valore diverso dal predefinito (${nota.predefinito}), altrimenti passa senza fare niente`);
      else if (!e.consegna.includes(v.contiene.trim())) p.push(`la verifica controlla che "${v.chiave}" valga ${v.contiene}, ma la consegna non dice quale valore impostare`);
    }
    return p;
  }

  if (!e.verifiche.some((v) => !eVerificaAmbiente(v))) return [...p, "non c'è nessuna verifica sui file: aggiungi verifiche che controllino ciò che chiede la consegna (almeno `progetto_godot`)"];
  if (e.modalita === "progetto") {
    const consegna = e.consegna.toLowerCase();
    const presenti = nomiGiaPresenti(prima);
    const manca = (nome?: string | null) => Boolean(nome?.trim()) && !consegna.includes(nome!.trim().toLowerCase()) && !presenti.has(nome!.trim().toLowerCase());
    const base = (percorso: string) => percorso.split("/").pop() ?? percorso;
    for (const v of e.verifiche) {
      if (v.tipo === "nodo" && manca(v.nome)) p.push(`una verifica pretende un nodo chiamato "${v.nome}", ma la consegna non lo nomina`);
      if (v.tipo === "script_collegato" && manca(v.nodo)) p.push(`una verifica controlla lo script del nodo "${v.nodo}", ma la consegna non lo nomina`);
      if (v.tipo === "azione_input" && manca(v.nome)) p.push(`una verifica controlla l'azione di input "${v.nome}", ma la consegna non la nomina`);
      if ((v.tipo === "file_esiste" || v.tipo === "testo_in_file") && base(v.percorso) !== "project.godot" && manca(base(v.percorso))) p.push(`una verifica controlla il file "${v.percorso}", ma la consegna non lo nomina`);
      if (v.tipo === "impostazione" && v.sezione === "application" && v.chiave === "config/name" && manca(v.contiene)) p.push(`una verifica pretende che il progetto si chiami "${v.contiene}", ma la consegna non lo dice`);
    }
    const inElenco = e.verifiche.flatMap((v) => (v.tipo === "progetto_in_elenco" ? [v.presente !== false] : []));
    const apertoNellEditor = e.verifiche.some((v) => v.tipo === "godot_aperto" && v.finestra === "editor");
    if (inElenco.includes(true) && inElenco.includes(false)) p.push("due verifiche `progetto_in_elenco` si contraddicono: una vuole il progetto nell'elenco del Project Manager, l'altra fuori. Controlla lo stato in cui la consegna chiede di lasciare il progetto ALLA FINE e tieni solo quella");
    if (apertoNellEditor && inElenco.includes(false)) p.push("due verifiche si contraddicono: una vuole il progetto aperto nell'editor, l'altra lo vuole fuori dall'elenco del Project Manager. Controlla lo stato in cui la consegna chiede di lasciarlo ALLA FINE e tieni solo la verifica che corrisponde");
  }
  for (const [i, v] of e.verifiche.entries()) {
    if (v.tipo !== "script_godot") continue;
    if (!/func\s+_run_tests\s*\(/.test(v.codice)) p.push(`la verifica ${i + 1} (script_godot) deve contenere \`func _run_tests() -> void:\``);
    else if (!/\bcheck\s*\(/.test(v.codice)) p.push(`la verifica ${i + 1} (script_godot) non chiama mai \`check(...)\`: così non controlla niente`);
  }
  const file = e.soluzione.file.filter((f) => f.percorso !== "project.godot");
  const percorsi = new Set([...e.soluzione.file.map((f) => f.percorso), ...percorsiSempreDisponibili()]);
  if (e.modalita === "codice") {
    const atteso = percorsoRelativo(e.fileCodice ?? "solution.gd");
    if (!file.some((f) => f.percorso === atteso)) return [...p, `la soluzione deve contenere il file "${atteso}" (lo script da scrivere)`];
    if (file.length > 1) p.push(`in modalità "codice" la soluzione è UN SOLO file ("${atteso}"): si incolla un unico script, senza altri file`);
    if (!e.verifiche.some((v) => v.tipo === "script_godot")) p.push('in modalità "codice" serve almeno una verifica `script_godot` che esegua lo script con instantiate_script');
  }
  if (e.modalita === "progetto") {
    p.push(...costruisciProjectGodot(e.soluzione.progetto ?? {}).problemi);
    const principale = e.soluzione.progetto?.scenaPrincipale;
    if (principale && !percorsi.has(percorsoRelativo(principale))) p.push(`\`soluzione.progetto.scenaPrincipale\` è "${principale}", ma quel file non è in \`soluzione.file\``);
    const azioni = new Set((e.soluzione.progetto?.azioni ?? []).map((a) => a.nome));
    for (const v of e.verifiche) {
      if (v.tipo === "azione_input" && !azioni.has(v.nome) && !/^ui_[a-z_]+$/.test(v.nome)) p.push(`una verifica controlla l'azione di input "${v.nome}", ma non è in \`soluzione.progetto.azioni\``);
      if ((v.tipo === "file_esiste" || v.tipo === "testo_in_file") && !percorsi.has(percorsoRelativo(v.percorso))) p.push(`una verifica controlla il file "${v.percorso}", ma non è in \`soluzione.file\``);
      if ((v.tipo === "nodo" || v.tipo === "script_collegato") && !percorsi.has(percorsoRelativo(v.scena))) p.push(`una verifica controlla la scena "${v.scena}", ma non è in \`soluzione.file\``);
    }
  }
  for (const f of file) {
    if (f.percorso.endsWith(".tscn")) p.push(...controllaScena(f.percorso, f.contenuto, percorsi));
    if (f.percorso.endsWith(".gd")) p.push(...controllaFormaGDScript(f.percorso, f.contenuto));
  }
  return p;
}

function righeCitate(e: Esercizio, problemi: string[]): string {
  const script = e.verifiche.filter((v) => v.tipo === "script_godot");
  const contenuto = (file: string): string | undefined => {
    const verificaN = file.match(/^htd\/verifica_(\d+)\.gd$/);
    if (verificaN) return script[Number(verificaN[1]) - 1]?.codice;
    return e.soluzione.file.find((f) => f.percorso === file)?.contenuto;
  };
  const righe = new Set<string>();
  for (const m of problemi.join("\n").matchAll(/res:\/\/([\w./-]+?):(\d+)/g)) {
    const testo = contenuto(m[1])?.split("\n")[Number(m[2]) - 1];
    if (testo?.trim()) righe.add(`  ${m[1].startsWith("htd/") ? "script di verifica" : m[1]}, riga ${m[2]}: \`${testo.trim().slice(0, 200)}\``);
  }
  return righe.size ? `\nRighe citate dagli errori:\n${[...righe].slice(0, 6).join("\n")}` : "";
}

function suggerimenti(problemi: string[]): string {
  let regole: { se: string; allora: string }[] = [];
  try {
    regole = (JSON.parse(leggiFileMotore("suggerimenti.json")) as { suggerimenti: typeof regole }).suggerimenti;
  } catch {
    return "";
  }
  const testo = problemi.join("\n");
  const adatti = regole.filter((r) => {
    try {
      return new RegExp(r.se, "i").test(testo);
    } catch {
      return false;
    }
  });
  return adatti.length ? `\nSuggerimenti:\n${adatti.slice(0, 4).map((r) => `  - ${r.allora}`).join("\n")}` : "";
}

export type OpzioniValidazione = {
  /** Il progetto PRIMA del lavoro richiesto: le verifiche devono fallire lì. Se manca, vale un progetto vuoto. */
  nonFatto?: FileProgetto[];
  /** Le parole che chi studia ha già visto (vedi problemaNonSpiegato). Se manca, quel controllo non si fa. */
  conosciute?: Set<string>;
  /** La lezione è già pubblicata: la soluzione non si può cambiare (cambia il consiglio dato al modello). */
  pubblicata?: boolean;
};

/** Problemi dell'esercizio (vuoto = valido), scritti per un modello che li corregge. */
export async function validaEsercizio(e: Esercizio, opzioni: OpzioniValidazione = {}): Promise<string[]> {
  const problemi = await problemiEsercizio(e, opzioni);
  if (problemi.length === 0) return problemi;
  problemi[problemi.length - 1] += righeCitate(e, problemi) + suggerimenti(problemi);
  return problemi;
}

async function problemiEsercizio(e: Esercizio, opzioni: OpzioniValidazione): Promise<string[]> {
  const forma = problemiDiForma(e, opzioni.nonFatto);
  if (forma.length > 0 || (e.modalita !== "progetto" && e.modalita !== "codice")) return forma;
  const esito = await verifica({ tipo: "file", file: e.soluzione.file, daLezione: true }, e.verifiche, { provaAvvio: true });
  const avvioFallito = (esito.avvio ?? []).filter((c) => !c.superato);
  if (avvioFallito.length > 0) return [`i file della soluzione NON funzionano in Godot 4.7 (prima di tutto vanno corretti questi errori):\n${elencoControlli(avvioFallito)}`];
  if (!esito.superato) {
    const falliti = esito.controlli.filter((c) => !c.superato);
    const colpaVerifica = falliti.some((c) => c.origine === "verifica");
    const grezzo = esito.outputGodot?.split("--- verifica_1.gd ---")[1] ?? "";
    const output = /SCRIPT ERROR|ERROR:/.test(grezzo) ? erroriGodot(grezzo) : "";
    return [
      `la soluzione di riferimento NON supera le verifiche in Godot 4.7.\nControlli falliti:\n${elencoControlli(falliti)}` +
        (output ? `\nOutput di Godot:\n${output}` : "") +
        (colpaVerifica
          ? "\nATTENZIONE: i punti segnati [ERRORE NELLO SCRIPT DI VERIFICA] sono errori nel `codice` della verifica `script_godot`, non nella soluzione: correggi quello script."
          : "\nDecidi se è sbagliata la soluzione o la verifica, e correggi quella sbagliata. La consegna, le verifiche e la soluzione devono dire la stessa cosa."),
    ];
  }
  if (e.verifiche.some((v) => VERIFICHE_DI_CONTENUTO.has(v.tipo))) {
    const nonFatto = opzioni.nonFatto ?? (e.modalita === "codice" ? [...PROGETTO_VUOTO, { percorso: percorsoRelativo(e.fileCodice ?? "solution.gd"), contenuto: "extends Node\n" }] : PROGETTO_VUOTO);
    const prima = await verifica({ tipo: "file", file: nonFatto, daLezione: true }, e.verifiche);
    if (prima.controlli.some((c) => c.origine === "sicurezza")) return [`il progetto da cui si parte non supera il controllo di sicurezza:\n${elencoControlli(prima.controlli)}`];
    if (prima.superato) {
      return [
        opzioni.nonFatto
          ? "le verifiche passano anche sul progetto com'è PRIMA dell'esercizio, quindi non controllano ciò che l'esercizio chiede di fare. Devono fallire prima del lavoro e passare dopo: aggiungi una verifica sul comportamento nuovo, o rendi più precise quelle che ci sono"
          : "le verifiche passano anche su un lavoro non fatto (progetto vuoto), quindi non controllano davvero ciò che chiede la consegna: rendile più precise",
      ];
    }
  }
  if (opzioni.nonFatto) {
    const nascoste = await problemaModificheNascoste(e, opzioni.nonFatto, Boolean(opzioni.pubblicata));
    if (nascoste) return [nascoste];
  }
  // I problemi minori tutti insieme, perché una correzione li sistemi in un colpo solo.
  const nonSpiegato = opzioni.conosciute ? problemaNonSpiegato(e, opzioni.conosciute, opzioni.nonFatto ?? [], Boolean(opzioni.pubblicata)) : null;
  const fragili = await problemaVerificheFragili(e, { soloVerifiche: opzioni.pubblicata });
  return [nonSpiegato, fragili].filter((p): p is string => p !== null);
}

// ─────────────────────────── Modifiche nascoste e cose non spiegate ───────────────────────────
//
// Il 18 ottobre, nella lezione 1.9, la soluzione di un esercizio cambiava anche rock.gd (la roccia teneva la posizione
// data invece di sceglierne una a caso), ma la consegna non lo diceva. Chi studiava aveva il suo rock.gd, giusto per le
// lezioni prima: le verifiche lo bocciavano anche dopo aver incollato tutto il basket.gd della soluzione. E la stessa
// soluzione creava le rocce con `instantiate()`, che nessuna lezione aveva ancora spiegato.

const PAROLA = /[A-Za-z_][A-Za-z0-9_]*/g;

/** Le parole (nomi di funzioni, proprietà, classi) di un testo: per sapere che cosa chi studia ha già visto. */
export function paroleDi(...testi: string[]): Set<string> {
  const parole = new Set<string>();
  for (const t of testi) for (const m of t.matchAll(PAROLA)) parole.add(m[0]);
  return parole;
}

const righeUguali = (a: string, b: string) => a.replace(/\r/g, "").trimEnd() === b.replace(/\r/g, "").trimEnd();

/**
 * La soluzione come la scriverebbe chi segue la consegna alla lettera: gli script che la soluzione cambia ma che il
 * testo dell'esercizio (titolo, consegna, passi) non nomina tornano com'erano prima del lavoro. Null se non ce ne sono.
 */
export function varianteLetterale(e: Esercizio, prima: FileProgetto[]): { file: FileProgetto[]; tornati: { percorso: string; differenze: string[] }[] } | null {
  const testo = [e.titolo, e.consegna, ...e.passiGuida].join("\n");
  const base = new Map(prima.map((f) => [f.percorso, f.contenuto]));
  const tornati: { percorso: string; differenze: string[] }[] = [];
  const file = e.soluzione.file.map((f) => {
    const vecchio = base.get(f.percorso);
    if (!f.percorso.endsWith(".gd") || vecchio === undefined || righeUguali(vecchio, f.contenuto) || testo.includes(f.percorso.split("/").pop()!)) return f;
    tornati.push({ percorso: f.percorso, differenze: differenzeRighe(vecchio, f.contenuto, 30) });
    return { ...f, contenuto: vecchio };
  });
  return tornati.length ? { file, tornati } : null;
}

/** Le verifiche sulla variante letterale: il problema se la bocciano (la consegna non dice tutto ciò che serve), o null. */
export async function problemaModificheNascoste(e: Esercizio, prima: FileProgetto[], pubblicata: boolean): Promise<string | null> {
  if (e.modalita !== "progetto") return null;
  const variante = varianteLetterale(e, prima);
  if (!variante) return null;
  const esito = await verifica({ tipo: "file", file: variante.file, daLezione: true }, e.verifiche);
  if (esito.superato) return null;
  return [
    `la soluzione cambia anche ${variante.tornati.map((t) => t.percorso).join(", ")}, ma il testo dell'esercizio non lo nomina: chi segue la consegna lascia quei file com'erano, e così le verifiche non passano. Le modifiche che la consegna non dice:`,
    ...variante.tornati.map((t) => `  ${t.percorso}:\n${t.differenze.map((d) => `    ${d}`).join("\n")}`),
    "Con quei file com'erano prima falliscono:",
    elencoControlli(esito.controlli),
    pubblicata
      ? "La soluzione non si può cambiare (le lezioni successive partono da lì): scrivi nella consegna, con il nome del file, cosa cambiare e perché."
      : "Se quelle modifiche servono, scrivile nella consegna con il nome del file (cosa cambiare e perché); se non servono, toglile dalla soluzione.",
  ].join("\n");
}

/** Le chiamate che non hanno bisogno di essere spiegate: costruttori dei tipi di base e print. */
const CHIAMATE_DI_BASE = new Set(["print", "str", "int", "float", "bool", "range", "len", "Vector2", "Vector2i", "Vector3", "Color", "Array", "Dictionary", "String", "super", "preload", "load"]);
const PAROLE_CHIAVE = new Set(["if", "elif", "else", "for", "while", "match", "return", "and", "or", "not", "in", "is", "as", "func", "var", "const", "await", "assert"]);

/**
 * Le funzioni e i metodi che le righe nuove della soluzione chiamano e che chi studia non ha mai visto: né nelle
 * lezioni precedenti (teoria, consegne, soluzioni), né nella teoria di questa, né nella consegna dell'esercizio, né nel
 * progetto da cui parte. Passi e suggerimenti non contano: una riga di codice da ricopiare non è una spiegazione (nella
 * 1.9 un passo faceva scrivere `instantiate()`, che la teoria non spiegava). Gli esercizi «trova» sono fatti apposta per
 * cercare nella documentazione ciò che non è stato spiegato.
 */
export function chiamateNonSpiegate(e: Esercizio, conosciute: Set<string>, prima: FileProgetto[]): string[] {
  if (e.modalita !== "progetto" && e.modalita !== "codice") return [];
  const daTrovare = new Set(e.daTrovare.map((n) => n.replace(/\W/g, "")));
  const base = new Map(prima.map((f) => [f.percorso, new Set(f.contenuto.split("\n").map((r) => r.trim()))]));
  const definite = new Set(e.soluzione.file.flatMap((f) => [...f.contenuto.matchAll(/func\s+([A-Za-z_]\w*)/g)].map((m) => m[1])));
  const viste = new Set([...conosciute, ...paroleDi(e.titolo, e.consegna, ...prima.map((f) => f.contenuto))]);
  const nuove = new Set<string>();
  for (const f of e.soluzione.file) {
    if (!f.percorso.endsWith(".gd")) continue;
    const vecchie = base.get(f.percorso);
    for (const riga of f.contenuto.split("\n")) {
      const codice = riga.split("#")[0].trim();
      if (!codice || vecchie?.has(riga.trim())) continue;
      for (const m of codice.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""').matchAll(/([A-Za-z_]\w*)\s*\(/g)) {
        const nome = m[1];
        if (!CHIAMATE_DI_BASE.has(nome) && !PAROLE_CHIAVE.has(nome) && !definite.has(nome) && !viste.has(nome) && !daTrovare.has(nome)) nuove.add(nome);
      }
    }
  }
  return [...nuove];
}

export function problemaNonSpiegato(e: Esercizio, conosciute: Set<string>, prima: FileProgetto[], pubblicata: boolean): string | null {
  const nomi = chiamateNonSpiegate(e, conosciute, prima);
  if (nomi.length === 0) return null;
  return [
    `${NON_SPIEGATO}: la soluzione usa ${nomi.map((n) => `\`${n}()\``).join(", ")}, che chi studia non ha mai visto: non compare nella teoria di questa lezione né in quelle prima, né nel progetto da cui parte. Un nome dentro un suggerimento non basta.`,
    pubblicata
      ? "La soluzione non si può cambiare: spiega nella consegna, in una o due frasi con un esempio, che cosa fa e come si usa."
      : "Usa solo ciò che la lezione ha spiegato (guarda gli esempi di codice della teoria), oppure spiega nella consegna, in una o due frasi con un esempio, che cosa fa e come si usa.",
  ].join("\n");
}
export { stessiFallimenti };
