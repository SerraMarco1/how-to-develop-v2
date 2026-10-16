import fs from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import { database, leggiImpostazione, scriviImpostazione } from "./db.ts";
import { cartellaProgettiPredefinita } from "./percorsi.ts";

// Le impostazioni dell'aula e le chiavi dei fornitori AI usati dal tutor.
// Le chiavi sono cifrate con safeStorage: su Windows le protegge il tuo account (DPAPI). Non tornano mai alla finestra:
// la finestra sa solo se una chiave c'è.

export type FornitoreAula = "groq" | "mistral" | "gemini";
export const FORNITORI_AULA: FornitoreAula[] = ["groq", "mistral", "gemini"];

export function cartellaProgetti(): string {
  return leggiImpostazione<string>("cartella_progetti", cartellaProgettiPredefinita());
}

export function impostaCartellaProgetti(cartella: string): void {
  const assoluta = path.resolve(cartella);
  fs.mkdirSync(assoluta, { recursive: true });
  scriviImpostazione("cartella_progetti", assoluta);
}

export function cartellaProgettiScelta(): boolean {
  return leggiImpostazione<string | null>("cartella_progetti", null) !== null;
}

export function salvaChiave(fornitore: FornitoreAula, chiave: string | null): void {
  if (!chiave) {
    database().prepare("DELETE FROM impostazioni WHERE chiave = ?").run(`chiave_${fornitore}`);
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows non permette di cifrare la chiave: non viene salvata");
  scriviImpostazione(`chiave_${fornitore}`, safeStorage.encryptString(chiave.trim()).toString("base64"));
}

export function leggiChiave(fornitore: FornitoreAula): string | null {
  const cifrata = leggiImpostazione<string | null>(`chiave_${fornitore}`, null);
  if (!cifrata) return null;
  try {
    return safeStorage.decryptString(Buffer.from(cifrata, "base64"));
  } catch {
    return null;
  }
}

export function chiaviPresenti(): Record<FornitoreAula, boolean> {
  return Object.fromEntries(FORNITORI_AULA.map((f) => [f, leggiImpostazione<string | null>(`chiave_${f}`, null) !== null])) as Record<FornitoreAula, boolean>;
}
