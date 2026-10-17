import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { problemiDelPacco } from "@htd/condiviso/controllo-pacco.ts";
import { apriIndice } from "@htd/condiviso/documentazione.ts";
import { CatalogoSchema, PaccoLezioneSchema, percorsoMedia, sha256, StatoPubblicoSchema, type Catalogo, type Media, type StatoPubblico } from "@htd/condiviso/pacchetto.ts";
import type { StatoSincronizzazione } from "../comune/api.ts";
import { adesso, database, leggiImpostazione, scriviImpostazione } from "./db.ts";
import { app } from "electron";
import { cartellaDati, PERCORSI, REPOSITORY } from "./percorsi.ts";

// Lo scaricamento delle lezioni dal ramo `corso` del repository.
//
// 1. Si chiede a GitHub l'ultima revisione del ramo (un codice che identifica il contenuto esatto).
// 2. Si scaricano catalogo e lezioni A QUELLA REVISIONE: il catalogo e i file non possono cambiare a metà.
// 3. Un file è accettato solo se la sua impronta SHA-256 è quella scritta nel catalogo, se rispetta il formato e se
//    supera il controllo di sicurezza sul codice. Altrimenti viene scartato e se ne dà notizia.
// Senza rete l'aula funziona con le lezioni già scaricate.

const stato: StatoSincronizzazione = { inCorso: false, ultima: null, errore: null, avvisi: [], cambiate: [] };
let inCorso: Promise<StatoSincronizzazione> | null = null;

// Durante lo sviluppo (mai nel programma installato) le prove possono indicare un server locale al posto di GitHub.
const API_GITHUB = !app.isPackaged && process.env.HTD_API_GITHUB ? process.env.HTD_API_GITHUB : "https://api.github.com";
const RAW_GITHUB = !app.isPackaged && process.env.HTD_RAW_GITHUB ? process.env.HTD_RAW_GITHUB : "https://raw.githubusercontent.com";

const INTESTAZIONI = { "User-Agent": "how-to-develop-aula", Accept: "application/vnd.github+json" };

async function scarica(url: string, timeoutMs = 60_000): Promise<Buffer> {
  const risposta = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status} per ${url.replace(/^https:\/\/[^/]+\//, "")}`);
  return Buffer.from(await risposta.arrayBuffer());
}

const grezzo = (revisione: string, file: string) => `${RAW_GITHUB}/${REPOSITORY}/${revisione}/${file}`;

/** Scarica un file e lo accetta solo se ha l'impronta attesa. */
async function scaricaVerificato(revisione: string, file: string, impronta: string): Promise<Buffer> {
  const dati = await scarica(grezzo(revisione, file), 5 * 60_000);
  const calcolata = sha256(dati);
  if (calcolata !== impronta) throw new Error(`${file}: l'impronta non corrisponde al catalogo (file alterato o rovinato)`);
  return dati;
}

export function percorsoMediaLocale(m: Pick<Media, "sha256" | "estensione">): string {
  return path.join(PERCORSI.media, `${m.sha256}.${m.estensione}`);
}

async function scaricaMedia(revisione: string, m: Media): Promise<void> {
  const destinazione = percorsoMediaLocale(m);
  if (fs.existsSync(destinazione) && fs.statSync(destinazione).size === m.byte) return;
  const dati = await scaricaVerificato(revisione, percorsoMedia(m), m.sha256);
  const temporaneo = `${destinazione}.parziale`;
  fs.writeFileSync(temporaneo, dati);
  fs.renameSync(temporaneo, destinazione);
}

/** Apre l'indice della documentazione già scaricato, se c'è (all'avvio, anche senza rete). */
export function apriDocumentazioneLocale(): void {
  const file = leggiImpostazione<string | null>("documentazione_file", null);
  if (file && fs.existsSync(file)) apriIndice(file);
}

async function aggiornaDocumentazione(revisione: string, catalogo: Catalogo): Promise<void> {
  const doc = catalogo.documentazione;
  if (!doc) return;
  const file = path.join(cartellaDati(), `docs-${doc.commit.slice(0, 12)}.sqlite`);
  if (!fs.existsSync(file)) {
    const gz = await scaricaVerificato(revisione, percorsoMedia(doc.media), doc.media.sha256);
    fs.writeFileSync(`${file}.parziale`, zlib.gunzipSync(gz));
    fs.renameSync(`${file}.parziale`, file);
  }
  apriIndice(file);
  scriviImpostazione("documentazione_file", file);
}

export function statoSincronizzazione(): StatoSincronizzazione {
  return { ...stato, ultima: stato.ultima ?? leggiImpostazione<string | null>("ultima_sincronizzazione", null) };
}

export function statoFabbricaSalvato(): StatoPubblico | null {
  return leggiImpostazione<StatoPubblico | null>("stato_fabbrica", null);
}

/** Scarica le novità. Una sola sincronizzazione alla volta: chi chiama mentre ne gira una aspetta quella. */
export function sincronizza(): Promise<StatoSincronizzazione> {
  inCorso ??= esegui().finally(() => {
    inCorso = null;
  });
  return inCorso;
}

async function esegui(): Promise<StatoSincronizzazione> {
  stato.inCorso = true;
  stato.errore = null;
  const avvisi: string[] = [];
  const cambiate: string[] = [];
  try {
    const { sha } = JSON.parse((await scarica(`${API_GITHUB}/repos/${REPOSITORY}/commits/corso`, 30_000)).toString("utf8")) as { sha: string };
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Revisione del ramo corso non valida");
    const catalogo = CatalogoSchema.parse(JSON.parse((await scarica(grezzo(sha, "catalogo.json"))).toString("utf8")));
    scriviImpostazione("lezioni_nel_piano", catalogo.lezioniNelPiano);
    try {
      const pubblico = StatoPubblicoSchema.parse(JSON.parse((await scarica(grezzo(sha, "stato/aula.json"))).toString("utf8")));
      scriviImpostazione("stato_fabbrica", pubblico);
    } catch {
      // Lo stato della fabbrica è solo da mostrare: se manca, pazienza.
    }
    const db = database();
    const locali = new Map((db.prepare("SELECT slug, sha256 FROM lezioni").all() as { slug: string; sha256: string }[]).map((r) => [r.slug, r.sha256]));
    const daScaricare = catalogo.lezioni.filter((v) => locali.get(v.slug) !== v.sha256);
    const coda = [...daScaricare];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (coda.length) {
          const voce = coda.shift()!;
          try {
            const dati = await scaricaVerificato(sha, voce.file, voce.sha256);
            const pacco = PaccoLezioneSchema.parse(JSON.parse(dati.toString("utf8")));
            if (pacco.slug !== voce.slug) throw new Error(`${voce.file}: il nome della lezione non corrisponde al catalogo`);
            const sicurezza = problemiDelPacco(pacco);
            if (sicurezza.length) throw new Error(`${pacco.numero} «${pacco.titolo}» non supera il controllo di sicurezza: ${sicurezza.slice(0, 2).join(" | ")}`);
            for (const m of Object.values(pacco.media)) await scaricaMedia(sha, m);
            db.prepare(
              "INSERT INTO lezioni (slug, numero, fase, titolo, versione, sha256, pacco, scaricata) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET numero = excluded.numero, fase = excluded.fase, titolo = excluded.titolo, versione = excluded.versione, sha256 = excluded.sha256, pacco = excluded.pacco, scaricata = excluded.scaricata",
            ).run(pacco.slug, pacco.numero, pacco.fase, pacco.titolo, pacco.versione, voce.sha256, dati.toString("utf8"), adesso());
            cambiate.push(pacco.slug);
          } catch (errore) {
            // Impronta sbagliata o controllo di sicurezza: si dice perché. Un guasto di rete: si riprova più tardi.
            const motivo = (errore as Error).message;
            console.error(`Lezione ${voce.slug} non scaricata: ${motivo}`);
            avvisi.push(`Lezione ${voce.numero} «${voce.titolo}» non scaricata: ${/impronta|sicurezza/.test(motivo) ? motivo : "riprovo più tardi"}`);
          }
        }
      }),
    );
    try {
      await aggiornaDocumentazione(sha, catalogo);
    } catch (errore) {
      console.error(`Documentazione non aggiornata: ${(errore as Error).message}`);
      avvisi.push("Documentazione per il tutor non aggiornata: riprovo più tardi.");
    }
    stato.ultima = adesso();
    scriviImpostazione("ultima_sincronizzazione", stato.ultima);
  } catch (errore) {
    // In parole per chi studia; il dettaglio tecnico resta nel registro del programma.
    const messaggio = `${(errore as Error).message} ${(errore as Error).name}`;
    console.error(`Sincronizzazione non riuscita: ${messaggio}`);
    stato.errore = /fetch failed|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|TimeoutError|aborted/i.test(messaggio)
      ? "Nessuna connessione a GitHub: uso le lezioni già scaricate."
      : /HTTP (404|409) per repos\/[^ ]+\/commits\/corso/.test(messaggio)
        ? "La fabbrica non ha ancora pubblicato nessuna lezione."
        : /HTTP (403|429)/.test(messaggio)
          ? "GitHub chiede di aspettare un po' prima di scaricare ancora: riprovo più tardi."
          : "Scaricamento delle lezioni non riuscito: riprovo più tardi. Intanto uso le lezioni già scaricate.";
  } finally {
    stato.inCorso = false;
    stato.avvisi = avvisi;
    stato.cambiate = cambiate;
  }
  return statoSincronizzazione();
}
