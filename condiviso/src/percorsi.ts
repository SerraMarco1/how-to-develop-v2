import path from "node:path";

// Percorsi dei file di un progetto, come li scrive una lezione ("res://player.gd", "scenes/main.tscn").
// Un percorso che arriva da una lezione non è mai affidabile: può essere stato scritto male da un modello o, nel caso
// peggiore, alterato. Qui si accettano solo percorsi relativi che restano dentro il progetto.

/** Lunghezza massima di un percorso relativo dentro un progetto. */
const MAX_LUNGHEZZA = 200;

/** "res://a/b.gd", "/a/b.gd", "a\\b.gd", "./a/b.gd" → "a/b.gd". Non controlla la sicurezza: per quello c'è `percorsoSicuro`. */
export function percorsoRelativo(percorso: string): string {
  return percorso.trim().replace(/^res:\/\//, "").replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/^\/+/, "");
}

/** "main.tscn", "/main.tscn", "res://main.tscn" → "res://main.tscn". */
export function percorsoRes(percorso: string): string {
  return `res://${percorsoRelativo(percorso)}`;
}

/**
 * Il motivo per cui un percorso relativo di un progetto non è accettabile, oppure null se va bene.
 * Rifiuta: percorsi assoluti, unità del disco, `..`, caratteri di controllo, nomi riservati di Windows, percorsi lunghi.
 */
export function problemaPercorso(percorso: string): string | null {
  const p = percorsoRelativo(percorso);
  if (!p) return "percorso vuoto";
  if (p.length > MAX_LUNGHEZZA) return `percorso troppo lungo (${p.length} caratteri)`;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f<>:"|?*]/.test(p)) return `percorso con caratteri non ammessi: ${JSON.stringify(p)}`;
  if (/^[a-z]:/i.test(percorso.trim()) || /^\\\\/.test(percorso.trim()) || /^~/.test(p)) return `percorso assoluto non ammesso: ${p}`;
  const parti = p.split("/");
  if (parti.some((x) => x === ".." || x === ".")) return `percorso che esce dal progetto: ${p}`;
  if (parti.some((x) => x === "")) return `percorso con parti vuote: ${p}`;
  if (parti.some((x) => /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(x) || /[. ]$/.test(x))) return `nome di file non valido su Windows: ${p}`;
  return null;
}

/**
 * Il percorso completo di un file dentro la cartella `base`, oppure un errore se il percorso non è accettabile o
 * uscirebbe dalla cartella (doppio controllo: sulle parole e sul percorso risolto).
 */
export function dentroCartella(base: string, percorso: string): string {
  const problema = problemaPercorso(percorso);
  if (problema) throw new Error(`Percorso non valido: ${problema}`);
  const radice = path.resolve(base);
  const completo = path.resolve(radice, percorsoRelativo(percorso));
  if (!completo.startsWith(radice + path.sep)) throw new Error(`Percorso non valido: esce dalla cartella (${percorso})`);
  return completo;
}
