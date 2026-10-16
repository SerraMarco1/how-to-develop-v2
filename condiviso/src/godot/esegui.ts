import { spawn } from "node:child_process";
import fs from "node:fs";

// Esecuzione del Godot di servizio: una copia di Godot usata solo dalla piattaforma per le verifiche, scaricata dal
// sito ufficiale e controllata (vedi installa.ts). Chi la usa dice all'avvio dove sta, con `impostaGodot`.

let eseguibile: string | null = null;

export function impostaGodot(percorso: string): void {
  if (!fs.existsSync(percorso)) throw new Error(`Godot di servizio non trovato: ${percorso}`);
  eseguibile = percorso;
}

export function godotPronto(): boolean {
  return eseguibile !== null && fs.existsSync(eseguibile);
}

export function godotEseguibileAttuale(): string {
  if (!eseguibile) throw new Error("Godot di servizio non impostato (impostaGodot)");
  return eseguibile;
}

export type EsitoGodot = { codiceUscita: number | null; output: string; scadutoTempo: boolean };

/**
 * Le sole variabili d'ambiente che Godot riceve. Il codice eseguito è quello delle lezioni e dei progetti di chi
 * studia: non deve vedere niente del processo che lo lancia (nella fabbrica, per esempio, le chiavi dei modelli).
 */
const AMBIENTE_AMMESSO = [
  "PATH", "SystemRoot", "SYSTEMROOT", "windir", "WINDIR", "TEMP", "TMP", "TMPDIR", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
  "APPDATA", "LOCALAPPDATA", "HOME", "LANG", "LC_ALL", "DISPLAY", "XDG_RUNTIME_DIR", "XDG_DATA_HOME", "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "COMSPEC", "LIBGL_ALWAYS_SOFTWARE", "GALLIUM_DRIVER",
];

function ambienteRidotto(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const nome of AMBIENTE_AMMESSO) if (process.env[nome] !== undefined) env[nome] = process.env[nome];
  return { ...env, ...extra };
}

/** Limite di sicurezza sull'output: un progetto che stampa all'infinito non deve riempire la memoria. */
const MAX_OUTPUT = 400_000;

/**
 * Sulla macchina della fabbrica (Linux) Godot può girare con un altro utente del sistema, indicato da HTD_GODOT_UTENTE:
 * quell'utente non può leggere i file né l'ambiente del processo che lo lancia, dove stanno le chiavi. È un recinto vero,
 * in più al controllo di sicurezza sul codice. Il comando diventa:
 *   sudo -n -u <utente> -- timeout -k 5 <secondi> env -i <ambiente ridotto> [prefisso…] godot <argomenti…>
 * (`timeout` dentro, perché un sudo fermato a forza può lasciare Godot acceso).
 */
function comando(exe: string, argomenti: string[], env: NodeJS.ProcessEnv, timeoutMs: number, prefisso: string[]): { programma: string; argomenti: string[]; env: NodeJS.ProcessEnv } {
  const utente = process.platform === "linux" ? process.env.HTD_GODOT_UTENTE : undefined;
  if (!utente) return prefisso.length ? { programma: prefisso[0], argomenti: [...prefisso.slice(1), exe, ...argomenti], env } : { programma: exe, argomenti, env };
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(utente)) throw new Error("HTD_GODOT_UTENTE non valido");
  const ambiente = Object.entries({ ...env, HOME: `/home/${utente}`, USER: utente }).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`);
  return {
    programma: "sudo",
    // umask 000: i file che crea Godot (cartelle .godot, video) devono poter essere tolti dalla fabbrica dopo.
    argomenti: ["-n", "-u", utente, "--", "timeout", "-k", "5", String(Math.ceil(timeoutMs / 1000)), "sh", "-c", 'umask 000; exec "$@"', "sh", "env", "-i", ...ambiente, ...prefisso, exe, ...argomenti],
    env: { PATH: process.env.PATH },
  };
}

/** Con un utente separato per Godot, la cartella di lavoro deve poterla scrivere anche lui (solo quella). */
export function apriAGodot(cartella: string): void {
  if (process.platform !== "linux" || !process.env.HTD_GODOT_UTENTE) return;
  const apri = (p: string) => {
    const voce = fs.lstatSync(p);
    if (voce.isSymbolicLink()) return;
    fs.chmodSync(p, voce.isDirectory() ? 0o777 : 0o666);
    if (voce.isDirectory()) for (const figlio of fs.readdirSync(p)) apri(`${p}/${figlio}`);
  };
  apri(cartella);
}

/** Toglie una cartella temporanea senza mai far fallire chi chiama: una cartella rimasta non è un guasto. */
export function togliCartella(cartella: string): void {
  try {
    fs.rmSync(cartella, { recursive: true, force: true });
  } catch {
    // Resta lì: la prossima pulizia la toglierà.
  }
}

/** Esegue il Godot di servizio con gli argomenti dati, con un tempo massimo. `prefisso`: un programma che lo lancia (es. xvfb-run). */
export function eseguiGodot(argomenti: string[], opzioni: { timeoutMs?: number; cwd?: string; ambiente?: Record<string, string>; prefisso?: string[] } = {}): Promise<EsitoGodot> {
  if (!eseguibile) throw new Error("Godot di servizio non impostato (impostaGodot)");
  const timeoutMs = opzioni.timeoutMs ?? 60_000;
  const c = comando(eseguibile, argomenti, ambienteRidotto(opzioni.ambiente), timeoutMs, opzioni.prefisso ?? []);
  return new Promise((resolve) => {
    const processo = spawn(c.programma, c.argomenti, { cwd: opzioni.cwd, windowsHide: true, env: c.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let scadutoTempo = false;
    const aggiungi = (dati: Buffer) => {
      if (output.length < MAX_OUTPUT) output += dati.toString("utf8");
    };
    processo.stdout.on("data", aggiungi);
    processo.stderr.on("data", aggiungi);
    const timer = setTimeout(() => {
      scadutoTempo = true;
      processo.kill("SIGKILL");
    }, timeoutMs);
    processo.on("close", (codice) => {
      clearTimeout(timer);
      resolve({ codiceUscita: codice, output, scadutoTempo });
    });
    processo.on("error", (errore) => {
      clearTimeout(timer);
      resolve({ codiceUscita: -1, output: `${output}${String(errore)}`, scadutoTempo });
    });
  });
}

/** Importa le risorse di un progetto: registra le classi e le immagini, serve prima di eseguirlo. */
export function importaProgetto(cartella: string): Promise<EsitoGodot> {
  apriAGodot(cartella);
  return eseguiGodot(["--headless", "--path", cartella, "--import"], { timeoutMs: 120_000 });
}
