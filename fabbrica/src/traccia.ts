import { aggiungiRiga, elenco, leggiRighe, scriviJson } from "./archivio.ts";
import { chiamateDelGiro } from "./ai/router.ts";
import { nascondiSegreti } from "./configurazione.ts";

// Il registro della scrittura delle lezioni. Ogni cosa che la fabbrica fa per una lezione diventa un passaggio: cosa ha
// fatto, su quale pezzo, com'è andata e, se è andata male, di che genere di guasto si tratta e come ha reagito.
//
//   tracce/<lezione>/registro.jsonl            una riga per passaggio (il racconto)
//   tracce/<lezione>/<NNNN>-<pezzo>-<azione>.json   i dati completi (richiesta, risposta, controlli falliti)
//
// Il racconto è in italiano e va letto da una persona; i dati servono a rifare l'analisi. Le chiavi non ci finiscono mai.

export type Pezzo = "lezione" | "teoria" | "pratica" | "test" | "ripasso" | `es${number}`;

/**
 * I quattro generi di guasto, ognuno con la sua reazione:
 * - "fornitore": il modello non ha risposto. Si aspetta e si riprende dallo stesso punto.
 * - "formato": ha risposto, ma non nel formato chiesto. Si ripara o si chiede la correzione del formato.
 * - "contenuto": il formato è giusto, ma un controllo non è superato. Si corregge solo quel pezzo.
 * - "piattaforma": si è rotto qualcosa nel programma. Ci si ferma: riprovare consumerebbe richieste per niente.
 */
export type Guasto = "fornitore" | "formato" | "contenuto" | "piattaforma";

export type Passaggio = {
  slug: string;
  pezzo: Pezzo;
  azione: string;
  esito: "ok" | "fallito" | "saltato" | "attesa";
  guasto?: Guasto;
  titolo: string;
  spiegazione: string;
  modello?: string;
  /** Quando è cominciato il passaggio (ms): serve a contare le richieste fatte da allora. */
  dalle?: number;
  dati?: unknown;
};

export type RigaRegistro = {
  n: number;
  quando: string;
  pezzo: Pezzo;
  azione: string;
  esito: Passaggio["esito"];
  guasto?: Guasto;
  titolo: string;
  spiegazione: string;
  modello?: string;
  richieste: number;
  durataMs?: number;
  dati?: string;
};

const numeri = new Map<string, number>();

function prossimoNumero(slug: string): number {
  if (!numeri.has(slug)) numeri.set(slug, leggiRighe<RigaRegistro>(`tracce/${slug}/registro.jsonl`).reduce((m, r) => Math.max(m, r.n), 0));
  const n = numeri.get(slug)! + 1;
  numeri.set(slug, n);
  return n;
}

/** Scrive un passaggio nel registro. Non lancia mai errori: il registro non deve poter fermare la generazione. */
export function registra(p: Passaggio): void {
  try {
    const n = prossimoNumero(p.slug);
    const chiamate = p.dalle ? chiamateDelGiro.filter((c) => c.slug === p.slug && c.quando >= p.dalle!) : [];
    const tentativi = chiamate.map((c) => `${c.modello}: ${c.ok ? `risposta in ${Math.round(c.durataMs / 1000)} s (${c.tokenInput ?? "?"} → ${c.tokenOutput ?? "?"} token)` : (c.errore ?? "errore").replace(/\s+/g, " ").slice(0, 160)}`);
    const nomeDati = p.dati !== undefined || tentativi.length ? `${String(n).padStart(4, "0")}-${p.pezzo}-${p.azione}.json` : undefined;
    const riga: RigaRegistro = {
      n,
      quando: new Date().toISOString(),
      pezzo: p.pezzo,
      azione: p.azione,
      esito: p.esito,
      guasto: p.guasto,
      titolo: nascondiSegreti(p.titolo).slice(0, 200),
      spiegazione: nascondiSegreti(p.spiegazione).slice(0, 6000),
      modello: p.modello,
      richieste: chiamate.filter((c) => c.contata).length,
      durataMs: p.dalle ? Date.now() - p.dalle : undefined,
      dati: nomeDati,
    };
    aggiungiRiga(`tracce/${p.slug}/registro.jsonl`, riga);
    if (nomeDati) {
      const dati = JSON.parse(nascondiSegreti(JSON.stringify({ ...riga, chiamate: tentativi, dati: p.dati ?? null })));
      scriviJson(`tracce/${p.slug}/${nomeDati}`, dati);
    }
  } catch (errore) {
    console.error(`Registro: passaggio non scritto (${(errore as Error).message})`);
  }
}

export function registroDiLezione(slug: string): RigaRegistro[] {
  return leggiRighe<RigaRegistro>(`tracce/${slug}/registro.jsonl`);
}

/** Quante richieste del giorno è costata finora una lezione, sommando tutto il registro. */
export function costoLezione(slug: string): number {
  return registroDiLezione(slug).reduce((s, r) => s + (r.richieste ?? 0), 0);
}

export function lezioniConTracce(): string[] {
  return elenco("tracce");
}
