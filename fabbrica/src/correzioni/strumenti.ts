import type { Esercizio, Lezione } from "@htd/condiviso/schemi.ts";

// Gli strumenti con cui si scrive una correzione del gioco (vedi correzioni.ts): che cosa è, e come si cambiano i testi
// di una lezione senza sbagliare posto. Ogni testo da cambiare deve esserci esattamente una volta: se la lezione è
// cambiata da quando la correzione è stata scritta, la correzione si ferma invece di scrivere nel punto sbagliato.

/** Una correzione del gioco che cresce di lezione in lezione. Il suo `id` non cambia mai: cambiarlo la rifà da capo. */
export type CorrezioneGioco = {
  id: string;
  titolo: string;
  /** La cartella del gioco (`statoIniziale.cartella`): le lezioni che non lo usano restano fuori. */
  gioco: string;
  /** La prima lezione toccata. */
  daLezione: string;
  /** La modifica di ogni script e di ogni esempio di codice: la stessa ovunque, e rifarla non cambia niente. */
  codice: (testo: string) => string;
  /** Testi e verifiche scritti a mano, per lezione: ricevono una copia della lezione e la cambiano. */
  lezioni: Record<string, (contenuto: Lezione) => void>;
};

/** Un testo che la correzione si aspetta di trovare e non trova: la lezione è cambiata da quando è stata scritta. */
export class CorrezioneImpossibile extends Error {}

/** Sostituisce in un testo un pezzo che deve esserci esattamente una volta. */
export function sostituisci(testo: string, da: string, a: string): string {
  const volte = testo.split(da).length - 1;
  if (volte !== 1) throw new CorrezioneImpossibile(`${volte === 0 ? "non trovo" : `trovo ${volte} volte`} il testo «${da.slice(0, 120)}»`);
  return testo.replace(da, () => a);
}

/** Inserisce una voce in un elenco subito dopo quella che contiene `dopo` (deve essercene una sola). */
export function inserisciDopo(elenco: string[], dopo: string, voce: string): void {
  const posizioni = elenco.flatMap((x, i) => (x.includes(dopo) ? [i] : []));
  if (posizioni.length !== 1) throw new CorrezioneImpossibile(`${posizioni.length === 0 ? "non trovo" : `trovo ${posizioni.length} volte`} la voce con «${dopo.slice(0, 120)}»`);
  elenco.splice(posizioni[0] + 1, 0, voce);
}

/** L'esercizio di una lezione per id (`es1`, `test`). */
export function esercizio(contenuto: Lezione, id: string): Esercizio {
  const e = id === "test" ? contenuto.test : contenuto.esercizi.find((x) => x.id === id);
  if (!e) throw new CorrezioneImpossibile(`non trovo l'esercizio ${id}`);
  return e;
}

type Blocco = Lezione["blocchi"][number];

/** Il blocco di teoria per id (`b3`), del tipo atteso. */
export function blocco<T extends Blocco["tipo"]>(contenuto: Lezione, id: string, tipo: T): Extract<Blocco, { tipo: T }> {
  const b = contenuto.blocchi.find((x) => x.id === id);
  if (!b || b.tipo !== tipo) throw new CorrezioneImpossibile(`non trovo il blocco ${id} di tipo ${tipo}`);
  return b as Extract<Blocco, { tipo: T }>;
}

/** La verifica `script_godot` di un esercizio con quella descrizione. */
export function verificaGodot(e: Esercizio, descrizione: string): Extract<Esercizio["verifiche"][number], { tipo: "script_godot" }> {
  const v = e.verifiche.find((x) => x.tipo === "script_godot" && x.descrizione === descrizione);
  if (!v || v.tipo !== "script_godot") throw new CorrezioneImpossibile(`${e.id}: non trovo la verifica «${descrizione.slice(0, 120)}»`);
  return v;
}
