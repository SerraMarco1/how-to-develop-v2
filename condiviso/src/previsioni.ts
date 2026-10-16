// Il confronto tra la previsione di chi studia e il valore vero, calcolato da Godot eseguendo il codice.
// Tollera ciò che non conta: spazi, maiuscole, virgolette, la virgola al posto del punto, "3" al posto di "3.0",
// "sì" al posto di "true".

const numeri = (testo: string) => (testo.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));

export function previsioneGiusta(attesa: string, data: string): boolean {
  const pulisci = (t: string) => t.trim().toLowerCase().replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ");
  const a = pulisci(attesa);
  const d = pulisci(data);
  if (!d) return false;
  if (a === d) return true;
  const veri = ["true", "vero", "sì", "si", "yes"];
  const falsi = ["false", "falso", "no"];
  if (a === "true" || a === "false") return (a === "true" ? veri : falsi).includes(d);
  // Numeri e vettori: stessi numeri, nello stesso ordine, a meno di un arrotondamento.
  const na = numeri(a);
  const nd = numeri(d);
  const soloNumeri = (t: string) => /^[\s\d.,()\-+e]+$/.test(t);
  if (na.length > 0 && soloNumeri(a) && soloNumeri(d)) {
    return na.length === nd.length && na.every((x, i) => Math.abs(x - nd[i]) <= Math.max(0.01, Math.abs(x) * 0.005));
  }
  return false;
}
