import assert from "node:assert/strict";
import { test } from "node:test";
import { codiceDelleVerifiche, diceCheSupera, differenzeDallaSoluzione, verifichePerCorrettore } from "../src/main/correttore.ts";

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

test("correttore: può dire che il codice fa ciò che chiede la consegna senza dire che supera i controlli", () => {
  // La frase che le istruzioni gli chiedono quando la verifica dipende da un valore che la consegna non fissa.
  assert.equal(diceCheSupera("Il tuo codice fa ciò che chiede la consegna: questo controllo dipende da un valore che la consegna non fissa."), false);
});

test("correttore e tutor: ricevono il codice delle verifiche che girano in Godot", () => {
  const testo = codiceDelleVerifiche([
    { tipo: "azione_input", descrizione: "Esiste l'azione dive" },
    { tipo: "script_godot", descrizione: "Il sottomarino scende", codice: 'extends "res://htd/htd_test.gd"\n\nfunc _run_tests() -> void:\n\tawait hold_action("dive", 180)\n' },
  ]);
  assert.match(testo, /^### Verifica 1: Il sottomarino scende\n```gdscript\nextends "res:\/\/htd\/htd_test\.gd"/);
  assert.match(testo, /hold_action\("dive", 180\)/);
  assert.doesNotMatch(testo, /azione dive/, "le verifiche sui file non hanno codice da mostrare");
  assert.match(codiceDelleVerifiche([{ tipo: "nodo", descrizione: "c'è il nodo" }]), /^\(nessuno/);
  assert.ok(codiceDelleVerifiche([{ tipo: "script_godot", codice: "x".repeat(10_000) }]).length <= 6000, "non riempie le istruzioni");
});

test("correttore e tutor: le differenze dalla soluzione, prima gli script che l'esercizio cambia", () => {
  // Il caso del 18 ottobre (lezione 1.9): basket.gd identico alla soluzione, la differenza che conta è in rock.gd.
  const soluzione = [
    { percorso: "project.godot", contenuto: "config_version=5\n" },
    { percorso: "basket.gd", contenuto: "extends Sprite2D\n\n\nfunc _ready() -> void:\n\tspawn_rock_row()\n" },
    { percorso: "rock.gd", contenuto: "extends Sprite2D\n\n\nfunc _ready() -> void:\n\tvar initial_pos: Vector2 = position\n\treset_rock()\n\tif initial_pos != Vector2.ZERO:\n\t\tposition = initial_pos\n" },
    { percorso: "star.gd", contenuto: "extends Sprite2D\n" },
  ];
  const progetto: Record<string, string> = {
    "basket.gd": "extends Sprite2D\n\n# le rocce\nfunc _ready() -> void:\n\tspawn_rock_row()\n",
    "rock.gd": "extends Sprite2D\n\n\nfunc _ready() -> void:\n\treset_rock()\n",
  };
  const testo = differenzeDallaSoluzione(soluzione, (p) => progetto[p] ?? null, ["rock.gd", "basket.gd"]);
  assert.equal(testo, "### rock.gd\n+ riga 5:   var initial_pos: Vector2 = position\n+ riga 7:   if initial_pos != Vector2.ZERO:\n+ riga 8:     position = initial_pos\n\n### star.gd\n(nel progetto di chi studia questo file non c'è)");
  assert.match(differenzeDallaSoluzione(soluzione.slice(0, 2), (p) => progetto[p] ?? null), /^\(nessuna/);
});
