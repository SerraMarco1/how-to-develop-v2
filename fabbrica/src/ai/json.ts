import type { z } from "zod";

// I modelli a volte aggiungono testo o blocchi ``` intorno al JSON: qui lo estraiamo e lo validiamo.

/** Estrae il primo oggetto JSON completo da un testo. */
export function estraiJson(testo: string): unknown {
  const pulito = testo.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  try {
    return JSON.parse(pulito);
  } catch {
    // continua sotto
  }
  const recintato = pulito.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (recintato) {
    try {
      return JSON.parse(recintato[1]);
    } catch {
      // continua sotto
    }
  }
  const inizio = pulito.indexOf("{");
  if (inizio === -1) throw new Error("Nessun oggetto JSON nella risposta");
  let profondita = 0;
  let inStringa = false;
  let escape = false;
  for (let i = inizio; i < pulito.length; i++) {
    const c = pulito[i];
    if (inStringa) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inStringa = false;
      continue;
    }
    if (c === '"') inStringa = true;
    else if (c === "{") profondita++;
    else if (c === "}") {
      profondita--;
      if (profondita === 0) return JSON.parse(pulito.slice(inizio, i + 1));
    }
  }
  throw new Error("JSON incompleto nella risposta (forse troncato)");
}

/** Valida con uno schema zod e restituisce un messaggio d'errore leggibile per il modello. */
export function validaJson<T>(schema: z.ZodType<T>, dati: unknown): { ok: true; dati: T } | { ok: false; errore: string } {
  const esito = schema.safeParse(dati);
  if (esito.success) return { ok: true, dati: esito.data };
  const errori = esito.error.issues
    .slice(0, 12)
    .map((i) => `- ${i.path.join(".") || "(radice)"}: ${i.message}`)
    .join("\n");
  return { ok: false, errore: errori };
}
