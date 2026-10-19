import fs from "node:fs";
import path from "node:path";
import { cercaDocumentazione, formattaDocumentazione } from "@htd/condiviso/documentazione.ts";
import { catalogoImmagini } from "@htd/condiviso/motore.ts";
import { CatalogoSchema, FORMATO, PaccoLezioneSchema, type Catalogo, type PaccoLezione } from "@htd/condiviso/pacchetto.ts";
import { lezioniDelCorso, leggiPiano, type LezioneNelCorso, type ProgettoDiFase } from "@htd/condiviso/piano.ts";
import type { StatoProgetto } from "@htd/condiviso/schemi.ts";
import { documentazioneHarness, stileDiCasa } from "./ai/prompt.ts";
import { leggiJson } from "./archivio.ts";
import { CONFIG } from "./configurazione.ts";
import { assetPerPrompt, impostazioniEditorPerPrompt, paroleDi } from "./lezione/esercizio.ts";
import { progettoVuoto } from "./lezione/pratica.ts";

// Il corso visto dalla fabbrica: il piano (l'ordine delle lezioni) e il catalogo (le lezioni già pubblicate).

export function catalogo(): Catalogo {
  const dati = leggiJson<unknown>("catalogo.json", null);
  if (!dati) return { formato: FORMATO, aggiornato: new Date(0).toISOString(), lezioniNelPiano: lezioniDelCorso().length, lezioni: [], documentazione: null };
  return CatalogoSchema.parse(dati);
}

export function paccoPubblicato(slug: string): PaccoLezione | null {
  const voce = catalogo().lezioni.find((l) => l.slug === slug);
  if (!voce) return null;
  return PaccoLezioneSchema.parse(leggiJson<unknown>(voce.file, null));
}

/** Tutti i testi dentro un valore (stringhe di oggetti e liste, a qualunque profondità). */
function testiDentro(valore: unknown, uscita: string[] = []): string[] {
  if (typeof valore === "string") uscita.push(valore);
  else if (Array.isArray(valore)) for (const v of valore) testiDentro(v, uscita);
  else if (valore && typeof valore === "object") for (const v of Object.values(valore)) testiDentro(v, uscita);
  return uscita;
}

/** I testi della teoria di una lezione (testo, codice, didascalie). */
export function testiDellaTeoria(blocchi: unknown[]): string[] {
  return testiDentro(blocchi);
}

/** I testi che chi studia ha visto in una lezione finita: teoria, consegne, passi e codice delle soluzioni. */
export function testiVisti(contenuto: Pick<PaccoLezione["contenuto"], "blocchi" | "esercizi" | "test">): string[] {
  return [...testiDentro(contenuto.blocchi), ...[...contenuto.esercizi, contenuto.test].flatMap((e) => [e.consegna, ...e.passiGuida, ...e.soluzione.file.map((f) => f.contenuto)])];
}

/**
 * Le parole che chi studia ha già visto prima di una lezione: teoria, consegne, passi e soluzioni delle lezioni
 * pubblicate che la precedono nel corso (vedi problemaNonSpiegato in lezione/esercizio.ts).
 */
export function paroleDelleLezioniPrima(lezione: LezioneNelCorso): Set<string> {
  const testi: string[] = [];
  for (const l of lezioniDelCorso()) {
    if (l.indice >= lezione.indice) break;
    const p = paccoPubblicato(l.slug);
    if (p) testi.push(...testiVisti(p.contenuto));
  }
  return paroleDi(...testi);
}

/** La prima lezione del piano non ancora pubblicata. */
export function prossimaLezione(): LezioneNelCorso | null {
  const pubblicate = new Set(catalogo().lezioni.map((l) => l.slug));
  return lezioniDelCorso().find((l) => !pubblicate.has(l.slug)) ?? null;
}

/** Lo stato finale dell'ultima lezione pubblicata di una fase (`tappe`: delle tappe del progetto di fine fase). */
function ultimoStato(slugFase: string, tappe: boolean): StatoProgetto | null {
  const lezioni = lezioniDelCorso().filter((l) => l.fase.slug === slugFase && (l.tipo === "progetto") === tappe).reverse();
  for (const l of lezioni) {
    const stato = paccoPubblicato(l.slug)?.statoFinale;
    if (stato) return stato;
  }
  return null;
}

/** Il progetto da cui parte una lezione: com'era alla fine della lezione prima nella stessa catena, oppure nuovo. */
export function statoDiPartenza(lezione: LezioneNelCorso): StatoProgetto {
  const tappa = lezione.tipo === "progetto";
  const previsto: ProgettoDiFase = (tappa ? lezione.fase.provaProgetto : lezione.fase.progetto) ?? { nome: lezione.fase.titolo, cartella: lezione.fase.slug };
  const precedenti = lezioniDelCorso().filter((l) => l.fase.slug === lezione.fase.slug && l.posizione < lezione.posizione && (l.tipo === "progetto") === tappa).reverse();
  for (const l of precedenti) {
    const stato = paccoPubblicato(l.slug)?.statoFinale;
    if (stato) return { ...stato, nome: previsto.nome, cartella: previsto.cartella };
  }
  if (previsto.continuaDa) {
    const daProva = previsto.continuaDa.startsWith("prova:");
    const altra = ultimoStato(previsto.continuaDa.replace(/^prova:/, ""), daProva);
    if (altra) return { ...altra, nome: previsto.nome, cartella: previsto.cartella, progetto: { ...altra.progetto, nome: previsto.nome } };
  }
  return progettoVuoto(previsto.nome, previsto.cartella);
}

/** Cosa chi studia ha già imparato prima di questa lezione: le lezioni vicine in dettaglio, le altre per titolo. */
export function giaInsegnato(lezione: LezioneNelCorso): string {
  const tutte = lezioniDelCorso();
  const prima = tutte.filter((l) => l.indice < lezione.indice);
  if (prima.length === 0) return "Niente: questa è la prima lezione del corso. Non ha ancora mai usato Godot.";
  const vicine = prima.slice(-6).map((l) => {
    const p = paccoPubblicato(l.slug);
    return p ? `- ${l.titolo}: ${p.contenuto.sommario} (concetti: ${p.contenuto.concetti.join(", ")})` : `- ${l.titolo}: ${l.costruisci}`;
  });
  const piano = leggiPiano();
  const percorso = piano.fasi
    .map((f, i) => ({ f, i, titoli: prima.filter((l) => l.fase.slug === f.slug).map((l) => l.titolo) }))
    .filter((x) => x.titoli.length > 0)
    .map((x, k, arr) => {
      const vicino = k >= arr.length - 2;
      const titoli = x.titoli.join("; ");
      return `- ${x.f.titolo}: ${vicino || titoli.length <= 260 ? titoli : `${titoli.slice(0, 260)}…`}`;
    })
    .join("\n");
  return `Lezioni più vicine (in dettaglio):\n${vicine.join("\n")}\n\nTutte le lezioni già completate, nell'ordine del corso:\n${percorso}`;
}

/** Cosa il corso insegnerà DOPO questa lezione: il modello non deve usarlo (altrimenti chiede cose spiegate più avanti). */
export function nonAncoraInsegnato(lezione: LezioneNelCorso): string {
  const dopo = lezioniDelCorso().filter((l) => l.indice > lezione.indice);
  if (dopo.length === 0) return "Niente: questa è l'ultima lezione del corso.";
  const stessaFase = dopo.filter((l) => l.fase.slug === lezione.fase.slug).map((l) => l.titolo);
  const fasiDopo = leggiPiano().fasi.slice(lezione.numeroFase + 1);
  const prossima = fasiDopo[0];
  return [
    stessaFase.length ? `- Più avanti in questa fase: ${stessaFase.join("; ")}` : "",
    prossima ? `- Fase successiva, "${prossima.titolo}": ${prossima.lezioni.map((l) => l.titolo).join("; ")}` : "",
    fasiDopo.length > 1 ? `- Fasi ancora più avanti: ${fasiDopo.slice(1).map((f) => f.titolo).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

let profilo: string | null = null;
function profiloStudente(): string {
  profilo ??= fs.readFileSync(path.join(CONFIG.repo, "fabbrica", "profilo-studente.md"), "utf8").trim();
  return profilo;
}

export function immaginiPerPrompt(): string {
  const voci = catalogoImmagini();
  if (voci.length === 0) return "Nessuna immagine disponibile: non usare blocchi `immagine`.";
  return voci.map((i) => `- \`${i.id}\` — ${i.titolo}: ${i.descrizione}`).join("\n");
}

/** I valori comuni a tutti i prompt di una lezione. */
export function valoriLezione(lezione: LezioneNelCorso): Record<string, string> {
  const tappa = lezione.tipo === "progetto";
  return {
    profilo: profiloStudente(),
    titolo_modulo: lezione.fase.titolo,
    titolo_competenza: lezione.titolo,
    descrizione_competenza: lezione.costruisci,
    tipo_competenza: tappa ? "tappa del progetto di fine fase" : lezione.tipo === "metodo" ? "lezione di metodo" : "lezione",
    obiettivi: lezione.impari.map((o) => `- ${o}`).join("\n"),
    costruisci: lezione.costruisci,
    verifica: lezione.verifica,
    gioco: (tappa ? lezione.fase.prova : lezione.fase.gioco) ?? "",
    gia_insegnato: giaInsegnato(lezione),
    non_ancora: nonAncoraInsegnato(lezione),
    note_modulo: lezione.fase.descrizione,
    stile: stileDiCasa(),
    documentazione: formattaDocumentazione(cercaDocumentazione(`${lezione.titolo} ${lezione.parole.join(" ")}`, { guide: 8, classi: 2, maxCaratteri: 16000, prefissi: lezione.fase.sezioniDocumentazione })),
    harness: documentazioneHarness(),
    asset: assetPerPrompt(),
    immagini: immaginiPerPrompt(),
    impostazioni_editor: impostazioniEditorPerPrompt(),
  };
}
