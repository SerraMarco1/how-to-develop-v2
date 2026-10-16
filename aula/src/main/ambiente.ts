import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { leggiProjectGodot } from "@htd/condiviso/godot/progetto.ts";
import type { Controllo } from "@htd/condiviso/godot/verifica.ts";
import { infoMotore } from "@htd/condiviso/motore.ts";
import type { Verifica } from "@htd/condiviso/schemi.ts";
import { PERCORSI } from "./percorsi.ts";

// Verifiche "di ambiente": controllano lo stato vero di Godot sul tuo PC, senza immagini e senza AI.
// - quale Godot è aperto (versione, edizione, finestra) si legge dai processi di Windows;
// - l'elenco del Project Manager e le impostazioni dell'editor si leggono dai file che Godot stesso salva.
// Servono alle lezioni in cui non c'è ancora un progetto da leggere (installare Godot, gestire i progetti).

const execFileAsync = promisify(execFile);

export type VerificaAmbiente = Extract<Verifica, { tipo: "godot_aperto" | "progetto_in_elenco" | "impostazione_editor" }>;

/** "4.7": le prime due cifre della versione di Godot del corso. */
function versioneCorso(): string {
  return infoMotore().version.split(".").slice(0, 2).join(".");
}

// ─────────────────────────── Finestre di Godot aperte ───────────────────────────

export type FinestraGodot = { nome: string; titolo: string; percorso: string; versione: string };

const COMANDO_FINESTRE =
  "[Console]::OutputEncoding = [Text.Encoding]::UTF8; " +
  "@(Get-Process | Where-Object { $_.ProcessName -like '*godot*' -and $_.MainWindowTitle } | ForEach-Object { " +
  "$v = ''; try { $v = $_.MainModule.FileVersionInfo.ProductVersion } catch {}; " +
  "[pscustomobject]@{ nome = $_.ProcessName; titolo = $_.MainWindowTitle; percorso = [string]$_.Path; versione = [string]$v } }) | ConvertTo-Json -Compress";

/** Le finestre di Godot aperte in questo momento (escluso il Godot di servizio della piattaforma). */
export async function finestreGodot(): Promise<FinestraGodot[]> {
  if (process.platform !== "win32") return [];
  try {
    const { stdout } = await execFileAsync(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command", COMANDO_FINESTRE], { timeout: 15_000, windowsHide: true });
    const testo = stdout.trim();
    if (!testo) return [];
    const dati = JSON.parse(testo) as FinestraGodot | FinestraGodot[];
    const servizio = path.resolve(PERCORSI.strumenti).toLowerCase();
    return (Array.isArray(dati) ? dati : [dati]).filter((f) => !path.resolve(f.percorso || ".").toLowerCase().startsWith(servizio));
  } catch {
    return [];
  }
}

/** Il Project Manager si intitola "Godot Engine - …"; l'editor "… - NomeProgetto - Godot Engine". */
const eProjectManager = (f: FinestraGodot) => /^Godot Engine\b/i.test(f.titolo);
const eEditor = (f: FinestraGodot) => /- Godot Engine$/i.test(f.titolo);
const edizioneDotNet = (f: FinestraGodot) => /mono|dotnet/i.test(`${f.nome} ${path.basename(f.percorso)}`);

function controllaGodotAperto(v: Extract<VerificaAmbiente, { tipo: "godot_aperto" }>, finestre: FinestraGodot[]): Controllo {
  const corso = versioneCorso();
  const dove = v.finestra === "project_manager" ? " sul Project Manager" : v.finestra === "editor" ? (v.progetto ? ` con il progetto "${v.progetto}" nell'editor` : " con un progetto nell'editor") : "";
  const descrizione = v.descrizione || `Godot ${corso} (edizione standard) è aperto${dove}`;
  if (finestre.length === 0) {
    return { descrizione, superato: false, dettaglio: "Non trovo nessuna finestra di Godot aperta. Avvia Godot e lascialo aperto mentre premi Verifica." };
  }
  const giuste = finestre.filter((f) => !f.versione || f.versione.startsWith(corso));
  if (giuste.length === 0) {
    return { descrizione, superato: false, dettaglio: `È aperto Godot ${finestre[0].versione.split(".").slice(0, 3).join(".")}, ma il corso usa Godot ${corso}: scarica la versione ${corso} da godotengine.org.` };
  }
  const standard = giuste.filter((f) => !edizioneDotNet(f));
  if (standard.length === 0) {
    return { descrizione, superato: false, dettaglio: "È aperta l'edizione .NET di Godot (il file con \"mono\" nel nome). Per il corso serve l'edizione standard: è l'altro download nella stessa pagina." };
  }
  if (v.finestra === "project_manager" && !standard.some(eProjectManager)) {
    return { descrizione, superato: false, dettaglio: `Godot è aperto, ma non sul Project Manager (finestra aperta: "${standard[0].titolo}"). Dall'editor ci torni con Project → Quit to Project List.` };
  }
  if (v.finestra === "editor") {
    const editor = standard.filter(eEditor);
    if (editor.length === 0) return { descrizione, superato: false, dettaglio: "Godot è aperto sul Project Manager, non sull'editor: apri il progetto con un doppio clic sul suo nome." };
    const atteso = v.progetto?.trim().toLowerCase();
    if (atteso && !editor.some((f) => f.titolo.toLowerCase().endsWith(`${atteso} - godot engine`))) {
      return { descrizione, superato: false, dettaglio: `L'editor è aperto su un altro progetto (finestra aperta: "${editor[0].titolo}"). Apri il progetto "${v.progetto}".` };
    }
  }
  const trovata = standard[0];
  return { descrizione, superato: true, dettaglio: `Trovato: Godot ${trovata.versione.split(".").slice(0, 3).join(".") || corso}, finestra "${trovata.titolo}"` };
}

// ─────────────────────────── File che Godot salva sul PC ───────────────────────────

/** Le cartelle dove Godot tiene impostazioni ed elenco dei progetti: quella dell'utente e, se usato così, accanto all'eseguibile. */
function cartelleDatiGodot(finestre: FinestraGodot[]): string[] {
  const cartelle = finestre.map((f) => path.join(path.dirname(f.percorso || "."), "editor_data"));
  if (process.env.APPDATA) cartelle.push(path.join(process.env.APPDATA, "Godot"));
  return [...new Set(cartelle)].filter((c) => fs.existsSync(c));
}

const percorsoNormale = (p: string) => path.resolve(p).replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

/** Le cartelle dei progetti elencati nel Project Manager (file projects.cfg: una sezione per progetto), come le scrive Godot. */
function cartelleInElenco(cartelleDati: string[]): string[] {
  const elenco: string[] = [];
  for (const c of cartelleDati) {
    try {
      for (const m of fs.readFileSync(path.join(c, "projects.cfg"), "utf8").matchAll(/^\[(.+)\]\s*$/gm)) elenco.push(m[1]);
    } catch {
      // Nessun elenco in questa cartella: Godot non ha ancora salvato progetti.
    }
  }
  return elenco;
}

/** Le stesse cartelle in forma confrontabile (barre in avanti, minuscole). */
export function progettiInElenco(cartelleDati: string[]): string[] {
  return cartelleInElenco(cartelleDati).map(percorsoNormale);
}

/** Il valore di un'impostazione dell'editor (file editor_settings-4.x.tres), o undefined se non è mai stata cambiata. */
export function impostazioneEditor(cartelleDati: string[], chiave: string): string | undefined {
  for (const c of cartelleDati) {
    const preferito = path.join(c, `editor_settings-${versioneCorso()}.tres`);
    const file = fs.existsSync(preferito) ? preferito : fs.readdirSync(c).filter((f) => /^editor_settings-4.*\.tres$/.test(f)).sort().map((f) => path.join(c, f)).pop();
    if (!file) continue;
    try {
      const valore = leggiProjectGodot(fs.readFileSync(file, "utf8")).resource?.[chiave];
      if (valore !== undefined) return valore;
    } catch {
      // File illeggibile: si prova la cartella successiva.
    }
  }
  return undefined;
}

const nomeProgetto = (cartella: string): string | null => {
  try {
    return leggiProjectGodot(fs.readFileSync(path.join(cartella, "project.godot"), "utf8")).application?.["config/name"]?.trim().replace(/^"|"$/g, "") ?? "";
  } catch {
    return null;
  }
};

/**
 * Trova la cartella vera del progetto di un esercizio, anche se non è stato creato dove suggerito:
 * 1. la cartella indicata, se contiene project.godot;
 * 2. la sua unica sottocartella con un project.godot (Godot, con "Create Folder" acceso, ne crea una con il nome del progetto);
 * 3. il progetto con il nome atteso nell'elenco del Project Manager di Godot.
 */
export async function trovaCartellaProgetto(indicata: string, nomeAtteso?: string | null): Promise<{ cartella: string; come: "indicata" | "sottocartella" | "elenco" } | null> {
  if (fs.existsSync(path.join(indicata, "project.godot"))) return { cartella: indicata, come: "indicata" };
  if (fs.existsSync(indicata) && fs.statSync(indicata).isDirectory()) {
    const dentro = fs.readdirSync(indicata, { withFileTypes: true }).filter((v) => v.isDirectory() && fs.existsSync(path.join(indicata, v.name, "project.godot")));
    if (dentro.length === 1) return { cartella: path.join(indicata, dentro[0].name), come: "sottocartella" };
  }
  const atteso = nomeAtteso?.trim().toLowerCase();
  if (atteso) {
    const conQuelNome = cartelleInElenco(cartelleDatiGodot(await finestreGodot())).filter((c) => nomeProgetto(c)?.toLowerCase() === atteso);
    if (conQuelNome.length === 1) return { cartella: path.resolve(conQuelNome[0]), come: "elenco" };
  }
  return null;
}

// ─────────────────────────── Punto d'ingresso ───────────────────────────

/**
 * Esegue le verifiche di ambiente. `cartellaProgetto` è la cartella vera del progetto dello studente
 * (serve a cercarla nell'elenco del Project Manager).
 */
export async function controlliAmbiente(tutte: Verifica[], cartellaProgetto?: string): Promise<Controllo[]> {
  const verifiche = tutte.filter((v): v is VerificaAmbiente => v.tipo === "godot_aperto" || v.tipo === "progetto_in_elenco" || v.tipo === "impostazione_editor");
  if (verifiche.length === 0) return [];
  const finestre = await finestreGodot();
  const dati = cartelleDatiGodot(finestre);
  return verifiche.map((v): Controllo => {
    switch (v.tipo) {
      case "godot_aperto":
        return controllaGodotAperto(v, finestre);
      case "progetto_in_elenco": {
        const presente = cartellaProgetto ? progettiInElenco(dati).includes(percorsoNormale(cartellaProgetto)) : false;
        const descrizione = v.descrizione || (v.presente ? "Il progetto compare nell'elenco del Project Manager" : "Il progetto non compare più nell'elenco del Project Manager");
        if (!cartellaProgetto) return { descrizione, superato: false, dettaglio: "Indica la cartella del progetto" };
        if (v.presente) return { descrizione, superato: presente, dettaglio: presente ? undefined : "Godot non ha questo progetto nel suo elenco: crealo dal Project Manager con Create, oppure aggiungilo con Import." };
        return { descrizione, superato: !presente, dettaglio: presente ? "Il progetto è ancora nell'elenco: selezionalo nel Project Manager e premi Remove (la cartella sul disco resta)." : undefined };
      }
      case "impostazione_editor": {
        const valore = impostazioneEditor(dati, v.chiave);
        const ok = valore !== undefined && (!v.contiene || valore.toLowerCase().includes(v.contiene.toLowerCase()));
        return {
          descrizione: v.descrizione || `Impostazione dell'editor ${v.chiave}${v.contiene ? ` = ${v.contiene}` : ""}`,
          superato: ok,
          dettaglio: valore === undefined ? "Impostazione mai cambiata (in Editor → Editor Settings)" : `Valore attuale: ${valore.slice(0, 120)}`,
        };
      }
    }
  });
}
