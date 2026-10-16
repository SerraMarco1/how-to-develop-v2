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
  suEvento(evento: "sincronizzato" | "aggiornamento", funzione: () => void) {
    if (evento !== "sincronizzato" && evento !== "aggiornamento") return () => {};
    const ascolta = () => funzione();
    ipcRenderer.on(`htd:evento:${evento}`, ascolta);
    return () => ipcRenderer.removeListener(`htd:evento:${evento}`, ascolta);
  },
} satisfies Api);
