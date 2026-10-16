import type { LezioneNelCorso } from "@htd/condiviso/piano.ts";
import { descrizioneTipo } from "@htd/condiviso/piano.ts";
import { EsercizioSchema, PraticaSchema, RevisioneSchema, SpiegazioneSchema, type Blocco, type Esercizio, type Lezione, type Pratica, type Spiegazione, type StatoProgetto, type TipoEsercizio } from "@htd/condiviso/schemi.ts";
import { fornitore } from "../ai/catalogo.ts";
import { fattiCerti, messaggi } from "../ai/prompt.ts";
import { AINonDisponibile, candidati, chiamaAI, finestraGiornaliera, RispostaAINonValida, risposteOggiPerLezione, stimaToken, type RichiestaAI, type RispostaAI } from "../ai/router.ts";
import { cancella, leggiJson, salva, scriviJson } from "../archivio.ts";
import { statoDiPartenza, valoriLezione } from "../corso.ts";
import { controllaTempo, GiroFinito } from "../tempo.ts";
import { registra, type Pezzo } from "../traccia.ts";
import { esercizioPerPrompt, istruzioniModalita, preparaEsercizio } from "./esercizio.ts";
import { controllaPezzo, preparaPezzo, progettoPerPrompt, statoDopo } from "./pratica.ts";
import { controllaTeoria, togliRiquadriDifettosi } from "./qualita.ts";

// La catena di scrittura di una lezione (portata dalla versione 1, dove funzionava):
//
//   teoria  →  controllo di qualità fatto dal codice
//   pratica (tutti gli esercizi e il test in UNA richiesta)  →  ogni pezzo controllato in Godot
//   revisione (UNA richiesta: i fatti della teoria, poi esercizi e test)  →  correzioni solo dove serve
//   risultato: la lezione e lo stato del gioco da cui partirà la successiva (la pubblica pubblica.ts)
//
// Le regole:
// - UN PEZZO APPROVATO NON SI RIFÀ. Il lavoro sta nel «cantiere» (cantieri/<lezione>.json), salvato dopo ogni pezzo.
// - OGNI GUASTO HA LA SUA REAZIONE (vedi traccia.ts): fornitore che non risponde → si aspetta; formato sbagliato → si
//   ripara; contenuto che non supera i controlli → correzione mirata con il messaggio preciso; errore del programma → stop.
// - OGNI PASSAGGIO VIENE SCRITTO NEL REGISTRO, riuscito o no.
// - C'È UN TETTO alle risposte per lezione in un giorno: oltre, la lezione aspetta il giorno dopo.

const TETTO_RICHIESTE = 12;
const MAX_CORREZIONI = 2;
const MAX_GIRI_QUALITA = 2;

/** La lezione non può andare avanti adesso, e non per colpa del fornitore. `definitiva`: serve un intervento. */
export class LezioneTrattenuta extends Error {
  riprovaTraSec: number;
  definitiva: boolean;
  constructor(message: string, riprovaTraSec: number, definitiva = false) {
    super(message);
    this.riprovaTraSec = riprovaTraSec;
    this.definitiva = definitiva;
  }
}

// ─────────────────────────── Il cantiere ───────────────────────────

type StatoPezzo = {
  stato: "da_fare" | "ok" | "tolto";
  grezzo: Esercizio;
  esercizio?: Esercizio;
  genere: TipoEsercizio;
  correzioni: number;
  semplificato: boolean;
  problemi: string[];
  modelli: string[];
};

type ProblemaRevisione = { parte: "spiegazione" | "pratica"; problema: string; correzione: string; fonte: string; dove: string };

export type Cantiere = {
  creato: string;
  teoria?: Spiegazione;
  teoriaRivista?: boolean;
  teoriaRiscritta?: boolean;
  ordine?: string[];
  pezzi: Record<string, StatoPezzo>;
  praticaRivista?: boolean;
  praticaRifatta?: boolean;
  restoDaRiscrivere?: string;
  revisione?: { problemi: ProblemaRevisione[]; teoriaCorretta: boolean; corretti: string[] };
  formatoMancato?: number;
  avvisi: string[];
  modelli: string[];
};

const fileCantiere = (slug: string) => `cantieri/${slug}.json`;

export function leggiCantiere(slug: string): Cantiere {
  return leggiJson<Cantiere | null>(fileCantiere(slug), null) ?? { creato: new Date().toISOString(), pezzi: {}, avvisi: [], modelli: [] };
}

export function esisteCantiere(slug: string): boolean {
  return leggiJson<Cantiere | null>(fileCantiere(slug), null) !== null;
}

/** Un nuovo tentativo dopo che la lezione si era fermata: il lavoro approvato resta, i contatori ripartono. */
export function riapriCantiere(slug: string): void {
  const c = leggiJson<Cantiere | null>(fileCantiere(slug), null);
  if (!c) return;
  c.formatoMancato = 0;
  c.teoriaRiscritta = false;
  c.praticaRifatta = false;
  for (const pezzo of Object.values(c.pezzi)) {
    if (pezzo.stato === "ok") continue;
    pezzo.stato = "da_fare";
    pezzo.correzioni = 0;
    pezzo.semplificato = false;
  }
  scriviJson(fileCantiere(slug), c);
  // Le risposte già pagate per i passi da rifare porterebbero allo stesso risultato: si chiede di nuovo.
  cancella(`risposte/${slug}`);
}

export function chiudiCantiere(slug: string): void {
  cancella(fileCantiere(slug));
  cancella(`risposte/${slug}`);
}

type Contesto = { slug: string; lezione: LezioneNelCorso; valori: Record<string, string>; base: StatoProgetto; cantiere: Cantiere };

async function salvaCantiere(ctx: Contesto, perche: string): Promise<void> {
  scriviJson(fileCantiere(ctx.slug), ctx.cantiere);
  await salva(`${ctx.lezione.numero} ${ctx.slug}: ${perche}`);
}

function nota(ctx: Contesto, testo: string) {
  console.log(`[${ctx.lezione.numero} ${ctx.slug}] ${testo}`);
}

const nomePezzo = (id: string) => (id === "test" ? "Test" : id === "teoria" ? "Teoria" : id === "pratica" ? "Pratica" : `Esercizio ${id.replace("es", "")}`);
const breve = (testo: string, massimo: number) => (testo.length > massimo ? `${testo.slice(0, massimo)}…` : testo);
const elenco = (voci: string[], massimo = 700) => voci.map((v) => `- ${breve(v.replace(/\n{2,}/g, "\n"), massimo)}`).join("\n");
const minuti = (secondi: number) => (secondi >= 5400 ? `${Math.round(secondi / 3600)} ore` : `${Math.max(1, Math.round(secondi / 60))} minuti`);

// ─────────────────────────── Chiamate ai modelli, con il registro ───────────────────────────

function controllaTetto(ctx: Contesto) {
  const risposte = risposteOggiPerLezione(ctx.slug);
  if (risposte < TETTO_RICHIESTE) return;
  const giornata = finestraGiornaliera(fornitore("gemini"));
  const attesa = Math.max(600, Math.ceil((giornata.fine.getTime() - Date.now()) / 1000));
  registra({
    slug: ctx.slug,
    pezzo: "lezione",
    azione: "attesa",
    esito: "attesa",
    guasto: "contenuto",
    titolo: "Tetto delle richieste raggiunto",
    spiegazione: `Oggi questa lezione ha già ricevuto ${risposte} risposte dai modelli (il tetto è ${TETTO_RICHIESTE} al giorno; senza intoppi ne servono tre). Il lavoro si ferma qui, con tutto ciò che è già approvato messo da parte, e riprende tra ${minuti(attesa)}, quando il conto riparte da zero.`,
  });
  throw new LezioneTrattenuta(`Tetto di ${TETTO_RICHIESTE} risposte al giorno raggiunto: la lezione riprende domani dal punto in cui è arrivata`, attesa);
}

async function chiedi<T>(ctx: Contesto, pezzo: Pezzo, azione: string, titolo: string, richiesta: Omit<RichiestaAI<T>, "slug">, cosa: (r: RispostaAI<T>) => string = () => "", opzioni: { seNessunoRisponde?: string } = {}): Promise<RispostaAI<T>> {
  const dalle = Date.now();
  const completa: RichiestaAI<T> = { ...richiesta, slug: ctx.slug };
  try {
    controllaTetto(ctx);
    const r = await chiamaAI(completa);
    if (!ctx.cantiere.modelli.includes(r.modello)) ctx.cantiere.modelli.push(r.modello);
    const buttate = r.scartate.length
      ? `\nPrima di questa risposta ${r.scartate.length === 1 ? "ne è stata scartata una" : `ne sono state scartate ${r.scartate.length}`} perché non rispettava il formato (ognuna è costata una richiesta):\n${elenco(r.scartate.map((s) => `${s.modello}: ${s.errore}`), 400)}`
      : "";
    registra({
      slug: ctx.slug,
      pezzo,
      azione,
      titolo,
      dalle,
      esito: "ok",
      modello: r.modello,
      spiegazione: `${r.riusata ? `Risposta di ${r.modello} già pagata in un giro precedente e conservata: usata senza una nuova richiesta.` : `${r.modello} ha risposto nel formato chiesto${r.ragionamento ? ` (dopo ${r.ragionamento} token di ragionamento)` : ""}.`} ${cosa(r)}${buttate}`.trim(),
      dati: { richiesta: richiesta.messaggi, risposta: r.testo, scartate: r.scartate, ragionamento: r.ragionamento, riusata: r.riusata },
    });
    return r;
  } catch (errore) {
    if (errore instanceof AINonDisponibile) {
      const scartate = errore.scartate.length ? ` Prima di fermarsi ${errore.scartate.length === 1 ? "era arrivata una risposta" : `erano arrivate ${errore.scartate.length} risposte`} nel formato sbagliato:\n${elenco(errore.scartate.map((s) => `${s.modello}: ${s.errore}`))}` : "";
      const rifiuti = errore.rifiuti.length
        ? `${errore.rifiuti.length === 1 ? "Il modello interpellato non ha risposto" : `I ${errore.rifiuti.length} modelli interpellati non hanno risposto`}:\n${elenco(errore.rifiuti.map((r) => `${r.modello}: ${r.errore} (${r.contata ? "il fornitore la conta lo stesso tra le richieste del giorno" : "non consuma richieste del giorno"})`))}`
        : `Nessun modello era libero per questa richiesta, che quindi non è partita: ${breve(errore.message.replace(/\s+/g, " "), 400)}.`;
      registra({
        slug: ctx.slug,
        pezzo,
        azione,
        titolo,
        dalle,
        esito: opzioni.seNessunoRisponde ? "saltato" : "attesa",
        guasto: "fornitore",
        spiegazione: `${[rifiuti, ...errore.fermi.map((f) => `${f}.`)].join("\n")}${scartate}\nReazione: ${opzioni.seNessunoRisponde ?? `la lezione si ferma qui senza perdere niente del lavoro già approvato e riprende da questo punto tra ${minuti(errore.riprovaTraSec)}`}.`,
        dati: { richiesta: richiesta.messaggi, rifiuti: errore.rifiuti, fermi: errore.fermi, scartate: errore.scartate },
      });
    } else if (errore instanceof RispostaAINonValida) {
      registra({ slug: ctx.slug, pezzo, azione, titolo, dalle, esito: "fallito", guasto: "formato", spiegazione: `I modelli hanno risposto, ma nessuna risposta rispettava il formato, nemmeno dopo aver chiesto di correggerlo:\n${elenco(errore.scartate.map((s) => `${s.modello}: ${s.errore}`))}`, dati: { richiesta: richiesta.messaggi, scartate: errore.scartate } });
    } else if (!(errore instanceof LezioneTrattenuta) && !(errore instanceof GiroFinito)) {
      registra({ slug: ctx.slug, pezzo, azione, titolo, dalle, esito: "fallito", guasto: "piattaforma", spiegazione: `Errore del programma durante la richiesta: ${(errore as Error).message}`, dati: { errore: (errore as Error).stack } });
    }
    throw errore;
  }
}

// ─────────────────────────── Normalizzazione ───────────────────────────

/** Assegna id stabili ai blocchi; toglie i video che puntano a esercizi inesistenti o non eseguibili. */
export function normalizzaLezione(spiegazione: Spiegazione, pratica: Pratica, avvisi: string[] = []): Lezione {
  const { esercizi, test } = pratica;
  const filmabile = (id: string) => esercizi.find((e) => e.id === id && e.modalita === "progetto" && e.soluzione.progetto?.scenaPrincipale && e.soluzione.file.some((f) => f.percorso.endsWith(".gd")));
  const blocchi = spiegazione.blocchi
    .filter((b) => b.tipo !== "video" || filmabile(b.esercizio))
    .map((b, i) => {
      const id = `b${i + 1}`;
      if (b.tipo === "video") {
        const azioni = new Set((filmabile(b.esercizio)?.soluzione.progetto?.azioni ?? []).map((a) => a.nome));
        return { ...b, id, azioni: b.azioni.filter((a) => azioni.has(a.azione)) };
      }
      return { ...b, id };
    }) as Blocco[];
  return { ...spiegazione, blocchi, esercizi, test, ...(avvisi.length ? { avvisi } : {}) };
}

function sintesiSpiegazione(s: Spiegazione, massimo = 7000, perRevisione = false): string {
  const parti = s.blocchi.map((b, i) => {
    const etichetta = perRevisione ? `[blocco ${i + 1} · ${b.tipo}]\n` : "";
    switch (b.tipo) {
      case "testo":
        return etichetta + b.md;
      case "codice":
        return etichetta + "```gdscript\n" + b.codice + "\n```" + (perRevisione && b.spiegazione ? `\n${b.spiegazione}` : "");
      case "passi":
        return `${etichetta}${b.titolo}\n${b.passi.map((p, j) => `${j + 1}. ${p}`).join("\n")}`;
      case "attenzione":
        return `${etichetta}(attenzione) ${b.md}`;
      case "riepilogo":
        return `${etichetta}Riepilogo:\n${b.md}`;
      case "immagine":
        return `${etichetta}[Immagine dell'editor: ${b.immagine}${b.didascalia ? ` — ${b.didascalia}` : ""}]`;
      case "video":
        return `${etichetta}[Video del risultato: esercizio ${b.esercizio}, azioni di input ${b.azioni.map((a) => a.azione).join(", ") || "nessuna"}]`;
    }
  });
  return `# ${s.titolo}\n${s.sommario}\n\n${parti.join("\n\n")}`.slice(0, massimo);
}

// ─────────────────────────── Teoria ───────────────────────────

async function controllaQualitaTeoria(ctx: Contesto, iniziale: Spiegazione, scrittore: string): Promise<{ spiegazione: Spiegazione; rimasti: string[] }> {
  let esito = controllaTeoria(iniziale);
  registra({
    slug: ctx.slug,
    pezzo: "teoria",
    azione: "controllo",
    esito: esito.problemi.length ? "fallito" : "ok",
    guasto: esito.problemi.length ? "contenuto" : undefined,
    titolo: "Teoria: controllo di qualità fatto dal codice",
    spiegazione:
      esito.problemi.length === 0
        ? `Nessun difetto${esito.ritocchi.length ? ` (sistemati dal codice: ${esito.ritocchi.join("; ")})` : ""}.`
        : `Trovati ${esito.problemi.length} difetti che richiedono una riscrittura mirata:\n${elenco(esito.problemi, 300)}${esito.ritocchi.length ? `\nSistemati dal codice: ${esito.ritocchi.join("; ")}.` : ""}\nReazione: i difetti tornano a un modello con il numero del blocco, per correggere solo quelli.`,
    dati: { problemi: esito.problemi, ritocchi: esito.ritocchi },
  });
  for (let giro = 0; giro < MAX_GIRI_QUALITA && esito.problemi.length > 0; giro++) {
    nota(ctx, `Teoria: correzione di ${esito.problemi.length} difetti…`);
    const prima = esito.problemi.length;
    try {
      const corretta = await chiedi(
        ctx,
        "teoria",
        "correzione",
        `Teoria: correzione mirata ${giro + 1} di ${MAX_GIRI_QUALITA}`,
        { ruolo: "scrittore", messaggi: messaggi("correzione", { ...ctx.valori, problemi: esito.problemi.map((p) => `- ${p}`).join("\n"), contenuto: JSON.stringify(esito.spiegazione) }), schema: SpiegazioneSchema, maxTokens: 9000, evita: giro >= 1 ? [scrittore] : [] },
        (r) => {
          const dopo = controllaTeoria(r.dati).problemi.length;
          return dopo < prima ? `I difetti scendono da ${prima} a ${dopo}: correzione accettata.` : `I difetti restano ${dopo} (erano ${prima}): correzione scartata.`;
        },
      );
      const nuovo = controllaTeoria(corretta.dati);
      if (nuovo.problemi.length < esito.problemi.length) esito = nuovo;
    } catch (errore) {
      if (!(errore instanceof RispostaAINonValida)) throw errore;
      break;
    }
  }
  return { spiegazione: esito.spiegazione, rimasti: esito.problemi };
}

async function scriviTeoria(ctx: Contesto): Promise<void> {
  const c = ctx.cantiere;
  for (;;) {
    const riscrittura = Boolean(c.teoriaRiscritta);
    nota(ctx, riscrittura ? "Teoria: riscrittura…" : "Teoria: scrittura…");
    const teoria = await chiedi(
      ctx,
      "teoria",
      "scrittura",
      riscrittura ? "Teoria: riscrittura con un altro modello" : "Teoria: scrittura",
      { ruolo: "scrittore", messaggi: messaggi("lezione-spiegazione", { ...ctx.valori, progetto_attuale: progettoPerPrompt(ctx.base, 9000), nome_progetto: ctx.base.nome }), schema: SpiegazioneSchema, maxTokens: 9000, evita: riscrittura ? c.modelli : [] },
      (r) => `Teoria di ${r.dati.blocchi.length} blocchi: ${r.dati.blocchi.map((b) => b.tipo).join(", ")}.`,
    );
    const esito = await controllaQualitaTeoria(ctx, teoria.dati, teoria.modello);
    if (esito.rimasti.length === 0) {
      c.teoria = esito.spiegazione;
      await salvaCantiere(ctx, "teoria approvata");
      return;
    }
    if (!c.teoriaRiscritta) {
      c.teoriaRiscritta = true;
      await salvaCantiere(ctx, "teoria da riscrivere");
      registra({ slug: ctx.slug, pezzo: "teoria", azione: "controllo", esito: "fallito", guasto: "contenuto", titolo: "Teoria: difetti rimasti dopo le correzioni", spiegazione: `Dopo ${MAX_GIRI_QUALITA} correzioni mirate restano ${esito.rimasti.length} difetti:\n${elenco(esito.rimasti, 300)}\nReazione: la teoria viene riscritta una volta con un altro modello.`, dati: { rimasti: esito.rimasti } });
      continue;
    }
    const pulita = controllaTeoria(togliRiquadriDifettosi(esito.spiegazione));
    if (pulita.problemi.length === 0) {
      c.teoria = pulita.spiegazione;
      await salvaCantiere(ctx, "teoria approvata");
      return;
    }
    registra({ slug: ctx.slug, pezzo: "teoria", azione: "controllo", esito: "fallito", guasto: "contenuto", titolo: "Teoria: non raggiunge il livello richiesto", spiegazione: `Anche la riscrittura lascia ${pulita.problemi.length} difetti:\n${elenco(pulita.problemi, 300)}\nReazione: la lezione viene trattenuta. Serve un intervento sulle istruzioni date ai modelli.`, dati: { rimasti: pulita.problemi, teoria: pulita.spiegazione } });
    throw new LezioneTrattenuta(`La teoria non supera il controllo di qualità nemmeno riscritta: ${pulita.problemi.map((p) => p.slice(0, 120)).join(" | ")}`, 0, true);
  }
}

const soloTesto = (t: string) => t.toLowerCase().replace(/[*_`"'«»“”‘’]/g, "").replace(/\s+/g, " ").trim();

function citazioneVera(citazione: string, fonti: string): boolean {
  const c = soloTesto(citazione);
  if (c.length < 25) return false;
  for (let i = 0; i + 30 <= Math.max(c.length, 30); i += 8) if (fonti.includes(c.slice(i, i + 30))) return true;
  return false;
}

const soloUnParere = (problema: string) => /incomplet|generic|poco chiar|più chiar|potrebbe|non specifica|non spiega abbastanza|manca(no)? /i.test(problema);

function citazionePertinente(p: { problema: string; correzione: string; fonte: string }): boolean {
  const parole = (t: string) => new Set(soloTesto(t).match(/[a-zà-ù0-9_]{5,}/g) ?? []);
  const nellaFonte = parole(p.fonte);
  return [...parole(`${p.problema} ${p.correzione}`)].filter((x) => nellaFonte.has(x)).length >= 2;
}

/**
 * Ciò che il revisore riceve per controllare i fatti della teoria, e il filtro sui problemi che segnala: un errore della
 * teoria conta solo se il revisore porta la frase della documentazione che lo dimostra, e quella frase esiste davvero.
 */
function fontiRevisione(ctx: Contesto) {
  const fonti = { fatti: fattiCerti(), immagini: ctx.valori.immagini, documentazione: breve(ctx.valori.documentazione, 4500), non_ancora: breve(ctx.valori.non_ancora, 900) };
  const testoFonti = soloTesto(Object.values(fonti).join("\n"));
  const dimostrati = <P extends { problema: string; correzione: string; fonte: string }>(problemi: P[]) => problemi.filter((p) => citazioneVera(p.fonte, testoFonti) && !soloUnParere(p.problema) && citazionePertinente(p));
  return { fonti, dimostrati };
}

async function correggiTeoriaSegnalata(ctx: Contesto, problemi: ProblemaRevisione[]): Promise<void> {
  const c = ctx.cantiere;
  const spiegazione = c.teoria!;
  if (problemi.length === 0) return;
  const righe = problemi.map((p) => `- ${p.dove ? `[${p.dove}] ` : ""}${p.problema}${p.correzione ? ` → ${p.correzione}` : ""}\n  Fonte: «${p.fonte.replace(/\s+/g, " ").slice(0, 300)}»`);
  const prima = controllaTeoria(spiegazione).problemi.length;
  const accettabile = (s: Spiegazione) => {
    const dopo = controllaTeoria(s);
    return dopo.spiegazione.blocchi.length >= spiegazione.blocchi.length - 2 && dopo.problemi.length <= prima;
  };
  try {
    const corretta = await chiedi(
      ctx,
      "teoria",
      "correzione",
      "Teoria: correzione dei fatti segnalati dal revisore",
      { ruolo: "scrittore", messaggi: messaggi("correzione", { ...ctx.valori, problemi: righe.join("\n"), contenuto: JSON.stringify(spiegazione) }), schema: SpiegazioneSchema, maxTokens: 9000 },
      (r) => (accettabile(r.dati) ? "Correzione accettata." : "Correzione scartata: toglieva blocchi o reintroduceva difetti."),
    );
    if (accettabile(corretta.dati)) {
      c.teoria = controllaTeoria(corretta.dati).spiegazione;
      await salvaCantiere(ctx, "teoria corretta dopo la revisione");
    }
  } catch (errore) {
    if (!(errore instanceof RispostaAINonValida)) throw errore;
  }
}

// ─────────────────────────── Pratica ───────────────────────────

function tipiPrevisti(lezione: LezioneNelCorso): TipoEsercizio[] {
  return lezione.esercizi.filter((t) => t !== "da-zero");
}

function genereTest(lezione: LezioneNelCorso): TipoEsercizio {
  if (lezione.tipo === "progetto") return "da-zero";
  const adatti = tipiPrevisti(lezione).filter((t) => t !== "guidato" && t !== "prevedi");
  return adatti.at(-1) ?? "obiettivo";
}

/** Sistema in locale le deviazioni dal formato che non meritano una richiesta di correzione. */
function riparaPratica(dati: unknown): unknown {
  const esercizio = (e: unknown): unknown => {
    if (!e || typeof e !== "object") return e;
    const x = { ...(e as Record<string, unknown>) };
    if (Array.isArray(x.verifiche)) x.verifiche = x.verifiche.map((v) => (v && typeof v === "object" && "contiene" in v && typeof (v as { contiene: unknown }).contiene !== "string" && (v as { contiene: unknown }).contiene != null ? { ...v, contiene: String((v as { contiene: unknown }).contiene) } : v));
    delete x.domande;
    if (x.genere === "prevedi") x.modalita = "previsioni";
    if (!x.modalita || x.modalita === "domande") x.modalita = "progetto";
    for (const campo of ["passiGuida", "suggerimenti", "daTrovare", "verifiche", "previsioni"]) if (x[campo] == null) delete x[campo];
    if (x.partenza === null) delete x.partenza;
    return x;
  };
  if (!dati || typeof dati !== "object") return dati;
  const d = dati as { esercizi?: unknown; test?: unknown };
  return { ...d, esercizi: Array.isArray(d.esercizi) ? d.esercizi.map(esercizio) : [], test: esercizio(d.test) };
}

function riparaEsercizio(dati: unknown): unknown {
  return (riparaPratica({ esercizi: [], test: dati }) as { test: unknown }).test;
}

type PraticaScritta = { coppie: { genere: TipoEsercizio; grezzo: Esercizio }[]; test: Esercizio; modello: string };

async function chiediPratica(ctx: Contesto, tipi: TipoEsercizio[], base: StatoProgetto, opzioni: { titolo: string; azione: string; nota?: string; evita?: string[] }): Promise<PraticaScritta> {
  const c = ctx.cantiere;
  const tappa = ctx.lezione.tipo === "progetto";
  const aParte = ctx.lezione.dove === "a-parte";
  const notaAParte = aParte ? '\n\nATTENZIONE: in questa lezione NON si lavora sul gioco della fase. Ogni esercizio e il test usano un progetto loro (`dove: "a-parte"`), con il nome che decide la consegna: ignora ciò che è detto sul gioco della fase e sui suoi file.' : "";
  const pratica = await chiedi(
    ctx,
    "pratica",
    opzioni.azione,
    opzioni.titolo,
    {
      ruolo: "scrittore",
      messaggi: messaggi("pratica", {
        ...ctx.valori,
        documentazione: breve(ctx.valori.documentazione, 5000),
        spiegazione: c.teoria ? sintesiSpiegazione(c.teoria) : "(questa è una tappa del progetto di fine fase: non ha una parte teorica, si usa ciò che la fase ha insegnato)",
        nome_progetto: base.nome,
        cartella_progetto: base.cartella,
        progetto_attuale: progettoPerPrompt(base),
        elenco_esercizi: (tipi.length ? tipi.map((t, i) => `${i + 1}. "${t}" — ${descrizioneTipo(t)?.nome ?? t}: ${descrizioneTipo(t)?.cosa ?? ""}`).join("\n") : "(nessun esercizio: c'è solo il test)") + notaAParte + (opzioni.nota ? `\n\n${opzioni.nota}` : ""),
        regola_test: tappa
          ? 'è la tappa stessa, di genere "da-zero" e `dove: "gioco"`: la consegna dice cosa deve fare il progetto alla fine della tappa, senza passi e senza suggerimenti. Lo studente decide da solo scene, script e struttura: la consegna fissa solo i nomi che le verifiche devono poter trovare (scena principale, azioni di input, nodi e funzioni controllati).'
          : `un lavoro di genere "${genereTest(ctx.lezione)}" (${descrizioneTipo(genereTest(ctx.lezione))?.nome ?? ""}).`,
        istruzioni_progetto: istruzioniModalita("progetto", { contesto: `${ctx.lezione.titolo} ${ctx.lezione.costruisci}` }),
        istruzioni_ambiente: /Project Manager|elenco dei progetti|Editor Settings|impostazion[ei] dell'editor/i.test(`${ctx.lezione.verifica} ${ctx.lezione.costruisci}`) ? istruzioniModalita("ambiente") : "In questa lezione non servono le verifiche `progetto_in_elenco` e `godot_aperto`: non usarle.",
      }),
      schema: PraticaSchema,
      ripara: riparaPratica,
      maxTokens: 14000,
      evita: opzioni.evita,
    },
    (r) => `Scritti ${r.dati.esercizi.length} esercizi (${r.dati.esercizi.map((e) => e.genere ?? "?").join(", ") || "nessuno"}) e il test (${r.dati.test.genere ?? "?"}).`,
  );
  const arrivati = [...pratica.dati.esercizi];
  const dichiarati = tipi.map((t) => {
    const posizione = arrivati.findIndex((e) => e.genere === t);
    return posizione >= 0 ? arrivati.splice(posizione, 1)[0] : null;
  });
  const coppie = tipi.map((genere, i) => ({ genere, grezzo: dichiarati[i] ?? arrivati.shift() ?? null })).filter((x): x is { genere: TipoEsercizio; grezzo: Esercizio } => x.grezzo !== null);
  const conDove = (e: Esercizio): Esercizio => (aParte ? { ...e, dove: "a-parte" } : e);
  return { coppie: coppie.map((x) => ({ genere: x.genere, grezzo: conDove(x.grezzo) })), test: conDove(pratica.dati.test), modello: pratica.modello };
}

const pezzoNuovo = (grezzo: Esercizio, genere: TipoEsercizio, modello: string): StatoPezzo => ({ stato: "da_fare", grezzo, genere, correzioni: 0, semplificato: false, problemi: [], modelli: [modello] });

async function scriviPratica(ctx: Contesto): Promise<void> {
  const c = ctx.cantiere;
  const tipi = tipiPrevisti(ctx.lezione);
  const tappa = ctx.lezione.tipo === "progetto";
  nota(ctx, tappa ? "Tappa del progetto: scrittura…" : "Pratica: scrittura di esercizi e test…");
  const pratica = await chiediPratica(ctx, tipi, ctx.base, { azione: "scrittura", titolo: tappa ? "Tappa del progetto: scrittura" : `Pratica: scrittura di ${tipi.length} esercizi e del test in una richiesta` });
  if (pratica.coppie.length < tipi.length) {
    registra({ slug: ctx.slug, pezzo: "pratica", azione: "controllo", esito: "fallito", guasto: "contenuto", titolo: "Pratica: meno esercizi del previsto", spiegazione: `Il piano prevede ${tipi.length} esercizi (${tipi.join(", ")}), il modello ne ha scritti ${pratica.coppie.length}.\nReazione: si prosegue con quelli che ci sono; la mancanza viene dichiarata tra gli avvisi della lezione.` });
    c.avvisi.push(`Il piano prevedeva ${tipi.length} esercizi (${tipi.join(", ")}), ne sono stati scritti ${pratica.coppie.length}.`);
  }
  c.ordine = [...pratica.coppie.map((_, i) => `es${i + 1}`), "test"];
  c.pezzi = {};
  pratica.coppie.forEach((x, i) => (c.pezzi[`es${i + 1}`] = pezzoNuovo(x.grezzo, x.genere, pratica.modello)));
  c.pezzi.test = pezzoNuovo(pratica.test, genereTest(ctx.lezione), pratica.modello);
  await salvaCantiere(ctx, "pratica scritta");
}

async function riscriviRestoDellaPratica(ctx: Contesto, tolto: string, stato: StatoProgetto): Promise<boolean> {
  const c = ctx.cantiere;
  const ordine = c.ordine ?? [];
  const dopo = ordine.slice(ordine.indexOf(tolto) + 1).filter((id) => c.pezzi[id].stato === "da_fare");
  const eserciziDopo = dopo.filter((id) => id !== "test");
  const tipi = eserciziDopo.map((id) => c.pezzi[id].genere);
  const approvati = ordine.filter((id) => c.pezzi[id].stato === "ok").map((id) => `«${c.pezzi[id].esercizio?.titolo ?? c.pezzi[id].grezzo.titolo}»`);
  const fatta = async () => {
    c.restoDaRiscrivere = undefined;
    c.praticaRifatta = true;
    await salvaCantiere(ctx, "resto della pratica riscritto");
  };
  nota(ctx, "Pratica: riscrittura degli esercizi rimasti…");
  try {
    const pratica = await chiediPratica(ctx, tipi, stato, {
      azione: "riscrittura",
      titolo: `Pratica: riscrittura di ${tipi.length ? `${tipi.length} esercizi e del test` : "test"} dopo un esercizio tolto`,
      evita: c.pezzi[tolto].modelli.slice(-1),
      nota: [
        "ATTENZIONE: stai scrivendo solo la parte FINALE della pratica di questa lezione.",
        approvati.length ? `Esercizi già approvati, che vengono prima di questi e NON vanno riscritti: ${approvati.join(", ")}. Il loro lavoro è già nel progetto mostrato sopra.` : "",
        `L'esercizio «${c.pezzi[tolto].grezzo.titolo}» NON fa parte della lezione: non superava i controlli ed è stato tolto. Il suo lavoro quindi NON è nel progetto: il gioco è esattamente quello mostrato sopra in "I file del progetto in questo momento".`,
        "Gli esercizi che scrivi partono da QUEL progetto. Se serve qualcosa che non c'è ancora (una scena, un nodo, uno script), deve farla creare il primo esercizio che scrivi, e la sua consegna deve dirlo con i nomi precisi.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    eserciziDopo.forEach((id, i) => {
      const nuovo = pratica.coppie[i];
      if (nuovo) c.pezzi[id] = pezzoNuovo(nuovo.grezzo, nuovo.genere, pratica.modello);
      else {
        c.pezzi[id].stato = "tolto";
        c.avvisi.push(`L'esercizio "${c.pezzi[id].grezzo.titolo}" (${c.pezzi[id].genere}) non è stato riscritto dopo che quello prima di lui era stato tolto.`);
      }
    });
    if (dopo.includes("test")) c.pezzi.test = pezzoNuovo(pratica.test, genereTest(ctx.lezione), pratica.modello);
    await fatta();
    return true;
  } catch (errore) {
    if (!(errore instanceof RispostaAINonValida)) throw errore;
    await fatta();
    return false;
  }
}

function richiestaCorrezione(valori: Record<string, string>, esercizio: Esercizio, problemi: string[]): Omit<RichiestaAI<Esercizio>, "slug"> {
  return {
    ruolo: "scrittore",
    messaggi: messaggi("correzione-esercizio", {
      titolo_competenza: valori.titolo_competenza,
      problemi: problemi.map((p) => `- ${p}`).join("\n").slice(0, 6000),
      istruzioni_modalita: istruzioniModalita(esercizio.modalita, { test: esercizio.tipo === "test", contesto: `${valori.titolo_competenza} ${esercizioPerPrompt(esercizio)}` }),
      documentazione: valori.documentazione.slice(0, 3500),
      esercizio: esercizioPerPrompt(esercizio),
    }),
    schema: EsercizioSchema,
    ripara: riparaEsercizio,
    maxTokens: 9000,
  };
}

/** Correzione di un esercizio fuori dalla catena (segnalazioni): restituisce l'esercizio messo in forma. */
export async function correggiEsercizio(slug: string, valori: Record<string, string>, esercizio: Esercizio, problemi: string[]): Promise<{ esercizio: Esercizio; modello: string }> {
  const { dati, modello } = await chiamaAI({ ...richiestaCorrezione(valori, esercizio, problemi), slug });
  const corretto = preparaEsercizio(dati, esercizio.id ?? "es1", esercizio.tipo);
  if (corretto.modalita === "progetto" && esercizio.cartella) corretto.cartella = esercizio.cartella;
  return { esercizio: corretto, modello };
}

/** La prima correzione di un pezzo, tentata da un modello del ruolo «ritocco» (molte più richieste, Godot giudica). */
async function ritocco(ctx: Contesto, pezzo: Pezzo, titolo: string, richiesta: Omit<RichiestaAI<Esercizio>, "slug">): Promise<RispostaAI<Esercizio> | null> {
  const leggera = { ...richiesta, ruolo: "ritocco" as const };
  const { disponibili } = candidati("ritocco", { tokenStimati: stimaToken(leggera.messaggi) + (leggera.maxTokens ?? 4000), escludi: [] });
  if (disponibili.length === 0) return null;
  try {
    return await chiedi(ctx, pezzo, "correzione", titolo, leggera, undefined, { seNessunoRisponde: "la correzione passa subito a un modello che scrive le lezioni: la lezione non aspetta" });
  } catch (errore) {
    if (errore instanceof AINonDisponibile) return null;
    throw errore;
  }
}

function promemoriaGenere(e: Esercizio): string {
  const t = descrizioneTipo(e.genere ?? "obiettivo");
  const dove = e.modalita !== "progetto" ? "" : e.dove === "gioco" ? ' L\'esercizio prosegue il gioco della fase (`dove: "gioco"`): non cambiare i nomi di ciò che esisteva già.' : " È un progetto a parte.";
  return `Questo esercizio è di genere "${e.genere}" (${t?.nome ?? ""}: ${t?.cosa ?? ""}) e deve restarlo.${dove}`;
}

async function completaPezzo(ctx: Contesto, id: string, base: StatoProgetto): Promise<boolean> {
  const pezzo = ctx.cantiere.pezzi[id];
  const ruolo: Esercizio["tipo"] = id === "test" ? "test" : pezzo.genere === "guidato" ? "guidato" : "autonomo";
  for (;;) {
    controllaTempo();
    nota(ctx, `${nomePezzo(id)}: controllo in Godot…`);
    const dalle = Date.now();
    let preparato: Esercizio;
    let problemi: string[];
    try {
      preparato = preparaPezzo(pezzo.grezzo, id, ruolo, pezzo.genere, base);
      ({ esercizio: preparato, problemi } = await controllaPezzo(preparato, base));
    } catch (errore) {
      registra({ slug: ctx.slug, pezzo: id as Pezzo, azione: "verifica", esito: "fallito", guasto: "piattaforma", titolo: `${nomePezzo(id)}: errore del programma durante il controllo`, spiegazione: `Il controllo dell'esercizio si è interrotto per un errore della piattaforma, non dell'esercizio: ${(errore as Error).message}\nReazione: ci si ferma, perché riprovare darebbe lo stesso errore.`, dalle, dati: { errore: (errore as Error).stack, grezzo: pezzo.grezzo } });
      throw errore;
    }
    const cosaControllato =
      preparato.modalita === "previsioni"
        ? `${preparato.previsioni.length} previsioni eseguite in Godot per ricavarne la risposta giusta`
        : preparato.modalita === "progetto"
          ? `${preparato.verifiche.length} verifiche eseguite sulla soluzione (devono passare) e sul progetto com'è prima del lavoro (devono fallire)`
          : `${preparato.verifiche.length} verifiche controllate nella forma`;
    if (problemi.length === 0) {
      pezzo.stato = "ok";
      pezzo.esercizio = preparato;
      pezzo.problemi = [];
      await salvaCantiere(ctx, `${nomePezzo(id).toLowerCase()} approvato`);
      registra({
        slug: ctx.slug,
        pezzo: id as Pezzo,
        azione: "verifica",
        esito: "ok",
        titolo: `${nomePezzo(id)} (${pezzo.genere}): approvato`,
        spiegazione: `«${preparato.titolo}». ${cosaControllato}.${pezzo.correzioni ? ` Approvato dopo ${pezzo.correzioni === 1 ? "una correzione" : `${pezzo.correzioni} correzioni`}.` : " Approvato al primo colpo."}${preparato.modalita === "previsioni" ? `\nRisposte calcolate: ${preparato.previsioni.map((p) => p.risposta).join(" · ")}` : ""}${preparato.soluzione.cambiati.length ? `\nFile aggiunti o cambiati: ${preparato.soluzione.cambiati.join(", ")}` : ""}`,
        dalle,
        dati: { esercizio: preparato },
      });
      return true;
    }
    pezzo.problemi = problemi;
    await salvaCantiere(ctx, `${nomePezzo(id).toLowerCase()}: problemi trovati`);
    const ancora = pezzo.correzioni < MAX_CORREZIONI;
    registra({
      slug: ctx.slug,
      pezzo: id as Pezzo,
      azione: "verifica",
      esito: "fallito",
      guasto: "contenuto",
      titolo: `${nomePezzo(id)} (${pezzo.genere}): ${problemi.length === 1 ? "1 problema" : `${problemi.length} problemi`}`,
      spiegazione: `«${preparato.titolo}», scritto da ${pezzo.modelli.at(-1)}. ${cosaControllato}.\n${elenco(problemi, 1200)}\nReazione: ${ancora ? `i problemi tornano a un modello per correggere solo questo pezzo (correzione ${pezzo.correzioni + 1} di ${MAX_CORREZIONI})${pezzo.correzioni >= 1 ? ", questa volta un modello diverso" : ""}.` : "le correzioni previste sono finite."}`,
      dalle,
      dati: { problemi, esercizio: preparato },
    });
    if (!ancora) return false;
    nota(ctx, `${nomePezzo(id)}: correzione ${pezzo.correzioni + 1}…`);
    try {
      const titolo = `${nomePezzo(id)}: correzione mirata ${pezzo.correzioni + 1} di ${MAX_CORREZIONI}`;
      const richiesta = richiestaCorrezione(ctx.valori, preparato, [promemoriaGenere(preparato), ...problemi]);
      const corretto = (pezzo.correzioni === 0 ? await ritocco(ctx, id as Pezzo, titolo, richiesta) : null) ?? (await chiedi(ctx, id as Pezzo, "correzione", titolo, { ...richiesta, evita: pezzo.correzioni >= 1 ? pezzo.modelli.slice(-1) : [] }));
      pezzo.grezzo = { ...corretto.dati, dove: preparato.dove };
      pezzo.modelli.push(corretto.modello);
    } catch (errore) {
      if (!(errore instanceof RispostaAINonValida)) throw errore;
    }
    pezzo.correzioni++;
    await salvaCantiere(ctx, `${nomePezzo(id).toLowerCase()}: correzione ${pezzo.correzioni}`);
  }
}

async function pezzoMancato(ctx: Contesto, id: string, base: StatoProgetto): Promise<boolean> {
  const c = ctx.cantiere;
  const pezzo = c.pezzi[id];
  if (!pezzo.semplificato) {
    nota(ctx, `${nomePezzo(id)}: riscrittura semplificata…`);
    const ruolo: Esercizio["tipo"] = id === "test" ? "test" : pezzo.genere === "guidato" ? "guidato" : "autonomo";
    const ultimo = preparaPezzo(pezzo.grezzo, id, ruolo, pezzo.genere, base);
    const fatta = async () => {
      pezzo.semplificato = true;
      pezzo.correzioni = MAX_CORREZIONI;
      await salvaCantiere(ctx, `${nomePezzo(id).toLowerCase()}: riscrittura semplificata`);
    };
    try {
      const riscritto = await chiedi(ctx, id as Pezzo, "riscrittura", `${nomePezzo(id)}: riscrittura semplificata con un altro modello`, {
        ...richiestaCorrezione(ctx.valori, ultimo, [
          promemoriaGenere(ultimo),
          "Le correzioni precedenti non sono bastate. Scrivi una versione PIÙ SEMPLICE che chieda la stessa cosa: meno file, meno nodi, una sola verifica `script_godot` breve che controlli il comportamento essenziale, più le verifiche semplici che servono.",
          ...pezzo.problemi,
        ]),
        evita: pezzo.modelli,
      });
      pezzo.grezzo = { ...riscritto.dati, dove: ultimo.dove };
      pezzo.modelli.push(riscritto.modello);
      await fatta();
      if (await completaPezzo(ctx, id, base)) return true;
    } catch (errore) {
      if (!(errore instanceof RispostaAINonValida)) throw errore;
      await fatta();
    }
  }
  const riusciti = (c.ordine ?? []).filter((x) => x !== "test" && c.pezzi[x].stato === "ok" && c.pezzi[x].esercizio?.modalita !== "previsioni");
  const comune = { slug: ctx.slug, pezzo: id as Pezzo, azione: "ripiego", esito: "saltato" as const, guasto: "contenuto" as const, dati: { problemi: pezzo.problemi, ultimo: pezzo.grezzo } };
  if (id !== "test") {
    const altri = (c.ordine ?? []).filter((x) => x !== "test" && x !== id && c.pezzi[x].stato !== "tolto");
    pezzo.stato = "tolto";
    c.avvisi.push(altri.length === 0 ? `L'esercizio "${pezzo.grezzo.titolo}" (${pezzo.genere}) non superava i controlli ed è stato tolto: questa lezione ha solo il test.` : `L'esercizio "${pezzo.grezzo.titolo}" (${pezzo.genere}) non superava i controlli: è stato tolto.`);
    await salvaCantiere(ctx, `${nomePezzo(id).toLowerCase()} tolto`);
    registra({ ...comune, titolo: `${nomePezzo(id)}: tolto dalla lezione`, spiegazione: `Dopo le correzioni e la riscrittura semplificata l'esercizio non supera i controlli:\n${elenco(pezzo.problemi, 600)}\nReazione: l'esercizio viene tolto e la cosa è dichiarata tra gli avvisi della lezione.` });
    return false;
  }
  if (riusciti.length === 0) {
    registra({ ...comune, esito: "fallito", titolo: "Test: non riuscito, e non c'è un esercizio da usare al suo posto", spiegazione: `Il test non supera i controlli:\n${elenco(pezzo.problemi, 600)}\nReazione: la lezione viene trattenuta. Serve un intervento.` });
    throw new LezioneTrattenuta("Il test non supera i controlli e non c'è un esercizio riuscito da usare come prova", 0, true);
  }
  const sostituto = c.pezzi[riusciti.at(-1)!].esercizio!;
  pezzo.stato = "ok";
  pezzo.esercizio = { ...sostituto, id: "test", tipo: "test", passiGuida: [], suggerimenti: sostituto.suggerimenti.slice(0, 1) };
  c.avvisi.push(`Il test previsto ("${pezzo.grezzo.titolo}") non superava i controlli: per ora la prova è l'ultimo esercizio, da rifare senza aiuto.`);
  await salvaCantiere(ctx, "test sostituito dall'ultimo esercizio");
  registra({ ...comune, titolo: "Test: sostituito dall'ultimo esercizio riuscito", spiegazione: `Il test non supera i controlli:\n${elenco(pezzo.problemi, 600)}\nReazione: perché il corso non si fermi, la prova di questa lezione diventa l'ultimo esercizio riuscito («${sostituto.titolo}»), senza passi e con un solo indizio. La sostituzione è dichiarata tra gli avvisi della lezione.` });
  return true;
}

async function correggiPraticaSegnalata(ctx: Contesto, esercizi: Esercizio[], statoPrima: Map<string, StatoProgetto>, problemi: { dove: string; problema: string; correzione: string }[], fatti: string[]): Promise<Esercizio[]> {
  const risultato: Esercizio[] = [];
  const concluso = async (e: Esercizio) => {
    risultato.push(e);
    ctx.cantiere.pezzi[e.id!].esercizio = e;
    if (!fatti.includes(e.id!)) fatti.push(e.id!);
    await salvaCantiere(ctx, `${nomePezzo(e.id!).toLowerCase()}: revisione chiusa`);
  };
  for (const e of esercizi) {
    const suoi = problemi.filter((p) => p.dove.toLowerCase().replace(/\s+/g, "").includes(e.id!)).map((p) => `${p.problema}${p.correzione ? ` → ${p.correzione}` : ""}`);
    const ultimoDelGioco = e.dove !== "gioco" || e.id === esercizi.filter((x) => x.dove === "gioco").at(-1)?.id;
    if (suoi.length === 0 || !ultimoDelGioco || fatti.includes(e.id!)) {
      risultato.push(e);
      continue;
    }
    try {
      const base = statoPrima.get(e.id!) ?? ctx.base;
      const corretto = await chiedi(ctx, e.id as Pezzo, "correzione", `${nomePezzo(e.id!)}: correzione chiesta dal revisore`, richiestaCorrezione(ctx.valori, e, [promemoriaGenere(e), `Il revisore del corso segnala (la soluzione attuale supera già le verifiche: deve continuare a farlo):\n${suoi.join("\n")}`]));
      controllaTempo();
      const preparato = preparaPezzo({ ...corretto.dati, dove: e.dove }, e.id!, e.tipo, e.genere ?? "obiettivo", base);
      const controllo = await controllaPezzo(preparato, base);
      registra({ slug: ctx.slug, pezzo: e.id as Pezzo, azione: "verifica", esito: controllo.problemi.length ? "saltato" : "ok", titolo: `${nomePezzo(e.id!)}: correzione del revisore ${controllo.problemi.length ? "scartata" : "accettata"}`, spiegazione: controllo.problemi.length ? `La versione corretta non supera più i controlli, quindi si tiene quella già approvata:\n${elenco(controllo.problemi, 500)}` : "La versione corretta supera tutti i controlli e sostituisce la precedente.", dati: { problemi: controllo.problemi } });
      await concluso(controllo.problemi.length ? e : controllo.esercizio);
    } catch (errore) {
      if (!(errore instanceof RispostaAINonValida)) throw errore;
      await concluso(e);
    }
  }
  return risultato;
}

const eserciziPerRevisione = (esercizi: Esercizio[]) =>
  JSON.stringify(esercizi.map((e) => ({ id: e.id, genere: e.genere, titolo: e.titolo, modalita: e.modalita, consegna: e.consegna, passiGuida: e.passiGuida, suggerimenti: e.suggerimenti, verifiche: e.verifiche, previsioni: e.previsioni.map((p) => ({ domanda: p.domanda, codice: p.codice, risposta: p.risposta })) }))).slice(0, 30000);

async function rivedi(ctx: Contesto, esercizi: Esercizio[], statoPrima: Map<string, StatoProgetto>, conTeoria: boolean): Promise<Esercizio[]> {
  const c = ctx.cantiere;
  const { fonti, dimostrati } = fontiRevisione(ctx);
  const parteDi = (p: ProblemaRevisione): "spiegazione" | "pratica" => (!conTeoria || /\b(es\s*\d+|test)\b/i.test(p.dove) ? "pratica" : /blocco/i.test(p.dove) ? "spiegazione" : p.parte);
  if (!c.revisione) {
    nota(ctx, conTeoria ? "Revisione della lezione…" : "Pratica: revisione…");
    const teoria = c.teoria ?? ({ titolo: ctx.lezione.titolo, sommario: ctx.lezione.costruisci, blocchi: [] } as unknown as Spiegazione);
    try {
      const revisione = await chiedi(
        ctx,
        conTeoria ? "lezione" : "pratica",
        "revisione",
        conTeoria ? "Revisione della lezione: fatti della teoria, esercizi e test" : "Pratica: revisione di esercizi e test",
        {
          ruolo: "revisore",
          messaggi: conTeoria
            ? messaggi("revisione-lezione", { ...ctx.valori, ...fonti, gia_insegnato: breve(ctx.valori.gia_insegnato, 1500), lezione: sintesiSpiegazione(teoria, 6500, true), esercizi: eserciziPerRevisione(esercizi) })
            : messaggi("revisione-pratica", { ...ctx.valori, spiegazione: breve(sintesiSpiegazione(teoria), 3000), gia_insegnato: breve(ctx.valori.gia_insegnato, 1200), non_ancora: breve(ctx.valori.non_ancora, 900), esercizi: eserciziPerRevisione(esercizi) }),
          schema: RevisioneSchema,
          maxTokens: conTeoria ? 3000 : 2000,
          evita: c.modelli,
          aspettaMigliore: 70_000,
        },
        (r) => {
          const segnalati: ProblemaRevisione[] = r.dati.approvata ? [] : r.dati.problemi;
          if (segnalati.length === 0) return conTeoria ? "Il revisore approva la teoria, gli esercizi e il test." : "Il revisore approva esercizi e test.";
          const diTeoria = segnalati.filter((p) => parteDi(p) === "spiegazione");
          const veri = dimostrati(diTeoria);
          const diPratica = segnalati.filter((p) => parteDi(p) === "pratica");
          return [
            !conTeoria ? "" : diTeoria.length ? `Teoria: ${diTeoria.length} problemi segnalati, ${veri.length} dimostrati con una frase che esiste davvero nella documentazione (gli altri vengono ignorati).\n${elenco(diTeoria.map((p) => `${veri.includes(p) ? "[dimostrato]" : "[senza prova]"} ${p.dove ? `${p.dove}: ` : ""}${p.problema}`), 300)}` : "Teoria: nessun errore di fatto.",
            diPratica.length ? `Esercizi e test: ${diPratica.length} problemi segnalati.\n${elenco(diPratica.map((p) => `${p.dove}: ${p.problema}`), 400)}` : "Esercizi e test: approvati.",
          ]
            .filter(Boolean)
            .join("\n");
        },
      );
      c.revisione = { problemi: revisione.dati.approvata ? [] : revisione.dati.problemi, teoriaCorretta: false, corretti: [] };
    } catch (errore) {
      if (!(errore instanceof RispostaAINonValida)) throw errore;
      c.revisione = { problemi: [], teoriaCorretta: true, corretti: [] };
    }
    await salvaCantiere(ctx, "revisione ricevuta");
  }
  const revisione = c.revisione;
  if (conTeoria && !revisione.teoriaCorretta) {
    await correggiTeoriaSegnalata(ctx, dimostrati(revisione.problemi.filter((p) => parteDi(p) === "spiegazione")));
    revisione.teoriaCorretta = true;
    await salvaCantiere(ctx, "correzioni della teoria chiuse");
  }
  return await correggiPraticaSegnalata(ctx, esercizi, statoPrima, revisione.problemi.filter((p) => parteDi(p) === "pratica"), revisione.corretti);
}

// ─────────────────────────── Catena completa ───────────────────────────

function teoriaDiTappa(lezione: LezioneNelCorso): Spiegazione {
  return {
    titolo: lezione.titolo,
    sommario: lezione.costruisci,
    concetti: [],
    obiettivi: lezione.impari,
    durataMinuti: lezione.minuti,
    blocchi: [
      { tipo: "testo", md: `Questa è una tappa del progetto di fine fase: **${lezione.fase.prova || lezione.titolo}**\n\nNon c'è niente di nuovo da studiare. Parti dal progetto com'è adesso (alla prima tappa: da un progetto vuoto) e costruisci da solo ciò che chiede la consegna, usando quello che hai imparato in questa fase e la documentazione.` },
      { tipo: "testo", md: `**In questa tappa:** ${lezione.costruisci}` },
      { tipo: "riepilogo", md: ["- Nessun passo e nessun suggerimento: decidi tu scene, script e nomi, tranne quelli che la consegna fissa.", "- La piattaforma esegue il tuo progetto e controlla cosa succede.", "- Se ti blocchi, riapri la lezione della fase che tratta quel punto: non c'è fretta."].join("\n") },
    ],
  } as Spiegazione;
}

export type LezioneScritta = { lezione: Lezione; statoFinale: StatoProgetto; modelli: string[] };

/**
 * Scrive (o riprende) una lezione fino alla fine. Lancia AINonDisponibile, LezioneTrattenuta o GiroFinito quando si
 * deve fermare: il lavoro fatto resta nel cantiere.
 */
export async function scriviLezione(lezione: LezioneNelCorso): Promise<LezioneScritta> {
  const slug = lezione.slug;
  const ctx: Contesto = { slug, lezione, valori: valoriLezione(lezione), base: statoDiPartenza(lezione), cantiere: leggiCantiere(slug) };
  const c = ctx.cantiere;
  const ripresa = Boolean(c.teoria || c.ordine);
  registra({
    slug,
    pezzo: "lezione",
    azione: ripresa ? "ripresa" : "inizio",
    esito: "ok",
    titolo: ripresa ? "Ripresa dal lavoro già fatto" : "Inizio",
    spiegazione: ripresa
      ? `Nel cantiere ci sono: ${[c.teoria ? `la teoria${c.teoriaRivista ? " (rivista)" : ""}` : "", ...(c.ordine ?? []).map((id) => `${nomePezzo(id).toLowerCase()} ${c.pezzi[id].stato === "ok" ? "approvato" : c.pezzi[id].stato === "tolto" ? "tolto" : "da completare"}`)].filter(Boolean).join(", ")}. Si riparte dal primo pezzo non concluso.`
      : `Lezione «${lezione.titolo}» (${ctx.valori.tipo_competenza}) della fase «${lezione.fase.titolo}». Tipi di esercizio previsti dal piano: ${lezione.esercizi.join(", ") || "nessuno"}. Il progetto di partenza «${ctx.base.nome}» ha ${ctx.base.file.length - 1} file oltre a project.godot.`,
  });

  try {
    if (lezione.tipo === "progetto") c.teoria ??= teoriaDiTappa(lezione);
    else if (!c.teoria) await scriviTeoria(ctx);

    if (!c.ordine) await scriviPratica(ctx);
    let stato = ctx.base;
    const statoPrima = new Map<string, StatoProgetto>();
    for (const id of c.ordine!) {
      if (c.restoDaRiscrivere && c.pezzi[id].stato === "da_fare") await riscriviRestoDellaPratica(ctx, c.restoDaRiscrivere, stato);
      statoPrima.set(id, stato);
      if (c.pezzi[id].stato === "da_fare" && !(await completaPezzo(ctx, id, stato)) && !(await pezzoMancato(ctx, id, stato))) {
        const delGioco = (x: string) => c.pezzi[x].grezzo.dove === "gioco" && c.pezzi[x].grezzo.modalita !== "previsioni";
        const dopo = c.ordine!.slice(c.ordine!.indexOf(id) + 1).filter((x) => c.pezzi[x].stato === "da_fare");
        if (id !== "test" && (c.pezzi[id].stato as StatoPezzo["stato"]) === "tolto" && delGioco(id) && dopo.some(delGioco) && !c.praticaRifatta) {
          registra({ slug, pezzo: "pratica", azione: "controllo", esito: "saltato", guasto: "contenuto", titolo: "Pratica: gli esercizi rimasti vanno riscritti", spiegazione: `${nomePezzo(id)} proseguiva il gioco ed è stato tolto. ${dopo.map(nomePezzo).join(", ")} davano per fatto il suo lavoro.\nReazione: vengono riscritti tutti insieme, in una sola richiesta, partendo dal gioco com'è adesso. Succede al massimo una volta per lezione.` });
          c.restoDaRiscrivere = id;
          await salvaCantiere(ctx, "resto della pratica da riscrivere");
        }
      }
      const pezzo = c.pezzi[id];
      if (pezzo.stato === "ok" && pezzo.esercizio) stato = statoDopo(stato, pezzo.esercizio);
    }
    let pratica = c.ordine!.filter((id) => c.pezzi[id].stato === "ok").map((id) => c.pezzi[id].esercizio!);

    if (!c.praticaRivista) {
      pratica = await rivedi(ctx, pratica, statoPrima, lezione.tipo !== "progetto" && !c.teoriaRivista);
      for (const e of pratica) c.pezzi[e.id!].esercizio = e;
      c.teoriaRivista = true;
      c.praticaRivista = true;
      await salvaCantiere(ctx, "revisione conclusa");
      stato = ctx.base;
      for (const e of pratica) stato = statoDopo(stato, e);
    }

    const contenuto = normalizzaLezione(c.teoria!, { esercizi: pratica.filter((e) => e.id !== "test"), test: pratica.find((e) => e.id === "test")! }, [...new Set(c.avvisi)]);
    if (pratica.some((e) => e.dove === "gioco")) contenuto.statoIniziale = ctx.base;
    return { lezione: contenuto, statoFinale: stato, modelli: c.modelli };
  } catch (errore) {
    scriviJson(fileCantiere(slug), c);
    if (errore instanceof RispostaAINonValida) {
      c.formatoMancato = (c.formatoMancato ?? 0) + 1;
      scriviJson(fileCantiere(slug), c);
      const definitiva = c.formatoMancato >= 2;
      registra({
        slug,
        pezzo: "lezione",
        azione: "attesa",
        esito: definitiva ? "fallito" : "attesa",
        guasto: "formato",
        titolo: definitiva ? "Formato non rispettato per la seconda volta: lezione trattenuta" : "Formato non rispettato: si riprova una volta, tra un'ora",
        spiegazione: definitiva
          ? "Per la seconda volta nessun modello ha risposto nel formato chiesto per un pezzo senza il quale la lezione non esiste. Reazione: la lezione viene trattenuta e il corso si ferma qui. Serve un intervento sulle istruzioni o sul formato."
          : "Nessun modello ha risposto nel formato chiesto per un pezzo senza il quale la lezione non esiste. Reazione: si riprova una sola volta, tra un'ora. Il lavoro già approvato resta nel cantiere.",
      });
      throw new LezioneTrattenuta(`Nessun modello ha rispettato il formato: ${breve(errore.message, 300)}`, definitiva ? 0 : 3600, definitiva);
    }
    throw errore;
  }
}
