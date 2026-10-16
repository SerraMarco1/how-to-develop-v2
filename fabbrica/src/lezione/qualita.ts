import { catalogoImmagini, leggiFileMotore } from "@htd/condiviso/motore.ts";
import type { Blocco, Esercizio, Spiegazione } from "@htd/condiviso/schemi.ts";
import { stileDiCasa } from "../ai/prompt.ts";

// Controllo di qualità della parte teorica, fatto dal codice e non da un modello.
// Un modello che scrive una lezione sbaglia in modi sempre uguali: ripete lo stesso blocco, ricopia nella
// lezione le regole interne che gli sono state date, riempie la pagina di riquadri. Sono difetti che si
// riconoscono con certezza leggendo il testo, quindi li cerca il codice:
// - quelli che si possono sistemare senza riscrivere (un doppione, un riquadro di troppo) vengono sistemati qui;
// - gli altri diventano un elenco di problemi precisi, che torna al modello per una correzione mirata.

/** Quanti riquadri "Attenzione" può avere una lezione: oltre, smettono di segnalare qualcosa. */
const MAX_ATTENZIONE = 2;
const MAX_IMMAGINI = 3;
const MIN_BLOCCHI = 5;
const MAX_BLOCCHI = 16;

function parole(testo: string): string[] {
  return (
    testo
      .toLowerCase()
      .replace(/[*_`#>[\]()«»"“”'’]/g, " ")
      .match(/[a-zà-ù0-9_./:+-]+/g) ?? []
  );
}

function gruppi(lista: string[], n: number): Set<string> {
  const insieme = new Set<string>();
  for (let i = 0; i + n <= lista.length; i++) insieme.add(lista.slice(i, i + n).join(" "));
  return insieme;
}

/** Quale parte di `a` si ritrova in `b` (da 0 a 1). */
function contenuto(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let comuni = 0;
  for (const x of a) if (b.has(x)) comuni++;
  return comuni / a.size;
}

/** Il testo discorsivo di un blocco (i blocchi senza prosa restituiscono ""). */
function prosa(b: Blocco): string {
  switch (b.tipo) {
    case "testo":
    case "attenzione":
    case "riepilogo":
      return b.md;
    case "passi":
      return `${b.titolo}. ${b.passi.join(" ")}`;
    default:
      return "";
  }
}

/** Due blocchi dicono la stessa cosa: quasi tutte le terne di parole del più corto stanno nell'altro. */
function doppione(a: Blocco, b: Blocco): boolean {
  if (a.tipo === "codice" || b.tipo === "codice") return a.tipo === "codice" && b.tipo === "codice" && a.codice.trim() === b.codice.trim();
  const [ga, gb] = [gruppi(parole(prosa(a)), 3), gruppi(parole(prosa(b)), 3)];
  const [corto, lungo] = ga.size <= gb.size ? [ga, gb] : [gb, ga];
  return corto.size >= 6 && contenuto(corto, lungo) >= 0.75;
}

/**
 * Frasi che parlano DELLO studente o danno ordini a chi scrive: nella lezione non devono comparire
 * (la lezione dà del tu a chi studia). Di solito sono regole interne ricopiate.
 */
const FRASI_INTERNE = /\b(lo|dello|allo|dallo) studente\b|\bgli studenti\b|\bmai chiedere\b|\bnon far cambiare\b|\bil corso tratterà\b|\bla lezione (deve|non deve)\b|\bstile di casa\b/i;

let cacheRegole: Set<string> | null = null;
/** Le regole interne date ai modelli (lo stile di casa), a gruppi di cinque parole: servono a riconoscere un blocco ricopiato. */
function regoleInterne(): Set<string> {
  cacheRegole ??= gruppi(parole(stileDiCasa()), 5);
  return cacheRegole;
}

function ricopiato(b: Blocco): boolean {
  if (b.tipo !== "testo" && b.tipo !== "attenzione") return false;
  const g = gruppi(parole(b.md), 5);
  return g.size >= 6 && contenuto(g, regoleInterne()) >= 0.6;
}

type NomeSbagliato = { se: string; allora: string };
let cacheNomi: { regola: RegExp; allora: string }[] | null = null;

/**
 * Nomi dell'interfaccia che non esistono in questa versione di Godot (elenco nel pacchetto motore, verificato
 * sulle schermate del vero editor). Restituisce una correzione per ogni nome sbagliato trovato nel testo.
 */
export function nomiSbagliati(testo: string): string[] {
  if (!cacheNomi) {
    try {
      const dati = JSON.parse(leggiFileMotore("nomi-sbagliati.json")) as { nomi: NomeSbagliato[] };
      cacheNomi = dati.nomi.map((n) => ({ regola: new RegExp(n.se, "i"), allora: n.allora }));
    } catch {
      cacheNomi = [];
    }
  }
  return cacheNomi.filter((n) => n.regola.test(testo)).map((n) => `"${testo.match(n.regola)?.[0]}": ${n.allora}`);
}

export type EsitoQualita = {
  spiegazione: Spiegazione;
  /** Difetti che richiedono una riscrittura, scritti per essere letti dal modello che corregge ("blocco 4: …"). */
  problemi: string[];
  /** Cosa è stato sistemato qui, senza riscrivere (per il diario della generazione). */
  ritocchi: string[];
};

/** Controlla la parte teorica: sistema ciò che si può sistemare da soli e segnala il resto. */
export function controllaTeoria(spiegazione: Spiegazione): EsitoQualita {
  const ritocchi: string[] = [];
  let blocchi: Blocco[] = spiegazione.blocchi.filter((b) => (b.tipo !== "testo" && b.tipo !== "attenzione" && b.tipo !== "riepilogo") || b.md.trim().length >= 15);

  // Doppioni: resta il primo. Il riepilogo è escluso: ripetere i punti chiave è il suo mestiere.
  const senzaDoppioni: Blocco[] = [];
  for (const b of blocchi) {
    if (b.tipo !== "riepilogo" && b.tipo !== "video" && b.tipo !== "immagine" && senzaDoppioni.some((x) => x.tipo !== "riepilogo" && doppione(x, b))) continue;
    senzaDoppioni.push(b);
  }
  if (senzaDoppioni.length < blocchi.length) ritocchi.push(`tolti ${blocchi.length - senzaDoppioni.length} blocchi che ripetevano un blocco precedente`);
  blocchi = senzaDoppioni;

  // Immagini: solo dal catalogo, ognuna una volta, poche.
  const noti = new Set(catalogoImmagini().map((i) => i.id));
  const viste = new Set<string>();
  const primaDelleImmagini = blocchi.length;
  blocchi = blocchi.filter((b) => {
    if (b.tipo !== "immagine") return true;
    if (!noti.has(b.immagine) || viste.has(b.immagine) || viste.size >= MAX_IMMAGINI) return false;
    viste.add(b.immagine);
    return true;
  });
  if (blocchi.length < primaDelleImmagini) ritocchi.push(`tolte ${primaDelleImmagini - blocchi.length} immagini (non nel catalogo, ripetute o di troppo)`);

  // Riquadri "Attenzione": i primi restano, gli altri tornano testo normale nel punto in cui sono.
  let attenzioni = 0;
  blocchi = blocchi.map((b): Blocco => (b.tipo === "attenzione" && ++attenzioni > MAX_ATTENZIONE ? { id: b.id, tipo: "testo", md: b.md } : b));
  if (attenzioni > MAX_ATTENZIONE) ritocchi.push(`${attenzioni - MAX_ATTENZIONE} riquadri "Attenzione" di troppo riportati a testo normale`);

  // Riepilogo: uno solo, in fondo.
  const riepiloghi = blocchi.filter((b) => b.tipo === "riepilogo");
  if (riepiloghi.length > 0) {
    const ultimo = riepiloghi[riepiloghi.length - 1];
    if (riepiloghi.length > 1 || blocchi[blocchi.length - 1] !== ultimo) ritocchi.push("riepilogo spostato in fondo");
    blocchi = [...blocchi.filter((b) => b.tipo !== "riepilogo"), ultimo];
  }

  const problemi: string[] = [];
  const numero = (b: Blocco) => `blocco ${blocchi.indexOf(b) + 1}`;
  for (const b of blocchi) {
    const testo = prosa(b);
    if (ricopiato(b)) {
      problemi.push(`${numero(b)}: ripete parola per parola una regola interna del corso ("${testo.slice(0, 70)}…"). Quelle regole servono a te per non sbagliare, non vanno riportate: se l'informazione serve a chi studia, spiegala con parole tue nel punto della lezione in cui serve; altrimenti togli il blocco.`);
    } else if (FRASI_INTERNE.test(testo)) {
      problemi.push(`${numero(b)}: parla DELLO studente o contiene un'istruzione per chi scrive il corso ("${testo.match(FRASI_INTERNE)?.[0]}"). La lezione si rivolge a chi studia dandogli del tu: riscrivi il blocco così, oppure toglilo se non gli serve.`);
    }
    for (const nome of nomiSbagliati(b.tipo === "codice" ? b.spiegazione : testo)) problemi.push(`${numero(b)}: nome dell'editor sbagliato — ${nome}.`);
  }
  const contenuti = blocchi.filter((b) => b.tipo !== "video" && b.tipo !== "immagine" && b.tipo !== "riepilogo");
  if (blocchi[0] && blocchi[0].tipo !== "testo") problemi.push("la lezione deve aprirsi con un blocco `testo` che dice a cosa serve l'argomento, non con un riquadro o un elenco di passi");
  if (riepiloghi.length === 0) problemi.push("manca il blocco `riepilogo` finale con i punti chiave della lezione (un elenco breve)");
  if (contenuti.length < MIN_BLOCCHI) problemi.push(`la lezione è troppo corta (${contenuti.length} blocchi di contenuto): spiega ogni obiettivo con il suo testo e, dove serve, i passi o il codice`);
  if (blocchi.length > MAX_BLOCCHI) problemi.push(`la lezione è troppo lunga (${blocchi.length} blocchi, massimo ${MAX_BLOCCHI - 2}): unisci i blocchi che parlano della stessa cosa e togli ciò che non riguarda gli obiettivi`);
  if (!blocchi.some((b) => b.tipo === "passi" || b.tipo === "codice")) problemi.push("la lezione non fa fare niente: aggiungi almeno un blocco `passi` (cosa cliccare nell'editor) o `codice`");

  return { spiegazione: { ...spiegazione, blocchi }, problemi, ritocchi };
}

/**
 * Ultima passata, quando le correzioni non hanno risolto tutto: i blocchi ancora ricopiati o con frasi interne
 * vengono tolti se sono riquadri (lì il danno è sicuro), lasciati se sono testo (l'informazione di solito è giusta).
 */
export function togliRiquadriDifettosi(spiegazione: Spiegazione): Spiegazione {
  return { ...spiegazione, blocchi: spiegazione.blocchi.filter((b) => !(b.tipo === "attenzione" && (ricopiato(b) || FRASI_INTERNE.test(b.md)))) };
}
