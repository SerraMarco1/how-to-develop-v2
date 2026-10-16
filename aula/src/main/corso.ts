import path from "node:path";
import { PaccoLezioneSchema, type PaccoLezione } from "@htd/condiviso/pacchetto.ts";
import { leggiPiano, lezioniDelCorso, type LezioneNelCorso } from "@htd/condiviso/piano.ts";
import type { Esercizio } from "@htd/condiviso/schemi.ts";
import type { FaseCorso, StatoLezione, VoceCorso } from "../comune/api.ts";
import { database } from "./db.ts";
import { cartellaProgetti } from "./impostazioni.ts";

// Il corso visto dall'aula: il piano (nel pacchetto del motore installato con il programma), le lezioni scaricate e i
// tuoi progressi. Il corso è una strada sola: una lezione si apre quando hai completato quella prima.

const cache = new Map<string, { sha: string; pacco: PaccoLezione }>();

/** La lezione scaricata (già controllata quando è stata scaricata, e ricontrollata qui nel formato). */
export function pacco(slug: string): PaccoLezione | null {
  const riga = database().prepare("SELECT sha256, pacco FROM lezioni WHERE slug = ?").get(slug) as { sha256: string; pacco: string } | undefined;
  if (!riga) return null;
  const inCache = cache.get(slug);
  if (inCache?.sha === riga.sha256) return inCache.pacco;
  const p = PaccoLezioneSchema.parse(JSON.parse(riga.pacco));
  cache.set(slug, { sha: riga.sha256, pacco: p });
  return p;
}

function versioni(): Map<string, number> {
  return new Map((database().prepare("SELECT slug, versione FROM lezioni").all() as { slug: string; versione: number }[]).map((r) => [r.slug, r.versione]));
}

function completate(): Set<string> {
  return new Set((database().prepare("SELECT slug FROM progressi WHERE stato = 'completata'").all() as { slug: string }[]).map((r) => r.slug));
}

/** Ogni lezione del piano con il suo stato, nell'ordine del corso. */
export function voci(): (VoceCorso & { lezione: LezioneNelCorso })[] {
  const pronte = versioni();
  const fatte = completate();
  let precedenteFatta = true;
  return lezioniDelCorso().map((l) => {
    const versione = pronte.get(l.slug) ?? null;
    let stato: StatoLezione;
    if (fatte.has(l.slug)) stato = "completata";
    else if (versione === null) stato = "in_arrivo";
    else stato = precedenteFatta ? "disponibile" : "bloccata";
    precedenteFatta = fatte.has(l.slug);
    return { slug: l.slug, numero: l.numero, titolo: l.titolo, tipo: l.tipo, minuti: l.minuti, stato, versione, lezione: l };
  });
}

export function corso(): FaseCorso[] {
  const tutte = voci();
  return leggiPiano().fasi.map((f, numero) => ({
    slug: f.slug,
    numero,
    titolo: f.titolo,
    descrizione: f.descrizione,
    gioco: f.gioco,
    prova: f.prova,
    lezioni: tutte.filter((v) => v.lezione.fase.slug === f.slug).map(({ lezione: _l, ...v }) => v),
  }));
}

/** La lezione da studiare adesso (la prima disponibile), oppure quella che si aspetta. */
export function prossima(): { lezione: VoceCorso | null; inAttesa: VoceCorso | null } {
  const tutte = voci();
  const lezione = tutte.find((v) => v.stato === "disponibile") ?? null;
  const primaNonFatta = tutte.find((v) => v.stato !== "completata") ?? null;
  return { lezione, inAttesa: !lezione && primaNonFatta?.stato === "in_arrivo" ? primaNonFatta : null };
}

/** Si può aprire una lezione: è scaricata e quella prima è completata (o è la prima). */
export function apribile(slug: string): boolean {
  const v = voci().find((x) => x.slug === slug);
  return Boolean(v && (v.stato === "disponibile" || v.stato === "completata"));
}

const pulisci = (nome: string) => nome.replace(/[^\w.-]+/g, "-").replace(/^[.-]+/, "") || "progetto";

/**
 * La cartella in cui lavori a un esercizio: il gioco di una fase sta in «giochi/<nome>» (cresce di lezione in lezione,
 * a volte attraverso più fasi); gli esercizi a parte nella cartella della loro fase. Come nella versione 1.
 */
export function cartellaDiLavoro(lezione: Pick<PaccoLezione, "fase">, esercizio: Pick<Esercizio, "dove" | "cartella" | "id">): string {
  const nome = pulisci(esercizio.cartella ?? esercizio.id ?? "progetto");
  if (esercizio.dove === "gioco") return path.join(cartellaProgetti(), "giochi", nome);
  const fasi = leggiPiano().fasi;
  const numero = Math.max(0, fasi.findIndex((f) => f.slug === lezione.fase));
  return path.join(cartellaProgetti(), `${String(numero).padStart(2, "0")}-${pulisci(lezione.fase)}`, nome);
}
