import assert from "node:assert/strict";
import { test } from "node:test";
import { estraiJson, scappaControlli } from "../src/json.ts";

// Il JSON dei modelli: come arriva davvero. Il caso delle tabulazioni e degli a capo veri dentro il codice è quello di
// una teoria di gemini-3.7-flash del 16 ottobre 2026, scartata prima di questa riparazione.

test("JSON dei modelli: a capo e tabulazioni veri dentro le stringhe vengono letti, il contenuto resta quello", () => {
  const codice = "extends Sprite2D\n\n\nfunc _process(delta: float) -> void:\n\tposition.y += 200.0 * delta\n";
  const grezzo = `{"blocchi": [{"tipo": "codice", "codice": "${codice}"}]}`;
  assert.throws(() => JSON.parse(grezzo), /control character/i);
  assert.deepEqual(estraiJson(grezzo), { blocchi: [{ tipo: "codice", codice }] });
});

test("JSON dei modelli: le sequenze già scritte bene e gli spazi fuori dalle stringhe non cambiano", () => {
  const giusto = '{\n\t"a": "riga\\nnuova\\tcon \\"virgolette\\" e \\\\ barra",\n\t"b": [1, 2]\n}';
  assert.equal(scappaControlli(giusto), giusto);
  assert.deepEqual(estraiJson(giusto), { a: 'riga\nnuova\tcon "virgolette" e \\ barra', b: [1, 2] });
});

test("JSON dei modelli: testo intorno, blocchi ``` e ragionamento <think> vengono tolti", () => {
  assert.deepEqual(estraiJson('Ecco la risposta:\n```json\n{"x": "a\tb"}\n```\nFine.'), { x: "a\tb" });
  assert.deepEqual(estraiJson('<think>penso {non json}</think>{"x": 1}'), { x: 1 });
  assert.deepEqual(estraiJson('prima {"x": {"y": "}"}} dopo'), { x: { y: "}" } });
});

test("JSON dei modelli: un JSON troncato resta un errore (non si inventa niente)", () => {
  assert.throws(() => estraiJson('{"x": "manca la fine'), /incompleto/);
  assert.throws(() => estraiJson("nessun oggetto qui"), /Nessun oggetto JSON/);
});
