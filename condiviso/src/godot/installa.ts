import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { infoMotore } from "../motore.ts";

// Installazione del Godot di servizio. Lo zip ufficiale viene scaricato da GitHub e accettato solo se la sua impronta
// SHA-512 è uguale a quella pubblicata da Godot e scritta nel pacchetto del motore (engine.json). Uno zip diverso, per
// qualunque motivo (download rovinato o alterato), viene buttato senza estrarlo.

const execFileAsync = promisify(execFile);

export type Piattaforma = "windows" | "linux";

export function piattaformaAttuale(): Piattaforma {
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  throw new Error(`Sistema non supportato: ${process.platform}`);
}

/** La cartella in cui sta (o starà) questa versione di Godot, dentro `cartellaStrumenti`. */
export function cartellaGodot(cartellaStrumenti: string): string {
  return path.join(cartellaStrumenti, `godot-${infoMotore().version}`);
}

/** Il percorso dell'eseguibile di Godot di servizio, se è installato e verificato. */
export function godotInstallato(cartellaStrumenti: string, piattaforma = piattaformaAttuale()): string | null {
  const scarico = infoMotore().download[piattaforma];
  const cartella = cartellaGodot(cartellaStrumenti);
  const exe = path.join(cartella, scarico.eseguibile);
  try {
    // Il segno lasciato dopo un'installazione completa: dice da quale zip (impronta) viene.
    const segno = fs.readFileSync(path.join(cartella, ".verificato"), "utf8").trim();
    return segno === scarico.sha512 && fs.existsSync(exe) ? exe : null;
  } catch {
    return null;
  }
}

/** Il programma `tar` di Windows, indicato per intero: un altro `tar` nel PATH (per esempio quello di Git) non legge gli zip. */
function tarDiWindows(): string {
  return path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
}

/** Scarica, controlla ed estrae Godot. Restituisce il percorso dell'eseguibile. Ripetibile: se c'è già, non fa niente. */
export async function installaGodot(cartellaStrumenti: string, avanzamento: (messaggio: string) => void = () => {}, piattaforma = piattaformaAttuale()): Promise<string> {
  const pronto = godotInstallato(cartellaStrumenti, piattaforma);
  if (pronto) return pronto;
  const { version, download } = infoMotore();
  const scarico = download[piattaforma];
  const cartella = cartellaGodot(cartellaStrumenti);
  fs.rmSync(cartella, { recursive: true, force: true });
  fs.mkdirSync(cartella, { recursive: true });
  const zip = path.join(cartellaStrumenti, `godot-${version}-${piattaforma}.zip.parziale`);

  avanzamento(`Download di Godot ${version}…`);
  const risposta = await fetch(scarico.file, { signal: AbortSignal.timeout(20 * 60_000) });
  if (!risposta.ok || !risposta.body) throw new Error(`Download di Godot non riuscito: HTTP ${risposta.status}`);
  const impronta = crypto.createHash("sha512");
  const totale = Number(risposta.headers.get("content-length") ?? 0);
  let scaricati = 0;
  let ultimo = 0;
  const corpo = Readable.fromWeb(risposta.body as never);
  corpo.on("data", (pezzo: Buffer) => {
    impronta.update(pezzo);
    scaricati += pezzo.length;
    if (totale && scaricati - ultimo > totale / 10) {
      ultimo = scaricati;
      avanzamento(`Download di Godot: ${Math.round((scaricati / totale) * 100)}%`);
    }
  });
  await pipeline(corpo, fs.createWriteStream(zip));
  const calcolata = impronta.digest("hex");
  if (calcolata !== scarico.sha512) {
    fs.rmSync(zip, { force: true });
    throw new Error(`Lo zip di Godot scaricato non è quello ufficiale (impronta diversa): non viene usato. Impronta attesa ${scarico.sha512.slice(0, 16)}…, ottenuta ${calcolata.slice(0, 16)}…`);
  }

  avanzamento("Estrazione di Godot…");
  try {
    if (piattaforma === "windows") await execFileAsync(tarDiWindows(), ["-xf", zip, "-C", cartella]);
    else await execFileAsync("unzip", ["-o", "-q", zip, "-d", cartella]);
  } finally {
    fs.rmSync(zip, { force: true });
  }
  const exe = path.join(cartella, scarico.eseguibile);
  if (!fs.existsSync(exe)) throw new Error(`Estrazione completata ma ${scarico.eseguibile} non c'è`);
  if (piattaforma === "linux") fs.chmodSync(exe, 0o755);
  fs.writeFileSync(path.join(cartella, ".verificato"), scarico.sha512);
  avanzamento(`Godot ${version} pronto`);
  return exe;
}
