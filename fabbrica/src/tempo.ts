import { CONFIG } from "./configurazione.ts";

// Il tempo di un giro. GitHub ferma un lavoro che supera il tempo massimo: prima che succeda, la fabbrica smette di
// cominciare passi nuovi, salva ed esce. Il giro dopo riparte da lì.

let inizio = Date.now();
let minuti = CONFIG.minutiGiro;

export function cominciaGiro(budgetMinuti = CONFIG.minutiGiro): void {
  inizio = Date.now();
  minuti = budgetMinuti;
}

export function tempoRimastoMs(): number {
  return inizio + minuti * 60_000 - Date.now();
}

/** Il giro ha finito il suo tempo: non si comincia niente di nuovo. Non è un guasto. */
export class GiroFinito extends Error {
  constructor() {
    super("Tempo del giro finito: il lavoro riprende al prossimo giro dal punto in cui è arrivato");
  }
}

/** Da chiamare prima di ogni passo lungo (una richiesta, un controllo in Godot). */
export function controllaTempo(): void {
  if (tempoRimastoMs() <= 0) throw new GiroFinito();
}
