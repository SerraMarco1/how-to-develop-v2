import { app } from "electron";
import { godotPronto, impostaGodot } from "@htd/condiviso/godot/esegui.ts";
import { installaGodot } from "@htd/condiviso/godot/installa.ts";
import { PERCORSI } from "./percorsi.ts";

// Il Godot di servizio dell'aula: si prepara all'avvio (la prima volta lo scarica, circa 70 MB, e ne controlla
// l'impronta). Una verifica che arriva prima che sia pronto lo aspetta; se l'installazione era fallita (per esempio
// senza rete) la riprova.

let preparazione: Promise<void> | null = null;

function cartellaStrumenti(): string {
  // Durante lo sviluppo le prove possono riusare un Godot già scaricato.
  return !app.isPackaged && process.env.HTD_STRUMENTI_AULA ? process.env.HTD_STRUMENTI_AULA : PERCORSI.strumenti;
}

export function preparaGodot(): Promise<void> {
  preparazione ??= installaGodot(cartellaStrumenti())
    .then((exe) => impostaGodot(exe))
    .catch((errore) => {
      preparazione = null;
      throw errore;
    });
  return preparazione;
}

/** Aspetta che Godot sia pronto. Lancia un errore leggibile se non si può preparare. */
export async function assicuraGodot(): Promise<void> {
  if (godotPronto()) return;
  try {
    await preparaGodot();
  } catch (errore) {
    throw new Error(`Il Godot che controlla gli esercizi non è pronto (${(errore as Error).message}). Controlla la connessione: la prima volta va scaricato.`);
  }
}
