import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { percorsoMotore } from "../motore.ts";
import type { Copione, FileProgetto, SoggettoVideo } from "../schemi.ts";
import { eseguiGodot, importaProgetto } from "./esegui.ts";

// Il video «Il risultato atteso» di un esercizio: la scena che chi studia avvia, registrata con il Movie Maker di Godot
// seguendo un copione (tasti, soggetti, scritte) e convertita in MP4 con ffmpeg. La base di registrazione
// (motori/godot/harness/htd_video.gd) misura a ogni fotogramma i soggetti del copione; qui si giudicano le misure.
//
// Perché: fino al 19 ottobre 2026 i video riprendevano la scena principale così com'era (il cesto, mezzo fuori dallo
// schermo) e nessuno guardava cosa mostravano. Il caso che lo ha fatto vedere: «Cinque stelle create all'avvio» (1.9),
// con le cinque stelle create davvero ma a y = 700–1070, sotto lo schermo alto 648. Ora un video si pubblica solo se:
//   1. i soggetti del copione si vedono davvero (dentro lo schermo, non nascosti, non trasparenti) e fanno ciò che il
//      copione dice, per la maggior parte del loro intervallo (valutaCopione);
//   2. nei fotogrammi del video, dove Godot dice che c'è un soggetto, c'è qualcosa di diverso dallo sfondo
//      (controllaFotogrammi): prende un nodo coperto da un altro o che non disegna niente;
//   3. lo stesso copione NON passa sul progetto com'era prima dell'esercizio (lo controlla chi chiama, con misuraCopione):
//      altrimenti il video non mostra il risultato dell'esercizio, come i vecchi video.
//
// Il Movie Maker deve disegnare: su Windows si apre per qualche secondo una finestra di Godot; su un server senza schermo
// (la fabbrica su GitHub) si usa uno schermo finto (xvfb) e il disegno via software, con il renderer Compatibility.
// La misura senza video (misuraCopione) gira senza finestra, in meno di un secondo.

const execFileAsync = promisify(execFile);

/** Fotogrammi al secondo del video e delle misure: con --fixed-fps il fotogramma k è all'istante k / FPS. */
export const FPS = 30;
/** Per quanta parte del suo intervallo un soggetto deve vedersi come dice il copione. */
const QUOTA = 0.8;
/** Per «mostrare testo» basta metà dell'intervallo: il testo spesso cambia a metà (un punto preso). */
const QUOTA_TESTO = 0.5;
/** Pixel (nello schermo del gioco) di cui un nodo deve spostarsi per «muoversi». */
const SPOSTAMENTO_MINIMO = 24;
/** Di quanto (0–1, su un canale) deve cambiare il colore per «cambiare colore». */
const CAMBIO_COLORE_MINIMO = 0.2;
/** Di quanto (in proporzione, in larghezza o in altezza) deve cambiare il rettangolo per «cambiare dimensione». */
const CAMBIO_DIMENSIONE_MINIMO = 0.15;
/** La durata minima dell'intervallo di un soggetto: un effetto breve (una scritta che sale e sparisce) dura mezzo secondo. */
const INTERVALLO_MINIMO = 0.5;
/**
 * Nei fotogrammi: quota di pixel diversi dallo sfondo perché in un riquadro «ci sia qualcosa». Bassa perché una scritta
 * corta in una Label larga occupa poco (il «Pronti?» della 3.0, in una Label di 300×50: il 3%); un nodo coperto o che non
 * disegna niente resta sotto l'1%.
 */
const PIXEL_DIVERSI_MINIMI = 0.01;
/** Nei fotogrammi: quota dei riquadri di un soggetto in cui deve esserci qualcosa. */
const RIQUADRI_CON_DISEGNO = 0.6;

// ─────────────────────────── Strumenti ───────────────────────────

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

const dentro = (cartella: string, file: string) => {
  const relativo = path.relative(path.resolve(cartella), path.resolve(file));
  return relativo === "" || (!relativo.startsWith("..") && !path.isAbsolute(relativo));
};

// ─────────────────────────── Il resoconto della base di registrazione ───────────────────────────

const numero = z.number().finite();
const rettangolo = z.array(numero).length(4);

const ResocontoSchema = z.object({
  errore: z.string().optional(),
  errori: z.array(z.string()).default([]),
  schermo: z.array(numero).length(2).optional(),
  fotogrammi: numero.optional(),
  soggetti: z
    .record(
      z.string(),
      z.object({
        /** Ogni 0,1 s dell'intervallo: [t, nodi trovati, nodi che si vedono, nodi che mostrano il testo cercato]. */
        campioni: z.array(z.array(numero).length(4)).default([]),
        nodi: z.record(z.string(), z.object({ nome: z.string(), fotogrammi: numero, spostamento: numero, cambio_colore: numero, cambio_dimensione: numero.default(0) }).passthrough()).default({}),
        esempi: z.array(z.object({ t: numero, nodi: z.array(z.object({ nome: z.string(), rett: rettangolo, dentro: numero, si_vede: z.boolean(), perche: z.string().default(""), testo: z.string().optional() })) })).default([]),
        riquadri: z.array(z.object({ f: z.number().int().nonnegative(), t: numero, rett: z.array(rettangolo) })).default([]),
      }),
    )
    .default({}),
});
export type Resoconto = z.infer<typeof ResocontoSchema>;

/**
 * Il resoconto stampato dalla base di registrazione (riga HTD_VIDEO). Arriva da un'esecuzione di codice delle lezioni:
 * si legge solo come dati, nella forma attesa. Se manca, un resoconto con l'errore e le righe di errore di Godot.
 */
export function leggiResoconto(output: string): Resoconto {
  const riga = output.split(/\r?\n/).filter((r) => r.startsWith("HTD_VIDEO ")).at(-1);
  if (!riga) {
    const errori = output.split(/\r?\n/).filter((r) => /error/i.test(r)).slice(0, 5);
    return { errore: "Godot non ha finito la scena (nessun resoconto)", errori, soggetti: {} };
  }
  try {
    return ResocontoSchema.parse(JSON.parse(riga.slice("HTD_VIDEO ".length)));
  } catch (e) {
    return { errore: `resoconto illeggibile: ${(e as Error).message.slice(0, 200)}`, errori: [], soggetti: {} };
  }
}

/** Copia la base di registrazione e il copione nella cartella (una copia del progetto). */
function preparaCartella(cartella: string, copione: Copione, disegna: boolean): void {
  const htd = path.join(cartella, "htd");
  fs.mkdirSync(htd, { recursive: true });
  fs.copyFileSync(percorsoMotore("harness", "htd_video.gd"), path.join(htd, "htd_video.gd"));
  fs.writeFileSync(path.join(htd, "copione.json"), JSON.stringify({ ...copione, disegna, seed: 1 }));
}

// ─────────────────────────── Registrare e misurare ───────────────────────────

/**
 * Registra la scena del copione con scritte, riquadri e tasti, scrive l'MP4 in `fileMp4` e restituisce le misure fatte
 * durante la registrazione stessa (quindi ciò che il video mostra). La cartella del progetto deve essere una copia: ci
 * vengono scritti i file della registrazione. `fileMp4` deve stare FUORI dalla cartella del progetto: quella, dopo che
 * Godot ci ha girato, può contenere qualunque cosa (nel cloud Godot è un altro utente), e la fabbrica non ci scrive.
 * Se la scena non parte, il resoconto ha `errore` e il video non c'è. Lancia un errore solo per guasti della piattaforma
 * (ffmpeg o lo schermo finto mancanti, nessun video scritto).
 */
export async function registraVideo(opzioni: { cartellaProgetto: string; copione: Copione; fileMp4: string }): Promise<Resoconto> {
  const ffmpeg = await ffmpegDisponibile();
  if (!ffmpeg) throw new Error("ffmpeg non trovato: serve per convertire il video");
  if (dentro(opzioni.cartellaProgetto, opzioni.fileMp4)) throw new Error("Il video va scritto fuori dalla cartella del progetto");
  preparaCartella(opzioni.cartellaProgetto, opzioni.copione, true);
  await importaProgetto(opzioni.cartellaProgetto);
  const avi = path.join(opzioni.cartellaProgetto, "htd", "video.avi");
  const argomenti = ["--path", opzioni.cartellaProgetto, "--write-movie", avi, "--fixed-fps", String(FPS), "-s", "res://htd/htd_video.gd"];
  // Su Linux: renderer Compatibility (OpenGL), disegnato dal processore; senza schermo, dentro uno schermo finto.
  const senzaSchermo = process.platform === "linux" && !process.env.DISPLAY;
  if (process.platform === "linux") argomenti.push("--rendering-method", "gl_compatibility", "--rendering-driver", "opengl3");
  let prefisso: string[] = [];
  if (senzaSchermo) {
    const xvfb = await trova("xvfb-run");
    if (!xvfb) throw new Error("xvfb-run non trovato: senza schermo il video non si può registrare");
    prefisso = [xvfb, "-a", "-s", "-screen 0 1920x1080x24"];
  }
  const esito = await eseguiGodot(argomenti, { timeoutMs: (opzioni.copione.durata * 8 + 90) * 1000, cwd: opzioni.cartellaProgetto, prefisso, ambiente: process.platform === "linux" ? { LIBGL_ALWAYS_SOFTWARE: "1", GALLIUM_DRIVER: "llvmpipe" } : {} });
  const resoconto = leggiResoconto(esito.output);
  if (resoconto.errore) return resoconto;
  // Il video dev'essere un file vero scritto lì (non un collegamento verso altro).
  const voce = fs.existsSync(avi) ? fs.lstatSync(avi) : null;
  if (!voce || !voce.isFile() || voce.size < 1000) {
    throw new Error(`Registrazione non riuscita: ${esito.output.split(/\r?\n/).filter((r) => /error/i.test(r)).slice(0, 5).join(" | ") || "nessun video prodotto"}`);
  }
  fs.mkdirSync(path.dirname(opzioni.fileMp4), { recursive: true });
  // Dimensioni pari (le chiede il formato yuv420p), nessun fotogramma tolto o aggiunto: il fotogramma k resta il k.
  await execFileAsync(ffmpeg, ["-y", "-loglevel", "error", "-i", avi, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "veryfast", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-fps_mode", "passthrough", "-movflags", "+faststart", "-an", opzioni.fileMp4], { timeout: 180_000 });
  try {
    fs.rmSync(avi, { force: true });
  } catch {
    // Resta nella cartella temporanea, che chi chiama toglie.
  }
  return resoconto;
}

/**
 * Le stesse misure senza registrare né disegnare, senza finestra: per controllare il copione sul progetto com'era prima
 * dell'esercizio (in meno di un secondo). La cartella deve essere una copia del progetto.
 */
export async function misuraCopione(opzioni: { cartellaProgetto: string; copione: Copione }): Promise<Resoconto> {
  preparaCartella(opzioni.cartellaProgetto, opzioni.copione, false);
  await importaProgetto(opzioni.cartellaProgetto);
  const esito = await eseguiGodot(["--headless", "--path", opzioni.cartellaProgetto, "--fixed-fps", String(FPS), "-s", "res://htd/htd_video.gd"], { timeoutMs: (opzioni.copione.durata * 4 + 60) * 1000, cwd: opzioni.cartellaProgetto });
  return leggiResoconto(esito.output);
}

// ─────────────────────────── Il giudizio sulle misure ───────────────────────────

const cifra = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const percento = (x: number) => `${Math.round(x * 100)}%`;

function descriviCerca(c: SoggettoVideo["cerca"]): string {
  return Object.entries(c)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} = ${v}`)
    .join(", ");
}

export function descriviSoggetto(s: SoggettoVideo): string {
  const cosa = s.deve === "mostrare testo" ? `mostrare il testo «${s.testo ?? ""}»` : s.deve;
  return `«${s.id}» (${descriviCerca(s.cerca)}; almeno ${s.quanti} da ${cifra(s.da)} a ${cifra(s.a)} s; deve ${cosa})`;
}

/** Come stanno i nodi del soggetto in un istante utile: il primo in cui qualcosa non si vede, o la metà dell'intervallo. */
function esempio(s: SoggettoVideo, m: Resoconto["soggetti"][string], schermo: number[] | undefined): string {
  const conNodi = m.esempi.filter((e) => e.nodi.length > 0);
  if (!conNodi.length) return "";
  const meta = (s.da + s.a) / 2;
  const scelto = conNodi.find((e) => e.nodi.some((n) => !n.si_vede)) ?? conNodi.reduce((a, b) => (Math.abs(b.t - meta) < Math.abs(a.t - meta) ? b : a));
  const nodi = scelto.nodi.slice(0, 4).map((n) => {
    const [x, y, w, h] = n.rett;
    const stato = n.si_vede ? "si vede" : n.perche === "fuori dallo schermo" ? `fuori dallo schermo (dentro per il ${percento(n.dentro)})` : n.perche;
    return `«${n.nome}» a (${cifra(x)}, ${cifra(y)}) ${cifra(w)}×${cifra(h)}, ${stato}${n.testo !== undefined ? `, testo «${n.testo}»` : ""}`;
  });
  return ` A ${cifra(scelto.t)} s: ${nodi.join("; ")}.${schermo ? ` Lo schermo va da (0, 0) a (${cifra(schermo[0])}, ${cifra(schermo[1])}).` : ""}`;
}

export type GiudizioCopione = { problemi: string[]; superati: string[] };

/**
 * Giudica le misure di un'esecuzione del copione: per ogni soggetto, se nel suo intervallo si vede quanto e come il
 * copione dice. `problemi` spiega, con i numeri misurati, ogni soggetto che non va (è ciò che torna al modello).
 */
export function valutaCopione(copione: Copione, resoconto: Resoconto): GiudizioCopione {
  if (resoconto.errore) return { problemi: [`La scena non è partita: ${resoconto.errore}.${resoconto.errori.length ? ` Errori: ${resoconto.errori.slice(0, 3).join(" | ")}` : ""}`], superati: [] };
  const problemi: string[] = [];
  const superati: string[] = [];
  for (const s of copione.soggetti) {
    const m = resoconto.soggetti[s.id];
    const campioni = m?.campioni ?? [];
    const nome = `Soggetto ${descriviSoggetto(s)}`;
    if (!m || !campioni.length) {
      problemi.push(`${nome}: nessuna misura nel suo intervallo (la scena non è arrivata a quel momento).`);
      continue;
    }
    const trovatiMax = Math.max(...campioni.map((c) => c[1]));
    const visibiliMax = Math.max(...campioni.map((c) => c[2]));
    const quota = (filtro: (c: number[]) => boolean, elenco = campioni) => (elenco.length ? elenco.filter(filtro).length / elenco.length : 0);
    const presenti = quota((c) => c[2] >= s.quanti);
    if (trovatiMax === 0) {
      problemi.push(`${nome}: nessun nodo della scena in esecuzione corrisponde a ${descriviCerca(s.cerca)}.`);
      continue;
    }
    const nodi = Object.values(m.nodi);
    const pochi = () => `si vedono almeno ${s.quanti} nodi solo nel ${percento(presenti)} dell'intervallo (serve l'${percento(QUOTA)}): trovati fino a ${trovatiMax}, visibili al massimo ${visibiliMax}.`;
    const durata = s.a - s.da;
    const inizio = campioni.filter((c) => c[0] <= s.da + Math.max(0.2, durata * 0.15));
    const fine = campioni.filter((c) => c[0] >= s.a - Math.max(0.5, durata * 0.3));
    let motivo = "";
    switch (s.deve) {
      case "esserci":
        if (presenti < QUOTA) motivo = pochi();
        break;
      case "muoversi": {
        const mossi = nodi.filter((n) => n.spostamento >= SPOSTAMENTO_MINIMO).length;
        if (presenti < QUOTA) motivo = pochi();
        else if (mossi < s.quanti) motivo = `si vedono, ma si sono spostati di almeno ${SPOSTAMENTO_MINIMO} pixel solo ${mossi} nodi su ${s.quanti} (spostamento massimo ${cifra(Math.max(0, ...nodi.map((n) => n.spostamento)))} pixel).`;
        break;
      }
      case "cambiare colore": {
        const cambiati = nodi.filter((n) => n.cambio_colore >= CAMBIO_COLORE_MINIMO).length;
        if (presenti < QUOTA) motivo = pochi();
        else if (cambiati < s.quanti) motivo = `si vedono, ma hanno cambiato colore solo ${cambiati} nodi su ${s.quanti} (cambio massimo ${cifra(Math.max(0, ...nodi.map((n) => n.cambio_colore)))} su 1, ne serve ${CAMBIO_COLORE_MINIMO}).`;
        break;
      }
      case "cambiare dimensione": {
        const cambiati = nodi.filter((n) => n.cambio_dimensione >= CAMBIO_DIMENSIONE_MINIMO).length;
        if (presenti < QUOTA) motivo = pochi();
        else if (cambiati < s.quanti) motivo = `si vedono, ma hanno cambiato dimensione solo ${cambiati} nodi su ${s.quanti} (cambio massimo ${percento(Math.max(0, ...nodi.map((n) => n.cambio_dimensione)))}, serve il ${percento(CAMBIO_DIMENSIONE_MINIMO)}).`;
        break;
      }
      case "mostrare testo": {
        const conTesto = quota((c) => c[3] >= s.quanti);
        if (!s.testo) motivo = "manca il testo da cercare.";
        else if (conTesto < QUOTA_TESTO) motivo = `il testo «${s.testo}» si vede solo nel ${percento(conTesto)} dell'intervallo (serve il ${percento(QUOTA_TESTO)}); visibili al massimo ${visibiliMax} nodi.`;
        break;
      }
      case "comparire": {
        const primaNo = inizio.every((c) => c[2] < s.quanti);
        const dopoSi = quota((c) => c[2] >= s.quanti, fine);
        if (!primaNo) motivo = `si vedono già all'inizio dell'intervallo (${cifra(s.da)} s): non compaiono durante.`;
        else if (dopoSi < QUOTA) motivo = `alla fine dell'intervallo si vedono solo nel ${percento(dopoSi)} del tempo (serve l'${percento(QUOTA)}): visibili al massimo ${visibiliMax}.`;
        break;
      }
      case "sparire": {
        const primaSi = inizio.every((c) => c[2] >= s.quanti);
        const dopoNo = quota((c) => c[2] < s.quanti, fine);
        if (!primaSi) motivo = `all'inizio dell'intervallo (${cifra(s.da)} s) non se ne vedono ${s.quanti}: non possono sparire.`;
        else if (dopoNo < QUOTA) motivo = `alla fine dell'intervallo si vedono ancora nel ${percento(1 - dopoNo)} del tempo.`;
        break;
      }
    }
    if (motivo) problemi.push(`${nome}: ${motivo}${esempio(s, m, resoconto.schermo)}${resoconto.errori.length ? ` Errori del progetto: ${resoconto.errori.slice(0, 2).join(" | ")}` : ""}`);
    else superati.push(s.id);
  }
  return { problemi, superati };
}

/**
 * Vero se il risultato non si vede perché i nodi ci sono ma stanno fuori dallo schermo (o nascosti, o trasparenti):
 * è un problema dell'esercizio, non del copione. Serve a dirlo nella traccia.
 */
export function nodiCheNonSiVedono(copione: Copione, resoconto: Resoconto): string[] {
  if (resoconto.errore) return [];
  return copione.soggetti.flatMap((s) => {
    const campioni = resoconto.soggetti[s.id]?.campioni ?? [];
    const trovati = Math.max(0, ...campioni.map((c) => c[1]));
    const visibili = Math.max(0, ...campioni.map((c) => c[2]));
    return trovati >= s.quanti && visibili < s.quanti ? [`«${s.id}»: ${trovati} nodi trovati, al massimo ${visibili} visibili.${esempio(s, resoconto.soggetti[s.id], resoconto.schermo)}`] : [];
  });
}

// ─────────────────────────── I fotogrammi veri ───────────────────────────

/** Il colore più frequente fra i pixel indicati (a 5 bit per canale), e quanti pixel ha guardato. */
function coloreDominante(dati: Buffer, indici: Iterable<number>): { colore: [number, number, number]; quota: number; guardati: number } {
  const conta = new Map<number, number>();
  let guardati = 0;
  for (const i of indici) {
    const chiave = ((dati[i] >> 3) << 10) | ((dati[i + 1] >> 3) << 5) | (dati[i + 2] >> 3);
    conta.set(chiave, (conta.get(chiave) ?? 0) + 1);
    guardati++;
  }
  if (!guardati) return { colore: [0, 0, 0], quota: 0, guardati };
  const [chiave, volte] = [...conta.entries()].sort((a, b) => b[1] - a[1])[0];
  return { colore: [((chiave >> 10) << 3) + 4, (((chiave >> 5) & 31) << 3) + 4, ((chiave & 31) << 3) + 4], quota: volte / guardati, guardati };
}

/**
 * Guarda i fotogrammi del video: dove Godot dice che un soggetto si vede, nei pixel ci deve essere qualcosa di diverso
 * dallo sfondo che ha intorno (il colore più frequente in due strisce a sinistra e a destra del riquadro, dove le
 * scritte del video non arrivano; il colore più frequente del fotogramma se lì non c'è posto). Prende un nodo coperto da
 * un altro, una texture che non si carica, un disegno andato storto (fotogrammi tutti di un colore). Con uno sfondo
 * disegnato (non un colore) il controllo è più debole: lascia passare, non boccia.
 */
export async function controllaFotogrammi(fileVideo: string, copione: Copione, resoconto: Resoconto): Promise<string[]> {
  const ffmpeg = await ffmpegDisponibile();
  if (!ffmpeg) throw new Error("ffmpeg non trovato: serve per guardare i fotogrammi");
  if (!resoconto.schermo) return ["Il resoconto della registrazione non dice quanto è grande lo schermo."];
  // Le dimensioni del video: dalla descrizione che ffmpeg dà del file (esce con errore perché manca l'uscita: va bene).
  const info = await execFileAsync(ffmpeg, ["-hide_banner", "-i", fileVideo], { timeout: 60_000 }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const dim = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(String(info.stderr));
  if (!dim) throw new Error("Dimensioni del video non trovate");
  const [vw, vh] = [Number(dim[1]), Number(dim[2])];
  // Un fotogramma ogni 15 (ogni 0,5 s, come i riquadri del resoconto), a metà risoluzione.
  const [dw, dh] = [2 * Math.floor(vw / 4), 2 * Math.floor(vh / 4)];
  const { stdout } = await execFileAsync(ffmpeg, ["-loglevel", "error", "-i", fileVideo, "-vf", `framestep=15,scale=${dw}:${dh}`, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { encoding: "buffer", maxBuffer: 512 * 1024 * 1024, timeout: 180_000 });
  const passo = dw * dh * 3;
  const fotogrammi = Math.floor(stdout.length / passo);
  if (fotogrammi === 0) return ["Il video non ha fotogrammi leggibili."];
  const sfondi: [number, number, number][] = [];
  let uniformi = 0;
  for (let k = 0; k < fotogrammi; k++) {
    const campione = function* () {
      for (let i = k * passo; i < (k + 1) * passo; i += 3 * 7) yield i;
    };
    const { colore, quota } = coloreDominante(stdout, campione());
    if (quota > 0.995) uniformi++;
    sfondi.push(colore);
  }
  if (uniformi === fotogrammi) return ["Nel video tutti i fotogrammi sono di un solo colore: la scena non è stata disegnata."];
  // Le strisce ai lati di un riquadro: da 5 a 11 pixel fuori (10–22 nel gioco), oltre il bordo giallo disegnato a 6.
  const strisce = function* (k: number, x0: number, y0: number, x1: number, y1: number) {
    for (const [a, b] of [
      [x0 - 11, x0 - 5],
      [x1 + 5, x1 + 11],
    ]) {
      for (let yy = y0; yy < y1; yy++) for (let xx = Math.max(0, a); xx < Math.min(dw, b); xx++) yield k * passo + (yy * dw + xx) * 3;
    }
  };
  // Le coordinate del resoconto sono quelle dello schermo del gioco; il video può essere più grande (finestra allargata).
  const sx = dw / resoconto.schermo[0];
  const sy = dh / resoconto.schermo[1];
  const problemi: string[] = [];
  for (const s of copione.soggetti) {
    const riquadri = (resoconto.soggetti[s.id]?.riquadri ?? []).filter((r) => r.f % 15 === 0 && r.f / 15 < fotogrammi);
    let guardati = 0;
    let pieni = 0;
    for (const r of riquadri) {
      const k = r.f / 15;
      for (const [x, y, w, h] of r.rett) {
        const x0 = Math.max(0, Math.round(x * sx));
        const y0 = Math.max(0, Math.round(y * sy));
        const x1 = Math.min(dw, Math.round((x + w) * sx));
        const y1 = Math.min(dh, Math.round((y + h) * sy));
        if (x1 - x0 < 6 || y1 - y0 < 6) continue;
        const intorno = coloreDominante(stdout, strisce(k, x0, y0, x1, y1));
        const [br, bg, bb] = intorno.guardati >= 20 ? intorno.colore : sfondi[k];
        let diversi = 0;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const i = k * passo + (yy * dw + xx) * 3;
            if (Math.abs(stdout[i] - br) + Math.abs(stdout[i + 1] - bg) + Math.abs(stdout[i + 2] - bb) > 40) diversi++;
          }
        }
        guardati++;
        if (diversi / ((x1 - x0) * (y1 - y0)) >= PIXEL_DIVERSI_MINIMI) pieni++;
      }
    }
    if (guardati > 0 && pieni / guardati < RIQUADRI_CON_DISEGNO) {
      problemi.push(`Soggetto ${descriviSoggetto(s)}: Godot dice che si vede, ma nei fotogrammi del video in quel punto c'è solo lo sfondo (qualcosa di disegnato in ${pieni} riquadri su ${guardati}): un altro nodo lo copre, o non disegna niente.`);
    }
  }
  return problemi;
}

// ─────────────────────────── Il copione, prima di girarlo ───────────────────────────

/** Il nome di una scena come lo vede chi studia nel pannello FileSystem: res://levels/main.tscn → levels/main.tscn. */
export const nomeScena = (scena: string) => scena.replace(/^res:\/\//, "");

/**
 * Il copione con la durata tagliata a un secondo dopo l'ultimo soggetto, l'ultima scritta e l'ultimo tasto: niente
 * secondi vuoti in fondo (nella 1.2 la stella esce dallo schermo dopo 3 secondi; un video di 6 ne mostrava 3 vuoti).
 */
export function accorciaCopione(copione: Copione): Copione {
  const fine = Math.max(...copione.soggetti.map((s) => s.a), ...copione.scritte.map((w) => w.a), ...copione.azioni.map((a) => a.fine));
  return { ...copione, durata: Math.max(4, Math.min(copione.durata, Math.ceil((fine + 1) * 10) / 10)) };
}

/**
 * Da dove comincia il video pubblicato: un secondo e mezzo prima della prima scritta o del primo soggetto, se prima ci
 * sono più di 3 secondi in cui non si spiega niente; 0 = dall'inizio. Il gioco deve comunque girare da capo (nella 2.5
 * la pausa tra le ondate arriva a 10 secondi: il primo video mostrava 10 secondi di cesto fermo e mezzo secondo di
 * pausa), ma chi guarda non deve aspettare. Misure e fotogrammi si controllano sulla registrazione intera, poi l'inizio
 * si taglia (tagliaInizio).
 */
export function inizioDelVideo(copione: Copione): number {
  const primo = Math.min(...copione.scritte.map((w) => w.da), ...copione.soggetti.map((s) => s.da));
  return primo > 3 ? Math.round((primo - 1.5) * 10) / 10 : 0;
}

/** Scrive in `uscita` il video `ingresso` senza i suoi primi `inizio` secondi. */
export async function tagliaInizio(ingresso: string, uscita: string, inizio: number): Promise<void> {
  const ffmpeg = await ffmpegDisponibile();
  if (!ffmpeg) throw new Error("ffmpeg non trovato: serve per tagliare il video");
  await execFileAsync(ffmpeg, ["-y", "-loglevel", "error", "-ss", String(inizio), "-i", ingresso, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "veryfast", "-movflags", "+faststart", "-an", uscita], { timeout: 180_000 });
}

/** Come chi studia avvia la scena del video: F5 se è la scena principale, altrimenti F6 con la scena aperta. */
export function comeSiAvvia(copione: Pick<Copione, "scena">, scenaPrincipale: string | null | undefined): string {
  return copione.scena === scenaPrincipale ? "Avvia il gioco con F5" : `Apri ${nomeScena(copione.scena)} e premi F6`;
}

/**
 * I problemi di un copione che si vedono senza eseguirlo: scena, file, azioni e tempi devono esistere ed essere coerenti,
 * e le scritte una alla volta. La scena può essere anche una che non è la principale: la didascalia del video dice come
 * avviarla (F6). Fino al 19 ottobre sera doveva essere nominata nella consegna: così restavano senza video la stella
 * della 1.7 e i menu della fase 3, che si vedono solo aprendo la loro scena.
 */
export function problemiDelCopione(copione: Copione, contesto: { file: FileProgetto[]; azioni: string[] }): string[] {
  const problemi: string[] = [];
  const esiste = (risorsa: string) => contesto.file.some((f) => `res://${f.percorso}` === risorsa);
  const scene = contesto.file.filter((f) => f.percorso.endsWith(".tscn")).map((f) => `res://${f.percorso}`);
  if (!esiste(copione.scena)) problemi.push(`La scena ${copione.scena} non c'è nella soluzione (scene: ${scene.join(", ") || "nessuna"}).`);
  const ids = new Set<string>();
  for (const s of copione.soggetti) {
    if (ids.has(s.id)) problemi.push(`Due soggetti si chiamano «${s.id}».`);
    ids.add(s.id);
    if (s.cerca.scena && !esiste(s.cerca.scena)) problemi.push(`Soggetto «${s.id}»: la scena ${s.cerca.scena} non c'è nella soluzione.`);
    if (s.cerca.script && !esiste(s.cerca.script)) problemi.push(`Soggetto «${s.id}»: lo script ${s.cerca.script} non c'è nella soluzione.`);
    if (s.a > copione.durata + 0.001) problemi.push(`Soggetto «${s.id}»: l'intervallo finisce a ${cifra(s.a)} s, dopo la fine del video (${cifra(copione.durata)} s).`);
    if (s.a - s.da < INTERVALLO_MINIMO - 0.001) problemi.push(`Soggetto «${s.id}»: l'intervallo (da ${cifra(s.da)} a ${cifra(s.a)} s) deve durare almeno ${cifra(INTERVALLO_MINIMO)} secondi.`);
    if (s.deve === "mostrare testo" && !s.testo) problemi.push(`Soggetto «${s.id}»: per "mostrare testo" serve il campo testo.`);
  }
  for (const a of copione.azioni) {
    if (!contesto.azioni.includes(a.azione)) problemi.push(`L'azione «${a.azione}» non è nella Input Map del progetto (azioni: ${contesto.azioni.join(", ") || "nessuna"}).`);
    if (a.fine <= a.inizio || a.fine > copione.durata + 0.001) problemi.push(`L'azione «${a.azione}»: tempi da ${cifra(a.inizio)} a ${cifra(a.fine)} s non validi (il video dura ${cifra(copione.durata)} s).`);
  }
  for (const w of copione.scritte) {
    const s = copione.soggetti.find((x) => x.id === w.soggetto);
    if (!s) problemi.push(`La scritta «${w.testo}» è legata al soggetto «${w.soggetto}», che non c'è.`);
    else if (w.da < s.da - 0.05 || w.a > s.a + 0.05 || w.a <= w.da) problemi.push(`La scritta «${w.testo}» (da ${cifra(w.da)} a ${cifra(w.a)} s) deve stare dentro l'intervallo del suo soggetto «${s.id}» (da ${cifra(s.da)} a ${cifra(s.a)} s).`);
  }
  // Una scritta alla volta: con due nello stesso momento se ne vede una sola (3.0 es2, 19 ottobre: tre scritte da 0,5 a 8 s).
  const ordinate = [...copione.scritte].sort((a, b) => a.da - b.da);
  for (let i = 1; i < ordinate.length; i++) {
    if (ordinate[i].da < ordinate[i - 1].a - 0.05) problemi.push(`Le scritte «${ordinate[i - 1].testo}» (fino a ${cifra(ordinate[i - 1].a)} s) e «${ordinate[i].testo}» (da ${cifra(ordinate[i].da)} s) si sovrappongono: se ne vedrebbe una sola. Mettile una dopo l'altra.`);
  }
  return problemi;
}
