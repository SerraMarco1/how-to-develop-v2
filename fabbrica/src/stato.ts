import { leggiJson, scriviJson } from "./archivio.ts";

// Lo stato della fabbrica tra un giro e l'altro (stato/fabbrica.json): fermi dei modelli, sovraccarichi, limiti imparati
// dagli errori dei fornitori, e se il corso è fermo. Si legge una volta all'inizio del giro e si riscrive a ogni modifica.

export type CorsoFermo = {
  slug: string;
  /** Perché: "contenuto" (un pezzo non supera i controlli), "formato", "piattaforma" (errore del programma). */
  motivo: "contenuto" | "formato" | "piattaforma";
  messaggio: string;
  dal: string;
  /** Il numero della segnalazione aperta su GitHub per avvisare, se c'è. */
  segnalazione?: number;
};

export type StatoFabbrica = {
  /** Fornitori sovraccarichi: da quanti giri di fila, e fino a quando restano fermi. */
  sovraccarico: Record<string, { volte: number; fino: number }>;
  /** Modelli fermi fino a un certo momento (limite raggiunto, errore), con l'ultimo errore. */
  fermi: Record<string, { fino: number; errore: string }>;
  /** "fornitore/modello" → il modello che lo serve davvero (stesse richieste del giorno). */
  stessoLimite: Record<string, string>;
  /** Richieste al giorno dichiarate dai fornitori nei loro errori. */
  rpd: Record<string, number>;
  /** Richieste troppo grandi per un modello: la dimensione massima che regge. */
  maxToken: Record<string, number>;
  /** Troncature con il ragionamento massimo, per modello e dimensione della richiesta. */
  troncate: Record<string, { volte: number; quando: number }>;
  /** Modelli che hanno superato la prova di scrittura e possono scrivere lezioni. */
  scrittoriApprovati: string[];
  /** Il corso è fermo su una lezione che aspetta un intervento. */
  corsoFermo: CorsoFermo | null;
  /** Prima di quest'ora non serve cominciare un giro: nessun modello può rispondere (ms). */
  prossimoTentativo: number | null;
};

const FILE = "stato/fabbrica.json";

const VUOTO: StatoFabbrica = { sovraccarico: {}, fermi: {}, stessoLimite: {}, rpd: {}, maxToken: {}, troncate: {}, scrittoriApprovati: [], corsoFermo: null, prossimoTentativo: null };

let stato: StatoFabbrica | null = null;

export function statoFabbrica(): StatoFabbrica {
  stato ??= { ...structuredClone(VUOTO), ...leggiJson<Partial<StatoFabbrica>>(FILE, {}) };
  return stato;
}

/** Modifica lo stato e lo riscrive subito nell'archivio. */
export function aggiornaStato(modifica: (s: StatoFabbrica) => void): void {
  const s = statoFabbrica();
  modifica(s);
  scriviJson(FILE, s);
}

/** Solo per le prove: dimentica lo stato letto, così il prossimo accesso lo rilegge dall'archivio. */
export function dimenticaStato(): void {
  stato = null;
}
