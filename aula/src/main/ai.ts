import type { z } from "zod";
import { estraiJson } from "@htd/condiviso/json.ts";
import { adesso, database } from "./db.ts";
import { leggiChiave, type FornitoreAula } from "./impostazioni.ts";

// I modelli che usa l'aula: tutor, analisi del codice, spiegazioni alternative. Qui passano le tue domande e il tuo
// codice, quindi si preferiscono i fornitori che non addestrano sui dati (Groq per contratto, Mistral con
// l'addestramento spento); Gemini Flash-Lite è la riserva. I modelli Flash di Gemini non si usano mai qui: le loro
// poche richieste al giorno servono alla fabbrica per scrivere le lezioni.

type Modello = { fornitore: FornitoreAula; modello: string; baseUrl: string; maxToken: number; json: boolean };

const MODELLI: Modello[] = [
  { fornitore: "groq", modello: "openai/gpt-oss-120b", baseUrl: "https://api.groq.com/openai/v1", maxToken: 8000, json: true },
  { fornitore: "mistral", modello: "ministral-14b-latest", baseUrl: "https://api.mistral.ai/v1", maxToken: 64000, json: true },
  { fornitore: "gemini", modello: "gemini-flash-lite-latest", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", maxToken: 200000, json: true },
];

export type Messaggio = { role: "system" | "user" | "assistant"; content: string };

/** Modelli fermi per un po' dopo un rifiuto (in memoria: basta per la durata del programma). */
const fermi = new Map<string, number>();

function stimaToken(messaggi: Messaggio[]): number {
  return Math.ceil(messaggi.reduce((t, m) => t + m.content.length, 0) / 3.2);
}

function registra(m: Modello, ruolo: string, ok: boolean, errore?: string): void {
  try {
    database().prepare("INSERT INTO chiamate_ai (quando, fornitore, modello, ruolo, ok, errore) VALUES (?, ?, ?, ?, ?, ?)").run(adesso(), m.fornitore, m.modello, ruolo, ok ? 1 : 0, errore?.slice(0, 300) ?? null);
  } catch {
    // Il registro non deve fermare una risposta.
  }
}

export class NessunModello extends Error {}

/**
 * Chiede una risposta al primo modello disponibile. Con `schema`, la risposta deve essere JSON valido secondo lo schema.
 * Restituisce il testo (o i dati) e il nome del modello che ha risposto.
 */
export async function chiedi<T = string>(opzioni: { ruolo: string; messaggi: Messaggio[]; maxTokens: number; temperatura?: number; schema?: z.ZodType<T> }): Promise<{ dati: T; testo: string; modello: string }> {
  const stimati = stimaToken(opzioni.messaggi) + opzioni.maxTokens;
  const errori: string[] = [];
  let configurati = 0;
  for (const m of MODELLI) {
    const chiave = leggiChiave(m.fornitore);
    if (!chiave) continue;
    configurati++;
    const nome = `${m.fornitore}/${m.modello}`;
    if ((fermi.get(nome) ?? 0) > Date.now() || stimati > m.maxToken) continue;
    try {
      const corpo: Record<string, unknown> = { model: m.modello, messages: opzioni.messaggi, max_tokens: opzioni.maxTokens, temperature: opzioni.temperatura ?? 0.4 };
      if (opzioni.schema && m.json) corpo.response_format = { type: "json_object" };
      if (m.modello.includes("gpt-oss")) corpo.reasoning_effort = "low";
      if (m.fornitore === "gemini") {
        corpo.reasoning_effort = "low";
        corpo.max_tokens = opzioni.maxTokens + 1500;
      }
      const risposta = await fetch(`${m.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${chiave}` },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(120_000),
      });
      const testo = await risposta.text();
      if (!risposta.ok) {
        const attesa = risposta.status === 401 || risposta.status === 403 ? 3600_000 : risposta.status === 429 || risposta.status >= 500 ? 300_000 : 60_000;
        fermi.set(nome, Date.now() + attesa);
        throw new Error(`HTTP ${risposta.status}`);
      }
      const contenuto = (JSON.parse(testo) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content?.trim() ?? "";
      if (!contenuto) throw new Error("risposta vuota");
      if (!opzioni.schema) {
        registra(m, opzioni.ruolo, true);
        return { dati: contenuto as T, testo: contenuto, modello: nome };
      }
      const esito = opzioni.schema.safeParse(estraiJson(contenuto));
      if (!esito.success) throw new Error("risposta nel formato sbagliato");
      registra(m, opzioni.ruolo, true);
      return { dati: esito.data, testo: contenuto, modello: nome };
    } catch (errore) {
      const messaggio = (errore as Error).name === "TimeoutError" ? "nessuna risposta entro 2 minuti" : (errore as Error).message;
      registra(m, opzioni.ruolo, false, messaggio);
      errori.push(`${nome}: ${messaggio}`);
    }
  }
  if (configurati === 0) throw new NessunModello("Per il tutor serve almeno una chiave (Groq, Mistral o Gemini): aggiungila in Impostazioni.");
  throw new NessunModello(`Nessun modello ha risposto in questo momento (${errori.join("; ") || "tutti in pausa dopo un rifiuto"}). Riprova tra qualche minuto.`);
}
