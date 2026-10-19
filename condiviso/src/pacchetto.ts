import crypto from "node:crypto";
import { z } from "zod";
import { CopioneSchema, LezioneSchema, PrevisioneSchema, StatoProgettoSchema } from "./schemi.ts";

// Il formato con cui la fabbrica pubblica le lezioni nel ramo `corso` e l'aula le scarica.
//
//   catalogo.json            l'elenco delle lezioni pubblicate, ognuna con l'impronta SHA-256 del suo file
//   lezioni/<fase>/<slug>.json   una lezione (questo «pacco»)
//   media/<sha256>.<ext>     immagini, video, asset, indice della documentazione: il nome è l'impronta del contenuto
//   stato/aula.json          cosa sta facendo la fabbrica, da mostrare (non serve a niente di importante)
//
// L'aula legge il catalogo a una revisione precisa del ramo e accetta un file solo se la sua impronta è quella scritta.

export const FORMATO = 1;

export const sha256 = (dati: string | Buffer | Uint8Array) => crypto.createHash("sha256").update(dati).digest("hex");

const impronta = z.string().regex(/^[0-9a-f]{64}$/);

/** Un file binario usato da una lezione, salvato in media/ con il nome uguale alla sua impronta. */
export const MediaSchema = z.object({
  sha256: impronta,
  /** Estensione del file (png, mp4, ogg, wav…). */
  estensione: z.string().regex(/^[a-z0-9]{2,5}$/),
  byte: z.number().int().nonnegative(),
});
export type Media = z.infer<typeof MediaSchema>;

export const percorsoMedia = (m: Pick<Media, "sha256" | "estensione">) => `media/${m.sha256}.${m.estensione}`;

/**
 * Il video «Il risultato atteso» di un esercizio: il copione con cui è stato registrato (e controllato) e l'impronta della
 * soluzione e del progetto di partenza in quel momento. Se cambiano, il video non vale più e si rifà.
 * Il file è nei media della lezione, con la chiave "video:<id dell'esercizio>".
 */
export const VideoEsercizioSchema = z.object({ copione: CopioneSchema, impronta: impronta });
export type VideoEsercizio = z.infer<typeof VideoEsercizioSchema>;

export const PaccoLezioneSchema = z.object({
  formato: z.literal(FORMATO),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** "1.7": fase 1, lezione 7 (contando da 0). */
  numero: z.string().regex(/^\d+\.\d+$/),
  fase: z.string(),
  titolo: z.string(),
  tipo: z.enum(["lezione", "metodo", "progetto"]),
  minuti: z.number().int().positive(),
  /** Cresce a ogni nuova pubblicazione della stessa lezione (per esempio dopo una segnalazione). */
  versione: z.number().int().positive(),
  contenuto: LezioneSchema,
  /** Il progetto di riferimento alla fine della lezione: da qui parte la lezione successiva della fase. */
  statoFinale: StatoProgettoSchema.nullable(),
  /**
   * I file binari usati dalla lezione: "immagine:<id>" per le schermate dell'editor, "video:<idEsercizio>" per i video
   * del risultato atteso (vedi `video`), "asset:assets/<file>" per gli asset del corso usati dagli esercizi. Le lezioni
   * pubblicate prima del 19 ottobre 2026 possono avere anche "video:<idBlocco>" (b1, b2…): i vecchi video, non più mostrati.
   */
  media: z.record(z.string(), MediaSchema),
  /** I video «Il risultato atteso», per id dell'esercizio (es1, test…). Vuoto se nessun esercizio ne ha uno. */
  video: z.record(z.string(), VideoEsercizioSchema).default({}),
  /** Le voci del ripasso a intervalli: codice da leggere e risultato da prevedere, calcolato da Godot. Vuoto se la lezione non ha codice. */
  ripasso: z.array(PrevisioneSchema).default([]),
  origine: z.object({
    /** Quando la lezione è stata completata. */
    pubblicata: z.string(),
    modelli: z.array(z.string()),
    /** Quante richieste del giorno sono costate. */
    richieste: z.number().int().nonnegative(),
    /** La revisione del codice (ramo main) che l'ha scritta, se nota. */
    codice: z.string().nullable(),
    /** Arrivata dalla versione 1 della piattaforma e ricontrollata in Godot dalla versione 2. */
    importata: z.boolean().default(false),
  }),
});
export type PaccoLezione = z.infer<typeof PaccoLezioneSchema>;

export const VoceCatalogoSchema = z.object({
  slug: z.string(),
  numero: z.string(),
  titolo: z.string(),
  versione: z.number().int().positive(),
  file: z.string().regex(/^lezioni\/[a-z0-9-]+\/[a-z0-9-]+\.json$/),
  sha256: impronta,
  byte: z.number().int().nonnegative(),
});
export type VoceCatalogo = z.infer<typeof VoceCatalogoSchema>;

export const CatalogoSchema = z.object({
  formato: z.literal(FORMATO),
  aggiornato: z.string(),
  /** Quante lezioni ha il piano: serve all'aula per dire «10 pronte su 179». */
  lezioniNelPiano: z.number().int().nonnegative(),
  lezioni: z.array(VoceCatalogoSchema),
  /** L'indice della documentazione di Godot usato dal tutor (database SQLite compresso). */
  documentazione: z.object({ media: MediaSchema, commit: z.string() }).nullable(),
});
export type Catalogo = z.infer<typeof CatalogoSchema>;

/** Cosa sta facendo la fabbrica, scritto per essere mostrato nell'aula con una frase. */
export const StatoPubblicoSchema = z.object({
  aggiornato: z.string(),
  /** lavora: sta scrivendo; aspetta: un modello tornerà disponibile; ferma: serve un intervento; finito: corso completo. */
  stato: z.enum(["lavora", "aspetta", "ferma", "finito"]),
  lezione: z.object({ slug: z.string(), numero: z.string(), titolo: z.string() }).nullable(),
  messaggio: z.string(),
  /** Quando la fabbrica conta di riprendere (stato "aspetta"). */
  riprende: z.string().nullable(),
});
export type StatoPubblico = z.infer<typeof StatoPubblicoSchema>;

export const percorsoLezione = (fase: string, slug: string) => `lezioni/${fase}/${slug}.json`;
