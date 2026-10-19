import assert from "node:assert/strict";
import { test } from "node:test";
import { differenzeRighe } from "../src/differenze.ts";

// Le differenze fra lo script di chi studia e quello della soluzione. Il caso vero del 18 ottobre: a chi studiava
// mancava un `+` in una riga, e nessuno glielo disse.

const SOLUZIONE = 'extends Sprite2D\n\nvar score: int = 0\n\n\nfunc add_score(points: int) -> void:\n\tscore += points\n\tlabel.text = "Punti: " + str(score)\n';

test("differenze: la riga con il + che manca, con il numero di riga del file di chi studia", () => {
  const studente = 'extends Sprite2D\n\n# il punteggio\nvar score: int = 0\n\nfunc add_score(points: int) -> void:\n\tscore = points\n\tlabel.text = "Punti: " + str(score)\n';
  assert.deepEqual(differenzeRighe(studente, SOLUZIONE), ["- riga 7:   score = points", "+ riga 7:   score += points"]);
});

test("differenze: commenti, righe vuote, spazi in fondo e a capo di Windows non contano", () => {
  const studente = 'extends Sprite2D\r\nvar score: int = 0   # parte da zero\r\n\r\nfunc add_score(points: int) -> void:\r\n\tscore += points\r\n\tlabel.text = "Punti: " + str(score)  \r\n';
  assert.deepEqual(differenzeRighe(studente, SOLUZIONE), []);
});

test("differenze: il rientro conta come livello (un TAB o quattro spazi), e si vede", () => {
  assert.deepEqual(differenzeRighe("func f() -> void:\n    if a:\n        b()\n", "func f() -> void:\n\tif a:\n\t\tb()\n"), [], "quattro spazi valgono un TAB");
  assert.deepEqual(differenzeRighe("func f() -> void:\n\tif a:\n\tb()\n", "func f() -> void:\n\tif a:\n\t\tb()\n"), ["- riga 3:   b()", "+ riga 3:     b()"]);
});

test("differenze: un # dentro un testo non è un commento", () => {
  assert.deepEqual(differenzeRighe('print("#1")\n', 'print("#2")\n'), ['- riga 1: print("#1")', '+ riga 1: print("#2")']);
});

test("differenze: troppe righe diverse vengono tagliate con il conto", () => {
  const molte = Array.from({ length: 80 }, (_, i) => `var a${i} := ${i}`).join("\n");
  const righe = differenzeRighe("", molte, 10);
  assert.equal(righe.length, 11);
  assert.equal(righe.at(-1), "… e altre 70 righe diverse");
});
