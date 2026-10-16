// Ciò che il correttore (l'analisi del codice dopo una verifica non superata) riceve e ciò che gli si lascia dire.
// I modelli dell'aula sono piccoli: il 16 ottobre ministral-14b scrisse «supera tutte le verifiche» con 9 controlli
// falliti. Qui il conto dei controlli gli arriva esplicito, e una risposta che lo contraddice non viene mostrata.

type ControlloDato = { descrizione: string; superato: boolean; dettaglio?: string };

/** Le verifiche per il correttore: prima il conto, poi i controlli falliti, poi quelli superati. */
export function verifichePerCorrettore(controlli: ControlloDato[]): { conto: string; elenco: string } {
  const falliti = controlli.filter((c) => !c.superato);
  const riga = (c: ControlloDato) => `${c.superato ? "✓" : "✗"} ${c.descrizione}${c.dettaglio ? ` — ${c.dettaglio}` : ""}`;
  const conto =
    controlli.length === 0
      ? "Nessun controllo eseguito."
      : falliti.length === 0
        ? controlli.length === 1
          ? "L'unico controllo è superato."
          : `Tutti i ${controlli.length} controlli sono superati.`
        : `${falliti.length} controlli su ${controlli.length} NON sono superati: il lavoro non è ancora corretto.`;
  return { conto, elenco: [...falliti, ...controlli.filter((c) => c.superato)].map(riga).join("\n").slice(0, 4000) };
}

const DICE_SUPERATO = [
  // «supera tutte le verifiche», «passa tutti i controlli», «rispetta ogni controllo»
  /\b(supera|superano|superato|superata|superate|passa|passano|passato|passata|passate|rispetta|rispettano)\b[^.!?]{0,60}\b(tutt[eiao]|ogni)\b[^.!?]{0,40}\b(verifich\w*|controll\w*|test)\b/i,
  // «tutte le verifiche sono superate», «tutti i controlli passano»
  /\b(tutt[eiao]|ogni)\b[^.!?]{0,30}\b(verifich\w*|controll\w*)\b[^.!?]{0,40}\b(super\w*|pass\w*|riuscit\w*)/i,
  // «la soluzione è corretta», «il lavoro è completo»
  /\b(la soluzione|il lavoro|l'esercizio|il test)\b[^.!?]{0,20}(è|e')\s+(corrett|complet)[oa]\b/i,
];

/** Vero se il testo dice che il lavoro supera le verifiche (o è corretto) senza negarlo nella stessa frase. */
export function diceCheSupera(testo: string): boolean {
  return testo
    .split(/(?<=[.!?:])\s+/)
    .some((frase) => !/\b(non|ancora|manca|mancano)\b/i.test(frase) && DICE_SUPERATO.some((r) => r.test(frase)));
}
