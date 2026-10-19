import assert from "node:assert/strict";
import { test } from "node:test";
import { spazioRisposta, stimaToken } from "../src/main/token.ts";

// Il conto dei token che decide se un modello può rispondere. Groq accetta al minuto 8.000 token fra domanda e
// risposta chiesta: se la domanda è lunga si chiede una risposta più corta, purché basti.

test("token: una domanda lunga entra nel limite di Groq chiedendo meno token di risposta", () => {
  const domanda = stimaToken([{ content: "x".repeat(16_000) }, { content: "y".repeat(2_000) }]);
  assert.equal(domanda, 5625);
  assert.equal(spazioRisposta(8000, domanda, 3000), 2375, "si chiedono i token che restano");
  assert.equal(spazioRisposta(64_000, domanda, 3000), 3000, "con un limite largo, quelli voluti");
});

test("token: un modello che non ha spazio per una risposta vera non viene interpellato", () => {
  // Il correttore del 18 ottobre con lo stile di casa e il gioco intero: 30.270 caratteri.
  assert.equal(spazioRisposta(8000, stimaToken([{ content: "x".repeat(30_270) }]), 3000), null);
  assert.equal(spazioRisposta(8000, 6600, 3000), null, "1.400 token non bastano");
  assert.equal(spazioRisposta(8000, 6500, 3000), 1500);
  assert.equal(spazioRisposta(8000, 7200, 800), 800, "una risposta corta chiede solo quello che serve");
  assert.equal(spazioRisposta(8000, 7300, 800), null);
});
