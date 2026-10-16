import type { Media } from "@htd/condiviso/pacchetto.ts";
import { percorsoMedia } from "@htd/condiviso/pacchetto.ts";
import { lezioniDelCorso, type LezioneNelCorso } from "@htd/condiviso/piano.ts";
import type { Lezione, Previsione, StatoProgetto } from "@htd/condiviso/schemi.ts";
import { cancella, elenco, leggiJson, percorsoDati, salva } from "./archivio.ts";
import { statoDiPartenza } from "./corso.ts";
import { controllaPezzo, statoDopo } from "./lezione/pratica.ts";
import { pubblicaLezione } from "./lezione/pubblica.ts";
import { controllaTempo } from "./tempo.ts";
import { registra } from "./traccia.ts";

// Le lezioni scritte dalla versione 1 della piattaforma, portate qui (importate/<lezione>.json) e ricontrollate prima
// di essere pubblicate. Il ricontrollo è quello di un esercizio appena scritto: codice sicuro, soluzione che supera le
// verifiche in Godot, verifiche che falliscono sul lavoro non fatto, risposte delle previsioni ricalcolate. In più la
// catena: la lezione deve partire esattamente dal gioco con cui è finita la precedente.
// Se qualcosa non va, la lezione (e quelle importate che partivano dal suo gioco) viene riscritta dalla fabbrica.

export type LezioneImportata = {
  slug: string;
  contenuto: Lezione;
  statoFinale: StatoProgetto | null;
  ripasso: Previsione[];
  /** I video già registrati dalla versione 1: "video:<blocco>" → file in media/. */
  media: Record<string, Media>;
  pubblicata: string;
  modelli: string[];
};

export function importataDa(slug: string): LezioneImportata | null {
  return leggiJson<LezioneImportata | null>(`importate/${slug}.json`, null);
}

const normalizza = (s: StatoProgetto | null | undefined) =>
  JSON.stringify(
    (s?.file ?? [])
      .filter((f) => f.percorso !== "project.godot")
      .map((f) => [f.percorso, f.contenuto.replace(/\r\n/g, "\n").trimEnd()])
      .sort(),
  );

/** Butta la lezione importata indicata e quelle importate successive della stessa catena (partivano dal suo gioco). */
function scartaDa(lezione: LezioneNelCorso, motivo: string): void {
  const catena = lezioniDelCorso().filter((l) => l.fase.slug === lezione.fase.slug && l.posizione >= lezione.posizione && (l.tipo === "progetto") === (lezione.tipo === "progetto"));
  const scartate = catena.filter((l) => importataDa(l.slug)).map((l) => l.slug);
  for (const slug of scartate) cancella(`importate/${slug}.json`);
  registra({ slug: lezione.slug, pezzo: "lezione", azione: "ricontrollo", esito: "fallito", guasto: "contenuto", titolo: "Lezione della versione 1: non supera il ricontrollo", spiegazione: `${motivo}\nReazione: la lezione viene riscritta dalla fabbrica${scartate.length > 1 ? `, insieme a quelle importate che partivano dal suo gioco (${scartate.slice(1).join(", ")})` : ""}.` });
}

/** Ricontrolla e, se va tutto bene, pubblica una lezione importata. Restituisce true se è stata pubblicata. */
export async function ricontrollaImportata(lezione: LezioneNelCorso): Promise<boolean> {
  const importata = importataDa(lezione.slug);
  if (!importata) return false;
  const dalle = Date.now();
  const { contenuto } = importata;
  const problemi: string[] = [];

  // La catena: la lezione parte dal gioco con cui è finita la precedente pubblicata.
  const atteso = statoDiPartenza(lezione);
  const usaIlGioco = [...contenuto.esercizi, contenuto.test].some((e) => e.dove === "gioco");
  if (usaIlGioco && normalizza(contenuto.statoIniziale) !== normalizza(atteso)) problemi.push("il gioco da cui parte non è quello con cui finisce la lezione precedente pubblicata");

  let stato: StatoProgetto = contenuto.statoIniziale ?? atteso;
  const esercizi = [...contenuto.esercizi, contenuto.test];
  const ricontrollati = [];
  if (problemi.length === 0) {
    for (const e of esercizi) {
      controllaTempo();
      const { esercizio, problemi: suoi } = await controllaPezzo(e, stato);
      if (suoi.length) problemi.push(...suoi.map((p) => `${e.id}: ${p}`));
      if (e.modalita === "previsioni") {
        const diverse = esercizio.previsioni.filter((p, i) => p.risposta !== e.previsioni[i]?.risposta);
        if (diverse.length) problemi.push(`${e.id}: Godot calcola risposte diverse da quelle salvate (${diverse.map((p) => p.id).join(", ")})`);
      }
      ricontrollati.push(esercizio);
      stato = statoDopo(stato, esercizio);
    }
  }
  if (problemi.length) {
    scartaDa(lezione, `Problemi trovati:\n${problemi.slice(0, 12).map((p) => `- ${p.slice(0, 600)}`).join("\n")}`);
    await salva(`${lezione.numero} ${lezione.slug}: lezione della versione 1 scartata`, { subito: true });
    return false;
  }
  const finale = usaIlGioco ? stato : (importata.statoFinale ?? stato);
  registra({ slug: lezione.slug, pezzo: "lezione", azione: "ricontrollo", esito: "ok", titolo: "Lezione della versione 1: ricontrollo superato", dalle, spiegazione: `${esercizi.length} pezzi ricontrollati in Godot 4.7.2 con le regole della versione 2 (sicurezza, soluzione che passa, verifiche che falliscono prima del lavoro, previsioni ricalcolate). Il gioco di partenza è quello della lezione precedente.` });
  const videoEsistenti = Object.fromEntries(Object.entries(importata.media).filter(([k]) => k.startsWith("video:")).map(([k, m]) => [k.slice("video:".length), percorsoDati(percorsoMedia(m))]));
  await pubblicaLezione(lezione, { lezione: { ...contenuto, esercizi: ricontrollati.filter((e) => e.id !== "test"), test: ricontrollati.find((e) => e.id === "test")! }, statoFinale: finale, modelli: importata.modelli }, { importata: true, ripasso: importata.ripasso.length >= 3 ? importata.ripasso : undefined, videoEsistenti, pubblicata: importata.pubblicata });
  cancella(`importate/${lezione.slug}.json`);
  await salva(`${lezione.numero} ${lezione.slug}: lezione della versione 1 ricontrollata e pubblicata`, { subito: true });
  return true;
}

export function lezioniImportateInAttesa(): string[] {
  return elenco("importate").map((f) => f.replace(/\.json$/, ""));
}
