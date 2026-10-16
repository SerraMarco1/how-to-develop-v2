// Il JSON che arriva dai modelli. A volte ha testo o blocchi ``` intorno, e a volte il codice dentro le stringhe è
// scritto con gli a capo e le tabulazioni VERI invece che come \n e \t: il contenuto è giusto, la confezione no
// (misurato il 16 ottobre 2026: una teoria di gemini-3.7-flash con 33 tabulazioni e diversi a capo dentro "codice").
// Qui si estrae il primo oggetto JSON e, se serve, si scrivono in modo corretto quei caratteri: non cambia nient'altro.

/**
 * Dentro le stringhe JSON, i caratteri di controllo (a capo, tabulazione…) scritti così come sono diventano le loro
 * sequenze (\n, \t, \u00XX). Fuori dalle stringhe non si tocca niente.
 */
export function scappaControlli(testo: string): string {
  let risultato = "";
  let inStringa = false;
  let escape = false;
  for (const c of testo) {
    if (!inStringa) {
      if (c === '"') inStringa = true;
      risultato += c;
      continue;
    }
    if (escape) {
      escape = false;
      risultato += c;
      continue;
    }
    if (c === "\\") escape = true;
    else if (c === '"') inStringa = false;
    else if (c.charCodeAt(0) < 0x20) {
      risultato += c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
      continue;
    }
    risultato += c;
  }
  return risultato;
}

/** JSON.parse, e se fallisce lo stesso testo con i caratteri di controllo dentro le stringhe scritti correttamente. */
function leggi(testo: string): unknown {
  try {
    return JSON.parse(testo);
  } catch (errore) {
    const riparato = scappaControlli(testo);
    if (riparato === testo) throw errore;
    return JSON.parse(riparato);
  }
}

/** Estrae il primo oggetto JSON completo da un testo. */
export function estraiJson(testo: string): unknown {
  const pulito = testo.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  try {
    return leggi(pulito);
  } catch {
    // continua sotto
  }
  const recintato = pulito.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (recintato) {
    try {
      return leggi(recintato[1]);
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
      if (profondita === 0) return leggi(pulito.slice(inizio, i + 1));
    }
  }
  throw new Error("JSON incompleto nella risposta (forse troncato)");
}
