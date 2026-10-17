import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { scriviFileProgetto, nuovaCartellaTemporanea } from "@htd/condiviso/godot/verifica.ts";
import { registraVideo } from "@htd/condiviso/godot/video.ts";
import { togliCartella } from "@htd/condiviso/godot/esegui.ts";
import { catalogoImmagini, elencoAssetCorso, percorsoMotore } from "@htd/condiviso/motore.ts";
import { CatalogoSchema, FORMATO, PaccoLezioneSchema, percorsoLezione, percorsoMedia, sha256, type Media, type PaccoLezione } from "@htd/condiviso/pacchetto.ts";
import type { LezioneNelCorso } from "@htd/condiviso/piano.ts";
import { lezioneDelCorso, lezioniDelCorso } from "@htd/condiviso/piano.ts";
import { EsercizioSchema, PrevisioneSchema, type Esercizio, type Lezione, type Previsione, type StatoProgetto } from "@htd/condiviso/schemi.ts";
import { fileDellaLezione, problemiDelPacco } from "@htd/condiviso/controllo-pacco.ts";
import { messaggi } from "../ai/prompt.ts";
import { AINonDisponibile, candidati, chiamaAI, dimenticaRisposta, RispostaAINonValida } from "../ai/router.ts";
import { esiste, percorsoDati, salva, scriviFile } from "../archivio.ts";
import { CONFIG } from "../configurazione.ts";
import { catalogo, paccoPubblicato } from "../corso.ts";
import { controllaTempo, GiroFinito } from "../tempo.ts";
import { costoLezione, registra, registroDiLezione } from "../traccia.ts";
import type { LezioneScritta } from "./catena.ts";
import { chiudiCantiere } from "./catena.ts";
import { istruzioniModalita, preparaEsercizio } from "./esercizio.ts";
import { calcolaPrevisioni } from "./pratica.ts";

// La pubblicazione di una lezione finita: il «pacco» con teoria, esercizi, progetto di riferimento, immagini, video e
// ripasso, scritto in lezioni/<fase>/<slug>.json e aggiunto al catalogo con la sua impronta.

/** Salva un file binario in media/ con il nome uguale alla sua impronta (se c'è già, non lo riscrive). */
export function salvaMedia(dati: Buffer, estensione: string): Media {
  const impronta = sha256(dati);
  const media: Media = { sha256: impronta, estensione, byte: dati.length };
  if (!esiste(percorsoMedia(media))) scriviFile(percorsoMedia(media), dati);
  return media;
}

// ─────────────────────────── Ripasso ───────────────────────────

const RipassoSchema = z.object({ previsioni: z.array(PrevisioneSchema).min(3).max(6) });

/** Una lezione senza codice (né script nel progetto né blocchi di codice nella teoria) non ha niente da ripassare. */
function haCodice(contenuto: Lezione, statoFinale: StatoProgetto | null): boolean {
  return (statoFinale?.file ?? []).some((f) => f.percorso.endsWith(".gd")) || contenuto.blocchi.some((b) => b.tipo === "codice");
}

/**
 * Le voci di ripasso di una lezione: codice da leggere e risultato da prevedere. Le scrive un modello con molte
 * richieste al giorno (il ruolo «ripasso»), le risposte giuste le calcola Godot. Vuoto se meno di tre voci si eseguono.
 * Lancia AINonDisponibile o RispostaAINonValida se nessun modello risponde nel formato chiesto.
 */
async function scriviRipasso(lezione: LezioneNelCorso, contenuto: Lezione, statoFinale: StatoProgetto | null): Promise<Previsione[]> {
  const dalle = Date.now();
  const script = (statoFinale?.file ?? []).filter((f) => f.percorso.endsWith(".gd"));
  const richiesta = {
    ruolo: "ripasso" as const,
    slug: lezione.slug,
    messaggi: messaggi("richiamo", {
      titolo_competenza: lezione.titolo,
      sommario: contenuto.sommario,
      concetti: contenuto.concetti.join(", "),
      obiettivi: lezione.impari.map((o) => `- ${o}`).join("\n"),
      progetto: script.map((f) => `#### ${f.percorso}\n${f.contenuto}`).join("\n\n").slice(0, 2500) || "(nessuno script)",
      istruzioni: istruzioniModalita("previsioni"),
    }),
    schema: RipassoSchema,
    maxTokens: 3000,
  };
  const { dati } = await chiamaAI(richiesta);
  const base = preparaEsercizio({ ...EsercizioSchema.parse({ titolo: "Ripasso", consegna: "Ripasso della lezione", modalita: "previsioni" }), previsioni: dati.previsioni } as Esercizio, "r", "autonomo");
  const { esercizio } = await calcolaPrevisioni(base);
  const voci = esercizio.previsioni.filter((v) => v.risposta && v.risposta !== "<null>" && v.risposta.length <= 80);
  // Usata la risposta (Godot ha calcolato le risposte giuste), non serve più conservarla; e se non è servita, il
  // tentativo successivo deve chiederne una nuova invece di ritrovare questa.
  dimenticaRisposta(richiesta);
  registra({ slug: lezione.slug, pezzo: "ripasso", azione: "scrittura", esito: voci.length >= 3 ? "ok" : "saltato", guasto: voci.length >= 3 ? undefined : "contenuto", dalle, titolo: "Ripasso: voci per il ripasso a intervalli", spiegazione: voci.length >= 3 ? `${voci.length} voci eseguite in Godot, con le risposte calcolate: ${voci.map((v) => v.risposta).join(" · ")}` : `Solo ${voci.length} voci su ${esercizio.previsioni.length} si eseguono in Godot: non bastano (ne servono almeno 3), il ripasso non viene usato.` });
  return voci.length >= 3 ? voci.map((v, i) => ({ ...v, id: `r${i + 1}` })) : [];
}

/** `dalle`: quando è cominciato il tentativo, perché il registro conti le richieste rifiutate o scartate. */
function ripassoNonScritto(slug: string, errore: AINonDisponibile | RispostaAINonValida, dalle: number, reazione: string): void {
  registra({ slug, pezzo: "ripasso", azione: "scrittura", esito: "saltato", guasto: errore instanceof AINonDisponibile ? "fornitore" : "formato", dalle, titolo: "Ripasso non scritto", spiegazione: `${errore.message.slice(0, 400)}\nReazione: ${reazione}` });
}

/** Il ripasso di una lezione appena scritta. Se nessun modello risponde, la lezione esce senza: lo recupera completaRipassi. */
async function preparaRipasso(lezione: LezioneNelCorso, scritta: LezioneScritta): Promise<Previsione[]> {
  if (!haCodice(scritta.lezione, scritta.statoFinale)) return [];
  const dalle = Date.now();
  try {
    return await scriviRipasso(lezione, scritta.lezione, scritta.statoFinale);
  } catch (errore) {
    if (!(errore instanceof AINonDisponibile) && !(errore instanceof RispostaAINonValida)) throw errore;
    ripassoNonScritto(lezione.slug, errore, dalle, "la lezione esce senza voci di ripasso; si riprova a scriverle nei giri successivi.");
    return [];
  }
}

/** Dopo quanti tentativi andati male (risposta inutilizzabile, non un rifiuto del fornitore) si smette di chiedere. */
const TENTATIVI_RIPASSO = 3;

/**
 * Le lezioni pubblicate senza ripasso perché in quel momento nessun modello poteva scriverlo (sovraccarico, chiave non
 * ancora messa): a ogni giro, prima di scrivere lezioni nuove, si riprova. Se riesce, la lezione esce in una versione
 * nuova in cui cambia solo il ripasso: teoria ed esercizi restano identici, e l'aula conserva i progressi (sono legati
 * alla lezione, non alla versione). Dopo tre tentativi andati male per la stessa lezione si smette, per non spendere
 * richieste all'infinito. Restituisce quante lezioni ha completato.
 */
export async function completaRipassi(): Promise<number> {
  let completate = 0;
  for (const voce of catalogo().lezioni) {
    const pacco = paccoPubblicato(voce.slug);
    const lezione = lezioneDelCorso(voce.slug);
    if (!pacco || !lezione || pacco.ripasso.length > 0 || !haCodice(pacco.contenuto, pacco.statoFinale)) continue;
    const andatiMale = registroDiLezione(voce.slug).filter((r) => r.pezzo === "ripasso" && r.esito !== "ok" && r.guasto !== "fornitore").length;
    if (andatiMale >= TENTATIVI_RIPASSO) continue;
    // Nessun modello libero per il ripasso: non si bussa e non si scrive niente, si riprova al giro dopo.
    if (candidati("ripasso", { tokenStimati: 3000, escludi: [] }).disponibili.length === 0) return completate;
    controllaTempo();
    const ancora = andatiMale + 1 < TENTATIVI_RIPASSO ? "si riprova al prossimo giro." : `${TENTATIVI_RIPASSO} tentativi andati male: la lezione resta senza ripasso.`;
    const dalle = Date.now();
    let nuovo: PaccoLezione;
    try {
      const voci = await scriviRipasso(lezione, pacco.contenuto, pacco.statoFinale);
      if (voci.length === 0) continue;
      nuovo = PaccoLezioneSchema.parse({ ...pacco, versione: pacco.versione + 1, ripasso: voci, origine: { ...pacco.origine, richieste: costoLezione(voce.slug) } });
      const sicurezza = problemiDelPacco(nuovo);
      if (sicurezza.length) {
        registra({ slug: voce.slug, pezzo: "ripasso", azione: "controllo", esito: "fallito", guasto: "contenuto", titolo: "Ripasso rifiutato dal controllo di sicurezza", spiegazione: `${sicurezza.slice(0, 5).join(" | ")}\nReazione: ${ancora}` });
        continue;
      }
    } catch (errore) {
      if (errore instanceof GiroFinito) throw errore;
      if (errore instanceof AINonDisponibile) {
        ripassoNonScritto(voce.slug, errore, dalle, "si riprova al prossimo giro.");
        return completate;
      }
      if (errore instanceof RispostaAINonValida) {
        ripassoNonScritto(voce.slug, errore, dalle, ancora);
        continue;
      }
      // Un errore del programma qui non deve fermare la scrittura delle lezioni nuove: resta nel registro, e conta tra
      // i tentativi andati male (così non si ripete all'infinito).
      console.error(`Ripasso di ${voce.slug}: ${(errore as Error).stack ?? errore}`);
      registra({ slug: voce.slug, pezzo: "ripasso", azione: "scrittura", esito: "fallito", guasto: "piattaforma", dalle, titolo: "Ripasso: errore del programma", spiegazione: `${(errore as Error).message.slice(0, 600)}\nReazione: ${ancora}`, dati: { errore: (errore as Error).stack } });
      continue;
    }
    const testo = JSON.stringify(nuovo);
    scriviFile(voce.file, testo);
    aggiornaCatalogo({ ...voce, versione: nuovo.versione, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
    registra({ slug: voce.slug, pezzo: "lezione", azione: "ripasso aggiunto", esito: "ok", titolo: "Ripasso aggiunto alla lezione pubblicata", spiegazione: `${nuovo.ripasso.length} voci di ripasso aggiunte; teoria ed esercizi non cambiano. Versione ${nuovo.versione}. Costo totale della lezione: ${nuovo.origine.richieste} richieste.` });
    await salva(`${voce.numero} ${voce.slug}: ripasso aggiunto (versione ${nuovo.versione})`, { subito: true });
    completate++;
  }
  return completate;
}

// ─────────────────────────── Video ───────────────────────────

async function videoDeiBlocchi(lezione: LezioneNelCorso, scritta: LezioneScritta, videoEsistenti: Record<string, string>): Promise<Record<string, Media>> {
  const media: Record<string, Media> = {};
  for (const blocco of scritta.lezione.blocchi) {
    if (blocco.tipo !== "video") continue;
    if (videoEsistenti[blocco.id!]) {
      media[`video:${blocco.id}`] = salvaMedia(fs.readFileSync(videoEsistenti[blocco.id!]), "mp4");
      continue;
    }
    const esercizio = scritta.lezione.esercizi.find((e) => e.id === blocco.esercizio);
    if (!esercizio) continue;
    const cartella = nuovaCartellaTemporanea("video");
    // Il video esce in una cartella a parte, che Godot non può toccare (vedi registraVideo).
    const uscita = nuovaCartellaTemporanea("video-mp4");
    const mp4 = path.join(uscita, "risultato.mp4");
    try {
      scriviFileProgetto(cartella, esercizio.soluzione.file, esercizio.titolo);
      await registraVideo({ cartellaProgetto: cartella, scena: blocco.scena, durata: blocco.durata, azioni: blocco.azioni, fileMp4: mp4 });
      media[`video:${blocco.id}`] = salvaMedia(fs.readFileSync(mp4), "mp4");
    } catch (errore) {
      registra({ slug: lezione.slug, pezzo: "lezione", azione: "video", esito: "saltato", titolo: "Video del risultato non registrato", spiegazione: `La registrazione non è riuscita (${(errore as Error).message.slice(0, 300)}): la lezione esce senza quel video.` });
    } finally {
      togliCartella(cartella);
      togliCartella(uscita);
    }
  }
  return media;
}

// ─────────────────────────── Pubblicazione ───────────────────────────

export async function pubblicaLezione(
  lezione: LezioneNelCorso,
  scritta: LezioneScritta,
  opzioni: { importata?: boolean; ripasso?: Previsione[]; videoEsistenti?: Record<string, string>; pubblicata?: string } = {},
): Promise<PaccoLezione> {
  const precedente = catalogo().lezioni.find((l) => l.slug === lezione.slug);
  const media: Record<string, Media> = {};

  // Immagini dell'editor e asset del corso: dal pacchetto del motore.
  const immagini = new Map(catalogoImmagini().map((i) => [i.id, i]));
  for (const b of scritta.lezione.blocchi) {
    if (b.tipo !== "immagine") continue;
    const voce = immagini.get(b.immagine);
    if (voce) media[`immagine:${b.immagine}`] = salvaMedia(fs.readFileSync(percorsoMotore("immagini", voce.file)), path.extname(voce.file).slice(1).toLowerCase());
  }
  const testi = fileDellaLezione({ contenuto: scritta.lezione, statoFinale: scritta.statoFinale }).flat().map((f) => f.contenuto).join("\n");
  for (const a of elencoAssetCorso()) {
    if (testi.includes(`assets/${a.file}`)) media[`asset:assets/${a.file}`] = salvaMedia(fs.readFileSync(percorsoMotore("assets", a.file)), path.extname(a.file).slice(1).toLowerCase());
  }
  Object.assign(media, await videoDeiBlocchi(lezione, scritta, opzioni.videoEsistenti ?? {}));
  // Un blocco video senza video non ha niente da mostrare.
  const contenuto = { ...scritta.lezione, blocchi: scritta.lezione.blocchi.filter((b) => b.tipo !== "video" || media[`video:${b.id}`]) };

  const ripasso = opzioni.ripasso ?? (await preparaRipasso(lezione, scritta));
  const pacco: PaccoLezione = PaccoLezioneSchema.parse({
    formato: FORMATO,
    slug: lezione.slug,
    numero: lezione.numero,
    fase: lezione.fase.slug,
    titolo: lezione.titolo,
    tipo: lezione.tipo,
    minuti: lezione.minuti,
    versione: (precedente?.versione ?? 0) + 1,
    contenuto,
    statoFinale: scritta.statoFinale,
    media,
    ripasso,
    origine: { pubblicata: opzioni.pubblicata ?? new Date().toISOString(), modelli: scritta.modelli, richieste: costoLezione(lezione.slug), codice: CONFIG.revisioneCodice, importata: Boolean(opzioni.importata) },
  });
  const sicurezza = problemiDelPacco(pacco);
  if (sicurezza.length) throw new Error(`La lezione non supera l'ultimo controllo di sicurezza prima della pubblicazione: ${sicurezza.slice(0, 5).join(" | ")}`);

  const file = percorsoLezione(lezione.fase.slug, lezione.slug);
  const testo = JSON.stringify(pacco);
  scriviFile(file, testo);
  aggiornaCatalogo({ slug: lezione.slug, numero: lezione.numero, titolo: lezione.titolo, versione: pacco.versione, file, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  chiudiCantiere(lezione.slug);
  registra({
    slug: lezione.slug,
    pezzo: "lezione",
    azione: "pubblicazione",
    esito: "ok",
    titolo: opzioni.importata ? "Lezione della versione 1 ricontrollata e pubblicata" : "Lezione pubblicata",
    spiegazione: `${contenuto.blocchi.length} blocchi di teoria, ${contenuto.esercizi.length} esercizi (${contenuto.esercizi.map((e) => e.genere).join(", ") || "nessuno"}) e il test (${contenuto.test.genere}). Versione ${pacco.versione}. Costo: ${pacco.origine.richieste} richieste. Modelli: ${scritta.modelli.join(", ") || "nessuno"}.${contenuto.avvisi?.length ? `\nAvvisi dichiarati:\n${contenuto.avvisi.map((a) => `- ${a}`).join("\n")}` : " Nessun ripiego."}\nRipasso: ${ripasso.length} voci. Media: ${Object.keys(media).length} file.`,
  });
  await salva(`${lezione.numero} ${lezione.slug}: lezione pubblicata (versione ${pacco.versione})`, { subito: true });
  return pacco;
}

export function aggiornaCatalogo(voce: z.infer<typeof CatalogoSchema>["lezioni"][number]): void {
  const c = catalogo();
  const ordine = new Map(lezioniDelCorso().map((l) => [l.slug, l.indice]));
  const lezioni = [...c.lezioni.filter((l) => l.slug !== voce.slug), voce].sort((a, b) => (ordine.get(a.slug) ?? 1e9) - (ordine.get(b.slug) ?? 1e9));
  const nuovo = CatalogoSchema.parse({ ...c, formato: FORMATO, aggiornato: new Date().toISOString(), lezioniNelPiano: lezioniDelCorso().length, lezioni });
  scriviFile("catalogo.json", `${JSON.stringify(nuovo, null, 1)}\n`);
}

/** Registra nel catalogo l'indice della documentazione (una volta per revisione della documentazione). */
export function pubblicaIndiceDocumentazione(gz: Buffer, commit: string): boolean {
  const c = catalogo();
  if (c.documentazione?.commit === commit && esiste(percorsoMedia(c.documentazione.media))) return false;
  const media = salvaMedia(gz, "gz");
  const nuovo = CatalogoSchema.parse({ ...c, formato: FORMATO, aggiornato: new Date().toISOString(), lezioniNelPiano: lezioniDelCorso().length, documentazione: { media, commit } });
  scriviFile("catalogo.json", `${JSON.stringify(nuovo, null, 1)}\n`);
  return true;
}

export { percorsoDati };
