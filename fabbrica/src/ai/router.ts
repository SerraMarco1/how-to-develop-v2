import crypto from "node:crypto";
import type { z } from "zod";
import { aggiungiRiga, cancella, leggiJson, leggiRighe, salva, scriviJson } from "../archivio.ts";
import { chiaveFornitore, nascondiSegreti } from "../configurazione.ts";
import { aggiornaStato, statoFabbrica } from "../stato.ts";
import { controllaTempo } from "../tempo.ts";
import { FORNITORI, MODELLI, QUALITA_MINIMA, fornitore, nomeModello, type Fornitore, type Modello, type Ruolo } from "./catalogo.ts";
import { chat, ErroreAI, sforzoPerDimensione, type Messaggio } from "./client.ts";
import { estraiJson, validaJson } from "./json.ts";

// Il router sceglie quale modello usare per ogni richiesta, conta le richieste del giorno, ferma i modelli che non
// rispondono e conserva ogni risposta valida appena arriva (vedi «Le risposte pagate»).
// Le regole sono quelle misurate nella versione 1 della piattaforma; qui cambia solo dove vive lo stato: in file del
// ramo `corso` invece che in un database sul PC.

export class AINonDisponibile extends Error {
  riprovaTraSec: number;
  scartate: RispostaScartata[];
  rifiuti: { modello: string; errore: string; contata: boolean }[];
  fermi: string[];
  constructor(message: string, riprovaTraSec: number, scartate: RispostaScartata[] = [], rifiuti: { modello: string; errore: string; contata: boolean }[] = [], fermi: string[] = []) {
    super(message);
    this.riprovaTraSec = riprovaTraSec;
    this.scartate = scartate;
    this.rifiuti = rifiuti;
    this.fermi = fermi;
  }
}

export type RispostaScartata = { modello: string; errore: string; testo: string };

/** I modelli hanno risposto, ma nessuno ha prodotto qualcosa di utilizzabile: riprovare subito non serve. */
export class RispostaAINonValida extends Error {
  scartate: RispostaScartata[];
  constructor(message: string, scartate: RispostaScartata[] = []) {
    super(message);
    this.scartate = scartate;
  }
}

export type RichiestaAI<T> = {
  ruolo: Ruolo;
  messaggi: Messaggio[];
  /** La lezione per cui si chiede: le risposte valide vengono conservate sotto il suo nome. */
  slug: string;
  maxTokens?: number;
  temperatura?: number;
  schema?: z.ZodType<T>;
  ripara?: (dati: unknown) => unknown;
  escludi?: string[];
  /** Modelli da evitare se possibile (es. il revisore diverso dallo scrittore). */
  evita?: string[];
  /** Quanto aspettare (ms) un modello migliore che ha raggiunto il limite al minuto, invece di passare a uno peggiore. */
  aspettaMigliore?: number;
};

export type RispostaAI<T> = { testo: string; dati: T; modello: string; scartate: RispostaScartata[]; ragionamento?: number; riusata: boolean };

// ─────────────────────────── La giornata dei fornitori ───────────────────────────

function orologio(fuso: string, istante: Date): { ore: number; minuti: number; secondi: number } {
  const parti = new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(istante);
  const n = (tipo: string) => Number(parti.find((p) => p.type === tipo)?.value ?? 0);
  return { ore: n("hour"), minuti: n("minute"), secondi: n("second") };
}

function ultimaMezzanotte(fuso: string, adesso: Date): Date {
  const o = orologio(fuso, adesso);
  let istante = Math.floor(adesso.getTime() / 1000) * 1000 - (o.ore * 3600 + o.minuti * 60 + o.secondi) * 1000;
  const li = orologio(fuso, new Date(istante)).ore;
  if (li === 23) istante += 3600_000;
  else if (li === 1) istante -= 3600_000;
  return new Date(istante);
}

/** L'intervallo in cui il fornitore conta le richieste «di oggi». Gemini: da mezzanotte a mezzanotte in California. */
export function finestraGiornaliera(f: Pick<Fornitore, "azzeramentoFuso">, adesso = new Date()): { inizio: Date; fine: Date } {
  const fuso = f.azzeramentoFuso ?? "UTC";
  const mezzanotte = ultimaMezzanotte(fuso, adesso);
  return { inizio: mezzanotte, fine: ultimaMezzanotte(fuso, new Date(mezzanotte.getTime() + 36 * 3600_000)) };
}

/** Il nome del file in cui si contano le chiamate di un fornitore nella sua giornata attuale. */
function fileGiornata(f: Fornitore, adesso = new Date()): string {
  const { inizio } = finestraGiornaliera(f, adesso);
  const giorno = new Intl.DateTimeFormat("en-CA", { timeZone: f.azzeramentoFuso ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(inizio.getTime() + 3600_000));
  return `stato/chiamate/${f.id}/${giorno}.jsonl`;
}

export type Chiamata = {
  quando: number;
  modello: string;
  ruolo: Ruolo;
  slug: string;
  ok: boolean;
  /** Conta tra le richieste del giorno: tutte tranne quelle mai arrivate e i 429 (limite già raggiunto). */
  contata: boolean;
  durataMs: number;
  tokenInput?: number;
  tokenOutput?: number;
  ragionamento?: number;
  errore?: string;
};

const cacheGiornate = new Map<string, Chiamata[]>();
/** Le chiamate fatte in questo giro, per il registro (quante richieste è costato un passaggio). */
export const chiamateDelGiro: Chiamata[] = [];

export function chiamateDiOggi(f: Fornitore): Chiamata[] {
  const file = fileGiornata(f);
  if (!cacheGiornate.has(file)) cacheGiornate.set(file, leggiRighe<Chiamata>(file));
  return cacheGiornate.get(file)!;
}

function registraChiamata(f: Fornitore, c: Chiamata): void {
  const pulita = { ...c, errore: c.errore ? nascondiSegreti(c.errore).slice(0, 500) : undefined };
  aggiungiRiga(fileGiornata(f), pulita);
  chiamateDiOggi(f).push(pulita);
  chiamateDelGiro.push(pulita);
}

/** I nomi che consumano le stesse richieste del giorno di un modello (lui compreso). */
function stessoSecchio(m: Modello): string[] {
  const s = statoFabbrica();
  const vero = s.stessoLimite[nomeModello(m)] ?? m.modello;
  return MODELLI.filter((x) => x.fornitore === m.fornitore && (x.modello === vero || (s.stessoLimite[nomeModello(x)] ?? x.modello) === vero)).map((x) => x.modello).concat(vero);
}

/** Quante richieste contano oggi per un modello (con gli altri nomi dello stesso secchio). */
export function richiesteOggi(m: Modello): number {
  const nomi = new Set(stessoSecchio(m));
  return chiamateDiOggi(fornitore(m.fornitore)).filter((c) => c.contata && nomi.has(c.modello)).length;
}

/** Quante risposte valide ha ricevuto una lezione nella giornata di Gemini (per il tetto per lezione). */
export function risposteOggiPerLezione(slug: string): number {
  return FORNITORI.reduce((n, f) => n + chiamateDiOggi(f).filter((c) => c.slug === slug && c.ok).length, 0);
}

// ─────────────────────────── Sovraccarico e fermi ───────────────────────────
//
// Quando un fornitore è sovraccarico rifiuta (503) quasi tutti i suoi modelli insieme, per decine di minuti, e ogni
// rifiuto consuma una richiesta del giorno. Al primo rifiuto si prova UN altro modello; se rifiuta anche lui il fornitore
// resta fermo 10, poi 20, 40, 60 minuti, e a ogni giro si fa una richiesta sola, a turno tra i modelli (prima chi ha
// rifiutato da più tempo). La prima risposta azzera tutto.

const PAUSE_SOVRACCARICO_MIN = [10, 20, 40, 60];
const SOVRACCARICO_DIMENTICATO_MS = 2 * 3600_000;

export function sovraccaricoDi(providerId: string): { volte: number; fino: number } | null {
  const stato = statoFabbrica().sovraccarico[providerId];
  return stato && Date.now() - stato.fino < SOVRACCARICO_DIMENTICATO_MS ? stato : null;
}

function ultimoRifiuto(m: Modello): number {
  const rifiuti = chiamateDiOggi(fornitore(m.fornitore)).filter((c) => c.modello === m.modello && !c.ok && c.contata);
  return rifiuti.length ? Math.max(...rifiuti.map((c) => c.quando)) : 0;
}

function fermaModello(nome: string, secondi: number, errore: string): void {
  aggiornaStato((s) => {
    const fino = Date.now() + secondi * 1000;
    if ((s.fermi[nome]?.fino ?? 0) < fino) s.fermi[nome] = { fino, errore: nascondiSegreti(errore).slice(0, 400) };
  });
}

function segnaSovraccarico(providerId: string, errore: string): string {
  const volte = (sovraccaricoDi(providerId)?.volte ?? 0) + 1;
  const secondi = PAUSE_SOVRACCARICO_MIN[Math.min(volte, PAUSE_SOVRACCARICO_MIN.length) - 1] * 60;
  const fino = Date.now() + secondi * 1000;
  aggiornaStato((s) => {
    s.sovraccarico[providerId] = { volte, fino };
    // Un modello senza limite al giorno può continuare: per lui un rifiuto non costa.
    for (const m of MODELLI.filter((x) => x.fornitore === providerId && x.rpd)) {
      const nome = nomeModello(m);
      if ((s.fermi[nome]?.fino ?? 0) < fino) s.fermi[nome] = { fino, errore: nascondiSegreti(errore).slice(0, 400) };
    }
  });
  const giro = volte === 1 ? "primo giro senza risposta" : `${volte}° giro di fila senza risposta`;
  return `${fornitore(providerId).nome} è sovraccarico: resta fermo ${Math.round(secondi / 60)} minuti (${giro}), poi si riprova con una richiesta sola`;
}

function fineSovraccarico(providerId: string): void {
  if (!statoFabbrica().sovraccarico[providerId]) return;
  aggiornaStato((s) => {
    delete s.sovraccarico[providerId];
  });
}

/** Quando finisce la giornata di un fornitore, più un minuto: dopo un «limite del giorno raggiunto» il modello aspetta lì. */
function fermoDopoRifiuto(f: Fornitore, errore: ErroreAI): number {
  if (errore.limiteGiornaliero && f.azzeramentoFuso) return Math.max(60, Math.ceil((finestraGiornaliera(f).fine.getTime() - Date.now()) / 1000) + 60);
  return errore.riprovaTraSec ?? 120;
}

// ─────────────────────────── Ragionamento troncato ───────────────────────────

const TRONCATE_DIMENTICATE_MS = 7 * 24 * 3600_000;
const chiaveTroncate = (modello: string, dimensione: number) => `${modello}:${dimensione}`;

function ragionamentoMassimoNonRegge(modello: string, dimensione: number): boolean {
  const voce = statoFabbrica().troncate[chiaveTroncate(modello, dimensione)];
  return Boolean(voce && voce.volte >= 2 && Date.now() - voce.quando < TRONCATE_DIMENTICATE_MS);
}

function segnaTroncata(modello: string, dimensione: number): void {
  aggiornaStato((s) => {
    const k = chiaveTroncate(modello, dimensione);
    s.troncate[k] = { volte: (s.troncate[k]?.volte ?? 0) + 1, quando: Date.now() };
  });
}

function azzeraTroncate(modello: string, dimensione: number): void {
  if (!statoFabbrica().troncate[chiaveTroncate(modello, dimensione)]) return;
  aggiornaStato((s) => {
    delete s.troncate[chiaveTroncate(modello, dimensione)];
  });
}

// ─────────────────────────── Scelta del modello ───────────────────────────

export function stimaToken(messaggi: Messaggio[]): number {
  return Math.ceil(messaggi.reduce((totale, m) => totale + m.content.length, 0) / 3.2);
}

type Candidato = { m: Modello; nome: string; f: Fornitore; chiave: string; oggi: number; ultimoRifiuto: number };

/** Può scrivere lezioni: Gemini Flash sì; gli altri solo dopo aver superato la prova di scrittura. */
function puoScrivere(m: Modello): boolean {
  return !m.scritturaDaApprovare || statoFabbrica().scrittoriApprovati.includes(nomeModello(m));
}

export function candidati(ruolo: Ruolo, opzioni: { tokenStimati: number; escludi: string[]; provati?: string[]; evita?: string[] }) {
  const s = statoFabbrica();
  const adesso = Date.now();
  const minima = QUALITA_MINIMA[ruolo];
  const disponibili: Candidato[] = [];
  const inAttesa: { qualita: number; tra: number }[] = [];
  let prossima = Infinity;
  let adeguati = 0;

  for (const m of MODELLI) {
    if (!m.ruoli.includes(ruolo)) continue;
    const nome = nomeModello(m);
    // Nella prova di scrittura scrive solo il modello in prova (vedi lezione/prova-scrittura.ts); fuori dalla prova,
    // solo i modelli capaci e già approvati. Chi giudica una lezione (il revisore) dev'essere già approvato: un modello
    // in prova non giudica mai il proprio lavoro.
    const inProva = process.env.HTD_SOLO_SCRITTORE;
    if (ruolo === "scrittore" && (inProva ? nome !== inProva : m.qualita < minima || !puoScrivere(m))) continue;
    if (ruolo === "revisore" && (!puoScrivere(m) || nome === inProva)) continue;
    const f = fornitore(m.fornitore);
    const chiave = chiaveFornitore(m.fornitore);
    if (!chiave) continue;
    // Un nome servito da un altro modello non dà richieste in più: si usa il modello vero, se c'è per lo stesso ruolo.
    const vero = s.stessoLimite[nome];
    if (vero && MODELLI.some((x) => x.fornitore === m.fornitore && x.modello === vero && x.ruoli.includes(ruolo))) continue;
    const maxToken = s.maxToken[nome] ?? m.maxToken;
    if (maxToken && opzioni.tokenStimati > maxToken) continue;
    if (m.qualita >= minima) adeguati++;
    if (opzioni.escludi.includes(nome)) continue;
    const provato = opzioni.provati?.includes(nome) ?? false;
    const fermo = s.fermi[nome]?.fino ?? 0;
    if (fermo > adesso) {
      prossima = Math.min(prossima, fermo);
      if (!provato) inAttesa.push({ qualita: m.qualita, tra: fermo - adesso });
      continue;
    }
    if (provato) continue;
    const oggi = richiesteOggi(m);
    const rpd = s.rpd[nome] ?? m.rpd;
    if (rpd && oggi >= rpd) {
      prossima = Math.min(prossima, finestraGiornaliera(f).fine.getTime());
      continue;
    }
    if (m.rpm) {
      const nomi = new Set(stessoSecchio(m));
      const ultimoMinuto = chiamateDiOggi(f).filter((c) => c.contata && nomi.has(c.modello) && c.quando > adesso - 60_000).length;
      if (ultimoMinuto >= m.rpm) {
        prossima = Math.min(prossima, adesso + 60_000);
        inAttesa.push({ qualita: m.qualita, tra: 60_000 });
        continue;
      }
    }
    disponibili.push({ m, nome, f, chiave, oggi, ultimoRifiuto: m.rpd && sovraccaricoDi(m.fornitore) ? ultimoRifiuto(m) : 0 });
  }
  const evitato = (c: Candidato) => Number(opzioni.evita?.includes(c.nome) ?? false);
  disponibili.sort(
    (a, b) =>
      Number(a.m.qualita < minima) - Number(b.m.qualita < minima) ||
      a.ultimoRifiuto - b.ultimoRifiuto ||
      evitato(a) - evitato(b) ||
      Number(a.f.addestra) - Number(b.f.addestra) ||
      b.m.qualita - a.m.qualita ||
      a.oggi - b.oggi,
  );
  return { disponibili, inAttesa, prossima, adeguati, minima };
}

/** Attesa massima per un modello molto migliore che si libera a breve, invece di ripiegare su uno scarso. */
const ATTESA_MASSIMA_MS = 90_000;

// ─────────────────────────── Le risposte pagate ───────────────────────────
//
// Ogni risposta valida viene scritta in risposte/<lezione>/ e spinta su GitHub prima di essere usata. Se il giro si
// interrompe subito dopo, al giro successivo la stessa richiesta trova la risposta già pagata e non la rifà.
// I file di una lezione vengono tolti quando la lezione è pubblicata.

type RispostaConservata = { modello: string; testo: string; ragionamento?: number; quando: string; ruolo: Ruolo };

function chiaveRisposta(r: RichiestaAI<unknown>): string {
  const base = JSON.stringify({ ruolo: r.ruolo, messaggi: r.messaggi, maxTokens: r.maxTokens ?? 4000, temperatura: r.temperatura ?? null, json: Boolean(r.schema), evita: r.evita ?? [], escludi: r.escludi ?? [] });
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 24);
}

const fileRisposta = (r: RichiestaAI<unknown>) => `risposte/${r.slug}/${chiaveRisposta(r)}.json`;

/** Toglie la risposta conservata per una richiesta: era nel formato giusto ma non è servita, la prossima volta si richiede. */
export function dimenticaRisposta(richiesta: RichiestaAI<unknown>): void {
  cancella(fileRisposta(richiesta));
}

// ─────────────────────────── Chiamata ───────────────────────────

function valida<T>(richiesta: RichiestaAI<T>, testo: string): { ok: true; dati: T } | { ok: false; errore: string } {
  if (!richiesta.schema) return { ok: true, dati: testo as T };
  try {
    const grezzo = estraiJson(testo);
    return validaJson(richiesta.schema, richiesta.ripara ? richiesta.ripara(grezzo) : grezzo);
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}

export async function chiamaAI<T = string>(richiesta: RichiestaAI<T>): Promise<RispostaAI<T>> {
  // Una risposta già pagata per questa stessa richiesta: si usa quella.
  const conservata = leggiJson<RispostaConservata | null>(fileRisposta(richiesta), null);
  if (conservata) {
    const esito = valida(richiesta, conservata.testo);
    if (esito.ok) return { testo: conservata.testo, dati: esito.dati, modello: conservata.modello, scartate: [], ragionamento: conservata.ragionamento, riusata: true };
  }
  controllaTempo();

  let maxTokens = richiesta.maxTokens ?? 4000;
  const tokenStimati = stimaToken(richiesta.messaggi) + maxTokens;
  const escludi = [...(richiesta.escludi ?? [])];
  const provati: string[] = [];
  const erroriVisti: string[] = [];
  let rispostePessime = 0;
  const scartate: RispostaScartata[] = [];
  let guastiFornitore = 0;
  const rifiutiPerSovraccarico = new Map<string, number>();
  const rifiuti: { modello: string; errore: string; contata: boolean }[] = [];
  const fermi: string[] = [];
  const giriSegnati = new Set<string>();
  const hannoRisposto = new Set<string>();
  const segnaGiriAndatiMale = (): boolean => {
    let segnati = false;
    for (const providerId of rifiutiPerSovraccarico.keys()) {
      if (giriSegnati.has(providerId) || hannoRisposto.has(providerId)) continue;
      giriSegnati.add(providerId);
      const fermo = segnaSovraccarico(providerId, "Fornitore sovraccarico: i suoi modelli rifiutano le richieste (HTTP 503)");
      erroriVisti.push(fermo);
      fermi.push(fermo);
      segnati = true;
    }
    return segnati;
  };

  let attesePrese = 0;
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const { disponibili, inAttesa, prossima, adeguati, minima } = candidati(richiesta.ruolo, { tokenStimati, escludi, provati, evita: richiesta.evita });
    const scelto = disponibili[0] && disponibili[0].m.qualita < minima && adeguati > 0 ? undefined : disponibili[0];
    const daAspettare = inAttesa.filter((a) => a.tra <= ATTESA_MASSIMA_MS && (!scelto || a.qualita - scelto.m.qualita >= 2)).sort((a, b) => a.tra - b.tra)[0];
    if (daAspettare && attesePrese < 3) {
      attesePrese++;
      tentativo--;
      await new Promise((ok) => setTimeout(ok, daAspettare.tra + 500));
      continue;
    }
    if (!scelto) {
      if (segnaGiriAndatiMale()) {
        tentativo--;
        continue;
      }
      if (!Number.isFinite(prossima) && rispostePessime > 0 && guastiFornitore === 0) {
        throw new RispostaAINonValida(`I modelli non hanno prodotto una risposta valida: ${erroriVisti.join(" | ")}`, scartate);
      }
      const attesa = Number.isFinite(prossima) ? Math.max(30, Math.ceil((prossima - Date.now()) / 1000)) : 1800;
      const messaggio =
        attesa > 3600
          ? `Le richieste gratuite di oggi per il ruolo "${richiesta.ruolo}" sono finite: si riparte alle ${new Date(prossima).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}`
          : Number.isFinite(prossima)
            ? `Nessun modello disponibile per il ruolo "${richiesta.ruolo}"${erroriVisti.length ? ` (ultimi errori: ${erroriVisti.join(" | ")})` : ""}`
            : `Nessun modello configurato per il ruolo "${richiesta.ruolo}": manca la chiave del fornitore nei segreti del repository`;
      throw new AINonDisponibile(nascondiSegreti(messaggio), attesa, scartate, rifiuti, fermi);
    }

    const messaggi = [...richiesta.messaggi];
    let allungata = false;
    const dimensione = richiesta.maxTokens ?? 4000;
    const massimoDiNorma = sforzoPerDimensione(dimensione) === "high";
    let sforzo: "medium" | "low" | undefined = massimoDiNorma && ragionamentoMassimoNonRegge(scelto.nome, dimensione) ? "medium" : undefined;
    let riprove429 = 0;
    for (let correzione = 0; correzione < 2; correzione++) {
      controllaTempo();
      const inizio = Date.now();
      try {
        const risposta = await chat({ fornitore: scelto.f, chiave: scelto.chiave, modello: scelto.m.modello, messaggi, maxTokens, temperatura: richiesta.temperatura, json: Boolean(richiesta.schema), sforzo });
        registraChiamata(scelto.f, {
          quando: inizio,
          modello: scelto.m.modello,
          ruolo: richiesta.ruolo,
          slug: richiesta.slug,
          ok: true,
          contata: true,
          durataMs: Date.now() - inizio,
          tokenInput: risposta.tokenInput,
          tokenOutput: risposta.tokenOutput,
          ragionamento: risposta.tokenRagionamento,
        });
        if (scelto.m.rpd) {
          fineSovraccarico(scelto.m.fornitore);
          hannoRisposto.add(scelto.m.fornitore);
        }
        if (!risposta.troncata && massimoDiNorma && sforzo === undefined) azzeraTroncate(scelto.nome, dimensione);
        if (risposta.troncata) {
          const attuale: "low" | "medium" | "high" = sforzo ?? sforzoPerDimensione(maxTokens);
          const prossimo: "medium" | "low" | null = attuale === "high" ? "medium" : attuale === "medium" ? "low" : null;
          const comeTroncata = `risposta troncata: ${risposta.tokenOutput ?? "?"} token di risposta su ${maxTokens} chiesti${risposta.tokenRagionamento ? `, dopo ${risposta.tokenRagionamento} token spesi a ragionare` : ""}${prossimo ? ` (si riprova chiedendo meno ragionamento: ${prossimo})` : ""}`;
          erroriVisti.push(`${scelto.nome}: ${comeTroncata}`);
          scartate.push({ modello: scelto.nome, errore: comeTroncata, testo: risposta.testo.slice(0, 60000) });
          rispostePessime++;
          if (massimoDiNorma && sforzo === undefined) segnaTroncata(scelto.nome, dimensione);
          if (!prossimo) break;
          if (!allungata) maxTokens = Math.min(Math.round(maxTokens * 1.3), 20000);
          allungata = true;
          sforzo = prossimo;
          correzione--;
          continue;
        }
        const esito = valida(richiesta, risposta.testo);
        if (esito.ok) {
          scriviJson(fileRisposta(richiesta), { modello: scelto.nome, testo: risposta.testo, ragionamento: risposta.tokenRagionamento, quando: new Date().toISOString(), ruolo: richiesta.ruolo } satisfies RispostaConservata);
          await salva(`${richiesta.slug}: risposta di ${scelto.nome} (${richiesta.ruolo})`, { subito: true });
          return { testo: risposta.testo, dati: esito.dati, modello: scelto.nome, scartate, ragionamento: risposta.tokenRagionamento, riusata: false };
        }
        erroriVisti.push(`${scelto.nome}: JSON non valido (${esito.errore.replace(/\s+/g, " ").slice(0, 140)})`);
        scartate.push({ modello: scelto.nome, errore: esito.errore, testo: risposta.testo.slice(0, 60000) });
        rispostePessime++;
        messaggi.push(
          { role: "assistant", content: risposta.testo.slice(0, 12000) },
          { role: "user", content: `La tua risposta non rispetta il formato richiesto:\n${esito.errore}\n\nRispondi di nuovo con SOLO il JSON completo e corretto, senza testo prima o dopo.` },
        );
      } catch (e) {
        if (!(e instanceof ErroreAI)) throw e;
        const errore = e;
        registraChiamata(scelto.f, { quando: inizio, modello: scelto.m.modello, ruolo: richiesta.ruolo, slug: richiesta.slug, ok: false, contata: !errore.nonServita, durataMs: Date.now() - inizio, errore: errore.message });
        const attesaMs = (errore.riprovaTraSec ?? 0) * 1000;
        if (errore.stato === 429 && attesaMs > 0 && attesaMs <= (richiesta.aspettaMigliore ?? 0) && riprove429 < 2) {
          riprove429++;
          correzione--;
          await new Promise((ok) => setTimeout(ok, attesaMs + 1500));
          continue;
        }
        erroriVisti.push(`${scelto.nome}: ${errore.message.slice(0, 120)}`);
        rifiuti.push({ modello: scelto.nome, errore: nascondiSegreti(errore.message.replace(/\s+/g, " ").slice(0, 220)), contata: !errore.nonServita });
        guastiFornitore++;
        if (errore.limiteGiornaliero) aggiornaStato((s) => void (s.rpd[scelto.nome] = errore.limiteGiornaliero!));
        if (errore.modelloDelLimite && errore.modelloDelLimite !== scelto.m.modello) {
          aggiornaStato((s) => void (s.stessoLimite[scelto.nome] = errore.modelloDelLimite!));
          const vero = MODELLI.find((x) => x.fornitore === scelto.m.fornitore && x.modello === errore.modelloDelLimite);
          if (vero) fermaModello(nomeModello(vero), fermoDopoRifiuto(scelto.f, errore), errore.message);
        }
        if (errore.troppoGrande) {
          if (correzione === 0) aggiornaStato((s) => void (s.maxToken[scelto.nome] = Math.max(2000, tokenStimati - 1)));
        } else if (errore.stato === 401 || errore.stato === 403) {
          fermaModello(scelto.nome, 3600, `Chiave non valida o senza permessi: ${errore.message}`);
        } else if (errore.stato === 404) {
          fermaModello(scelto.nome, 24 * 3600, "Modello non trovato presso il fornitore");
        } else if (errore.sovraccarico && !scelto.m.rpd) {
          fermaModello(scelto.nome, Math.max(errore.riprovaTraSec ?? 0, 300), errore.message);
        } else if (errore.sovraccarico) {
          const n = (rifiutiPerSovraccarico.get(scelto.m.fornitore) ?? 0) + 1;
          rifiutiPerSovraccarico.set(scelto.m.fornitore, n);
          if (n === 1 && !sovraccaricoDi(scelto.m.fornitore)) {
            fermaModello(scelto.nome, Math.max(errore.riprovaTraSec ?? 0, 300), errore.message);
          } else {
            giriSegnati.add(scelto.m.fornitore);
            const fermo = segnaSovraccarico(scelto.m.fornitore, errore.message);
            erroriVisti.push(fermo);
            fermi.push(fermo);
          }
        } else {
          fermaModello(scelto.nome, fermoDopoRifiuto(scelto.f, errore), errore.message);
        }
        break;
      }
    }
    provati.push(scelto.nome);
  }
  segnaGiriAndatiMale();
  if (rispostePessime > 0 && guastiFornitore === 0) throw new RispostaAINonValida(`I modelli non hanno prodotto una risposta valida: ${erroriVisti.join(" | ")}`, scartate);
  throw new AINonDisponibile(nascondiSegreti(`Tutti i tentativi sono falliti: ${erroriVisti.join(" | ")}`), guastiFornitore > 0 && rispostePessime > 0 ? 600 : 300, scartate, rifiuti, fermi);
}

/** Il primo momento in cui almeno un modello del ruolo potrà rispondere (ms), oppure null se ce n'è uno libero adesso. */
export function prossimaDisponibilita(ruolo: Ruolo): number | null {
  const { disponibili, prossima } = candidati(ruolo, { tokenStimati: 0, escludi: [] });
  if (disponibili.some((c) => c.m.qualita >= QUALITA_MINIMA[ruolo])) return null;
  return Number.isFinite(prossima) ? prossima : null;
}
