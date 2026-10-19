// Le differenze tra due versioni di un file di codice, riga per riga, per i modelli che spiegano un errore (correttore e
// tutor dell'aula) e per le correzioni della fabbrica. Le righe vuote, i commenti e gli spazi a fine riga non contano:
// il codice di chi studia ha i suoi commenti, e una differenza lì non dice niente su un controllo fallito. Il rientro
// conta (in GDScript dice dentro quale blocco sta una riga), ma come livello: un TAB o quattro spazi sono la stessa cosa.

type Riga = { livello: number; testo: string; numero: number };

/** Una riga di codice come si confronta: livello di rientro e testo, senza commento (un # fuori dalle virgolette). */
function normalizza(grezza: string, numero: number): Riga {
  let riga = grezza.replace(/\r$/, "");
  let virgolette: string | null = null;
  for (let k = 0; k < riga.length; k++) {
    const c = riga[k];
    if (virgolette) {
      if (c === "\\") k++;
      else if (c === virgolette) virgolette = null;
    } else if (c === '"' || c === "'") virgolette = c;
    else if (c === "#") {
      riga = riga.slice(0, k);
      break;
    }
  }
  const rientro = riga.match(/^[\t ]*/)![0];
  const livello = [...rientro].filter((c) => c === "\t").length + Math.floor([...rientro].filter((c) => c === " ").length / 4);
  return { livello, testo: riga.trim(), numero };
}

const righeDi = (contenuto: string): Riga[] =>
  contenuto
    .split("\n")
    .map((r, i) => normalizza(r, i + 1))
    .filter((r) => r.testo !== "");

/** La riga come la legge un modello: il rientro come due spazi per livello. */
const mostra = (r: Riga) => `${"  ".repeat(r.livello)}${r.testo}`;

/**
 * Le differenze fra `prima` e `dopo` come elenco di righe «- riga N: …» (solo in prima) e «+ riga N: …» (solo in dopo),
 * nell'ordine dei file. Vuoto se il codice è lo stesso. Per file fino a qualche centinaio di righe (sottosequenza
 * comune più lunga, quadratica).
 */
export function differenzeRighe(prima: string, dopo: string, massimo = 60): string[] {
  const a = righeDi(prima);
  const b = righeDi(dopo);
  const confronta = (x: Riga, y: Riga) => x.livello === y.livello && x.testo === y.testo;
  // lcs[i][j]: lunghezza della sottosequenza comune più lunga fra a[i..] e b[j..].
  const lcs: Uint16Array[] = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = confronta(a[i], b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const uscita: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && confronta(a[i], b[j])) {
      i++;
      j++;
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      uscita.push(`- riga ${a[i].numero}: ${mostra(a[i])}`);
      i++;
    } else {
      uscita.push(`+ riga ${b[j].numero}: ${mostra(b[j])}`);
      j++;
    }
  }
  return uscita.length > massimo ? [...uscita.slice(0, massimo), `… e altre ${uscita.length - massimo} righe diverse`] : uscita;
}
