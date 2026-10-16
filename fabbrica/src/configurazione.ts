import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Dove lavora la fabbrica e con quali limiti. Tutto arriva dall'ambiente, con valori predefiniti adatti a GitHub Actions.
//
//   HTD_DATI         la cartella del ramo `corso` (dove si scrivono lezioni, cantieri, tracce, stato)
//   HTD_CACHE        una cartella che resta tra un giro e l'altro (Godot, indice della documentazione)
//   HTD_MINUTI       quanti minuti può durare un giro prima di smettere di cominciare passi nuovi
//   HTD_SENZA_PUSH   "1": salva in locale senza spingere su GitHub (prove)
//   GEMINI_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY   le chiavi dei fornitori (segreti del repository)
//   GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_REPOSITORY_OWNER   per leggere le segnalazioni e aprirne una quando il corso si ferma

const qui = path.dirname(fileURLToPath(import.meta.url));

function cartellaRepository(): string {
  // Da sorgente (fabbrica/src) o compilata (fabbrica/dist): il repository è due livelli sopra.
  return process.env.HTD_REPO ? path.resolve(process.env.HTD_REPO) : path.resolve(qui, "..", "..");
}

export const CONFIG = {
  repo: cartellaRepository(),
  motore: path.join(cartellaRepository(), "motori", "godot"),
  dati: path.resolve(process.env.HTD_DATI ?? path.join(cartellaRepository(), "dati", "corso")),
  cache: path.resolve(process.env.HTD_CACHE ?? path.join(os.homedir(), ".cache", "how-to-develop")),
  minutiGiro: Number(process.env.HTD_MINUTI ?? 40),
  senzaPush: process.env.HTD_SENZA_PUSH === "1",
  /** La revisione del codice che sta girando (GitHub la mette in GITHUB_SHA). */
  revisioneCodice: process.env.GITHUB_SHA ?? null,
  github: {
    token: process.env.GITHUB_TOKEN ?? null,
    repository: process.env.GITHUB_REPOSITORY ?? null,
    proprietario: process.env.GITHUB_REPOSITORY_OWNER ?? null,
  },
};

/** Le chiavi dei fornitori, lette dall'ambiente. Una chiave che manca vuol dire: quel fornitore non si usa. */
export function chiaveFornitore(id: string): string | null {
  const nome = `${id.toUpperCase()}_API_KEY`;
  const valore = process.env[nome]?.trim();
  return valore ? valore : null;
}

/** Tutti i valori segreti presenti nell'ambiente: non devono mai finire in un file o in un messaggio. */
export function valoriSegreti(): string[] {
  return Object.entries(process.env)
    .filter(([nome, valore]) => /(_API_KEY|_TOKEN|SECRET|PASSWORD)$/i.test(nome) && valore && valore.trim().length >= 12)
    .map(([, valore]) => valore!.trim());
}

/** Toglie da un testo ogni valore segreto (sostituito da «[nascosto]»). */
export function nascondiSegreti(testo: string): string {
  let t = testo;
  for (const s of valoriSegreti()) t = t.replaceAll(s, "[nascosto]");
  return t;
}
