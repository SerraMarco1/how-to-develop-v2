import { app } from "electron";
import electronUpdater from "electron-updater";
import type { Aggiornamento } from "../comune/api.ts";

// Gli aggiornamenti dell'aula: le versioni nuove sono pubblicate tra le Release del repository. L'aula controlla se ce
// n'è una, la scarica solo quando premi «Aggiorna» e la installa al riavvio. Il file scaricato viene controllato con
// l'impronta SHA-512 pubblicata accanto (latest.yml).

/** Preso solo quando serve: electron-updater non va toccato prima che il programma sia pronto. */
const aggiornatore = () => electronUpdater.autoUpdater;
let stato: Aggiornamento = { stato: "nessuno" };
let avvisa: () => void = () => {};

export function preparaAggiornamenti(quandoCambia: () => void): void {
  avvisa = quandoCambia;
  if (!app.isPackaged) return;
  aggiornatore().autoDownload = false;
  aggiornatore().autoInstallOnAppQuit = true;
  aggiornatore().on("update-available", (info) => {
    stato = { stato: "disponibile", versione: info.version };
    avvisa();
  });
  aggiornatore().on("update-not-available", () => {
    stato = { stato: "nessuno" };
  });
  aggiornatore().on("download-progress", (p) => {
    stato = { stato: "scaricamento", versione: stato.versione, messaggio: `${Math.round(p.percent)}%` };
    avvisa();
  });
  aggiornatore().on("update-downloaded", (info) => {
    stato = { stato: "pronto", versione: info.version };
    avvisa();
  });
  aggiornatore().on("error", (errore) => {
    stato = { stato: "errore", messaggio: errore.message.slice(0, 300) };
  });
  void aggiornatore().checkForUpdates().catch(() => {});
}

export async function aggiornamento(): Promise<Aggiornamento> {
  return stato;
}

/** Scarica la versione nuova; se è già scaricata, riavvia e installa. */
export async function installaAggiornamento(): Promise<void> {
  if (!app.isPackaged) return;
  if (stato.stato === "pronto") {
    aggiornatore().quitAndInstall();
    return;
  }
  if (stato.stato === "disponibile") {
    stato = { stato: "scaricamento", versione: stato.versione, messaggio: "0%" };
    avvisa();
    await aggiornatore().downloadUpdate();
  }
}
