import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { percorsoMotore } from "../motore.ts";
import { eseguiGodot, importaProgetto } from "./esegui.ts";

// Il video di un progetto in esecuzione, registrato con il Movie Maker di Godot e convertito in MP4 con ffmpeg.
// Il Movie Maker deve disegnare: su Windows si apre per qualche secondo una finestra di Godot; su un server senza schermo
// (la fabbrica su GitHub) si usa uno schermo finto (xvfb) e il disegno via software, con il renderer Compatibility.

const execFileAsync = promisify(execFile);

export type AzioneDemo = { azione: string; inizio: number; fine: number };

async function trova(programma: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(process.platform === "win32" ? "where" : "which", [programma]);
    return stdout.split(/\r?\n/)[0]?.trim() || null;
  } catch {
    return null;
  }
}

export async function ffmpegDisponibile(): Promise<string | null> {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  return trova("ffmpeg");
}

/**
 * Registra `durata` secondi della scena indicata (o della principale) simulando le azioni di input, e scrive l'MP4 in
 * `fileMp4`. La cartella del progetto deve essere una copia: ci vengono scritti i file della registrazione.
 */
export async function registraVideo(opzioni: { cartellaProgetto: string; scena?: string; durata: number; azioni: AzioneDemo[]; fileMp4: string }): Promise<void> {
  const ffmpeg = await ffmpegDisponibile();
  if (!ffmpeg) throw new Error("ffmpeg non trovato: serve per convertire il video");
  const htd = path.join(opzioni.cartellaProgetto, "htd");
  fs.mkdirSync(htd, { recursive: true });
  fs.copyFileSync(percorsoMotore("harness", "htd_demo.gd"), path.join(htd, "htd_demo.gd"));
  const config: Record<string, unknown> = { duration: opzioni.durata, actions: opzioni.azioni.map((a) => ({ action: a.azione, start: a.inizio, end: a.fine })) };
  if (opzioni.scena) config.scene = opzioni.scena.startsWith("res://") ? opzioni.scena : `res://${opzioni.scena}`;
  fs.writeFileSync(path.join(htd, "demo.json"), JSON.stringify(config));
  await importaProgetto(opzioni.cartellaProgetto);
  const avi = path.join(htd, "video.avi");
  const argomenti = ["--path", opzioni.cartellaProgetto, "--write-movie", avi, "--fixed-fps", "30", "-s", "res://htd/htd_demo.gd"];
  // Senza schermo: renderer Compatibility (OpenGL) disegnato dal processore, dentro uno schermo finto.
  const senzaSchermo = process.platform === "linux" && !process.env.DISPLAY;
  if (senzaSchermo || process.platform === "linux") argomenti.push("--rendering-method", "gl_compatibility", "--rendering-driver", "opengl3");
  const timeoutMs = (opzioni.durata * 6 + 90) * 1000;
  let prefisso: string[] = [];
  if (senzaSchermo) {
    const xvfb = await trova("xvfb-run");
    if (!xvfb) throw new Error("xvfb-run non trovato: senza schermo il video non si può registrare");
    prefisso = [xvfb, "-a", "-s", "-screen 0 1280x720x24"];
  }
  const esito = await eseguiGodot(argomenti, { timeoutMs, cwd: opzioni.cartellaProgetto, prefisso, ambiente: process.platform === "linux" ? { LIBGL_ALWAYS_SOFTWARE: "1", GALLIUM_DRIVER: "llvmpipe" } : {} });
  if (!fs.existsSync(avi) || fs.statSync(avi).size < 1000) {
    throw new Error(`Registrazione non riuscita: ${esito.output.split(/\r?\n/).filter((r) => /error/i.test(r)).slice(0, 5).join(" | ") || "nessun video prodotto"}`);
  }
  fs.mkdirSync(path.dirname(opzioni.fileMp4), { recursive: true });
  await execFileAsync(ffmpeg, ["-y", "-loglevel", "error", "-i", avi, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "veryfast", "-vf", "scale=960:-2", "-movflags", "+faststart", "-an", opzioni.fileMp4], { timeout: 180_000 });
  try {
    fs.rmSync(avi, { force: true });
  } catch {
    // Resta nella cartella temporanea, che chi chiama toglie.
  }
}
