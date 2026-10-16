import type { PaccoLezione } from "./pacchetto.ts";
import { controllaFileLezione, controllaGDScript, descriviViolazioni } from "./sicurezza.ts";

// L'ultimo controllo di sicurezza su una lezione intera: lo fa la fabbrica prima di pubblicarla e lo rifà l'aula prima
// di accettarla. Gli stessi controlli, nello stesso codice: se una lezione passa da una parte, passa anche dall'altra.

/** Tutti i file di progetto della lezione: quelli che arrivano sul PC di chi studia. */
export function fileDellaLezione(p: Pick<PaccoLezione, "contenuto" | "statoFinale">): { percorso: string; contenuto: string }[][] {
  const esercizi = [...p.contenuto.esercizi, p.contenuto.test];
  return [p.statoFinale?.file ?? [], p.contenuto.statoIniziale?.file ?? [], ...esercizi.map((e) => e.soluzione.file), ...esercizi.map((e) => e.partenza?.file ?? [])];
}

/** I problemi di sicurezza di una lezione (vuoto = va bene). */
export function problemiDelPacco(p: Pick<PaccoLezione, "contenuto" | "statoFinale" | "ripasso">): string[] {
  const problemi = fileDellaLezione(p).flatMap((file) => descriviViolazioni(controllaFileLezione(file)));
  for (const e of [...p.contenuto.esercizi, p.contenuto.test]) {
    e.verifiche.forEach((v, i) => {
      if (v.tipo === "script_godot") problemi.push(...descriviViolazioni(controllaGDScript(`${e.id} verifica ${i + 1}`, v.codice)));
    });
    e.previsioni.forEach((v, i) => problemi.push(...descriviViolazioni(controllaGDScript(`${e.id} previsione ${i + 1}`, v.codice))));
  }
  p.ripasso.forEach((v, i) => problemi.push(...descriviViolazioni(controllaGDScript(`ripasso ${i + 1}`, v.codice))));
  return [...new Set(problemi)];
}
