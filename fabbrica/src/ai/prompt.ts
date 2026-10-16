import { leggiFileMotore } from "@htd/condiviso/motore.ts";
import type { Messaggio } from "./client.ts";

// Le istruzioni per i modelli stanno nel pacchetto del motore (motori/godot/prompts/*.md), con segnaposto {{nome}}.
// Per migliorare le lezioni di solito basta cambiare quei file, non il codice.

export function riempi(modello: string, valori: Record<string, string | number | undefined>): string {
  return modello.replace(/\{\{(\w+)\}\}/g, (_, chiave: string) => {
    const v = valori[chiave];
    return v === undefined || v === "" ? "(nessuno)" : String(v);
  });
}

export function prompt(nome: string, valori: Record<string, string | number | undefined>): string {
  return riempi(leggiFileMotore("prompts", `${nome}.md`), valori);
}

/** Istruzioni generali del corso + richiesta specifica. */
export function messaggi(nome: string, valori: Record<string, string | number | undefined>): Messaggio[] {
  return [
    { role: "system", content: leggiFileMotore("prompts", "sistema.md") },
    { role: "user", content: prompt(nome, valori) },
  ];
}

export function stileDiCasa(): string {
  return leggiFileMotore("stile-di-casa.md");
}

/** La sezione «Fatti da non sbagliare» dello stile di casa: l'elenco breve che serve a chi rivede una lezione. */
export function fattiCerti(): string {
  const sezione = stileDiCasa().match(/## Fatti da non sbagliare[^\n]*\n([\s\S]*?)(?=\n## )/);
  return sezione ? sezione[1].trim() : "";
}

/** Le funzioni della base di verifica, descritte dai commenti ## del file GDScript. */
export function documentazioneHarness(): string {
  const linee = leggiFileMotore("harness", "htd_test.gd").split(/\r?\n/);
  const righe: string[] = [];
  for (let i = 0; i < linee.length; i++) {
    const firma = linee[i].match(/^func ([a-z][\w]*\(.*\).*):$/);
    if (!firma || firma[1].startsWith("_")) continue;
    const commento: string[] = [];
    for (let j = i - 1; j >= 0 && linee[j].startsWith("##"); j--) commento.unshift(linee[j].replace(/^##\s?/, ""));
    if (commento.length === 0) continue;
    righe.push(`- \`${firma[1]}\` — ${commento.join(" ")}`);
  }
  return righe.join("\n");
}
