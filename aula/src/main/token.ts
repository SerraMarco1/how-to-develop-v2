// Quanto è lunga una richiesta per un modello, e quanto spazio resta per la risposta.
//
// Groq (gpt-oss-120b, il modello dell'aula che il 18 ottobre trovò la causa vera di un controllo fallito, dove gli
// altri inventarono) accetta al minuto 8.000 token di domanda più token di risposta CHIESTI. Misure di quel giorno sui
// prompt veri del correttore: 22.212 caratteri di testo valutati 4.955 token; 20.655 caratteri pieni di codice valutati
// 6.141. Il codice conta di più: la stima tiene 3,2 caratteri a token, e se il limite è stretto si chiedono meno token
// di risposta invece di rinunciare al modello.

/** I token di una richiesta, stimati con 3,2 caratteri a token (il caso peggiore misurato: testo pieno di codice). */
export function stimaToken(messaggi: { content: string }[]): number {
  return Math.ceil(messaggi.reduce((t, m) => t + m.content.length, 0) / 3.2);
}

/**
 * I token di risposta da chiedere a un modello con un limite per richiesta (`limite`, domanda e risposta insieme):
 * quelli voluti se ci stanno, altrimenti quelli che restano, purché bastino a una risposta vera (1.500, o i voluti se
 * sono meno). Null se il modello non può rispondere a questa richiesta.
 */
export function spazioRisposta(limite: number, tokenDomanda: number, voluti: number): number | null {
  const resta = limite - tokenDomanda;
  return resta >= Math.min(voluti, 1500) ? Math.min(voluti, resta) : null;
}
