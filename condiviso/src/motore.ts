import fs from "node:fs";
import path from "node:path";

// Il pacchetto del motore (motori/godot): piano del corso, istruzioni per i modelli, base di verifica, immagini, asset.
// Fabbrica e aula lo trovano in posti diversi (la fabbrica nel repository, l'aula tra le risorse del programma):
// all'avvio dicono dove sta con `impostaCartellaMotore`, e da lì in poi tutto lo legge da qui.

let cartella: string | null = null;

export function impostaCartellaMotore(percorso: string): void {
  if (!fs.existsSync(path.join(percorso, "engine.json"))) throw new Error(`Non trovo il pacchetto del motore in ${percorso}`);
  cartella = path.resolve(percorso);
}

export function cartellaMotore(): string {
  if (!cartella) throw new Error("Cartella del pacchetto motore non impostata (impostaCartellaMotore)");
  return cartella;
}

/** Il percorso di un file del pacchetto. Le parti non possono uscire dalla cartella del pacchetto. */
export function percorsoMotore(...parti: string[]): string {
  const base = cartellaMotore();
  const completo = path.resolve(base, ...parti);
  if (completo !== base && !completo.startsWith(base + path.sep)) throw new Error(`Percorso fuori dal pacchetto motore: ${parti.join("/")}`);
  return completo;
}

export function leggiFileMotore(...parti: string[]): string {
  return fs.readFileSync(percorsoMotore(...parti), "utf8");
}

export function leggiJsonMotore<T>(...parti: string[]): T {
  return JSON.parse(leggiFileMotore(...parti)) as T;
}

export type InfoMotore = {
  id: string;
  name: string;
  version: string;
  releaseUrl: string;
  download: Record<"windows" | "linux", { file: string; sha512: string; eseguibile: string }>;
  docs: { repo: string; branch: string; commit: string; siteBase: string };
};

export function infoMotore(): InfoMotore {
  return leggiJsonMotore<InfoMotore>("engine.json");
}

// ─────────────────────────── Immagini dell'editor ───────────────────────────

export type ImmagineCatalogo = { id: string; file: string; titolo: string; descrizione: string };

/** Le schermate vere dell'editor che una lezione può mostrare (una lezione non può inventarne altre). */
export function catalogoImmagini(): ImmagineCatalogo[] {
  try {
    const dati = leggiJsonMotore<{ immagini: ImmagineCatalogo[] }>("immagini", "catalogo.json");
    return dati.immagini.filter((i) => fs.existsSync(percorsoMotore("immagini", i.file)));
  } catch {
    return [];
  }
}

// ─────────────────────────── Asset del corso ───────────────────────────

export type AssetCorso = { file: string; descrizione: string };

export function elencoAssetCorso(): AssetCorso[] {
  try {
    return leggiJsonMotore<AssetCorso[]>("assets", "elenco.json");
  } catch {
    return [];
  }
}

/** Gli asset del pacchetto citati in un testo (scene, script) come res://assets/<file>. */
export function assetCorsoRiferiti(testo: string): { relativo: string; origine: string }[] {
  return elencoAssetCorso()
    .filter((a) => testo.includes(`assets/${a.file}`))
    .map((a) => ({ relativo: `assets/${a.file}`, origine: percorsoMotore("assets", a.file) }));
}

/** Percorsi (relativi al progetto) sempre disponibili in una soluzione, anche se il modello non li scrive. */
export function percorsiSempreDisponibili(): string[] {
  return ["icon.svg", ...elencoAssetCorso().map((a) => `assets/${a.file}`)];
}
