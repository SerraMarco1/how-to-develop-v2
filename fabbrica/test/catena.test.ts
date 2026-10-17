import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CHIAVE_FINTA, fornitoreFinto, preparaAmbiente, tuttiIFile } from "./aiuto.ts";
import { CESTO_1, controllo, ES1_ROTTO, ES2_LEZIONE_1, PRATICA_1, PRATICA_2, PRATICA_3, PRATICA_3_GIUSTA, previsione, RESTO_3, teoria, VERIFICA_COLORE, CESTO_3 } from "./risposte.ts";

// La catena di scrittura dall'inizio alla fine, con il Godot VERO e un fornitore finto (nessuna richiesta vera).
// Tre lezioni della fase 1, poi i guasti: tetto per lezione, formato sbagliato, sovraccarico, interruzione a metà.

const { dati } = preparaAmbiente("catena");

const LEGGERO = "gemini-flash-lite-latest";
let leggeroRifiuta = false;
let guasto: "nessuno" | "rifiuta" | "formato" | "codice-pericoloso" = "nessuno";
let correzioni = 0;
// Nella prova di scrittura che deve riuscire, la pratica della terza lezione arriva già giusta (senza la stella rotta).
let praticaGiusta = false;
// Il ripasso della lezione 1.1 arriva con voci che non restituiscono niente (Godot non può calcolare le risposte).
let ripassoRotto = false;

const RIPASSO = {
  previsioni: [
    previsione("\tvar a: int = 5\n\treturn a * 2\n", "Che numero restituisce `run()`?"),
    previsione('\tvar nome: String = "Ada"\n\treturn "Ciao " + nome\n', "Che testo restituisce `run()`?"),
    previsione("\tvar v := Vector2(1, 2)\n\treturn v * 3\n", "Che vettore restituisce `run()`?"),
  ],
};
const RIPASSO_ROTTO = {
  previsioni: [
    previsione("\tvar a: int = 5\n", "Che numero restituisce `run()`?"),
    previsione('\tvar nome: String = "Ada"\n', "Che testo restituisce `run()`?"),
    previsione("\tvar v := Vector2(1, 2)\n", "Che vettore restituisce `run()`?"),
  ],
};

const finto = await fornitoreFinto(({ modello, testo }) => {
  if (guasto === "rifiuta" || (leggeroRifiuta && modello === LEGGERO)) return { stato: 503 };
  if (guasto === "formato") return { dati: { lezione: "non è il formato chiesto" } };
  const seconda = /^(Lezione|Competenza): Variabili e tipi/m.test(testo);
  const terza = /^(Lezione|Competenza): _process e delta/m.test(testo) || testo.includes('della lezione "_process e delta');
  if (testo.startsWith("Scrivi il RIPASSO") && ripassoRotto && testo.includes('lezione "Variabili e tipi')) return { dati: RIPASSO_ROTTO };
  if (testo.startsWith("Scrivi il RIPASSO")) return { dati: RIPASSO };
  if (testo.startsWith("Scrivi la PARTE TEORICA")) return { dati: seconda ? teoria("Variabili e tipi: ricordare i valori", "dai un nome ai valori del cesto", CESTO_3) : teoria("Il primo script: dare ordini a un nodo", "scrivi il primo script del gioco", CESTO_1) };
  if (testo.startsWith("Scrivi per intero la PARTE PRATICA") && terza) return { dati: praticaGiusta ? PRATICA_3_GIUSTA : testo.includes("stai scrivendo solo la parte FINALE") ? RESTO_3 : PRATICA_3 };
  if (testo.includes("RIFIUTATO dai controlli automatici") && terza) return { dati: ES1_ROTTO };
  if (testo.startsWith("Scrivi per intero la PARTE PRATICA")) {
    if (guasto === "codice-pericoloso") {
      const p = PRATICA_1([VERIFICA_COLORE]);
      p.test.soluzione.file[1].contenuto += '\nfunc _exit_tree() -> void:\n\tOS.execute("cmd.exe", ["/c", "echo"])\n';
      return { dati: p };
    }
    return { dati: seconda ? PRATICA_2 : PRATICA_1([{ tipo: "script_collegato", scena: "res://main.tscn", nodo: "Basket", descrizione: "Il nodo Basket ha uno script collegato" }]) };
  }
  if (testo.includes("RIFIUTATO dai controlli automatici")) {
    correzioni++;
    if (testo.includes("controllo di sicurezza")) {
      // La correzione richiesta dal controllo di sicurezza: il test senza la riga pericolosa.
      return { dati: PRATICA_1([VERIFICA_COLORE]).test };
    }
    return { dati: ES2_LEZIONE_1([VERIFICA_COLORE]) };
  }
  return { dati: { approvata: true, problemi: [] } };
});

// I moduli della fabbrica leggono l'ambiente quando vengono caricati: dopo preparaAmbiente.
const { impostaCartellaMotore } = await import("@htd/condiviso/motore.ts");
const { impostaGodot } = await import("@htd/condiviso/godot/esegui.ts");
const { installaGodot } = await import("@htd/condiviso/godot/installa.ts");
const { impostaCartellaTemporanea } = await import("@htd/condiviso/godot/verifica.ts");
const { lezioneDelCorso } = await import("@htd/condiviso/piano.ts");
const { PaccoLezioneSchema } = await import("@htd/condiviso/pacchetto.ts");
const { CONFIG } = await import("../src/configurazione.ts");
const { FORNITORI } = await import("../src/ai/catalogo.ts");
const { AINonDisponibile, chiamateDiOggi, finestraGiornaliera } = await import("../src/ai/router.ts");
const { aggiungiRiga, leggiJson, salva } = await import("../src/archivio.ts");
const { preparaDocumentazione } = await import("../src/documentazione.ts");
const { LezioneTrattenuta, leggiCantiere, riapriCantiere, scriviLezione } = await import("../src/lezione/catena.ts");
const { pubblicaLezione } = await import("../src/lezione/pubblica.ts");
const { catalogo, paccoPubblicato } = await import("../src/corso.ts");
const { registroDiLezione } = await import("../src/traccia.ts");
const { aggiornaStato, statoFabbrica } = await import("../src/stato.ts");
const { cominciaGiro, GiroFinito } = await import("../src/tempo.ts");

FORNITORI.find((f) => f.id === "gemini")!.baseUrl = finto.url;
impostaCartellaMotore(CONFIG.motore);
impostaCartellaTemporanea(path.join(CONFIG.cache, "temp"));
fs.writeFileSync(path.join(dati, ".gitkeep"), "");
await salva("inizio");

const lezione = (slug: string) => {
  const l = lezioneDelCorso(slug);
  assert.ok(l, `la lezione ${slug} è nel piano`);
  return l;
};
const errore = async (promessa: Promise<unknown>) => {
  try {
    await promessa;
  } catch (e) {
    return e;
  }
  throw new Error("era atteso un errore");
};
const pulisciFermi = () =>
  aggiornaStato((s) => {
    s.fermi = {};
    s.sovraccarico = {};
  });

test("preparazione: Godot di servizio verificato e documentazione indicizzata", { timeout: 20 * 60_000 }, async () => {
  impostaGodot(await installaGodot(path.join(CONFIG.cache, "strumenti")));
  const indice = await preparaDocumentazione();
  assert.ok(fs.existsSync(indice));
});

test("lezione 1.0: scritta, controllata in Godot e pubblicata nonostante 14 rifiuti già incontrati", { timeout: 10 * 60_000 }, async () => {
  const l = lezione("il-primo-script");
  // Come la sera del 12 ottobre 2026: 14 rifiuti del fornitore prima di riuscire a scrivere qualcosa.
  const gemini = FORNITORI.find((f) => f.id === "gemini")!;
  const giorno = finestraGiornaliera(gemini);
  for (let i = 0; i < 14; i++) chiamateDiOggi(gemini).push({ quando: Date.now() - 60_000, modello: "gemini-3.7-flash", ruolo: "scrittore", slug: l.slug, ok: false, contata: true, durataMs: 2000, errore: "HTTP 503" });
  assert.ok(giorno.fine > giorno.inizio);
  const scritta = await scriviLezione(l);
  const pacco = await pubblicaLezione(l, scritta);
  assert.equal(pacco.versione, 1);
  assert.deepEqual(pacco.contenuto.esercizi.map((e) => e.genere), ["guidato", "obiettivo"]);
  assert.equal(pacco.contenuto.test.genere, "obiettivo");
  assert.equal(correzioni, 1, "una sola correzione, per il solo esercizio 2");
  assert.deepEqual(pacco.contenuto.esercizi[1].soluzione.cambiati, ["basket.gd"]);
  assert.deepEqual(pacco.statoFinale!.file.map((f) => f.percorso).sort(), ["basket.gd", "main.tscn", "project.godot", "title.gd"]);
  assert.ok(pacco.ripasso.length >= 3, "le voci di ripasso ci sono, con le risposte calcolate da Godot");
  assert.deepEqual(pacco.ripasso.map((r) => r.risposta), ["10", "Ciao Ada", "(3.0, 6.0)"]);
  const passi = registroDiLezione(l.slug);
  assert.ok(passi.some((p) => p.pezzo === "es2" && p.esito === "fallito" && p.guasto === "contenuto" && p.spiegazione.includes("PRIMA dell'esercizio")), "il registro dice perché l'esercizio 2 è stato rifiutato");
  assert.deepEqual(passi.filter((p) => p.azione === "correzione").map((p) => p.modello), [`gemini/${LEGGERO}`], "la prima correzione la fa il modello di ritocco");
  assert.equal(passi.filter((p) => p.azione === "revisione").length, 1);
  // Il catalogo ha la lezione con l'impronta giusta del suo file.
  const voce = catalogo().lezioni.find((x) => x.slug === l.slug)!;
  const testo = fs.readFileSync(path.join(dati, voce.file), "utf8");
  const { sha256 } = await import("@htd/condiviso/pacchetto.ts");
  assert.equal(voce.sha256, sha256(testo));
  PaccoLezioneSchema.parse(JSON.parse(testo));
  assert.ok(!fs.existsSync(path.join(dati, "cantieri", `${l.slug}.json`)), "il cantiere è chiuso dopo la pubblicazione");
  assert.ok(!fs.existsSync(path.join(dati, "risposte", l.slug)), "le risposte conservate sono tolte dopo la pubblicazione");
});

test("lezione 1.1: parte dal gioco com'è finito nella 1.0, previsioni calcolate da Godot", { timeout: 10 * 60_000 }, async () => {
  const l = lezione("variabili-e-tipi");
  const prima = finto.richieste.length;
  const scritta = await scriviLezione(l);
  const pacco = await pubblicaLezione(l, scritta);
  const pratica = finto.richieste.slice(prima).find((r) => r.testo.startsWith("Scrivi per intero la PARTE PRATICA"))!;
  assert.ok(pratica.testo.includes("modulate = Color(1.0, 0.8, 0.2)") && pratica.testo.includes("#### title.gd"), "la richiesta contiene i file del gioco alla fine della lezione 1.0");
  assert.deepEqual(pacco.contenuto.esercizi[1].previsioni.map((p) => p.risposta), ["3", "3.5", "Vite: 3", "(140.0, 50.0)"]);
  assert.ok(pacco.statoFinale!.file.find((f) => f.percorso === "title.gd")!.contenuto.includes("score"));
});

test("lezione 1.2: un esercizio non riesce, il ritocco è sovraccarico, il resto viene riscritto", { timeout: 15 * 60_000 }, async () => {
  const l = lezione("process-e-delta");
  pulisciFermi();
  leggeroRifiuta = true;
  const scritta = await scriviLezione(l);
  leggeroRifiuta = false;
  const s = statoFabbrica();
  assert.ok(!s.sovraccarico.gemini, "il rifiuto del modello di ritocco non segna sovraccarico il fornitore");
  assert.ok((s.fermi[`gemini/${LEGGERO}`]?.fino ?? 0) > Date.now(), "riposa solo il modello di ritocco");
  assert.deepEqual(scritta.lezione.esercizi.map((e) => e.titolo), ["Cosa restituisce?", "Anche il livello"]);
  assert.ok(scritta.lezione.avvisi?.some((a) => a.includes("Una stella che cade")));
  assert.ok(!scritta.statoFinale.file.some((f) => f.percorso === "star.gd"));
  const passi = registroDiLezione(l.slug);
  assert.deepEqual(passi.filter((p) => p.pezzo === "es1" && p.azione === "correzione").map((p) => p.esito), ["saltato", "ok", "ok"]);
  await pubblicaLezione(l, scritta);
  pulisciFermi();
});

test("ripasso mancante: recuperato nei giri dopo senza toccare il resto della lezione, e mai chiesto all'infinito", { timeout: 10 * 60_000 }, async () => {
  const { aggiornaCatalogo, completaRipassi } = await import("../src/lezione/pubblica.ts");
  const { scriviFile } = await import("../src/archivio.ts");
  const { sha256 } = await import("@htd/condiviso/pacchetto.ts");
  const ripassi = () => finto.richieste.filter((r) => r.testo.startsWith("Scrivi il RIPASSO"));
  const ripassiDi = (titolo: string) => ripassi().filter((r) => r.testo.includes(`lezione "${titolo}`));
  const righe = (slug: string) => registroDiLezione(slug).length;

  // La 1.2 è uscita senza ripasso perché il modello del ripasso era fermo (com'è successo alla 1.7 il 16 ottobre).
  const delta = "process-e-delta";
  const prima12 = paccoPubblicato(delta)!;
  assert.equal(prima12.ripasso.length, 0, "la 1.2 è stata pubblicata senza ripasso");
  assert.ok(registroDiLezione(delta).some((p) => p.pezzo === "ripasso" && p.esito === "saltato" && p.guasto === "fornitore"), "il registro dice perché");
  // La 1.1 come le lezioni arrivate dalla versione 1 senza ripasso.
  const variabili = "variabili-e-tipi";
  const voce11 = catalogo().lezioni.find((v) => v.slug === variabili)!;
  const testo11 = JSON.stringify({ ...paccoPubblicato(variabili)!, ripasso: [] });
  scriviFile(voce11.file, testo11);
  aggiornaCatalogo({ ...voce11, sha256: sha256(testo11), byte: Buffer.byteLength(testo11) });
  const prima11 = paccoPubblicato(variabili)!;

  // 1) Il modello del ripasso è fermo: non si bussa e non si scrive niente nel registro.
  aggiornaStato((s) => void (s.fermi[`gemini/${LEGGERO}`] = { fino: Date.now() + 10 * 60_000, errore: "HTTP 503" }));
  let richieste = finto.richieste.length;
  const [r11, r12] = [righe(variabili), righe(delta)];
  assert.equal(await completaRipassi(), 0);
  assert.equal(finto.richieste.length, richieste, "nel fermo nessuna richiesta");
  assert.deepEqual([righe(variabili), righe(delta)], [r11, r12], "e nessuna riga nel registro");
  pulisciFermi();

  // 2) Il modello rifiuta (503): una richiesta sola, poi si aspetta il giro dopo senza provare le altre lezioni.
  leggeroRifiuta = true;
  richieste = finto.richieste.length;
  assert.equal(await completaRipassi(), 0);
  leggeroRifiuta = false;
  assert.equal(finto.richieste.length - richieste, 1, "una sola richiesta rifiutata");
  assert.equal(registroDiLezione(variabili).at(-1)!.guasto, "fornitore");
  assert.equal(registroDiLezione(variabili).at(-1)!.richieste, 1, "il rifiuto conta tra le richieste della lezione (Google lo conta)");
  assert.equal(righe(delta), r12, "la 1.2 non è stata provata");
  assert.deepEqual(paccoPubblicato(variabili), prima11);
  pulisciFermi();

  // 3) La 1.1 riceve voci che non si eseguono, la 1.2 voci buone: solo la 1.2 esce in una versione nuova.
  ripassoRotto = true;
  const chiesteAlla11 = ripassiDi("Variabili e tipi").length;
  assert.equal(await completaRipassi(), 1);
  const dopo12 = paccoPubblicato(delta)!;
  assert.deepEqual(dopo12.ripasso.map((r) => r.risposta), ["10", "Ciao Ada", "(3.0, 6.0)"], "le risposte giuste le calcola Godot");
  assert.equal(dopo12.versione, prima12.versione + 1);
  const { ripasso: _a, versione: _b, origine: o1, ...resto1 } = prima12;
  const { ripasso: _c, versione: _d, origine: o2, ...resto2 } = dopo12;
  assert.deepEqual(resto2, resto1, "teoria, esercizi, progetto e media non cambiano");
  assert.equal(o2.pubblicata, o1.pubblicata);
  assert.ok(o2.richieste > o1.richieste, "il costo della lezione comprende la richiesta del ripasso");
  const voce12 = catalogo().lezioni.find((v) => v.slug === delta)!;
  assert.equal(voce12.versione, dopo12.versione);
  assert.equal(voce12.sha256, sha256(fs.readFileSync(path.join(dati, voce12.file), "utf8")), "il catalogo ha l'impronta del file nuovo");
  assert.ok(registroDiLezione(delta).some((p) => p.azione === "ripasso aggiunto" && p.esito === "ok"));
  const conservate = (slug: string) => (fs.existsSync(path.join(dati, "risposte", slug)) ? fs.readdirSync(path.join(dati, "risposte", slug)) : []);
  assert.deepEqual(conservate(delta), [], "nessuna risposta conservata resta in giro");
  assert.equal(paccoPubblicato(variabili)!.ripasso.length, 0);
  assert.equal(registroDiLezione(variabili).at(-1)!.guasto, "contenuto");

  // 4) La 1.1 riprova con una richiesta NUOVA ogni volta (non la stessa risposta inutile conservata), poi smette.
  assert.equal(await completaRipassi(), 0);
  assert.equal(await completaRipassi(), 0);
  assert.equal(ripassiDi("Variabili e tipi").length - chiesteAlla11, 3, "tre richieste vere, una per tentativo");
  assert.deepEqual(conservate(variabili), [], "le risposte inutili non restano conservate");
  richieste = finto.richieste.length;
  const r11dopo = righe(variabili);
  assert.equal(await completaRipassi(), 0);
  assert.equal(finto.richieste.length, richieste, "dopo tre tentativi andati male non si chiede più");
  assert.equal(righe(variabili), r11dopo);
  assert.equal(paccoPubblicato(variabili)!.versione, prima11.versione, "la 1.1 resta com'era");
  ripassoRotto = false;
  // Niente più da completare: nessuna richiesta.
  assert.equal(await completaRipassi(), 0);
  assert.equal(finto.richieste.length, richieste);
});

test("sicurezza: una soluzione con un comando di sistema viene rifiutata e corretta", { timeout: 10 * 60_000 }, async () => {
  // Una copia della prima lezione della fase (parte da un progetto vuoto), con un altro nome per non toccare quella vera.
  const l = lezione("il-primo-script");
  guasto = "codice-pericoloso";
  correzioni = 0;
  // La teoria e la pratica arrivano; il test contiene OS.execute: il controllo lo rifiuta e chiede una correzione.
  const scritta = await scriviLezione({ ...l, slug: "prova-sicurezza" });
  guasto = "nessuno";
  const passi = registroDiLezione("prova-sicurezza");
  assert.ok(passi.some((p) => p.pezzo === "test" && p.esito === "fallito" && p.spiegazione.includes("controllo di sicurezza") && p.spiegazione.includes("OS.execute")), "il registro dice che il test è stato rifiutato per sicurezza");
  assert.ok(!JSON.stringify(scritta.lezione).includes("OS.execute"), "nella lezione finita non c'è il comando");
});

test("interruzione a metà: la risposta già pagata viene riusata, senza chiederla di nuovo", { timeout: 10 * 60_000 }, async () => {
  const l = lezione("condizioni");
  // Un giro senza tempo: si ferma alla prima richiesta.
  cominciaGiro(0);
  const fermo = await errore(scriviLezione(l));
  assert.ok(fermo instanceof GiroFinito, `atteso GiroFinito, arrivato ${fermo}`);
  cominciaGiro(60);
  // La teoria arriva e viene conservata; poi il giro si ferma di nuovo prima della pratica (simulato cancellando il cantiere).
  const prima = finto.richieste.length;
  await errore(
    (async () => {
      const { chiamaAI } = await import("../src/ai/router.ts");
      const { messaggi } = await import("../src/ai/prompt.ts");
      const { valoriLezione } = await import("../src/corso.ts");
      const { SpiegazioneSchema } = await import("@htd/condiviso/schemi.ts");
      const { progettoPerPrompt } = await import("../src/lezione/pratica.ts");
      const { statoDiPartenza } = await import("../src/corso.ts");
      const base = statoDiPartenza(l);
      await chiamaAI({ ruolo: "scrittore", slug: l.slug, messaggi: messaggi("lezione-spiegazione", { ...valoriLezione(l), progetto_attuale: progettoPerPrompt(base, 9000), nome_progetto: base.nome }), schema: SpiegazioneSchema, maxTokens: 9000, evita: [] });
      throw new Error("interruzione simulata dopo la risposta");
    })(),
  );
  assert.equal(finto.richieste.length - prima, 1, "una richiesta per la teoria");
  const dopo = finto.richieste.length;
  // Il giro dopo: la teoria non viene richiesta, la risposta conservata basta.
  guasto = "rifiuta";
  pulisciFermi();
  const attesa = await errore(scriviLezione(l));
  guasto = "nessuno";
  assert.ok(attesa instanceof AINonDisponibile, `la pratica trova il fornitore che rifiuta: ${attesa}`);
  const nuove = finto.richieste.slice(dopo);
  assert.ok(!nuove.some((r) => r.testo.startsWith("Scrivi la PARTE TEORICA")), "la teoria non è stata chiesta di nuovo");
  assert.ok(leggiCantiere(l.slug).teoria, "la teoria è nel cantiere");
  assert.ok(registroDiLezione(l.slug).some((p) => p.spiegazione.includes("già pagata")), "il registro dice che la risposta è stata riusata");
  pulisciFermi();
});

test("sovraccarico: dopo due rifiuti il fornitore resta fermo, e nel fermo non si bussa", { timeout: 5 * 60_000 }, async () => {
  const l = lezione("condizioni");
  pulisciFermi();
  guasto = "rifiuta";
  const prima = finto.richieste.length;
  const e1 = await errore(scriviLezione(l));
  assert.ok(e1 instanceof AINonDisponibile && e1.riprovaTraSec >= 9 * 60, `fermo di almeno 10 minuti: ${e1}`);
  const bussate = finto.richieste.length - prima;
  assert.ok(bussate <= 2, `al massimo due modelli interpellati, non ${bussate}`);
  const e2 = await errore(scriviLezione(l));
  assert.ok(e2 instanceof AINonDisponibile);
  assert.equal(finto.richieste.length - prima, bussate, "durante il fermo non parte nessuna richiesta");
  guasto = "nessuno";
  pulisciFermi();
});

test("tetto per lezione e formato sbagliato: la lezione si ferma, poi Riprova la sblocca", { timeout: 10 * 60_000 }, async () => {
  const l = lezione("condizioni");
  const gemini = FORNITORI.find((f) => f.id === "gemini")!;
  // 12 risposte ricevute oggi per questa lezione: tetto.
  for (let i = 0; i < 12; i++) chiamateDiOggi(gemini).push({ quando: Date.now(), modello: "gemini-3.7-flash", ruolo: "scrittore", slug: l.slug, ok: true, contata: true, durataMs: 1000 });
  const alTetto = await errore(scriviLezione(l));
  assert.ok(alTetto instanceof LezioneTrattenuta && !alTetto.definitiva, `attesa lezione trattenuta fino a domani: ${alTetto}`);
  chiamateDiOggi(gemini).splice(0);
  // Il formato sbagliato da tutti: la prima volta si riprova tra un'ora, la seconda la lezione si ferma.
  riapriCantiere(l.slug);
  aggiungiRiga("stato/vuoto.jsonl", {});
  guasto = "formato";
  pulisciFermi();
  // Senza teoria nel cantiere la prima richiesta è la teoria: il formato sbagliato la fa fallire.
  const cantiere = leggiCantiere(l.slug);
  delete cantiere.teoria;
  const { scriviJson } = await import("../src/archivio.ts");
  scriviJson(`cantieri/${l.slug}.json`, cantiere);
  const primaVolta = await errore(scriviLezione(l));
  assert.ok(primaVolta instanceof LezioneTrattenuta && !primaVolta.definitiva && primaVolta.riprovaTraSec === 3600, `prima volta: ${primaVolta}`);
  pulisciFermi();
  const secondaVolta = await errore(scriviLezione(l));
  assert.ok(secondaVolta instanceof LezioneTrattenuta && secondaVolta.definitiva, `seconda volta: ${secondaVolta}`);
  riapriCantiere(l.slug);
  assert.equal(leggiCantiere(l.slug).formatoMancato, 0, "Riprova azzera il contatore");
  guasto = "nessuno";
  pulisciFermi();
});

test("prova di scrittura: il modello nuovo scrive da solo in una copia; bocciato se toglie un esercizio, approvato se no", { timeout: 30 * 60_000 }, async () => {
  const { provaScrittore } = await import("../src/lezione/prova-scrittura.ts");
  const CANDIDATO = "openrouter/openai/gpt-oss-120b:free";
  const openrouter = FORNITORI.find((f) => f.id === "openrouter")!;
  openrouter.baseUrl = finto.url;
  process.env.OPENROUTER_API_KEY = CHIAVE_FINTA;
  pulisciFermi();
  const pubblicato = () => tuttiIFile(dati).filter((f) => /[\\/](lezioni|media)[\\/]|catalogo\.json$/.test(f)).map((f) => `${f}:${fs.readFileSync(f, "base64")}`).sort();
  const corsoPrima = pubblicato();
  const temporanee = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("htd-prova-scrittore-")).sort();
  const temporaneePrima = temporanee();
  const scrittura = (t: string) => t.startsWith("Scrivi la PARTE TEORICA") || t.startsWith("Scrivi per intero la PARTE PRATICA");

  // 1) La terza lezione arriva con un esercizio che non può riuscire: viene tolto, quindi la prova non è superata.
  let prima = finto.richieste.length;
  const bocciato = await provaScrittore(CANDIDATO);
  let nuove = finto.richieste.slice(prima);
  assert.equal(bocciato.risultato, "non approvato");
  assert.deepEqual(bocciato.esiti.map((e) => [e.numero, e.esito]), [["1.1", "superata"], ["1.2", "con-ripieghi"]]);
  assert.ok(nuove.some((r) => scrittura(r.testo)), "la prova ha scritto davvero");
  assert.ok(nuove.filter((r) => scrittura(r.testo)).every((r) => r.modello === "openai/gpt-oss-120b:free"), "scrive solo il modello in prova");
  assert.ok(nuove.filter((r) => r.testo.startsWith("Sei il REVISORE")).length >= 2, "ogni lezione è stata rivista");
  assert.ok(nuove.filter((r) => r.testo.startsWith("Sei il REVISORE")).every((r) => r.modello !== "openai/gpt-oss-120b:free"), "il modello in prova non giudica il proprio lavoro");
  assert.ok(!statoFabbrica().scrittoriApprovati.includes(CANDIDATO));
  assert.equal(process.env.HTD_SOLO_SCRITTORE, undefined, "finita la prova, scrivono di nuovo gli scrittori di sempre");
  assert.equal(CONFIG.dati, dati, "finita la prova, la fabbrica lavora di nuovo sull'archivio vero");
  assert.deepEqual(pubblicato(), corsoPrima, "il corso vero non è stato toccato");
  for (const slug of ["variabili-e-tipi", "process-e-delta"]) assert.ok(!fs.existsSync(path.join(dati, "cantieri", `${slug}.json`)), `nessun cantiere nel corso vero per ${slug}`);
  assert.deepEqual(temporanee(), temporaneePrima, "la copia dell'archivio è stata tolta");
  const spese = chiamateDiOggi(openrouter).filter((c) => c.modello === "openai/gpt-oss-120b:free").length;
  assert.ok(spese >= nuove.filter((r) => r.modello === "openai/gpt-oss-120b:free").length, "le richieste spese nella prova sono contate nell'archivio vero");
  const rapporti = fs.readdirSync(path.join(dati, "prove", "scrittori"));
  assert.equal(rapporti.length, 1);
  const rapporto = JSON.parse(fs.readFileSync(path.join(dati, "prove", "scrittori", rapporti[0]), "utf8"));
  assert.equal(rapporto.risultato, "non approvato");
  assert.ok(rapporto.esiti[1].dettaglio.includes("Una stella che cade"), "il rapporto dice quale esercizio è stato tolto");

  // 2) Le stesse due lezioni scritte giuste: approvato, e da ora scrive anche fuori dalla prova.
  praticaGiusta = true;
  prima = finto.richieste.length;
  const approvato = await provaScrittore(CANDIDATO);
  praticaGiusta = false;
  nuove = finto.richieste.slice(prima);
  assert.equal(approvato.risultato, "approvato", JSON.stringify(approvato.esiti));
  assert.ok(statoFabbrica().scrittoriApprovati.includes(CANDIDATO));
  assert.deepEqual(pubblicato(), corsoPrima, "neanche la seconda prova tocca il corso vero");
  const { candidati } = await import("../src/ai/router.ts");
  assert.ok(candidati("scrittore", { tokenStimati: 1000, escludi: [] }).disponibili.some((c) => c.nome === CANDIDATO), "approvato: è tra gli scrittori");
  assert.ok(candidati("scrittore", { tokenStimati: 1000, escludi: [] }).disponibili.some((c) => c.nome.startsWith("gemini/")), "e Gemini scrive ancora, alla pari");

  // Il resto delle prove gira come prima: senza il fornitore nuovo.
  aggiornaStato((s) => {
    s.scrittoriApprovati = [];
  });
  delete process.env.OPENROUTER_API_KEY;
  pulisciFermi();
});

test("nessuna chiave in nessun file dell'archivio, e ogni lezione pubblicata è valida", () => {
  for (const file of tuttiIFile(dati)) assert.ok(!fs.readFileSync(file).includes(CHIAVE_FINTA), `la chiave è finita in ${file}`);
  for (const voce of catalogo().lezioni) {
    const pacco = paccoPubblicato(voce.slug);
    assert.ok(pacco && pacco.versione >= 1);
  }
  assert.equal(catalogo().lezioni.length, 3);
  assert.equal(leggiJson<unknown>("stato/fabbrica.json", null) !== null, true);
  finto.chiuso();
  fs.rmSync(dati, { recursive: true, force: true });
});

// ES1_ROTTO e CESTO_1 servono alle risposte del finto fornitore; controllo serve alle verifiche.
void [ES1_ROTTO, CESTO_1, controllo];
