import { previsioneGiusta } from "@htd/condiviso/previsioni.ts";
import type { Ripasso } from "../comune/api.ts";
import { pacco } from "./corso.ts";
import { adesso, database } from "./db.ts";
import { codiceHtml, markdownHtml } from "./testo.ts";

// Il ripasso a intervalli crescenti (lo stesso principio di Anki): ogni lezione completata torna dopo qualche giorno,
// poi sempre più tardi se la ricordi bene, prima se no. Le voci sono previsioni (codice da leggere, risultato da
// scrivere) preparate dalla fabbrica con le risposte calcolate da Godot.

const GIORNO = 24 * 3600 * 1000;

type RigaRipasso = { slug: string; scadenza: string; intervallo: number; facilita: number; ripetizioni: number; errori: number };

export function programmaPrimoRipasso(slug: string, aiutoUsato: number): void {
  const giorni = aiutoUsato >= 3 ? 1 : 2;
  database().prepare("INSERT INTO ripassi (slug, scadenza, intervallo, facilita) VALUES (?, ?, ?, 2.5) ON CONFLICT(slug) DO NOTHING").run(slug, new Date(Date.now() + giorni * GIORNO).toISOString(), giorni);
}

function dovuti(): RigaRipasso[] {
  return (database().prepare("SELECT * FROM ripassi WHERE scadenza <= ? ORDER BY scadenza").all(adesso()) as RigaRipasso[]).filter((r) => (pacco(r.slug)?.ripasso.length ?? 0) > 0);
}

export function quantiRipassiDovuti(): number {
  return dovuti().length;
}

export async function ripassi(): Promise<Ripasso[]> {
  return Promise.all(
    dovuti().map(async (r) => {
      const p = pacco(r.slug)!;
      return { slug: r.slug, titolo: `${p.numero} ${p.contenuto.titolo}`, voci: await Promise.all(p.ripasso.map(async (v) => ({ id: v.id ?? "", domandaHtml: await markdownHtml(v.domanda), codiceHtml: await codiceHtml(v.codice) }))) };
    }),
  );
}

/** Corregge le risposte di un ripasso e decide quando tornerà (algoritmo SM-2 semplificato). */
export async function rispondiRipasso(slug: string, risposte: Record<string, string>): Promise<{ esiti: { id: string; corretta: boolean; commentoHtml: string }[]; prossimo: string }> {
  const r = database().prepare("SELECT * FROM ripassi WHERE slug = ?").get(slug) as RigaRipasso | undefined;
  const p = pacco(slug);
  if (!r || !p) return { esiti: [], prossimo: "" };
  const esiti = await Promise.all(
    p.ripasso.map(async (v) => {
      const corretta = previsioneGiusta(v.risposta, risposte[v.id ?? ""] ?? "");
      return { id: v.id ?? "", corretta, commentoHtml: await markdownHtml(`${corretta ? "Giusto." : `Il risultato vero è \`${v.risposta}\`.`} ${v.spiegazione}`) };
    }),
  );
  const punteggio = esiti.length ? esiti.filter((e) => e.corretta).length / esiti.length : 1;
  let { intervallo, facilita, ripetizioni, errori } = r;
  if (punteggio >= 0.8) {
    ripetizioni += 1;
    intervallo = ripetizioni === 1 ? 3 : Math.round(intervallo * facilita * 10) / 10;
    facilita = Math.min(2.8, facilita + 0.1);
  } else if (punteggio >= 0.5) {
    intervallo = Math.max(1, Math.round(intervallo * 1.2 * 10) / 10);
    facilita = Math.max(1.3, facilita - 0.15);
  } else {
    errori += 1;
    ripetizioni = 0;
    intervallo = 1;
    facilita = Math.max(1.3, facilita - 0.2);
  }
  const scadenza = new Date(Date.now() + intervallo * GIORNO);
  database().prepare("UPDATE ripassi SET scadenza = ?, intervallo = ?, facilita = ?, ripetizioni = ?, errori = ?, ultimo = ? WHERE slug = ?").run(scadenza.toISOString(), intervallo, facilita, ripetizioni, errori, adesso(), slug);
  return { esiti, prossimo: scadenza.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) };
}
