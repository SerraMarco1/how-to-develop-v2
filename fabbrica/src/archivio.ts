import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { CONFIG, valoriSegreti } from "./configurazione.ts";

// L'archivio della fabbrica: il ramo `corso`, scaricato in CONFIG.dati. Ogni cosa che la fabbrica sa sta in un file
// qui dentro, e dopo ogni passo il ramo viene spinto su GitHub: se la macchina si spegne, al giro dopo si riparte
// esattamente da lì.

const execFileAsync = promisify(execFile);

/** Il percorso completo di un file dell'archivio. Un nome che uscirebbe dall'archivio è un errore del programma. */
export function percorsoDati(...parti: string[]): string {
  const base = path.resolve(CONFIG.dati);
  const completo = path.resolve(base, ...parti);
  if (completo !== base && !completo.startsWith(base + path.sep)) throw new Error(`Percorso fuori dall'archivio: ${parti.join("/")}`);
  return completo;
}

export function esiste(...parti: string[]): boolean {
  return fs.existsSync(percorsoDati(...parti));
}

export function leggiJson<T>(relativo: string, predefinito: T): T {
  try {
    return JSON.parse(fs.readFileSync(percorsoDati(relativo), "utf8")) as T;
  } catch (errore) {
    if ((errore as NodeJS.ErrnoException).code === "ENOENT") return predefinito;
    throw new Error(`File dell'archivio illeggibile (${relativo}): ${(errore as Error).message}`);
  }
}

/** Scrive un file in modo atomico: prima un file temporaneo, poi lo scambio. Un file a metà non resta mai. */
export function scriviFile(relativo: string, contenuto: string | Buffer): void {
  const destinazione = percorsoDati(relativo);
  fs.mkdirSync(path.dirname(destinazione), { recursive: true });
  const temporaneo = `${destinazione}.${process.pid}.tmp`;
  fs.writeFileSync(temporaneo, contenuto);
  fs.renameSync(temporaneo, destinazione);
}

export function scriviJson(relativo: string, dati: unknown, leggibile = true): void {
  scriviFile(relativo, `${JSON.stringify(dati, null, leggibile ? 1 : 0)}\n`);
}

export function aggiungiRiga(relativo: string, dati: unknown): void {
  const destinazione = percorsoDati(relativo);
  fs.mkdirSync(path.dirname(destinazione), { recursive: true });
  fs.appendFileSync(destinazione, `${JSON.stringify(dati)}\n`);
}

export function leggiRighe<T>(relativo: string): T[] {
  try {
    return fs
      .readFileSync(percorsoDati(relativo), "utf8")
      .split("\n")
      .filter((r) => r.trim())
      .flatMap((r) => {
        try {
          return [JSON.parse(r) as T];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export function cancella(relativo: string): void {
  fs.rmSync(percorsoDati(relativo), { recursive: true, force: true });
}

export function elenco(relativo: string): string[] {
  try {
    return fs.readdirSync(percorsoDati(relativo)).sort();
  } catch {
    return [];
  }
}

// ─────────────────────────── Git ───────────────────────────

/** Chi firma i salvataggi della fabbrica: il robot di GitHub Actions, con il suo indirizzo anonimo. */
const FIRMA = { nome: "Fabbrica How to Develop", email: "41898282+github-actions[bot]@users.noreply.github.com" };

async function git(...argomenti: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", argomenti, {
    cwd: CONFIG.dati,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_AUTHOR_NAME: FIRMA.nome, GIT_AUTHOR_EMAIL: FIRMA.email, GIT_COMMITTER_NAME: FIRMA.nome, GIT_COMMITTER_EMAIL: FIRMA.email, ...autenticazione(argomenti[0]) },
  });
  return stdout.trim();
}

/**
 * Per spingere su GitHub serve il token del giro (GITHUB_TOKEN, scade quando il giro finisce). Non viene mai scritto su
 * disco né passato come argomento: arriva a git nell'ambiente, solo per il comando `push`, come intestazione HTTP.
 */
function autenticazione(comando: string | undefined): Record<string, string> {
  const token = CONFIG.github.token;
  if (comando !== "push" || !token) return {};
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
  };
}

/**
 * Prima di ogni commit: nessun file che sta per essere salvato può contenere un valore segreto. Se succede è un errore
 * del programma, e il salvataggio si ferma prima di arrivare su GitHub.
 */
async function controllaSegreti(): Promise<void> {
  const segreti = valoriSegreti();
  if (segreti.length === 0) return;
  const cambiati = (await git("diff", "--cached", "--name-only", "-z")).split("\0").filter(Boolean);
  for (const file of cambiati) {
    const completo = percorsoDati(file);
    if (!fs.existsSync(completo)) continue;
    const contenuto = fs.readFileSync(completo);
    for (const s of segreti) {
      if (contenuto.includes(s)) {
        await git("reset", "-q");
        throw new Error(`Il file ${file} contiene una chiave segreta: salvataggio fermato prima di arrivare su GitHub`);
      }
    }
  }
}

let ultimoPush = 0;

/**
 * Salva nell'archivio tutto ciò che è cambiato e lo spinge su GitHub. `subito`: senza aspettare (dopo una risposta
 * pagata o un passo importante); altrimenti si spinge al massimo una volta ogni 20 secondi e il resto va col prossimo.
 */
export async function salva(messaggio: string, opzioni: { subito?: boolean } = {}): Promise<void> {
  await git("add", "-A");
  const cambiamenti = await git("status", "--porcelain");
  if (cambiamenti) {
    await controllaSegreti();
    await git("commit", "-q", "-m", messaggio.slice(0, 300));
  }
  if (CONFIG.senzaPush) return;
  if (!opzioni.subito && Date.now() - ultimoPush < 20_000) return;
  await spingi();
}

/** Spinge il ramo `corso` su GitHub, riprovando qualche volta se la rete fa le bizze. */
export async function spingi(): Promise<void> {
  if (CONFIG.senzaPush) return;
  const davanti = await git("rev-list", "--count", "@{u}..HEAD").catch(() => "1");
  if (davanti === "0") return;
  let ultimoErrore: unknown = null;
  for (let tentativo = 1; tentativo <= 4; tentativo++) {
    try {
      await git("push", "-q", "origin", "HEAD:corso");
      ultimoPush = Date.now();
      return;
    } catch (errore) {
      ultimoErrore = errore;
      await new Promise((ok) => setTimeout(ok, 3000 * tentativo));
    }
  }
  throw new Error(`Impossibile spingere il ramo corso su GitHub: ${(ultimoErrore as Error).message}`);
}

/** La revisione attuale del ramo (per scriverla nelle tracce). */
export async function revisioneAttuale(): Promise<string | null> {
  return git("rev-parse", "HEAD").catch(() => null);
}
