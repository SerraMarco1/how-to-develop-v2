import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";
import { apriIndice, costruisciIndice } from "@htd/condiviso/documentazione.ts";
import { infoMotore } from "@htd/condiviso/motore.ts";
import { CONFIG } from "./configurazione.ts";

// La documentazione di Godot per la fabbrica: i file .rst di godot-docs alla revisione fissata in engine.json,
// scaricati una volta e tenuti nella cartella che resta tra i giri, poi indicizzati.
// Si scaricano solo i file .rst (niente immagini) e git controlla che il contenuto sia quello della revisione.

const execFileAsync = promisify(execFile);

async function git(cartella: string, ...argomenti: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", argomenti, { cwd: cartella, maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000 });
  return stdout.trim();
}

/** Scarica i file .rst della revisione fissata (se non ci sono già) e restituisce la cartella. */
async function scaricaDocumentazione(): Promise<string> {
  const { docs } = infoMotore();
  const cartella = path.join(CONFIG.cache, `godot-docs-${docs.commit.slice(0, 12)}`);
  if (fs.existsSync(path.join(cartella, ".fatto"))) return cartella;
  fs.rmSync(cartella, { recursive: true, force: true });
  fs.mkdirSync(cartella, { recursive: true });
  await git(cartella, "init", "-q");
  await git(cartella, "remote", "add", "origin", `https://github.com/${docs.repo}.git`);
  await git(cartella, "sparse-checkout", "set", "--no-cone", "*.rst");
  await git(cartella, "fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", docs.commit);
  await git(cartella, "checkout", "-q", "FETCH_HEAD");
  const revisione = await git(cartella, "rev-parse", "HEAD");
  if (revisione !== docs.commit) throw new Error(`Documentazione scaricata alla revisione sbagliata (${revisione} invece di ${docs.commit})`);
  fs.writeFileSync(path.join(cartella, ".fatto"), docs.commit);
  return cartella;
}

/** Prepara l'indice della documentazione (lo costruisce la prima volta) e lo apre. Restituisce il percorso del file. */
export async function preparaDocumentazione(log: (m: string) => void = () => {}): Promise<string> {
  const { docs } = infoMotore();
  const fileIndice = path.join(CONFIG.cache, `docs-${docs.commit.slice(0, 12)}.sqlite`);
  if (!fs.existsSync(fileIndice)) {
    log("Documentazione di Godot: download dei file .rst…");
    const cartella = await scaricaDocumentazione();
    log("Documentazione di Godot: costruzione dell'indice…");
    const temporaneo = `${fileIndice}.parziale`;
    const { pagine, pezzi } = costruisciIndice(cartella, temporaneo, docs.siteBase);
    fs.renameSync(temporaneo, fileIndice);
    log(`Indice pronto: ${pagine} pagine, ${pezzi} sezioni`);
  }
  apriIndice(fileIndice);
  return fileIndice;
}

/** L'indice compresso, da pubblicare per l'aula. */
export function indiceCompresso(fileIndice: string): Buffer {
  return zlib.gzipSync(fs.readFileSync(fileIndice), { level: 9 });
}
