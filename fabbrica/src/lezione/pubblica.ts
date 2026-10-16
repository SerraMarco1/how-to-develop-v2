import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { scriviFileProgetto, nuovaCartellaTemporanea } from "@htd/condiviso/godot/verifica.ts";
import { registraVideo } from "@htd/condiviso/godot/video.ts";
import { togliCartella } from "@htd/condiviso/godot/esegui.ts";
import { catalogoImmagini, elencoAssetCorso, percorsoMotore } from "@htd/condiviso/motore.ts";
import { CatalogoSchema, FORMATO, PaccoLezioneSchema, percorsoLezione, percorsoMedia, sha256, type Media, type PaccoLezione } from "@htd/condiviso/pacchetto.ts";
import type { LezioneNelCorso } from "@htd/condiviso/piano.ts";
import { lezioniDelCorso } from "@htd/condiviso/piano.ts";
import { EsercizioSchema, PrevisioneSchema, type Esercizio, type Previsione } from "@htd/condiviso/schemi.ts";
import { fileDellaLezione, problemiDelPacco } from "@htd/condiviso/controllo-pacco.ts";
import { messaggi } from "../ai/prompt.ts";
import { AINonDisponibile, chiamaAI, RispostaAINonValida } from "../ai/router.ts";
import { esiste, percorsoDati, salva, scriviFile } from "../archivio.ts";
import { CONFIG } from "../configurazione.ts";
import { catalogo } from "../corso.ts";
import { costoLezione, registra } from "../traccia.ts";
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

/**
 * Le voci di ripasso di una lezione: codice da leggere e risultato da prevedere. Le scrive un modello con molte
 * richieste al giorno (il ruolo «ripasso»), le risposte giuste le calcola Godot. Se non riesce, la lezione esce senza.
 */
async function preparaRipasso(lezione: LezioneNelCorso, scritta: LezioneScritta): Promise<Previsione[]> {
  const script = scritta.statoFinale.file.filter((f) => f.percorso.endsWith(".gd"));
  if (script.length === 0 && !scritta.lezione.blocchi.some((b) => b.tipo === "codice")) return [];
  try {
    const { dati } = await chiamaAI({
      ruolo: "ripasso",
      slug: lezione.slug,
      messaggi: messaggi("richiamo", {
        titolo_competenza: lezione.titolo,
        sommario: scritta.lezione.sommario,
        concetti: scritta.lezione.concetti.join(", "),
        obiettivi: lezione.impari.map((o) => `- ${o}`).join("\n"),
        progetto: script.map((f) => `#### ${f.percorso}\n${f.contenuto}`).join("\n\n").slice(0, 2500) || "(nessuno script)",
        istruzioni: istruzioniModalita("previsioni"),
      }),
      schema: RipassoSchema,
      maxTokens: 3000,
    });
    const base = preparaEsercizio({ ...EsercizioSchema.parse({ titolo: "Ripasso", consegna: "Ripasso della lezione", modalita: "previsioni" }), previsioni: dati.previsioni } as Esercizio, "r", "autonomo");
    const { esercizio } = await calcolaPrevisioni(base);
    const voci = esercizio.previsioni.filter((v) => v.risposta && v.risposta !== "<null>" && v.risposta.length <= 80);
    registra({ slug: lezione.slug, pezzo: "ripasso", azione: "scrittura", esito: voci.length >= 3 ? "ok" : "saltato", titolo: "Ripasso: voci per il ripasso a intervalli", spiegazione: voci.length >= 3 ? `${voci.length} voci eseguite in Godot, con le risposte calcolate: ${voci.map((v) => v.risposta).join(" · ")}` : `Solo ${voci.length} voci su ${esercizio.previsioni.length} si eseguono in Godot: la lezione esce senza ripasso proprio.` });
    return voci.length >= 3 ? voci.map((v, i) => ({ ...v, id: `r${i + 1}` })) : [];
  } catch (errore) {
    if (!(errore instanceof AINonDisponibile) && !(errore instanceof RispostaAINonValida)) throw errore;
    registra({ slug: lezione.slug, pezzo: "ripasso", azione: "scrittura", esito: "saltato", guasto: errore instanceof AINonDisponibile ? "fornitore" : "formato", titolo: "Ripasso non scritto", spiegazione: `${(errore as Error).message.slice(0, 400)}\nReazione: la lezione esce senza voci di ripasso.` });
    return [];
  }
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
    const mp4 = path.join(cartella, "risultato.mp4");
    try {
      scriviFileProgetto(cartella, esercizio.soluzione.file, esercizio.titolo);
      await registraVideo({ cartellaProgetto: cartella, scena: blocco.scena, durata: blocco.durata, azioni: blocco.azioni, fileMp4: mp4 });
      media[`video:${blocco.id}`] = salvaMedia(fs.readFileSync(mp4), "mp4");
    } catch (errore) {
      registra({ slug: lezione.slug, pezzo: "lezione", azione: "video", esito: "saltato", titolo: "Video del risultato non registrato", spiegazione: `La registrazione non è riuscita (${(errore as Error).message.slice(0, 300)}): la lezione esce senza quel video.` });
    } finally {
      togliCartella(cartella);
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
