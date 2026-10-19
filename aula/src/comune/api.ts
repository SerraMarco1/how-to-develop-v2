// Ciò che la finestra dell'aula può chiedere al programma, e cosa riceve. La finestra non ha accesso a niente del PC:
// passa da qui (preload → main), e il main controlla ogni richiesta prima di eseguirla.

export type StatoLezione = "completata" | "disponibile" | "bloccata" | "in_arrivo";

export type VoceCorso = { slug: string; numero: string; titolo: string; tipo: "lezione" | "metodo" | "progetto"; minuti: number; stato: StatoLezione; versione: number | null };
export type FaseCorso = { slug: string; numero: number; titolo: string; descrizione: string; gioco: string; prova: string; lezioni: VoceCorso[] };

export type StatoFabbricaVista = { stato: "lavora" | "aspetta" | "ferma" | "finito" | "sconosciuto"; messaggio: string; aggiornato: string | null; riprende: string | null };

export type Oggi = {
  prossima: VoceCorso | null;
  /** Quante lezioni pronte non ancora completate. */
  pronteDavanti: number;
  completate: number;
  totali: number;
  pubblicate: number;
  ripassiDovuti: number;
  fabbrica: StatoFabbricaVista;
  sincronizzazione: StatoSincronizzazione;
  /** Prima volta: manca qualcosa da impostare (cartella dei progetti, chiavi del tutor, importazione dalla versione 1). */
  daImpostare: string[];
};

/** `cambiate`: le lezioni scaricate dall'ultima sincronizzazione (nuove, o in una versione nuova). */
export type StatoSincronizzazione = { inCorso: boolean; ultima: string | null; errore: string | null; avvisi: string[]; cambiate: string[] };

export type BloccoVista =
  | { id: string; tipo: "testo" | "attenzione" | "riepilogo"; html: string }
  | { id: string; tipo: "codice"; html: string; spiegazioneHtml: string }
  | { id: string; tipo: "passi"; titolo: string; passiHtml: string[] }
  | { id: string; tipo: "immagine"; url: string; didascalia: string }
  | { id: string; tipo: "video"; url: string; titolo: string; azioni: { azione: string; inizio: number; fine: number; tasto?: string }[] };

export type EsercizioVista = {
  id: string;
  ruolo: "guidato" | "autonomo" | "test";
  titolo: string;
  consegnaHtml: string;
  modalita: "progetto" | "codice" | "ambiente" | "previsioni";
  genere: { nome: string; allena: string } | null;
  cartellaPredefinita: string | null;
  /** "progetto": un progetto scritto apposta da copiare; "gioco": il gioco della fase, da rimettere com'era; null: si parte da zero. */
  partenza: "progetto" | "gioco" | null;
  fileCodice: string | null;
  passiHtml: string[];
  suggerimenti: string[];
  previsioni: { id: string; domandaHtml: string; codiceHtml: string }[];
  verifiche: string[];
  superato: boolean;
};

export type LezioneVista = {
  slug: string;
  numero: string;
  fase: { numero: number; titolo: string };
  titolo: string;
  tipo: "lezione" | "metodo" | "progetto";
  minuti: number;
  versione: number;
  obiettivi: string[];
  avvisi: string[];
  blocchi: BloccoVista[];
  alternative: Record<string, string[]>;
  esercizi: EsercizioVista[];
  test: EsercizioVista;
  completata: boolean;
  voto: number | null;
  nota: string | null;
  prossima: { slug: string; titolo: string } | null;
  /** La lezione dopo non è ancora pronta: perché, in una frase. */
  attesaProssima: string | null;
};

export type Controllo = { descrizione: string; superato: boolean; dettaglio?: string; origine?: string };
export type EsitoConsegna = {
  superato: boolean;
  controlli: Controllo[];
  /** Le cause probabili riconosciute dalla verifica in Godot (es. uno script non attaccato al nodo). */
  indizi: string[];
  previsioni: { id: string; corretta: boolean; commentoHtml: string }[];
  riepilogo: string;
  completata: boolean;
  cartellaUsata?: string;
  errore?: string;
  /** Superato alla seconda esecuzione: la verifica dà esiti diversi da una volta all'altra (vedi consegna in studio.ts). */
  nota?: string;
};

export type Consegna = { cartella?: string; codice?: string; risposte?: Record<string, string> };

export type MessaggioTutor = { id: number; ruolo: "utente" | "tutor"; html: string; testo: string };

export type VoceRipasso = { id: string; domandaHtml: string; codiceHtml: string };
export type Ripasso = { slug: string; titolo: string; voci: VoceRipasso[] };

export type VoceScheda = { chiave: string; testo: string; livello: number | null; nota: string | null };
export type LezioneScheda = { slug: string; numero: string; titolo: string; tipo: string; misure: string; voci: VoceScheda[] };
export type FaseScheda = { slug: string; numero: number; titolo: string; voci: VoceScheda[]; lezioni: LezioneScheda[] };

export type Impostazioni = {
  cartellaProgetti: string;
  chiavi: Record<"groq" | "mistral" | "gemini", boolean>;
  versione: string;
  datiImportati: string | null;
};

export type Aggiornamento = { stato: "nessuno" | "disponibile" | "scaricamento" | "pronto" | "errore"; versione?: string; messaggio?: string };

/** I nomi dei canali. Ogni canale ha un solo modo d'uso: invoke con argomenti controllati nel main. */
export type Api = {
  oggi(): Promise<Oggi>;
  corso(): Promise<FaseCorso[]>;
  lezione(slug: string): Promise<LezioneVista | null>;
  consegna(slug: string, pezzo: string, consegna: Consegna): Promise<EsitoConsegna>;
  preparaPartenza(slug: string, pezzo: string): Promise<{ cartella?: string; spostata?: string; errore?: string }>;
  soluzione(slug: string, pezzo: string): Promise<{ html: string }>;
  analisiCodice(slug: string, pezzo: string, consegna: Consegna, controlli: Controllo[], indizi: string[]): Promise<{ html?: string; righe?: { file?: string; riga?: number | null; problema: string; suggerimento: string }[]; errore?: string }>;
  tutor(slug: string, testo: string, livello: number, pezzo: string | null, codice: string | null): Promise<{ html?: string; errore?: string }>;
  storiaTutor(slug: string, pezzo: string | null): Promise<MessaggioTutor[]>;
  spiegaAltrimenti(slug: string, blocco: string): Promise<{ html?: string; errore?: string }>;
  segnala(slug: string, dove: string): Promise<void>;
  vota(slug: string, voto: number, nota: string): Promise<void>;
  ripassi(): Promise<Ripasso[]>;
  rispondiRipasso(slug: string, risposte: Record<string, string>): Promise<{ esiti: { id: string; corretta: boolean; commentoHtml: string }[]; prossimo: string }>;
  scheda(): Promise<FaseScheda[]>;
  autovaluta(chiave: string, livello: number | null, nota: string): Promise<void>;
  esportaScheda(formato: "md" | "json", fase: string | null): Promise<{ salvato: string | null }>;
  impostazioni(): Promise<Impostazioni>;
  scegliCartellaProgetti(): Promise<string | null>;
  salvaChiave(fornitore: "groq" | "mistral" | "gemini", chiave: string): Promise<{ ok: boolean; errore?: string }>;
  importaVersione1(): Promise<{ ok: boolean; riepilogo: string }>;
  sincronizza(): Promise<StatoSincronizzazione>;
  apriCartella(percorso: string): Promise<void>;
  apriLink(url: string): Promise<void>;
  aggiornamento(): Promise<Aggiornamento>;
  installaAggiornamento(): Promise<void>;
  /**
   * Avvisi dal programma (sincronizzazione finita, aggiornamento pronto). `cambiate`: per «sincronizzato», le lezioni
   * appena scaricate (vuoto se non è arrivato niente); per «aggiornamento» sempre vuoto. Restituisce la funzione per
   * smettere di ascoltare.
   */
  suEvento(evento: "sincronizzato" | "aggiornamento", funzione: (cambiate: string[]) => void): () => void;
};
