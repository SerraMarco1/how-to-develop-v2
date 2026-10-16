import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import type { Oggi } from "../comune/api.ts";
import { aggiornamento, installaAggiornamento } from "./aggiornamenti.ts";
import { corso, prossima, voci } from "./corso.ts";
import { leggiImpostazione } from "./db.ts";
import { cartellaProgetti, cartellaProgettiScelta, chiaviPresenti, impostaCartellaProgetti, salvaChiave } from "./impostazioni.ts";
import { giaImportata, importaVersione1 } from "./migrazione.ts";
import { REPOSITORY } from "./percorsi.ts";
import { quantiRipassiDovuti, ripassi, rispondiRipasso } from "./ripasso.ts";
import { autovaluta, scheda, schedaJson, schedaMarkdown } from "./scheda.ts";
import { sincronizza, statoFabbricaSalvato, statoSincronizzazione } from "./sincronizza.ts";
import { analisiCodice, consegna, preparaPartenza, segnala, soluzione, spiegaAltrimenti, storiaTutor, tutor, vistaLezione, vota } from "./studio.ts";

// I canali tra la finestra e il programma. La finestra è trattata come se non fosse affidabile: ogni argomento viene
// controllato con uno schema prima di essere usato, e le richieste arrivano solo dalla finestra dell'aula.

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const pezzo = z.string().regex(/^(es\d{1,2}|test)$/);
const ConsegnaSchema = z.object({
  cartella: z.string().max(500).optional(),
  codice: z.string().max(100_000).optional(),
  risposte: z.record(z.string().max(40), z.string().max(300)).optional(),
});
const ControlliSchema = z.array(z.object({ descrizione: z.string().max(2000), superato: z.boolean(), dettaglio: z.string().max(4000).optional(), origine: z.enum(["verifica", "sicurezza"]).optional() })).max(100);

/** Siti che l'aula può aprire nel browser: la documentazione di Godot, le pagine delle chiavi e il repository del corso. */
const SITI_AMMESSI = new Set(["docs.godotengine.org", "godotengine.org", "aistudio.google.com", "console.groq.com", "console.mistral.ai", "admin.mistral.ai"]);

function linkAmmesso(indirizzo: string): boolean {
  let url: URL;
  try {
    url = new URL(indirizzo);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  if (url.hostname === "github.com") return url.pathname === `/${REPOSITORY}` || url.pathname.startsWith(`/${REPOSITORY}/`);
  return SITI_AMMESSI.has(url.hostname);
}

let finestraAula: BrowserWindow | null = null;

export function impostaFinestra(finestra: BrowserWindow): void {
  finestraAula = finestra;
}

/** Registra un canale: accetta richieste solo dalla finestra dell'aula, con argomenti che superano lo schema. */
function canale<A extends z.ZodTuple>(nome: string, argomenti: A, gestore: (...a: z.infer<A>) => unknown): void {
  ipcMain.handle(`htd:${nome}`, async (evento: IpcMainInvokeEvent, ...grezzi: unknown[]) => {
    if (!finestraAula || evento.sender !== finestraAula.webContents || !evento.senderFrame?.url.startsWith("htd://app/")) throw new Error("Richiesta non ammessa");
    const esito = argomenti.safeParse(grezzi);
    if (!esito.success) throw new Error(`Richiesta non valida (${nome})`);
    return gestore(...(esito.data as z.infer<A>));
  });
}

function daImpostare(): string[] {
  const cose: string[] = [];
  if (!cartellaProgettiScelta()) cose.push("cartella");
  if (!Object.values(chiaviPresenti()).some(Boolean)) cose.push("chiavi");
  return cose;
}

function oggi(): Oggi {
  const tutte = voci();
  const pubblicata = tutte.filter((v) => v.versione !== null);
  const fabbrica = statoFabbricaSalvato();
  return {
    prossima: (() => {
      const p = prossima();
      const v = p.lezione ?? p.inAttesa;
      return v ? { slug: v.slug, numero: v.numero, titolo: v.titolo, tipo: v.tipo, minuti: v.minuti, stato: v.stato, versione: v.versione } : null;
    })(),
    pronteDavanti: pubblicata.filter((v) => v.stato !== "completata").length,
    completate: tutte.filter((v) => v.stato === "completata").length,
    totali: leggiImpostazione<number>("lezioni_nel_piano", tutte.length),
    pubblicate: pubblicata.length,
    ripassiDovuti: quantiRipassiDovuti(),
    fabbrica: fabbrica ? { stato: fabbrica.stato, messaggio: fabbrica.messaggio, aggiornato: fabbrica.aggiornato, riprende: fabbrica.riprende } : { stato: "sconosciuto", messaggio: "Non so ancora cosa sta facendo la fabbrica: le lezioni non sono mai state scaricate.", aggiornato: null, riprende: null },
    sincronizzazione: statoSincronizzazione(),
    daImpostare: daImpostare(),
  };
}

export function registraCanali(versione: string): void {
  canale("oggi", z.tuple([]), oggi);
  canale("corso", z.tuple([]), corso);
  canale("lezione", z.tuple([slug]), vistaLezione);
  canale("consegna", z.tuple([slug, pezzo, ConsegnaSchema]), consegna);
  canale("preparaPartenza", z.tuple([slug, pezzo]), preparaPartenza);
  canale("soluzione", z.tuple([slug, pezzo]), soluzione);
  canale("analisiCodice", z.tuple([slug, pezzo, ConsegnaSchema, ControlliSchema]), analisiCodice);
  canale("tutor", z.tuple([slug, z.string().max(4000), z.number().int().min(0).max(5), pezzo.nullable(), z.string().max(100_000).nullable()]), tutor);
  canale("storiaTutor", z.tuple([slug]), storiaTutor);
  canale("spiegaAltrimenti", z.tuple([slug, z.string().regex(/^b\d{1,3}$/)]), spiegaAltrimenti);
  canale("segnala", z.tuple([slug, z.string().max(60)]), segnala);
  canale("vota", z.tuple([slug, z.number().int().min(1).max(5), z.string().max(2000)]), vota);
  canale("ripassi", z.tuple([]), ripassi);
  canale("rispondiRipasso", z.tuple([slug, z.record(z.string().max(20), z.string().max(300))]), rispondiRipasso);
  canale("scheda", z.tuple([]), scheda);
  canale("autovaluta", z.tuple([z.string().regex(/^(lezione|fase):[a-z0-9-]+:\d{1,3}$/), z.number().int().min(0).max(4).nullable(), z.string().max(2000)]), autovaluta);
  canale("esportaScheda", z.tuple([z.enum(["md", "json"]), slug.nullable()]), async (formato, fase) => {
    const risultato = await dialog.showSaveDialog(finestraAula!, { title: "Salva la scheda «Cosa so fare»", defaultPath: `cosa-so-fare${fase ? `-${fase}` : ""}.${formato}`, filters: [{ name: formato === "md" ? "Markdown" : "JSON", extensions: [formato] }] });
    if (risultato.canceled || !risultato.filePath) return { salvato: null };
    fs.writeFileSync(risultato.filePath, formato === "md" ? schedaMarkdown(fase) : `${JSON.stringify(schedaJson(fase), null, 2)}\n`);
    return { salvato: risultato.filePath };
  });
  canale("impostazioni", z.tuple([]), () => ({ cartellaProgetti: cartellaProgetti(), chiavi: chiaviPresenti(), versione, datiImportati: giaImportata() }));
  canale("scegliCartellaProgetti", z.tuple([]), async () => {
    const r = await dialog.showOpenDialog(finestraAula!, { title: "Cartella dei progetti del corso", defaultPath: cartellaProgetti(), properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return null;
    impostaCartellaProgetti(r.filePaths[0]);
    return cartellaProgetti();
  });
  canale("salvaChiave", z.tuple([z.enum(["groq", "mistral", "gemini"]), z.string().max(300).regex(/^[\x21-\x7e]*$/)]), (fornitore, chiave) => {
    try {
      salvaChiave(fornitore, chiave || null);
      return { ok: true };
    } catch (errore) {
      return { ok: false, errore: (errore as Error).message };
    }
  });
  canale("importaVersione1", z.tuple([]), async () => {
    // Il database lo scegli tu (nelle prove automatiche lo indica HTD_PROVA_V1, solo fuori dal programma installato).
    let file = !app.isPackaged && process.env.HTD_PROVA_V1 ? process.env.HTD_PROVA_V1 : null;
    if (!file) {
      const r = await dialog.showOpenDialog(finestraAula!, { title: "Il database della versione 1 (data\\how-to-develop.db)", properties: ["openFile"], filters: [{ name: "Database della versione 1", extensions: ["db"] }] });
      if (r.canceled || !r.filePaths[0]) return { ok: false, riepilogo: "" };
      file = r.filePaths[0];
    }
    return importaVersione1(file);
  });
  canale("sincronizza", z.tuple([]), () => sincronizza());
  canale("apriCartella", z.tuple([z.string().max(500)]), async (percorso) => {
    const base = path.resolve(cartellaProgetti());
    const scelta = path.resolve(percorso);
    if (scelta !== base && !scelta.startsWith(base + path.sep)) return;
    // Solo cartelle: aprire un file vorrebbe dire eseguirlo con il programma associato.
    if (fs.existsSync(scelta) && fs.statSync(scelta).isDirectory()) await shell.openPath(scelta);
  });
  canale("apriLink", z.tuple([z.string().url().max(1000)]), async (url) => {
    if (linkAmmesso(url)) await shell.openExternal(new URL(url).href);
  });
  canale("aggiornamento", z.tuple([]), aggiornamento);
  canale("installaAggiornamento", z.tuple([]), installaAggiornamento);
}

/** Avvisa la finestra che qualcosa è cambiato (la finestra poi chiede i dati nuovi). */
export function avvisaFinestra(evento: "sincronizzato" | "aggiornamento"): void {
  finestraAula?.webContents.send(`htd:evento:${evento}`);
}
