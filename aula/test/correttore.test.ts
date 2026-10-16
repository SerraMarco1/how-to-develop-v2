import assert from "node:assert/strict";
import { test } from "node:test";
import { diceCheSupera, verifichePerCorrettore } from "../src/main/correttore.ts";

// Il controllo sulle risposte del correttore. Il primo caso è la risposta vera di ministral-14b del 16 ottobre, data
// con 9 controlli falliti su 12.

test("correttore: riconosce una risposta che dà per superato il lavoro", () => {
  const vera =
    "Lo script `rock.gd` supera tutte le verifiche automatiche e rispetta lo stile di casa. La soluzione è corretta: le costanti e le variabili sono dichiarate con i valori giusti, la posizione viene calcolata correttamente (240, 80), il colore è impostato su rosso.";
  assert.equal(diceCheSupera(vera), true);
  assert.equal(diceCheSupera("Tutti i controlli sono superati, ottimo lavoro."), true);
  assert.equal(diceCheSupera("Il lavoro è completo."), true);
  assert.equal(diceCheSupera("Il tuo progetto passa tutte le verifiche."), true);
});

test("correttore: non scambia per superato un lavoro spiegato come incompleto", () => {
  for (const frase of [
    "Il codice di `rock.gd` è scritto bene, ma il nodo Rock di rock.tscn non ha lo script attaccato: per questo 9 controlli non passano.",
    "Le verifiche sulle costanti sono superate, ma tutte quelle che leggono i valori in Godot falliscono.",
    "I controlli sulle costanti passano; quelli sui valori della roccia falliscono perché la scena non ha lo script.",
    "Non tutti i controlli sono superati: manca lo script sul nodo.",
    "Tutti i controlli che leggono le variabili falliscono: Godot non trova lo script.",
    "La soluzione non è ancora corretta.",
  ]) {
    assert.equal(diceCheSupera(frase), false, frase);
  }
});

test("correttore: il conto dei controlli arriva esplicito, prima i falliti", () => {
  const { conto, elenco } = verifichePerCorrettore([
    { descrizione: "dichiara MAX_DAMAGE", superato: true },
    { descrizione: "MAX_DAMAGE vale 3", superato: false },
    { descrizione: "la roccia è rossa", superato: false, dettaglio: "era bianca" },
  ]);
  assert.equal(conto, "2 controlli su 3 NON sono superati: il lavoro non è ancora corretto.");
  assert.equal(elenco, "✗ MAX_DAMAGE vale 3\n✗ la roccia è rossa — era bianca\n✓ dichiara MAX_DAMAGE");
  assert.equal(verifichePerCorrettore([{ descrizione: "a", superato: true }]).conto, "L'unico controllo è superato.");
  assert.equal(verifichePerCorrettore([{ descrizione: "a", superato: true }, { descrizione: "b", superato: true }]).conto, "Tutti i 2 controlli sono superati.");
  assert.equal(verifichePerCorrettore([]).conto, "Nessun controllo eseguito.");
});
