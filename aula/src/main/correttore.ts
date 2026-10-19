import { differenzeRighe } from "@htd/condiviso/differenze.ts";

// Ciò che il correttore (l'analisi del codice dopo una verifica non superata) riceve e ciò che gli si lascia dire.
// I modelli dell'aula sono piccoli: il 16 ottobre ministral-14b scrisse «supera tutte le verifiche» con 9 controlli
// falliti. Qui il conto dei controlli gli arriva esplicito, e una risposta che lo contraddice non viene mostrata.

type ControlloDato = { descrizione: string; superato: boolean; dettaglio?: string };

/**
 * Le righe in cui gli script di chi studia differiscono da quelli della soluzione, per correttore e tutor (che non le
 * mostrano). Il 18 ottobre a chi studiava mancava un `+` in una riga, e il correttore gli fece correggere altre cose;
 * un'altra volta il suo basket.gd era identico a quello della soluzione, e la differenza che contava era in rock.gd.
 * Prima gli script che l'esercizio cambia (`primi`), poi gli altri. «-» = solo nel file di chi studia, «+» = solo nella
 * soluzione; commenti, righe vuote e spazi non contano.
 */
export function differenzeDallaSoluzione(soluzione: { percorso: string; contenuto: string }[], delloStudente: (percorso: string) => string | null, primi: string[] = []): string {
  const script = soluzione.filter((f) => f.percorso.endsWith(".gd")).sort((a, b) => Number(primi.includes(b.percorso)) - Number(primi.includes(a.percorso)));
  const parti: string[] = [];
  for (const f of script) {
    const suo = delloStudente(f.percorso);
    if (suo === null) {
      parti.push(`### ${f.percorso}\n(nel progetto di chi studia questo file non c'è)`);
      continue;
    }
    const righe = differenzeRighe(suo, f.contenuto, 40);
    if (righe.length) parti.push(`### ${f.percorso}\n${righe.join("\n")}`);
  }
  if (parti.length === 0) return "(nessuna: gli script di chi studia sono uguali a quelli della soluzione, a parte commenti, righe vuote e spazi)";
  const testo = parti.join("\n\n");
  return testo.length > 4000 ? `${testo.slice(0, 4000)}\n… (altre differenze non mostrate)` : testo;
}

/**
 * Il codice delle verifiche che girano in Godot, per correttore e tutor. Il 17 ottobre, senza vederlo, nessuno dei due
 * seppe dire perché un sottomarino giusto non passava: la verifica teneva premuto «giù» per 180 frame, e a 150 pixel
 * al secondo il sottomarino arrivava a 530 invece che al fondale a 560. Con il codice davanti il conto si può fare.
 */
export function codiceDelleVerifiche(verifiche: { tipo: string; codice?: string; descrizione?: string }[]): string {
  const script = verifiche.filter((v) => v.tipo === "script_godot" && v.codice?.trim());
  if (script.length === 0) return "(nessuno: le verifiche di questo esercizio leggono solo i file e le impostazioni del progetto)";
  const recinto = "```";
  return script.map((v, i) => `### Verifica ${i + 1}${v.descrizione ? `: ${v.descrizione}` : ""}\n${recinto}gdscript\n${v.codice!.trim()}\n${recinto}`).join("\n\n").slice(0, 6000);
}

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
