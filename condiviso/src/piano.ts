import { leggiJsonMotore } from "./motore.ts";
import type { TipoEsercizio } from "./schemi.ts";

// Il piano del corso: scritto a mano nel pacchetto del motore (motori/godot/corso, un file per fase) e approvato.
// È il corso: la fabbrica scrive le sue lezioni in quest'ordine, l'aula le mostra in quest'ordine.

export type LezionePiano = {
  slug: string;
  titolo: string;
  /** "metodo": una lezione su come cavarsela. "progetto": una tappa del progetto di fine fase, da un progetto vuoto. */
  tipo: "lezione" | "metodo" | "progetto";
  minuti: number;
  esercizi: TipoEsercizio[];
  /** "a-parte": in questa lezione non si lavora sul gioco della fase. */
  dove?: "gioco" | "a-parte";
  impari: string[];
  costruisci: string;
  verifica: string;
  parole: string[];
};

/** Un progetto Godot di una fase. `continuaDa`: prosegue il gioco di un'altra fase ("prova:<fase>" = il suo progetto finale). */
export type ProgettoDiFase = { nome: string; cartella: string; continuaDa?: string };

export type FasePiano = {
  slug: string;
  titolo: string;
  descrizione: string;
  gioco: string;
  prova: string;
  progetto: ProgettoDiFase;
  provaProgetto?: ProgettoDiFase;
  allaFine: string[];
  sezioniDocumentazione: string[];
  lezioni: LezionePiano[];
};

export type DescrizioneTipo = { id: TipoEsercizio; nome: string; cosa: string; allena: string };

export type Piano = {
  versione: number;
  stato: "proposta" | "approvato";
  titolo: string;
  traguardo: string;
  regole: string[];
  tipiDiEsercizio: { nota: string; tipi: DescrizioneTipo[] };
  fasi: FasePiano[];
};

/** Una lezione del piano con la sua posizione nel corso. `numero`: "1.7" = fase 1, lezione 7 (contando da 0). */
export type LezioneNelCorso = LezionePiano & { fase: FasePiano; numeroFase: number; posizione: number; numero: string; indice: number };

let cache: Piano | null = null;

export function leggiPiano(): Piano {
  if (cache) return cache;
  const indice = leggiJsonMotore<Omit<Piano, "fasi"> & { fasi: string[] }>("corso", "00-piano.json");
  cache = { ...indice, fasi: indice.fasi.map((file) => leggiJsonMotore<FasePiano>("corso", file)) };
  return cache;
}

/** Tutte le lezioni del corso, nell'ordine in cui si studiano. */
export function lezioniDelCorso(): LezioneNelCorso[] {
  const piano = leggiPiano();
  const tutte: LezioneNelCorso[] = [];
  piano.fasi.forEach((fase, numeroFase) => {
    fase.lezioni.forEach((l, posizione) => tutte.push({ ...l, fase, numeroFase, posizione, numero: `${numeroFase}.${posizione}`, indice: tutte.length }));
  });
  return tutte;
}

export function lezioneDelCorso(slug: string): LezioneNelCorso | undefined {
  return lezioniDelCorso().find((l) => l.slug === slug);
}

export function descrizioneTipo(id: string): DescrizioneTipo | undefined {
  return leggiPiano().tipiDiEsercizio.tipi.find((t) => t.id === id);
}

/**
 * I controlli di coerenza del piano: nomi unici, tipi di esercizio conosciuti, fasi che proseguono fasi esistenti.
 * Restituisce l'elenco dei problemi (vuoto = piano coerente).
 */
export function problemiDelPiano(piano: Piano = leggiPiano()): string[] {
  const problemi: string[] = [];
  const tipi = new Set(piano.tipiDiEsercizio.tipi.map((t) => t.id));
  const slugLezioni = new Set<string>();
  const slugFasi = new Set(piano.fasi.map((f) => f.slug));
  if (slugFasi.size !== piano.fasi.length) problemi.push("due fasi hanno lo stesso slug");
  for (const fase of piano.fasi) {
    for (const p of [fase.progetto, fase.provaProgetto]) {
      if (!p?.continuaDa) continue;
      const altra = p.continuaDa.replace(/^prova:/, "");
      if (!slugFasi.has(altra)) problemi.push(`fase ${fase.slug}: continuaDa "${p.continuaDa}" non è una fase del piano`);
    }
    for (const l of fase.lezioni) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(l.slug)) problemi.push(`lezione "${l.slug}": lo slug deve avere solo lettere minuscole, cifre e trattini`);
      if (slugLezioni.has(l.slug)) problemi.push(`lezione "${l.slug}" ripetuta`);
      slugLezioni.add(l.slug);
      for (const t of l.esercizi) if (!tipi.has(t)) problemi.push(`lezione "${l.slug}": tipo di esercizio sconosciuto "${t}"`);
      if (!l.impari?.length) problemi.push(`lezione "${l.slug}": manca "impari"`);
      if (!l.costruisci?.trim()) problemi.push(`lezione "${l.slug}": manca "costruisci"`);
    }
  }
  return problemi;
}
