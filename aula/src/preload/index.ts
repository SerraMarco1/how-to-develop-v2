import { contextBridge, ipcRenderer } from "electron";
import type { Api } from "../comune/api.ts";

// L'unico ponte tra la finestra e il programma: un elenco fisso di richieste. La finestra non riceve ipcRenderer né
// altro di Electron, solo queste funzioni.

const chiama =
  (nome: string) =>
  (...argomenti: unknown[]) =>
    ipcRenderer.invoke(`htd:${nome}`, ...argomenti);

const nomi = [
  "oggi", "corso", "lezione", "consegna", "preparaPartenza", "soluzione", "analisiCodice", "tutor", "storiaTutor",
  "spiegaAltrimenti", "segnala", "vota", "ripassi", "rispondiRipasso", "scheda", "autovaluta", "esportaScheda",
  "impostazioni", "scegliCartellaProgetti", "salvaChiave", "importaVersione1", "sincronizza", "apriCartella", "apriLink",
  "aggiornamento", "installaAggiornamento",
] as const;

const api = Object.fromEntries(nomi.map((n) => [n, chiama(n)])) as Omit<Api, "suEvento">;

contextBridge.exposeInMainWorld("htd", {
  ...api,
  suEvento(evento: "sincronizzato" | "aggiornamento", funzione: (cambiate: string[]) => void) {
    if (evento !== "sincronizzato" && evento !== "aggiornamento") return () => {};
    // Alla finestra arriva solo l'elenco dei nomi delle lezioni, mai l'oggetto dell'evento di Electron.
    const ascolta = (_evento: unknown, cambiate: unknown) => funzione(Array.isArray(cambiate) ? cambiate.filter((s): s is string => typeof s === "string") : []);
    ipcRenderer.on(`htd:evento:${evento}`, ascolta);
    return () => ipcRenderer.removeListener(`htd:evento:${evento}`, ascolta);
  },
} satisfies Api);
