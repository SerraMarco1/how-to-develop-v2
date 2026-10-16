import fs from "node:fs";
import path from "node:path";
import { dentroCartella, percorsoRes, problemaPercorso } from "../percorsi.ts";

export { percorsoRes };
import { sezioneProgettoAmmessa } from "../sicurezza.ts";

// Lettura dei file di un progetto Godot: project.godot (impostazioni) e .tscn (scene).
// Sono file di testo: li leggiamo direttamente, senza avviare Godot.

/** project.godot → { sezione: { chiave: valore grezzo } }. La sezione iniziale senza nome è "". */
export function leggiProjectGodot(testo: string): Record<string, Record<string, string>> {
  const risultato: Record<string, Record<string, string>> = { "": {} };
  let sezione = "";
  const righe = testo.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < righe.length; i++) {
    const riga = righe[i];
    if (riga.startsWith(";") || riga.trim() === "") continue;
    const intestazione = riga.match(/^\[([^\]]+)\]\s*$/);
    if (intestazione) {
      sezione = intestazione[1];
      risultato[sezione] ??= {};
      continue;
    }
    const uguale = riga.indexOf("=");
    if (uguale === -1) continue;
    const chiave = riga.slice(0, uguale).trim();
    let valore = riga.slice(uguale + 1);
    // Valori su più righe (es. azioni di input): continua finché le parentesi non si chiudono.
    let bilancio = contaParentesi(valore);
    while (bilancio > 0 && i + 1 < righe.length) {
      i++;
      valore += "\n" + righe[i];
      bilancio = contaParentesi(valore);
    }
    risultato[sezione][chiave] = valore.trim();
  }
  return risultato;
}

function contaParentesi(testo: string): number {
  let n = 0;
  let inStringa = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (c === '"' && testo[i - 1] !== "\\") inStringa = !inStringa;
    if (inStringa) continue;
    if (c === "{" || c === "[" || c === "(") n++;
    if (c === "}" || c === "]" || c === ")") n--;
  }
  return n;
}

export type NodoScena = {
  nome: string;
  tipo: string | null;
  genitore: string | null;
  /** Percorso relativo alla radice: "." per la radice, "Player", "Player/Sprite2D". */
  percorso: string;
  istanzaDi: string | null;
  proprieta: Record<string, string>;
};

export type Scena = {
  nodi: NodoScena[];
  risorseEsterne: { id: string; tipo: string; percorso: string }[];
};

function attributi(intestazione: string): Record<string, string> {
  const valori: Record<string, string> = {};
  for (const m of intestazione.matchAll(/(\w+)=("([^"]*)"|[^\s\]]+)/g)) valori[m[1]] = m[3] ?? m[2];
  return valori;
}

export function leggiScena(testo: string): Scena {
  const scena: Scena = { nodi: [], risorseEsterne: [] };
  let nodoCorrente: NodoScena | null = null;
  for (const riga of testo.replace(/\r\n/g, "\n").split("\n")) {
    const intestazione = riga.match(/^\[(\w+)\s*(.*)\]\s*$/);
    if (intestazione) {
      const [, tipoBlocco, resto] = intestazione;
      const a = attributi(resto);
      nodoCorrente = null;
      if (tipoBlocco === "ext_resource") {
        scena.risorseEsterne.push({ id: a.id ?? "", tipo: a.type ?? "", percorso: a.path ?? "" });
      } else if (tipoBlocco === "node") {
        const genitore = a.parent ?? null;
        const percorso = genitore === null ? "." : genitore === "." ? a.name : `${genitore}/${a.name}`;
        const istanza = a.instance?.match(/ExtResource\("?([^")]+)"?\)/)?.[1] ?? null;
        nodoCorrente = { nome: a.name ?? "", tipo: a.type ?? null, genitore, percorso, istanzaDi: istanza, proprieta: {} };
        scena.nodi.push(nodoCorrente);
      }
      continue;
    }
    if (nodoCorrente) {
      const uguale = riga.indexOf(" = ");
      if (uguale > 0) nodoCorrente.proprieta[riga.slice(0, uguale).trim()] = riga.slice(uguale + 3).trim();
    }
  }
  return scena;
}

/** Converte "res://cartella/file.gd" in un percorso reale dentro la cartella del progetto (mai fuori: vedi percorsi.ts). */
export function risolviRes(cartellaProgetto: string, percorso: string): string {
  return dentroCartella(cartellaProgetto, percorso);
}

export function leggiFileProgetto(cartellaProgetto: string, percorso: string): string | null {
  try {
    return fs.readFileSync(risolviRes(cartellaProgetto, percorso), "utf8");
  } catch {
    return null;
  }
}

// ─────────────────────────── uid:// al posto dei percorsi ───────────────────────────

const CARTELLE_SENZA_UID = new Set([".godot", ".git", "htd", "build", "export", "node_modules"]);

/**
 * uid → "res://…" per i file del progetto. L'editor di Godot 4.7 scrive molti riferimenti come "uid://…" invece del
 * percorso (es. run/main_scene="uid://cggertcnbxxv8" quando si sceglie la scena principale). Il collegamento sta nei
 * file stessi: l'intestazione di scene e risorse (uid="uid://…"), i file .uid accanto agli script, i .import accanto
 * alle immagini. La cache .godot/uid_cache.bin non serve: la verifica lavora su una copia che salta .godot.
 */
export function percorsiDaUid(cartellaProgetto: string): Map<string, string> {
  const mappa = new Map<string, string>();
  const res = (file: string) => `res://${path.relative(cartellaProgetto, file).replace(/\\/g, "/")}`;
  const visita = (cartella: string) => {
    for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
      const completo = path.join(cartella, voce.name);
      if (voce.isDirectory()) {
        if (!CARTELLE_SENZA_UID.has(voce.name)) visita(completo);
        continue;
      }
      if (!voce.isFile()) continue;
      let uid: string | undefined;
      let percorso = completo;
      if (/\.(tscn|tres)$/.test(voce.name)) {
        // L'uid sta nella prima riga: [gd_scene format=3 uid="uid://…"].
        const fd = fs.openSync(completo, "r");
        try {
          const inizio = Buffer.alloc(512);
          const letti = fs.readSync(fd, inizio, 0, 512, 0);
          uid = inizio.toString("utf8", 0, letti).split("\n")[0].match(/uid="(uid:\/\/[0-9a-z]+)"/)?.[1];
        } finally {
          fs.closeSync(fd);
        }
      } else if (voce.name.endsWith(".uid")) {
        uid = fs.readFileSync(completo, "utf8").match(/uid:\/\/[0-9a-z]+/)?.[0];
        percorso = completo.slice(0, -".uid".length);
      } else if (voce.name.endsWith(".import")) {
        uid = fs.readFileSync(completo, "utf8").match(/^uid="(uid:\/\/[0-9a-z]+)"/m)?.[1];
        percorso = completo.slice(0, -".import".length);
      }
      if (uid && !mappa.has(uid)) mappa.set(uid, res(percorso));
    }
  };
  visita(cartellaProgetto);
  return mappa;
}

/**
 * Il valore di un'impostazione con ogni "uid://…" sostituito dal percorso del file a cui punta.
 * `sconosciuti` elenca gli uid che nessun file del progetto porta (file cancellato o spostato fuori da Godot).
 */
export function traduciUid(cartellaProgetto: string, valore: string): { valore: string; sconosciuti: string[] } {
  if (!valore.includes("uid://")) return { valore, sconosciuti: [] };
  const mappa = percorsiDaUid(cartellaProgetto);
  const sconosciuti: string[] = [];
  const tradotto = valore.replace(/uid:\/\/[0-9a-z]+/g, (uid) => {
    const percorso = mappa.get(uid);
    if (!percorso) sconosciuti.push(uid);
    return percorso ?? uid;
  });
  return { valore: tradotto, sconosciuti };
}

// ─────────────────────────── project.godot costruito dalla piattaforma ───────────────────────────

/** Impostazioni di un progetto descritte in modo semplice: da qui la piattaforma scrive project.godot. */
export type ProgettoGodot = {
  nome?: string;
  scenaPrincipale?: string;
  azioni?: { nome: string; tasti: string[] }[];
  autoload?: { nome: string; percorso: string }[];
  impostazioni?: { sezione: string; chiave: string; valore: string }[];
};

const TASTI_SPECIALI: Record<string, number> = {
  space: 32, spazio: 32, spacebar: 32,
  escape: 4194305, esc: 4194305,
  tab: 4194306,
  backspace: 4194308,
  enter: 4194309, invio: 4194309, return: 4194309,
  delete: 4194312, canc: 4194312,
  left: 4194319, sinistra: 4194319,
  up: 4194320, su: 4194320,
  right: 4194321, destra: 4194321,
  down: 4194322, giu: 4194322,
  shift: 4194325, ctrl: 4194326, control: 4194326, alt: 4194328,
};
const PULSANTI_MOUSE: Record<string, number> = {
  mouseleft: 1, leftmouse: 1, mouse1: 1, clic: 1, click: 1, leftclick: 1, clicsinistro: 1, mousesinistro: 1,
  mouseright: 2, rightmouse: 2, mouse2: 2, rightclick: 2, clicdestro: 2, mousedestro: 2,
  mousemiddle: 3, middlemouse: 3, mouse3: 3,
};

/** Nomi dei tasti accettati nelle azioni di input (per le istruzioni ai modelli e i messaggi d'errore). */
export const TASTI_VALIDI = 'lettere "A"-"Z", cifre "0"-"9", "Space", "Enter", "Escape", "Tab", "Shift", "Ctrl", "Alt", "Left", "Right", "Up", "Down", "F1"-"F12", "MouseLeft", "MouseRight"';

type EventoInput = { tipo: "tasto"; codice: number } | { tipo: "mouse"; pulsante: number };

/** Converte il nome di un tasto ("D", "Freccia destra", "Space", "MouseLeft") nell'evento di Godot. Null se non lo riconosce. */
export function eventoDaTasto(nome: string): EventoInput | null {
  const pulito = nome
    .normalize("NFD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/^key_/, "")
    .replace(/[\s_\-+]/g, "")
    .replace(/^(arrow|freccia|tasto|key)(?=.)/, "");
  if (/^[a-z0-9]$/.test(pulito)) return { tipo: "tasto", codice: pulito.toUpperCase().charCodeAt(0) };
  const funzione = pulito.match(/^f(\d{1,2})$/);
  if (funzione && Number(funzione[1]) >= 1 && Number(funzione[1]) <= 12) return { tipo: "tasto", codice: 4194331 + Number(funzione[1]) };
  if (PULSANTI_MOUSE[pulito]) return { tipo: "mouse", pulsante: PULSANTI_MOUSE[pulito] };
  if (TASTI_SPECIALI[pulito]) return { tipo: "tasto", codice: TASTI_SPECIALI[pulito] };
  return null;
}

function testoEvento(e: EventoInput): string {
  const comune = '"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false';
  return e.tipo === "tasto"
    ? `Object(InputEventKey,${comune},"pressed":false,"keycode":0,"physical_keycode":${e.codice},"key_label":0,"unicode":0,"location":0,"echo":false,"script":null)`
    : `Object(InputEventMouseButton,${comune},"button_mask":0,"position":Vector2(0, 0),"global_position":Vector2(0, 0),"factor":1.0,"button_index":${e.pulsante},"canceled":false,"pressed":false,"double_click":false,"script":null)`;
}

/** Un valore scritto "alla buona" (es. main.tscn senza virgolette) diventa un valore valido per project.godot. */
function valoreImpostazione(valore: string): string {
  const v = valore.trim();
  // Un valore su più righe potrebbe aggiungere sezioni a project.godot: diventa un testo tra virgolette.
  if (!/[\r\n]/.test(v) && /^(-?\d+(\.\d+)?|true|false|null|"[^"\\]*(\\.[^"\\]*)*"|[A-Z]\w*\([^\r\n]*\)|\[[^\r\n]*\]|\{[^\r\n]*\})$/.test(v)) return v;
  return JSON.stringify(v);
}

/** Un testo da mettere tra virgolette in project.godot: senza virgolette, barre rovesciate e a capo. */
function testoSemplice(testo: string): string {
  // eslint-disable-next-line no-control-regex
  return testo.replace(/[\x00-\x1f"\\]/g, "").trim();
}

/**
 * Scrive un project.godot completo e valido a partire da una descrizione semplice.
 * I modelli AI sbagliano spesso questo file (ha un formato particolare): per questo non lo scrivono loro.
 */
export function costruisciProjectGodot(p: ProgettoGodot): { testo: string; problemi: string[] } {
  const problemi: string[] = [];
  const sezioni = new Map<string, string[]>();
  const aggiungi = (sezione: string, riga: string) => sezioni.set(sezione, [...(sezioni.get(sezione) ?? []), riga]);
  const percorsoValido = (cosa: string, percorso: string): boolean => {
    const problema = problemaPercorso(percorso);
    if (problema) problemi.push(`${cosa}: ${problema}`);
    return !problema;
  };

  aggiungi("application", `config/name="${testoSemplice(p.nome ?? "") || "Progetto"}"`);
  if (p.scenaPrincipale?.trim() && percorsoValido("scena principale", p.scenaPrincipale)) aggiungi("application", `run/main_scene="${percorsoRes(p.scenaPrincipale)}"`);
  aggiungi("application", 'config/features=PackedStringArray("4.7", "Forward Plus")');
  aggiungi("application", 'config/icon="res://icon.svg"');

  for (const a of p.autoload ?? []) {
    if (!/^[A-Za-z_]\w*$/.test(a.nome)) problemi.push(`autoload "${a.nome}": il nome deve essere un identificatore senza spazi (es. GameState)`);
    else if (percorsoValido(`autoload "${a.nome}"`, a.percorso.replace(/^\*/, ""))) aggiungi("autoload", `${a.nome}="*${percorsoRes(a.percorso.replace(/^\*/, ""))}"`);
  }

  for (const a of p.azioni ?? []) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(a.nome)) {
      problemi.push(`azione di input "${a.nome}": il nome deve essere in snake_case senza spazi (es. move_right)`);
      continue;
    }
    const eventi: string[] = [];
    for (const t of a.tasti) {
      const evento = eventoDaTasto(t);
      if (evento) eventi.push(testoEvento(evento));
      else problemi.push(`azione di input "${a.nome}": tasto "${t}" non riconosciuto. Tasti validi: ${TASTI_VALIDI}`);
    }
    aggiungi("input", `${a.nome}={\n"deadzone": 0.2,\n"events": [${eventi.join(", ")}]\n}`);
  }

  for (const i of p.impostazioni ?? []) {
    const sezione = i.sezione.trim().replace(/^\[|\]$/g, "");
    const chiave = i.chiave.trim();
    if (!sezione || !chiave || sezione === "input" || sezione === "autoload") continue;
    if (!sezioneProgettoAmmessa(sezione)) {
      problemi.push(`impostazione "${sezione}/${chiave}": la sezione [${sezione}] non si può impostare in un esercizio`);
      continue;
    }
    if (!/^[A-Za-z0-9_][A-Za-z0-9_/.\-]*$/.test(chiave)) {
      problemi.push(`impostazione "${sezione}/${chiave}": il nome dell'impostazione può contenere solo lettere, cifre, _ / . -`);
      continue;
    }
    // Nome, scena principale e icona arrivano dai campi dedicati.
    if (sezione === "application" && ["config/name", "run/main_scene", "config/features", "config/icon"].includes(chiave)) continue;
    aggiungi(sezione, `${chiave}=${valoreImpostazione(i.valore)}`);
  }

  const altre = [...sezioni.keys()].filter((s) => !["application", "autoload", "input"].includes(s)).sort();
  const corpo = ["application", "autoload", ...altre, "input"]
    .filter((s) => sezioni.has(s))
    .map((s) => `[${s}]\n\n${sezioni.get(s)!.join("\n")}`)
    .join("\n\n");
  return { testo: `; Engine configuration file.\n; Scritto dalla piattaforma How to Develop.\n\nconfig_version=5\n\n${corpo}\n`, problemi };
}

// ─────────────────────────── Scene: istanze di altre scene ───────────────────────────

function radiceIstanziata(cartellaProgetto: string, scena: Scena, nodo: NodoScena): { scena: Scena; nodo: NodoScena } | null {
  if (!nodo.istanzaDi) return null;
  const risorsa = scena.risorseEsterne.find((r) => r.id === nodo.istanzaDi);
  const testo = risorsa ? leggiFileProgetto(cartellaProgetto, risorsa.percorso) : null;
  if (!testo) return null;
  const altra = leggiScena(testo);
  return altra.nodi[0] ? { scena: altra, nodo: altra.nodi[0] } : null;
}

/**
 * Il tipo reale di un nodo. Un nodo che è l'istanza di un'altra scena non ha il tipo scritto nel file:
 * vale quello della radice della scena istanziata (seguendo anche le istanze di istanze).
 */
export function tipoEffettivo(cartellaProgetto: string, scena: Scena, nodo: NodoScena, profondita = 0): string | null {
  if (nodo.tipo) return nodo.tipo;
  const radice = radiceIstanziata(cartellaProgetto, scena, nodo);
  if (!radice || profondita > 6) return null;
  return tipoEffettivo(cartellaProgetto, radice.scena, radice.nodo, profondita + 1);
}

/** Lo script di un nodo: quello collegato nella scena oppure, per un'istanza, quello della scena istanziata. */
export function scriptEffettivo(cartellaProgetto: string, scena: Scena, nodo: NodoScena, profondita = 0): string | null {
  const id = nodo.proprieta.script?.match(/ExtResource\(\s*"?([^")]+)"?\s*\)/)?.[1];
  const risorsa = id ? scena.risorseEsterne.find((r) => r.id === id) : undefined;
  if (risorsa) return risorsa.percorso;
  const radice = radiceIstanziata(cartellaProgetto, scena, nodo);
  if (!radice || profondita > 6) return null;
  return scriptEffettivo(cartellaProgetto, radice.scena, radice.nodo, profondita + 1);
}
