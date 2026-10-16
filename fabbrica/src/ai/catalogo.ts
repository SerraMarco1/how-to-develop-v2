// I fornitori e i modelli che la fabbrica può usare. Tutti gratuiti; ciascuno si attiva solo se la sua chiave è nei
// segreti del repository.
//
// Fatti misurati (non stime) che spiegano le scelte, dalla versione 1 della piattaforma:
// - Gemini: 20 richieste al giorno per ogni modello Flash, e tre «secchi» soli (gemini-3.5-flash consuma le richieste di
//   gemini-3.6-flash; gemini-flash-latest è servito da gemini-3.8-flash): circa 60 richieste al giorno in tutto.
//   Il giorno di Gemini va da mezzanotte a mezzanotte in California (le 09:00 italiane), non quando dice il suo errore.
//   I rifiuti per sovraccarico (503) CONTANO tra le richieste del giorno. Flash-Lite ne concede 500 e scrive peggio.
// - Mistral: nel piano gratuito Medium, Small e Magistral hanno limite 0 (provato il 15 ottobre 2026): non c'è.
// - OpenRouter: circa 50 richieste al giorno sui modelli gratuiti, per account. NVIDIA: circa 40 al minuto, condizioni
//   «di valutazione». Nessuno dei due è stato ancora misurato su queste lezioni: scrivono solo dopo una prova.

export type Ruolo = "scrittore" | "revisore" | "ritocco" | "ripasso";

export type Fornitore = {
  id: string;
  nome: string;
  baseUrl: string;
  /** Fuso orario alla cui mezzanotte si azzerano le richieste del giorno. Se manca: mezzanotte UTC. */
  azzeramentoFuso?: string;
  modalitaJson: boolean;
  /** Il fornitore può usare i dati ricevuti per addestrare. Per la fabbrica conta poco: le lezioni sono pubbliche. */
  addestra: boolean;
};

export const FORNITORI: Fornitore[] = [
  { id: "gemini", nome: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", azzeramentoFuso: "America/Los_Angeles", modalitaJson: true, addestra: true },
  { id: "openrouter", nome: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", modalitaJson: false, addestra: true },
  { id: "nvidia", nome: "NVIDIA", baseUrl: "https://integrate.api.nvidia.com/v1", modalitaJson: false, addestra: true },
  { id: "groq", nome: "Groq", baseUrl: "https://api.groq.com/openai/v1", modalitaJson: true, addestra: false },
];

export type Modello = {
  fornitore: string;
  modello: string;
  ruoli: Ruolo[];
  /** 1 = debole … 5 = ottimo. */
  qualita: number;
  /** Richieste al minuto e al giorno concesse (se il fornitore le conta). */
  rpm?: number;
  rpd?: number;
  /** Token massimi (domanda + risposta) per richiesta. */
  maxToken?: number;
  /**
   * Scrive e rivede lezioni solo se è nell'elenco dei modelli approvati (stato/fabbrica.json → scrittoriApprovati),
   * dopo una prova con gli stessi controlli (lezione/prova-scrittura.ts). Gemini Flash è approvato dalla versione 1.
   */
  scritturaDaApprovare?: boolean;
  /** Altri nomi che consumano le stesse richieste del giorno di questo modello. */
  stessoLimiteDi?: string;
};

export const MODELLI: Modello[] = [
  { fornitore: "gemini", modello: "gemini-flash-latest", ruoli: ["scrittore", "revisore"], qualita: 5, rpm: 5, rpd: 20, maxToken: 200_000 },
  { fornitore: "gemini", modello: "gemini-3.7-flash", ruoli: ["scrittore", "revisore"], qualita: 4, rpm: 5, rpd: 20, maxToken: 200_000 },
  { fornitore: "gemini", modello: "gemini-3.6-flash", ruoli: ["scrittore", "revisore"], qualita: 4, rpm: 5, rpd: 20, maxToken: 200_000 },
  // Senza `rpd`: il suo limite (500) è lontano. Fa la prima correzione di un pezzo bocciato (Godot giudica il risultato)
  // e le domande di ripasso (Godot calcola le risposte giuste).
  { fornitore: "gemini", modello: "gemini-flash-lite-latest", ruoli: ["ritocco", "ripasso", "revisore"], qualita: 3, rpm: 15, maxToken: 200_000 },
  { fornitore: "openrouter", modello: "openai/gpt-oss-120b:free", ruoli: ["scrittore", "revisore", "ritocco"], qualita: 4, rpm: 20, rpd: 50, maxToken: 60_000, scritturaDaApprovare: true },
  { fornitore: "nvidia", modello: "deepseek-ai/deepseek-v3.1", ruoli: ["scrittore", "revisore", "ritocco"], qualita: 4, rpm: 40, maxToken: 100_000, scritturaDaApprovare: true },
  { fornitore: "nvidia", modello: "openai/gpt-oss-120b", ruoli: ["scrittore", "revisore", "ritocco"], qualita: 4, rpm: 40, maxToken: 100_000, scritturaDaApprovare: true },
  // Groq non addestra sui dati ma accetta solo richieste piccole (8000 token al minuto): ripasso e piccole correzioni.
  { fornitore: "groq", modello: "openai/gpt-oss-120b", ruoli: ["ripasso", "ritocco"], qualita: 4, rpm: 30, rpd: 1000, maxToken: 8000 },
];

/** Qualità minima per ruolo: chi scrive o rivede una lezione deve essere capace; per le correzioni giudica Godot. */
export const QUALITA_MINIMA: Record<Ruolo, number> = { scrittore: 4, revisore: 4, ritocco: 3, ripasso: 3 };

export function fornitore(id: string): Fornitore {
  const f = FORNITORI.find((x) => x.id === id);
  if (!f) throw new Error(`Fornitore sconosciuto: ${id}`);
  return f;
}

export const nomeModello = (m: Pick<Modello, "fornitore" | "modello">) => `${m.fornitore}/${m.modello}`;
