import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

// Dove l'aula tiene le sue cose. Tutto sta nella cartella dei dati del programma (%APPDATA%\How to Develop):
// il database dei progressi, le lezioni e i file scaricati, il Godot di servizio, le copie temporanee dei progetti.

export const REPOSITORY = "SerraMarco1/how-to-develop-v2";

export function cartellaDati(): string {
  return app.getPath("userData");
}

export const PERCORSI = {
  get database() {
    return path.join(cartellaDati(), "aula.sqlite");
  },
  get media() {
    return path.join(cartellaDati(), "media");
  },
  get strumenti() {
    return path.join(cartellaDati(), "strumenti");
  },
  get temporanei() {
    return path.join(cartellaDati(), "temp");
  },
  get copie() {
    return path.join(cartellaDati(), "copie");
  },
  /** Il pacchetto del motore: tra le risorse del programma installato, o nel repository durante lo sviluppo. */
  get motore() {
    return app.isPackaged ? path.join(process.resourcesPath, "motore") : path.resolve(app.getAppPath(), "..", "motori", "godot");
  },
};

/** La cartella dei progetti degli esercizi proposta la prima volta. */
export function cartellaProgettiPredefinita(): string {
  return path.join(app.getPath("documents"), "How to Develop", "Corso");
}

export function preparaCartelle(): void {
  for (const c of [PERCORSI.media, PERCORSI.strumenti, PERCORSI.temporanei, PERCORSI.copie]) fs.mkdirSync(c, { recursive: true });
  // Le copie temporanee di un giro precedente (chiuso male) non servono più.
  for (const voce of fs.readdirSync(PERCORSI.temporanei)) fs.rmSync(path.join(PERCORSI.temporanei, voce), { recursive: true, force: true });
}
