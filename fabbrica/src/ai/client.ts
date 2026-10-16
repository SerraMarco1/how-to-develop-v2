import { Agent, fetch as fetchUndici } from "undici";
import type { Fornitore } from "./catalogo.ts";

// Le chiamate HTTP ai fornitori, tutte nel formato «compatibile OpenAI».

/**
 * Una connessione senza il limite di 5 minuti di attesa della risposta (resta il tempo massimo complessivo): i modelli
 * che ragionano rispondono tutto insieme dopo minuti di silenzio. Il 12 ottobre 2026 una risposta vera di Gemini è
 * arrivata dopo 429 secondi.
 */
const connessionePaziente = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

const ATTESA_RISPOSTA_MS = 280_000;
/** Per le richieste grandi a Gemini (scrivere o correggere una lezione), con il ragionamento massimo. */
const ATTESA_RAGIONAMENTO_MS = 900_000;

/** Errori di rete in cui la richiesta non è arrivata al fornitore. */
const MAI_PARTITA = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"];

export type Messaggio = { role: "system" | "user" | "assistant"; content: string };

export type RichiestaChat = {
  fornitore: Fornitore;
  chiave: string;
  modello: string;
  messaggi: Messaggio[];
  maxTokens: number;
  temperatura?: number;
  json?: boolean;
  timeoutMs?: number;
  sforzo?: "low" | "medium" | "high";
};

/** `troncata`: il modello si è fermato al limite di token. `tokenRagionamento`: quanti ne ha spesi a ragionare. */
export type RispostaChat = { testo: string; tokenInput?: number; tokenOutput?: number; tokenRagionamento?: number; troncata?: boolean };

/**
 * Lo spazio lasciato a Gemini per ragionare, oltre ai token chiesti per la risposta: ragionamento e risposta escono dallo
 * stesso tetto (il 12 ottobre 2026, con 16.000 token, una richiesta ha ragionato 212 secondi e ha risposto con 45 token).
 */
const SPAZIO_RAGIONAMENTO = { low: 1500, medium: 12000, high: 40000 } as const;
const TETTO_USCITA_GEMINI = 60000;

/** Quanto far ragionare quando chi chiede non lo dice: le richieste grandi scrivono o correggono una lezione. */
export function sforzoPerDimensione(maxTokens: number): "low" | "medium" | "high" {
  return maxTokens < 1500 ? "low" : maxTokens >= 5000 ? "high" : "medium";
}

/** L'errore di una chiamata, con ciò che serve al router per decidere cosa fare. */
export class ErroreAI extends Error {
  stato: number | null;
  riprovaTraSec: number | null;
  troppoGrande: boolean;
  limiteGiornaliero: number | null;
  maiPartita: boolean;
  modelloDelLimite: string | null;
  constructor(
    message: string,
    dati: { stato?: number | null; riprovaTraSec?: number | null; troppoGrande?: boolean; limiteGiornaliero?: number | null; maiPartita?: boolean; modelloDelLimite?: string | null } = {},
  ) {
    super(message);
    this.stato = dati.stato ?? null;
    this.riprovaTraSec = dati.riprovaTraSec ?? null;
    this.troppoGrande = dati.troppoGrande ?? false;
    this.limiteGiornaliero = dati.limiteGiornaliero ?? null;
    this.maiPartita = dati.maiPartita ?? false;
    this.modelloDelLimite = dati.modelloDelLimite ?? null;
  }

  /** La richiesta non consuma quelle del giorno: non è arrivata, o è stata rifiutata perché il limite era già raggiunto. */
  get nonServita(): boolean {
    return this.maiPartita || this.stato === 429;
  }

  /** Sovraccarico o guasto del fornitore (5xx): di solito riguarda tutti i suoi modelli insieme. */
  get sovraccarico(): boolean {
    return this.stato !== null && this.stato >= 500;
  }
}

export async function chat(r: RichiestaChat): Promise<RispostaChat> {
  const corpo: Record<string, unknown> = {
    model: r.modello,
    messages: r.messaggi.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: r.maxTokens,
    temperature: r.temperatura ?? 0.4,
  };
  if (r.json && r.fornitore.modalitaJson) corpo.response_format = { type: "json_object" };
  let attesaMs = r.timeoutMs ?? ATTESA_RISPOSTA_MS;
  if (r.fornitore.id === "gemini") {
    const impegno = r.sforzo ?? sforzoPerDimensione(r.maxTokens);
    corpo.reasoning_effort = impegno;
    corpo.max_tokens = Math.min(TETTO_USCITA_GEMINI, r.maxTokens + SPAZIO_RAGIONAMENTO[impegno]);
    if (r.maxTokens >= 5000) attesaMs = r.timeoutMs ?? ATTESA_RAGIONAMENTO_MS;
  } else if (r.modello.includes("gpt-oss")) {
    // I modelli gpt-oss ragionano: sulle richieste grandi più spazio e più pazienza, su Groq ragionamento contenuto.
    corpo.reasoning_effort = r.fornitore.id === "groq" ? (r.maxTokens < 1500 ? "low" : "medium") : (r.sforzo ?? sforzoPerDimensione(r.maxTokens));
    if (r.maxTokens >= 5000) attesaMs = r.timeoutMs ?? ATTESA_RAGIONAMENTO_MS;
  }

  const invia = async () => {
    try {
      const risposta = await fetchUndici(`${r.fornitore.baseUrl}/chat/completions`, {
        dispatcher: connessionePaziente,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${r.chiave}` },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(attesaMs),
      });
      return { risposta, testo: await risposta.text() };
    } catch (errore) {
      // Tempo scaduto: la richiesta era partita e il fornitore forse la stava lavorando, quindi può averla contata.
      if ((errore as Error).name === "TimeoutError") throw new ErroreAI(`Nessuna risposta entro ${Math.round(attesaMs / 1000)} secondi`, { riprovaTraSec: 30 });
      const codice = ((errore as Error).cause as { code?: string } | undefined)?.code ?? "";
      throw new ErroreAI(`Connessione fallita: ${(errore as Error).message}${codice ? ` (${codice})` : ""}`, { riprovaTraSec: 30, maiPartita: MAI_PARTITA.includes(codice) });
    }
  };
  let { risposta, testo } = await invia();
  // Spazio di ragionamento più grande di quanto il modello concede: Gemini respinge senza lavorare. Si rimanda subito.
  const tettoProvato = r.maxTokens + 16000;
  if (r.fornitore.id === "gemini" && risposta.status === 400 && Number(corpo.max_tokens) > tettoProvato && /max_?(output_?|completion_?)?tokens|output tokens?/i.test(testo)) {
    corpo.max_tokens = tettoProvato;
    ({ risposta, testo } = await invia());
  }
  if (!risposta.ok) throw interpretaErrore(risposta.status, risposta.headers, testo);

  let dati: {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  };
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new ErroreAI(`Risposta del fornitore illeggibile: ${testo.slice(0, 200)}`, { stato: risposta.status, riprovaTraSec: 30 });
  }
  const contenuto = dati.choices?.[0]?.message?.content;
  const troncata = ["length", "max_tokens"].includes(dati.choices?.[0]?.finish_reason ?? "");
  if (!contenuto && !troncata) throw new ErroreAI("Risposta vuota dal modello", { stato: risposta.status, riprovaTraSec: 10 });
  const u = dati.usage;
  const ragionamento = u?.completion_tokens_details?.reasoning_tokens ?? (u?.total_tokens !== undefined && u.prompt_tokens !== undefined && u.completion_tokens !== undefined ? u.total_tokens - u.prompt_tokens - u.completion_tokens : undefined);
  return { testo: contenuto ?? "", tokenInput: u?.prompt_tokens, tokenOutput: u?.completion_tokens, tokenRagionamento: ragionamento !== undefined && ragionamento > 0 ? ragionamento : undefined, troncata };
}

/** I secondi da aspettare scritti nell'errore: Gemini `"retryDelay": "48046s"`, Groq "try again in 3m26.064s". */
export function attesaNelMessaggio(testo: string): number | null {
  const gemini = testo.match(/"retryDelay":\s*"([\d.]+)s"/);
  if (gemini) return Number(gemini[1]);
  const frase = testo.match(/(?:try again|retry) in (?:(\d+)h)?(?:(\d+)m(?!s))?([\d.]+)(ms|s)/i);
  if (frase) return Number(frase[1] ?? 0) * 3600 + Number(frase[2] ?? 0) * 60 + Number(frase[3]) * (frase[4] === "ms" ? 0.001 : 1);
  return null;
}

/** Il limite al giorno scritto nell'errore ("…free_tier_requests, limit: 20"), solo se l'attesa è lunga o si parla di PerDay. */
export function limiteGiornalieroNelMessaggio(testo: string, attesaSec: number): number | null {
  if (attesaSec < 3600 && !/PerDay/i.test(testo)) return null;
  const trovato = testo.match(/_requests,\s*limit:\s*(\d+)/i);
  return trovato ? Number(trovato[1]) : null;
}

/** Il modello a cui il fornitore attribuisce il limite ("…limit: 20, model: gemini-3.6-flash"). */
export function modelloDelLimiteNelMessaggio(testo: string): string | null {
  return testo.match(/_requests,\s*limit:\s*\d+,\s*model:\s*([\w.-]+)/i)?.[1] ?? null;
}

function messaggioFornitore(testo: string): string {
  try {
    const dati = JSON.parse(testo) as unknown;
    const errore = ((Array.isArray(dati) ? dati[0] : dati) as { error?: string | { message?: string } } | null)?.error;
    const messaggio = typeof errore === "string" ? errore : errore?.message;
    if (messaggio) return messaggio.slice(0, 400);
  } catch {
    // Non è JSON.
  }
  return testo.slice(0, 400);
}

export function interpretaErrore(stato: number, intestazioni: { get(nome: string): string | null }, testo: string): ErroreAI {
  const breve = messaggioFornitore(testo);
  const troppoGrande = stato === 413 || /too large|context length|maximum context|tokens per minute|reduce the length|token limit/i.test(testo);
  if (stato === 429 && (intestazioni.get("x-ratelimit-limit-req-minute") === "0" || intestazioni.get("x-ratelimit-limit-requests") === "0")) {
    return new ErroreAI("Piano non attivo: il fornitore concede 0 richieste a questo modello", { stato, riprovaTraSec: 6 * 3600 });
  }
  if (/request too large/i.test(testo)) return new ErroreAI(`HTTP ${stato}: ${breve}`, { stato, troppoGrande: true });
  if ([429, 500, 502, 503, 504].includes(stato)) {
    let attesa = Number(intestazioni.get("retry-after"));
    if (!attesa) attesa = attesaNelMessaggio(testo) ?? (stato === 429 ? 60 : 20);
    const dichiarata = attesa;
    if (/per day|daily|RPD|quota/i.test(testo) && stato === 429) attesa = Math.max(attesa, 3600);
    return new ErroreAI(`HTTP ${stato}: ${breve}`, {
      stato,
      riprovaTraSec: Math.ceil(attesa),
      limiteGiornaliero: stato === 429 ? limiteGiornalieroNelMessaggio(testo, dichiarata) : null,
      modelloDelLimite: stato === 429 ? modelloDelLimiteNelMessaggio(testo) : null,
    });
  }
  return new ErroreAI(`HTTP ${stato}: ${breve}`, { stato, troppoGrande });
}
