import type { z } from "zod";

// L'estrazione del JSON dalle risposte dei modelli sta nel codice condiviso (la usa anche il tutor dell'aula).
export { estraiJson } from "@htd/condiviso/json.ts";

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
