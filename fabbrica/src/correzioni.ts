import { problemiDelPacco } from "@htd/condiviso/controllo-pacco.ts";
import { PaccoLezioneSchema, sha256, type PaccoLezione, type VoceCatalogo } from "@htd/condiviso/pacchetto.ts";
import { lezioneDelCorso } from "@htd/condiviso/piano.ts";
import type { Esercizio, FileProgetto, Lezione, StatoProgetto } from "@htd/condiviso/schemi.ts";
import { leggiJson, salva, scriviFile, scriviJson } from "./archivio.ts";
import { catalogo, paccoPubblicato, paroleDelleLezioniPrima, testiDellaTeoria } from "./corso.ts";
import { STELLE_DEL_CESTO } from "./correzioni/stelle-del-cesto.ts";
import { CorrezioneImpossibile, type CorrezioneGioco } from "./correzioni/strumenti.ts";
import { paroleDi } from "./lezione/esercizio.ts";
import { baseDi, controllaPezzo, statoDopo } from "./lezione/pratica.ts";
import { aggiornaCatalogo } from "./lezione/pubblica.ts";
import { videoAncoraValidi } from "./lezione/video.ts";
import { versioneConGliStessiEsercizi } from "./robustezza.ts";
import { controllaTempo } from "./tempo.ts";
import { costoLezione, registra } from "./traccia.ts";

// Correzioni del gioco: quando la soluzione di un esercizio pubblicato è sbagliata e le lezioni dopo, che partono dal
// suo risultato, ne hanno ereditato il difetto. Il 19 ottobre i video «Il risultato atteso» misurarono che le stelle
// create nella 1.9 erano figlie del cesto, che sta in basso: disegnate sotto lo schermo, e così tutto ciò che il cesto
// creava fino alla 3.5. La robustezza corregge verifiche e testi ma mai la soluzione, e una segnalazione non tocca un
// esercizio da cui sono già partite altre lezioni: qui invece la stessa modifica del codice va su TUTTI i file della
// catena (progetto di partenza, soluzioni, gioco finale, esempi della teoria), così ogni lezione parte ancora da dove
// finisce la precedente. I testi da cambiare li scrive una persona, nel file della correzione: nessun modello.
//
// Ogni esercizio che cambia ripassa tutti i controlli in Godot, come una lezione appena scritta. Le lezioni si
// pubblicano tutte insieme, in una versione nuova, solo se passano tutte: se un controllo fallisce non cambia niente e
// la traccia dice perché. I controlli possono durare più di un giro: quelli già superati restano nel registro.

export const CORREZIONI: CorrezioneGioco[] = [STELLE_DEL_CESTO];

const FILE = "stato/correzioni.json";

type StatoCorrezione = {
  esito: "in corso" | "fatta" | "fallita";
  /** Per lezione, l'impronta del contenuto nuovo che ha già superato i controlli. */
  controllate: Record<string, string>;
  /** Le versioni pubblicate con la correzione. */
  versioni?: Record<string, number>;
  motivo?: string;
  quando: string;
};

const correggiFile = (c: CorrezioneGioco, file: FileProgetto[]) => file.map((f) => (f.percorso.endsWith(".gd") ? { ...f, contenuto: c.codice(f.contenuto) } : f));
const stessiFile = (a: FileProgetto[], b: FileProgetto[]) => JSON.stringify([...a].sort((x, y) => x.percorso.localeCompare(y.percorso))) === JSON.stringify([...b].sort((x, y) => x.percorso.localeCompare(y.percorso)));

type LezioneCorretta = {
  voce: VoceCatalogo;
  pacco: PaccoLezione;
  contenuto: Lezione;
  statoFinale: StatoProgetto;
  /** Gli esercizi che cambiano (o cambia il progetto da cui partono), con il progetto da cui partono ora. */
  cambiati: { e: Esercizio; base: StatoProgetto }[];
  impronta: string;
};

/**
 * Le lezioni della catena con la correzione applicata (solo quelle che cambiano). Lancia CorrezioneImpossibile se la
 * catena non è coerente (una lezione non parte da dove finisce la precedente) o se un testo da cambiare non c'è più.
 */
export function preparaCatena(c: CorrezioneGioco): LezioneCorretta[] {
  const voci = catalogo().lezioni;
  const inizio = voci.findIndex((v) => v.slug === c.daLezione);
  if (inizio < 0) throw new CorrezioneImpossibile(`la lezione ${c.daLezione} non è pubblicata`);
  const daScrivere = new Set(Object.keys(c.lezioni));
  const risultato: LezioneCorretta[] = [];
  let finaleVecchio: StatoProgetto | null = null;
  let finaleNuovo: StatoProgetto | null = null;
  for (const voce of voci.slice(inizio)) {
    const pacco = paccoPubblicato(voce.slug);
    const iniziale = pacco?.contenuto.statoIniziale;
    if (!pacco || !iniziale || iniziale.cartella !== c.gioco) continue;
    const dove = `${voce.numero} ${voce.slug}`;
    if (finaleVecchio && !stessiFile(iniziale.file, finaleVecchio.file)) throw new CorrezioneImpossibile(`${dove}: il gioco da cui parte non è quello con cui finisce la lezione prima`);
    const contenuto = structuredClone(pacco.contenuto) as Lezione;
    const aMano = c.lezioni[voce.slug];
    if (aMano) {
      try {
        aMano(contenuto);
      } catch (errore) {
        throw new CorrezioneImpossibile(`${dove}: ${(errore as Error).message}`);
      }
      daScrivere.delete(voce.slug);
    }
    for (const b of contenuto.blocchi) if (b.tipo === "codice") b.codice = c.codice(b.codice);
    contenuto.statoIniziale = finaleNuovo ? { ...iniziale, file: finaleNuovo.file, progetto: finaleNuovo.progetto } : { ...iniziale, file: correggiFile(c, iniziale.file) };

    const vecchi = [...pacco.contenuto.esercizi, pacco.contenuto.test];
    const nuovi = [...contenuto.esercizi, contenuto.test];
    let gioco: StatoProgetto = contenuto.statoIniziale;
    let giocoVecchio: StatoProgetto = iniziale;
    const cambiati: LezioneCorretta["cambiati"] = [];
    for (const [i, e] of nuovi.entries()) {
      if (e.modalita === "progetto" && e.dove === "gioco") e.soluzione.file = correggiFile(c, e.soluzione.file);
      const base = baseDi(e, gioco);
      if (JSON.stringify(e) !== JSON.stringify(vecchi[i]) || JSON.stringify(base) !== JSON.stringify(baseDi(vecchi[i], giocoVecchio))) cambiati.push({ e, base });
      gioco = statoDopo(gioco, e);
      giocoVecchio = statoDopo(giocoVecchio, vecchi[i]);
    }
    if (!pacco.statoFinale || !stessiFile(pacco.statoFinale.file, giocoVecchio.file)) throw new CorrezioneImpossibile(`${dove}: il gioco finale pubblicato non è quello dell'ultimo esercizio`);
    finaleVecchio = pacco.statoFinale;
    finaleNuovo = { ...pacco.statoFinale, file: gioco.file, progetto: gioco.progetto };
    const prima = JSON.stringify({ contenuto: pacco.contenuto, statoFinale: pacco.statoFinale });
    const dopo = JSON.stringify({ contenuto, statoFinale: finaleNuovo });
    if (prima !== dopo) risultato.push({ voce, pacco, contenuto, statoFinale: finaleNuovo, cambiati, impronta: sha256(dopo) });
  }
  if (daScrivere.size) throw new CorrezioneImpossibile(`i testi scritti per ${[...daScrivere].join(", ")} non hanno trovato la loro lezione nella catena`);
  return risultato;
}

/** I problemi degli esercizi cambiati di una lezione, ricontrollati in Godot come in una lezione appena scritta. */
async function problemiDellaLezione(l: LezioneCorretta): Promise<string[]> {
  const lezione = lezioneDelCorso(l.voce.slug);
  if (!lezione) return [`${l.voce.slug} non è più nel piano del corso`];
  const conosciute = new Set([...paroleDelleLezioniPrima(lezione), ...paroleDi(...testiDellaTeoria(l.contenuto.blocchi))]);
  const problemi: string[] = [];
  for (const { e, base } of l.cambiati) {
    if (e.modalita !== "progetto" && e.modalita !== "codice") continue;
    controllaTempo();
    const controllo = await controllaPezzo(e, base, { conosciute, pubblicata: true });
    problemi.push(...controllo.problemi.map((p) => `${e.id}: ${p}`));
  }
  return problemi;
}

/** La versione nuova di una lezione corretta. Lancia CorrezioneImpossibile se non supera il controllo di sicurezza. */
function versioneNuova(l: LezioneCorretta): PaccoLezione {
  // I video degli esercizi cambiati non valgono più (mostrano il gioco di prima): li rifà completaVideo.
  const validi = videoAncoraValidi(l.pacco, l.contenuto);
  const media = { ...Object.fromEntries(Object.entries(l.pacco.media).filter(([k]) => !/^video:(es\d+|test)$/.test(k))), ...validi.media };
  const nuovo = PaccoLezioneSchema.parse({ ...l.pacco, versione: l.pacco.versione + 1, contenuto: l.contenuto, statoFinale: l.statoFinale, media, video: validi.video, origine: { ...l.pacco.origine, richieste: costoLezione(l.pacco.slug) } });
  const sicurezza = problemiDelPacco(nuovo);
  if (sicurezza.length) throw new CorrezioneImpossibile(`${l.voce.numero} ${l.voce.slug} non supera il controllo di sicurezza: ${sicurezza.slice(0, 5).join(" | ")}`);
  return nuovo;
}

function pubblicaCorretta(l: LezioneCorretta, nuovo: PaccoLezione, c: CorrezioneGioco): void {
  const testo = JSON.stringify(nuovo);
  scriviFile(l.voce.file, testo);
  aggiornaCatalogo({ ...l.voce, versione: nuovo.versione, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  // Gli esercizi cambiati hanno appena ripassato i controlli della robustezza: non serve rifarli sulla versione nuova.
  versioneConGliStessiEsercizi(l.pacco.slug, l.pacco.versione, nuovo.versione);
  const tolti = Object.keys(l.pacco.video).filter((id) => !nuovo.video[id]);
  registra({
    slug: l.pacco.slug,
    pezzo: "lezione",
    azione: "correzione del gioco",
    esito: "ok",
    titolo: `Gioco corretto: ${c.titolo}`,
    spiegazione: `Correzione «${c.id}» applicata a tutta la catena del gioco. Qui cambiano ${l.cambiati.map((x) => x.e.id).join(", ") || "solo teoria e gioco finale"}; tutti hanno ripassato i controlli in Godot. Versione ${nuovo.versione}.${tolti.length ? ` Video da rifare: ${tolti.join(", ")}.` : ""}`,
  });
}

async function fallita(c: CorrezioneGioco, registro: Record<string, StatoCorrezione>, slug: string, motivo: string, dettagli: string[] = []): Promise<void> {
  registro[c.id] = { ...(registro[c.id] ?? { controllate: {} }), esito: "fallita", motivo: motivo.slice(0, 2000), quando: new Date().toISOString() };
  scriviJson(FILE, registro);
  registra({
    slug,
    pezzo: "lezione",
    azione: "correzione del gioco",
    esito: "fallito",
    guasto: "contenuto",
    titolo: `Correzione del gioco non applicata: ${c.titolo}`,
    spiegazione: `${motivo}${dettagli.length ? `\n${dettagli.map((d) => `- ${d.slice(0, 900)}`).join("\n")}` : ""}\nReazione: nessuna lezione cambia. La correzione non si riprova finché non cambia il suo codice su main.`,
    dati: { dettagli },
  });
  await salva(`Correzione del gioco «${c.id}» non applicata`, { subito: true });
}

/** Vero se c'è una correzione ancora da fare: non usa modelli, quindi non aspetta che tornino liberi. */
export function correzioniInSospeso(correzioni = CORREZIONI): boolean {
  const registro = leggiJson<Record<string, StatoCorrezione>>(FILE, {});
  return correzioni.some((c) => registro[c.id]?.esito !== "fatta" && registro[c.id]?.esito !== "fallita");
}

/**
 * Applica le correzioni del gioco non ancora fatte. Restituisce quante lezioni sono uscite in una versione nuova.
 * Lancia GiroFinito se il tempo finisce durante i controlli: quelli superati restano nel registro.
 */
export async function applicaCorrezioni(correzioni = CORREZIONI): Promise<number> {
  const registro = leggiJson<Record<string, StatoCorrezione>>(FILE, {});
  let pubblicate = 0;
  for (const c of correzioni) {
    const prima = registro[c.id];
    if (prima?.esito === "fatta" || prima?.esito === "fallita") continue;
    let catena: LezioneCorretta[];
    try {
      catena = preparaCatena(c);
    } catch (errore) {
      if (!(errore instanceof CorrezioneImpossibile)) throw errore;
      await fallita(c, registro, c.daLezione, errore.message);
      continue;
    }
    const controllate = { ...(prima?.controllate ?? {}) };
    let bocciata = false;
    for (const l of catena) {
      if (controllate[l.voce.slug] === l.impronta) continue;
      const problemi = await problemiDellaLezione(l);
      if (problemi.length) {
        await fallita(c, registro, l.voce.slug, `In ${l.voce.numero} ${l.voce.slug} un esercizio corretto non supera i controlli.`, problemi);
        bocciata = true;
        break;
      }
      controllate[l.voce.slug] = l.impronta;
      registro[c.id] = { esito: "in corso", controllate, quando: new Date().toISOString() };
      scriviJson(FILE, registro);
    }
    if (bocciata) continue;
    // Tutte le versioni nuove prima di scriverne una: o escono tutte, o nessuna.
    let nuove: PaccoLezione[];
    try {
      nuove = catena.map(versioneNuova);
    } catch (errore) {
      if (!(errore instanceof CorrezioneImpossibile)) throw errore;
      await fallita(c, registro, c.daLezione, errore.message);
      continue;
    }
    const versioni: Record<string, number> = {};
    for (const [i, l] of catena.entries()) {
      pubblicaCorretta(l, nuove[i], c);
      versioni[l.voce.slug] = nuove[i].versione;
    }
    registro[c.id] = { esito: "fatta", controllate, versioni, quando: new Date().toISOString() };
    scriviJson(FILE, registro);
    pubblicate += catena.length;
    await salva(`Correzione del gioco «${c.id}»: ${catena.length} lezioni in una versione nuova`, { subito: true });
  }
  return pubblicate;
}
