import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { problemiDelPacco } from "@htd/condiviso/controllo-pacco.ts";
import { togliCartella } from "@htd/condiviso/godot/esegui.ts";
import { leggiProjectGodot } from "@htd/condiviso/godot/progetto.ts";
import { nuovaCartellaTemporanea, scriviFileProgetto } from "@htd/condiviso/godot/verifica.ts";
import { accorciaCopione, comeSiAvvia, controllaFotogrammi, inizioDelVideo, tagliaInizio, misuraCopione, nodiCheNonSiVedono, problemiDelCopione, registraVideo, valutaCopione } from "@htd/condiviso/godot/video.ts";
import { PaccoLezioneSchema, sha256, type Media, type PaccoLezione, type VideoEsercizio } from "@htd/condiviso/pacchetto.ts";
import { controllaFileLezione, descriviViolazioni } from "@htd/condiviso/sicurezza.ts";
import { CopioneSchema, type Copione, type Esercizio, type Lezione, type StatoProgetto } from "@htd/condiviso/schemi.ts";
import { messaggi } from "../ai/prompt.ts";
import { AINonDisponibile, candidati, chiamaAI, dimenticaRisposta, RispostaAINonValida, stimaToken, type RichiestaAI } from "../ai/router.ts";
import { leggiJson, salva, scriviFile, scriviJson } from "../archivio.ts";
import { catalogo, paccoPubblicato } from "../corso.ts";
import { versioneConGliStessiEsercizi } from "../robustezza.ts";
import { controllaTempo, GiroFinito } from "../tempo.ts";
import { costoLezione, registra, type Pezzo } from "../traccia.ts";
import { baseDi, progettoPerPrompt, statoDopo } from "./pratica.ts";
import { aggiornaCatalogo, salvaMedia } from "./pubblica.ts";

// I video «Il risultato atteso» degli esercizi guidati e «Rifai uguale» (imita): cosa deve vedere chi studia quando avvia
// il gioco dopo aver fatto l'esercizio. Un modello con molte richieste al giorno (il ruolo «ritocco», Flash-Lite) scrive
// il copione; Godot registra la soluzione seguendolo e misura i soggetti; il video si pubblica solo se le misure
// confermano il copione, se nei fotogrammi i soggetti si vedono davvero e se lo stesso copione NON passa sul progetto
// com'era prima dell'esercizio (vedi condiviso/src/godot/video.ts). Altrimenti i dati misurati tornano al modello, fino a
// tre tentativi; poi l'esercizio resta senza video e la traccia dice perché.
//
// Si fa a ogni giro, prima di scrivere lezioni nuove, per le lezioni pubblicate che non hanno ancora il video (anche
// quella appena uscita: la pubblicazione non aspetta mai un video). Una lezione con video nuovi esce in una versione nuova
// in cui cambiano solo i video; i progressi nell'aula restano, perché sono legati alla lezione e non alla versione.

const FILE = "stato/video.json";
const TENTATIVI = 3;
/**
 * La versione delle regole dei copioni. Gli esercizi rimasti senza video («niente», «rinuncia») con regole più vecchie si
 * riprovano; quelli con il risultato fuori dallo schermo no (le regole non lo cambiano). 2: dalla sera del 19 ottobre,
 * scene da avviare con F6 anche se la consegna non le nomina, effetti di mezzo secondo, «cambiare dimensione», una
 * scritta alla volta.
 */
const REGOLE = 2;
/** I tipi di esercizio con il video: il guidato (il primo su un argomento nuovo) e «Rifai uguale», dove è il riferimento. */
const GENERI_CON_VIDEO = new Set(["guidato", "imita"]);

/**
 * Per ogni lezione e esercizio: l'impronta della soluzione su cui si è lavorato, i tentativi fatti e com'è finita.
 * "niente": il modello dice che il risultato non si vede sullo schermo; "invisibile": i nodi dell'esercizio ci sono ma
 * fuori dallo schermo (o nascosti); "rinuncia": tentativi finiti per altri motivi. Con l'impronta cambiata si riprova.
 */
type StatoVideo = { impronta: string; tentativi: number; esito: "in corso" | "fatto" | "niente" | "invisibile" | "rinuncia"; motivo?: string; ultimo?: { copione: unknown; problemi: string[] }; regole?: number };
type Registro = Record<string, Record<string, StatoVideo>>;

const RispostaCopioneSchema = z
  .object({ video: z.boolean().default(true), perche: z.string().default("") })
  .passthrough()
  .transform((r, ctx) => {
    if (!r.video) return { video: false as const, perche: r.perche };
    const copione = CopioneSchema.safeParse(r);
    if (!copione.success) {
      for (const problema of copione.error.issues) ctx.addIssue({ ...problema, code: "custom", message: problema.message });
      return z.NEVER;
    }
    return { video: true as const, copione: copione.data };
  });

type DaFilmare = { e: Esercizio; base: StatoProgetto; impronta: string };

/** L'impronta di ciò da cui dipende il video: la soluzione (file e impostazioni) e il progetto com'era prima. */
function improntaVideo(e: Esercizio, base: StatoProgetto): string {
  const ordinati = (file: { percorso: string; contenuto: string }[]) => [...file].sort((a, b) => a.percorso.localeCompare(b.percorso)).map((f) => [f.percorso, f.contenuto]);
  return sha256(JSON.stringify({ soluzione: ordinati(e.soluzione.file), progetto: e.soluzione.progetto ?? null, base: ordinati(base.file) }));
}

/** Gli esercizi di una lezione che hanno un video, con il progetto com'era prima di ciascuno e l'impronta. */
export function eserciziDaFilmare(contenuto: Pick<Lezione, "esercizi" | "test" | "statoIniziale">): DaFilmare[] {
  const risultato: DaFilmare[] = [];
  let gioco = contenuto.statoIniziale;
  for (const e of [...contenuto.esercizi, contenuto.test]) {
    const base = baseDi(e, gioco);
    if (e.id && e.modalita === "progetto" && GENERI_CON_VIDEO.has(e.genere ?? "") && e.soluzione.file.some((f) => f.percorso.endsWith(".tscn"))) risultato.push({ e, base, impronta: improntaVideo(e, base) });
    if (gioco) gioco = statoDopo(gioco, e);
  }
  return risultato;
}

/**
 * I video di una lezione pubblicata che valgono ancora per un contenuto nuovo (dopo una segnalazione, un ricontrollo):
 * quelli il cui esercizio ha la stessa soluzione e lo stesso progetto di partenza. Gli altri si rifanno.
 */
export function videoAncoraValidi(precedente: PaccoLezione | null, contenuto: Pick<Lezione, "esercizi" | "test" | "statoIniziale">): { video: Record<string, VideoEsercizio>; media: Record<string, Media> } {
  const video: Record<string, VideoEsercizio> = {};
  const media: Record<string, Media> = {};
  if (!precedente) return { video, media };
  for (const { e, impronta } of eserciziDaFilmare(contenuto)) {
    const v = precedente.video[e.id!];
    const m = precedente.media[`video:${e.id}`];
    if (v && m && v.impronta === impronta) {
      video[e.id!] = v;
      media[`video:${e.id}`] = m;
    }
  }
  return { video, media };
}

// ─────────────────────────── La richiesta del copione ───────────────────────────

function azioniDelProgetto(e: Esercizio): string[] {
  const dalProgetto = (e.soluzione.progetto?.azioni ?? []).map((a) => a.nome);
  const file = e.soluzione.file.find((f) => f.percorso === "project.godot");
  const dalFile = file ? Object.keys(leggiProjectGodot(file.contenuto).input ?? {}) : [];
  return [...new Set([...dalProgetto, ...dalFile])];
}

function schermoDelProgetto(e: Esercizio): string {
  const file = e.soluzione.file.find((f) => f.percorso === "project.godot");
  const finestra = file ? (leggiProjectGodot(file.contenuto).display ?? {}) : {};
  const w = Number(finestra["window/size/viewport_width"]) || 1152;
  const h = Number(finestra["window/size/viewport_height"]) || 648;
  return `${w}×${h}`;
}

const scenaPrincipaleDi = (e: Esercizio) => e.soluzione.progetto?.scenaPrincipale || undefined;

function richiestaCopione(slug: string, e: Esercizio, precedente?: { copione: unknown; problemi: string[] }): RichiestaAI<z.infer<typeof RispostaCopioneSchema>> {
  const azioni = azioniDelProgetto(e);
  const tasti = new Map((e.soluzione.progetto?.azioni ?? []).map((a) => [a.nome, a.tasti]));
  const correzione = precedente
    ? `\n## Il copione di prima è stato scartato\n${JSON.stringify(precedente.copione)}\n\nPerché (misurato da Godot):\n${precedente.problemi.map((p) => `- ${p.slice(0, 900)}`).join("\n")}\n\nScrivi un copione nuovo che tenga conto di queste misure. Se i nodi che l'esercizio crea stanno davvero fuori dallo schermo, il video non si può fare: rispondi {"video": false, "perche": "…"}.\n`
    : "";
  return {
    ruolo: "ritocco",
    slug,
    messaggi: messaggi("video-copione", {
      titolo: e.titolo,
      genere: e.genere ?? "",
      consegna: e.consegna,
      passi: e.passiGuida.length ? `Passi:\n${e.passiGuida.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "",
      schermo: schermoDelProgetto(e),
      scena_principale: scenaPrincipaleDi(e) ?? "nessuna",
      azioni: azioni.length ? azioni.map((a) => `${a} (${(tasti.get(a) ?? []).join(", ") || "tasti nel progetto"})`).join("; ") : "nessuna",
      cambiati: e.soluzione.cambiati.join(", ") || "nessuno",
      progetto: progettoPerPrompt({ nome: e.titolo, cartella: e.cartella ?? "progetto", file: e.soluzione.file, progetto: e.soluzione.progetto ?? { nome: e.titolo, scenaPrincipale: "", azioni: [], autoload: [], impostazioni: [] } }, 16000),
      correzione,
    }),
    schema: RispostaCopioneSchema,
    maxTokens: 2500,
  };
}

// ─────────────────────────── Un tentativo ───────────────────────────

type EsitoTentativo =
  | { attesa: true }
  | { niente: string }
  | { problemi: string[]; copione?: Copione; invisibili: string[] }
  | { fatto: VideoEsercizio; media: Media };

const nomePezzo = (e: Esercizio) => (e.id === "test" ? "Test" : `Esercizio ${e.id?.replace("es", "")}`);

/**
 * Registra il copione sulla soluzione e lo prova sul progetto di prima: i problemi trovati (vuoto = il video va bene) e,
 * se va bene, il file da pubblicare (senza l'inizio in cui non si spiega niente: vedi inizioDelVideo).
 */
async function provaCopione(e: Esercizio, base: StatoProgetto, copione: Copione, mp4: string): Promise<{ problemi: string[]; invisibili: string[]; file?: string }> {
  const statici = problemiDelCopione(copione, { file: e.soluzione.file, azioni: azioniDelProgetto(e) });
  if (statici.length) return { problemi: statici, invisibili: [] };
  const cartella = nuovaCartellaTemporanea("video");
  const prima = nuovaCartellaTemporanea("video-prima");
  try {
    scriviFileProgetto(cartella, e.soluzione.file, e.titolo);
    const resoconto = await registraVideo({ cartellaProgetto: cartella, copione, fileMp4: mp4 });
    const giudizio = valutaCopione(copione, resoconto);
    if (giudizio.problemi.length) return { problemi: giudizio.problemi, invisibili: nodiCheNonSiVedono(copione, resoconto) };
    const fotogrammi = await controllaFotogrammi(mp4, copione, resoconto);
    if (fotogrammi.length) return { problemi: fotogrammi, invisibili: [] };
    // Il progetto com'era prima dell'esercizio: se il copione passa anche lì, il video non mostra il risultato.
    if (base.file.length) {
      scriviFileProgetto(prima, base.file, base.nome);
      const resocontoPrima = await misuraCopione({ cartellaProgetto: prima, copione });
      if (valutaCopione(copione, resocontoPrima).problemi.length === 0) {
        return { problemi: ["Il copione passa anche sul progetto com'era PRIMA dell'esercizio: i soggetti c'erano già e facevano già così, quindi il video non mostrerebbe il risultato dell'esercizio. Scegli come soggetti ciò che l'esercizio aggiunge o cambia, nel momento in cui si vede la differenza."], invisibili: [] };
      }
    }
    const inizio = inizioDelVideo(copione);
    if (inizio === 0) return { problemi: [], invisibili: [], file: mp4 };
    const tagliato = mp4.replace(/.mp4$/, "-tagliato.mp4");
    await tagliaInizio(mp4, tagliato, inizio);
    return { problemi: [], invisibili: [], file: tagliato };
  } finally {
    togliCartella(cartella);
    togliCartella(prima);
  }
}

async function unTentativo(slug: string, e: Esercizio, base: StatoProgetto, impronta: string, tentativo: number, precedente?: { copione: unknown; problemi: string[] }): Promise<EsitoTentativo> {
  const richiesta = richiestaCopione(slug, e, precedente);
  // Nessun modello libero per il copione: non si bussa, si riprova al giro dopo.
  if (candidati("ritocco", { tokenStimati: stimaToken(richiesta.messaggi) + (richiesta.maxTokens ?? 4000), escludi: [] }).disponibili.length === 0) return { attesa: true };
  const dalle = Date.now();
  const titolo = `${nomePezzo(e)}: video del risultato atteso, tentativo ${tentativo + 1} di ${TENTATIVI}`;
  let risposta;
  try {
    risposta = await chiamaAI(richiesta);
  } catch (errore) {
    if (errore instanceof AINonDisponibile) {
      registra({ slug, pezzo: e.id as Pezzo, azione: "video", esito: "attesa", guasto: "fornitore", dalle, titolo, spiegazione: `${errore.message.slice(0, 400)}\nReazione: si riprova al prossimo giro.` });
      return { attesa: true };
    }
    if (errore instanceof RispostaAINonValida) {
      registra({ slug, pezzo: e.id as Pezzo, azione: "video", esito: "fallito", guasto: "formato", dalle, titolo, spiegazione: `Copione non nel formato chiesto: ${errore.message.slice(0, 500)}` });
      return { problemi: [`La risposta non era nel formato chiesto: ${errore.message.slice(0, 400)}`], invisibili: [] };
    }
    throw errore;
  }
  // Usata la risposta, non serve più conservarla: se il copione non va, il tentativo dopo deve chiederne uno nuovo.
  dimenticaRisposta(richiesta);
  const dati = risposta.dati;
  if (!dati.video) {
    registra({ slug, pezzo: e.id as Pezzo, azione: "video", esito: "saltato", modello: risposta.modello, dalle, titolo: `${nomePezzo(e)}: nessun video del risultato atteso`, spiegazione: `${risposta.modello} dice che il risultato di «${e.titolo}» non si vede sullo schermo: ${dati.perche.slice(0, 600) || "(nessun motivo)"}` });
    return { niente: dati.perche };
  }
  const copione = accorciaCopione(dati.copione);
  const uscita = nuovaCartellaTemporanea("video-mp4");
  const mp4 = path.join(uscita, "risultato.mp4");
  try {
    let esito: { problemi: string[]; invisibili: string[]; file?: string };
    try {
      esito = await provaCopione(e, base, copione, mp4);
    } catch (errore) {
      if (errore instanceof GiroFinito) throw errore;
      // Un guasto della piattaforma (ffmpeg, Godot) non deve fermare il resto: resta nel registro e conta come tentativo.
      console.error(`Video di ${slug} ${e.id}: ${(errore as Error).stack ?? errore}`);
      registra({ slug, pezzo: e.id as Pezzo, azione: "video", esito: "fallito", guasto: "piattaforma", modello: risposta.modello, dalle, titolo, spiegazione: `Errore del programma durante la registrazione: ${(errore as Error).message.slice(0, 600)}`, dati: { copione, errore: (errore as Error).stack } });
      return { problemi: [`Errore della piattaforma durante la registrazione: ${(errore as Error).message.slice(0, 300)}`], copione, invisibili: [] };
    }
    if (esito.problemi.length) {
      registra({
        slug,
        pezzo: e.id as Pezzo,
        azione: "video",
        esito: "fallito",
        guasto: "contenuto",
        modello: risposta.modello,
        dalle,
        titolo,
        spiegazione: `Il copione di ${risposta.modello} non supera i controlli:\n${esito.problemi.map((p) => `- ${p.slice(0, 900)}`).join("\n")}\nReazione: ${tentativo + 1 < TENTATIVI ? "le misure tornano al modello per un copione nuovo." : "tentativi finiti, l'esercizio resta senza video."}`,
        dati: { copione, problemi: esito.problemi },
      });
      return { problemi: esito.problemi, copione, invisibili: esito.invisibili };
    }
    const inizio = inizioDelVideo(copione);
    const media = salvaMedia(fs.readFileSync(esito.file ?? mp4), "mp4");
    registra({
      slug,
      pezzo: e.id as Pezzo,
      azione: "video",
      esito: "ok",
      modello: risposta.modello,
      dalle,
      titolo: `${nomePezzo(e)}: video del risultato atteso registrato`,
      spiegazione: `Copione di ${risposta.modello}: ${comeSiAvvia(copione, scenaPrincipaleDi(e))}, ${copione.durata} s. Soggetti: ${copione.soggetti.map((s) => `«${s.etichetta}» (${s.deve})`).join(", ")}. Scritte: ${copione.scritte.map((w) => `«${w.testo}»`).join(" · ")}. I soggetti si vedono come dice il copione, nei fotogrammi c'è ciò che Godot misura, e sul progetto di prima il copione non passa.${inizio ? ` Il video pubblicato comincia a ${inizio} s: prima non si spiega niente.` : ""} Video ${Math.round(media.byte / 1024)} KB.`,
      dati: { copione, media },
    });
    return { fatto: { copione, impronta, inizio }, media };
  } finally {
    togliCartella(uscita);
  }
}

// ─────────────────────────── Le lezioni pubblicate ───────────────────────────

/** Scrive la versione nuova di una lezione in cui cambiano solo i video. */
async function pubblicaVideo(pacco: PaccoLezione, nuovi: Record<string, { video: VideoEsercizio; media: Media }>): Promise<PaccoLezione | null> {
  // Restano i video ancora validi (stessa soluzione), più quelli nuovi.
  const validi = videoAncoraValidi(pacco, pacco.contenuto);
  const media = Object.fromEntries(Object.entries(pacco.media).filter(([k]) => !/^video:(es\d+|test)$/.test(k)));
  const video: Record<string, VideoEsercizio> = { ...validi.video };
  Object.assign(media, validi.media);
  for (const [id, n] of Object.entries(nuovi)) {
    video[id] = n.video;
    media[`video:${id}`] = n.media;
  }
  const nuovo = PaccoLezioneSchema.parse({ ...pacco, versione: pacco.versione + 1, media, video, origine: { ...pacco.origine, richieste: costoLezione(pacco.slug) } });
  const sicurezza = problemiDelPacco(nuovo);
  if (sicurezza.length) {
    registra({ slug: pacco.slug, pezzo: "lezione", azione: "video", esito: "fallito", guasto: "contenuto", titolo: "Video non pubblicati: controllo di sicurezza", spiegazione: `${sicurezza.slice(0, 5).join(" | ")}\nReazione: la lezione resta com'era.` });
    return null;
  }
  const voce = catalogo().lezioni.find((l) => l.slug === pacco.slug)!;
  const testo = JSON.stringify(nuovo);
  scriviFile(voce.file, testo);
  aggiornaCatalogo({ ...voce, versione: nuovo.versione, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  // Gli esercizi non cambiano: se la versione di prima era già ricontrollata, non serve ricontrollare questa.
  versioneConGliStessiEsercizi(pacco.slug, pacco.versione, nuovo.versione);
  registra({ slug: pacco.slug, pezzo: "lezione", azione: "video", esito: "ok", titolo: "Video del risultato atteso aggiunti alla lezione", spiegazione: `Video nuovi per ${Object.keys(nuovi).join(", ")}; teoria ed esercizi non cambiano. Versione ${nuovo.versione}. Costo totale della lezione: ${nuovo.origine.richieste} richieste.` });
  return nuovo;
}

/**
 * Fa i video che mancano agli esercizi guidati e «Rifai uguale» delle lezioni pubblicate. Si ferma (e riprende al giro
 * dopo) quando il modello del copione non è libero. Restituisce quante lezioni sono uscite in una versione nuova.
 */
export async function completaVideo(): Promise<number> {
  const registro = leggiJson<Registro>(FILE, {});
  let pubblicate = 0;
  for (const voce of catalogo().lezioni) {
    const pacco = paccoPubblicato(voce.slug);
    if (!pacco) continue;
    const nuovi: Record<string, { video: VideoEsercizio; media: Media }> = {};
    let fermati = false;
    let interrotto: GiroFinito | null = null;
    try {
      for (const { e, base, impronta } of eserciziDaFilmare(pacco.contenuto)) {
        const id = e.id!;
        // Un video che vale ancora: stessa soluzione, un copione che rispetta le regole di oggi (con due scritte nello
        // stesso momento se ne vedeva una sola) e l'inizio vuoto tagliato (il primo video della 2.5 aveva 10 secondi di
        // attesa). Altrimenti si rifà.
        const esistente = pacco.video[id];
        if (esistente?.impronta === impronta && pacco.media[`video:${id}`] && problemiDelCopione(esistente.copione, { file: e.soluzione.file, azioni: azioniDelProgetto(e) }).length === 0 && esistente.inizio === inizioDelVideo(esistente.copione)) continue;
        const prima = registro[voce.slug]?.[id];
        // Deciso per questa soluzione: risultato fuori dallo schermo, oppure niente da mostrare o tentativi esauriti con le
        // regole di oggi. Non si richiede. "fatto" senza un video valido nella lezione si rifà.
        const deciso = prima?.impronta === impronta && (prima.esito === "invisibile" || ((prima.esito === "niente" || prima.esito === "rinuncia") && prima.regole === REGOLE));
        if (deciso) continue;
        const stato: StatoVideo = prima?.impronta === impronta && prima.esito === "in corso" ? { ...prima, regole: REGOLE } : { impronta, tentativi: 0, esito: "in corso", regole: REGOLE };
        // Prima di eseguire il codice della lezione, lo stesso controllo di sicurezza di ogni esecuzione.
        const rifiuti = [...descriviViolazioni(controllaFileLezione(e.soluzione.file)), ...descriviViolazioni(controllaFileLezione(base.file))];
        if (rifiuti.length && stato.esito === "in corso") {
          stato.esito = "rinuncia";
          stato.motivo = `codice rifiutato dal controllo di sicurezza: ${rifiuti.slice(0, 3).join(" | ")}`.slice(0, 500);
          registra({ slug: voce.slug, pezzo: id as Pezzo, azione: "video", esito: "fallito", guasto: "contenuto", titolo: `${nomePezzo(e)}: video non fatto`, spiegazione: `Il codice dell'esercizio non supera il controllo di sicurezza, quindi non si esegue: ${rifiuti.slice(0, 5).join(" | ")}` });
        }
        // Il copione scartato l'ultima volta (anche in un giro prima) torna al modello con le sue misure.
        let precedente = stato.ultimo;
        let invisibili: string[] = [];
        while (stato.tentativi < TENTATIVI && stato.esito === "in corso") {
          controllaTempo();
          const esito = await unTentativo(voce.slug, e, base, impronta, stato.tentativi, precedente);
          if ("attesa" in esito) {
            fermati = true;
            break;
          }
          stato.tentativi++;
          if ("niente" in esito) {
            stato.esito = "niente";
            stato.motivo = esito.niente.slice(0, 500);
          } else if ("fatto" in esito) {
            stato.esito = "fatto";
            delete stato.motivo;
            delete stato.ultimo;
            nuovi[id] = { video: esito.fatto, media: esito.media };
          } else {
            precedente = { copione: esito.copione ?? null, problemi: esito.problemi.map((p) => p.slice(0, 900)) };
            stato.ultimo = precedente;
            invisibili = esito.invisibili;
            stato.motivo = esito.problemi[0]?.slice(0, 500);
          }
        }
        if (stato.esito === "in corso" && stato.tentativi >= TENTATIVI) {
          stato.esito = invisibili.length ? "invisibile" : "rinuncia";
          // Il risultato dell'esercizio non si vede nello schermo: lo si dice chiaro nella traccia, perché è un difetto
          // dell'esercizio (chi lo fa giusto non vede niente), non del video.
          if (invisibili.length) registra({ slug: voce.slug, pezzo: id as Pezzo, azione: "video", esito: "saltato", guasto: "contenuto", titolo: `${nomePezzo(e)}: il risultato dell'esercizio non si vede nello schermo`, spiegazione: `«${e.titolo}»: i nodi che l'esercizio crea ci sono, ma chi avvia il gioco non li vede:\n${invisibili.map((x) => `- ${x.slice(0, 900)}`).join("\n")}\nL'esercizio resta senza video. Va corretto l'esercizio (posizioni, genitore dei nodi), non il video.` });
        }
        (registro[voce.slug] ??= {})[id] = stato;
        scriviJson(FILE, registro);
        if (fermati) break;
      }
    } catch (errore) {
      // Il tempo del giro è finito a metà lezione: i video già fatti si pubblicano lo stesso, poi il giro si chiude.
      if (!(errore instanceof GiroFinito)) throw errore;
      interrotto = errore;
    }
    if (Object.keys(nuovi).length) {
      const nuovo = await pubblicaVideo(pacco, nuovi);
      if (nuovo) pubblicate++;
      await salva(`${voce.numero} ${voce.slug}: video del risultato atteso${nuovo ? ` (versione ${nuovo.versione})` : " non pubblicati"}`, { subito: true });
    }
    if (interrotto) throw interrotto;
    if (fermati) return pubblicate;
  }
  return pubblicate;
}
