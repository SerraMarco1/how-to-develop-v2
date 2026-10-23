import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { preparaAmbiente } from "./aiuto.ts";

// Le correzioni del gioco, con il Godot VERO. Un corso finto con due lezioni del gioco: nella 1.9 il cesto crea cinque
// stelle come sue figlie (sotto lo schermo, come nel corso vero fino al 23 ottobre), nella 1.10 parte da lì e aggiunge
// spawn_star(). La correzione delle stelle mette `top_level = true` in tutta la catena e un controllo «si vedono nello
// schermo» nella 1.9: escono tutte e due le lezioni, la 1.10 parte ancora da dove finisce la 1.9. Una correzione che
// non trova il suo testo, o il cui esercizio non supera i controlli, non cambia niente.

const { dati } = preparaAmbiente("correzioni");

const BASKET_TSCN = '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://basket.gd" id="1_b"]\n[ext_resource type="Texture2D" path="res://icon.svg" id="2_t"]\n\n[node name="Basket" type="Sprite2D"]\ntexture = ExtResource("2_t")\nscript = ExtResource("1_b")\n';
const STAR_TSCN = '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://star.gd" id="1_s"]\n[ext_resource type="Texture2D" path="res://icon.svg" id="2_t"]\n\n[node name="Star" type="Sprite2D"]\ntexture = ExtResource("2_t")\nscript = ExtResource("1_s")\n';
const STAR_GD = "extends Sprite2D\n\nvar fall_speed: float = 180.0\n\n\nfunc _process(delta: float) -> void:\n\tposition.y += fall_speed * delta\n";
const BASKET_GD = "extends Sprite2D\n\n\nfunc _ready() -> void:\n\tposition = Vector2(576, 600)\n";
const BASKET_STELLE = `${BASKET_GD}\tfor i in range(5):\n\t\tvar star: Sprite2D = load("res://star.tscn").instantiate()\n\t\tadd_child(star)\n\t\tstar.position = Vector2(150.0 + i * 180.0, 80.0 + i * 50.0)\n`;
const BASKET_SPAWN = `${BASKET_STELLE}\n\nfunc spawn_star() -> void:\n\tvar new_star: Sprite2D = load("res://star.tscn").instantiate()\n\tadd_child(new_star)\n`;
const CONTA_STELLE = 'extends "res://htd/htd_test.gd"\n\n\nfunc _run_tests() -> void:\n\tvar basket := await instantiate_main_scene()\n\tif not check("basket", basket != null, "La scena basket.tscn deve caricarsi"):\n\t\treturn\n\tvar stars: Array[Node] = []\n\tfor child in basket.get_children():\n\t\tif child is Sprite2D:\n\t\t\tstars.append(child)\n\tcheck("star_count", stars.size() == 5, "Il cesto deve contenere 5 stelle")\n';
const CONSEGNA_1 = "In `basket.gd`, dentro `_ready()`, crea 5 stelle con `for i in range(5):`: carica `res://star.tscn` con `load()`, chiama `instantiate()`, aggiungi la stella con `add_child(star)` e mettila a `Vector2(150.0 + i * 180.0, 80.0 + i * 50.0)`.";

const { impostaCartellaMotore } = await import("@htd/condiviso/motore.ts");
const { impostaGodot } = await import("@htd/condiviso/godot/esegui.ts");
const { installaGodot } = await import("@htd/condiviso/godot/installa.ts");
const { impostaCartellaTemporanea, verifica } = await import("@htd/condiviso/godot/verifica.ts");
const { lezioneDelCorso } = await import("@htd/condiviso/piano.ts");
const { costruisciProjectGodot } = await import("@htd/condiviso/godot/progetto.ts");
const { FORMATO, PaccoLezioneSchema, percorsoLezione, sha256 } = await import("@htd/condiviso/pacchetto.ts");
const { EsercizioSchema } = await import("@htd/condiviso/schemi.ts");
const { CONFIG } = await import("../src/configurazione.ts");
const { leggiJson, salva, scriviFile } = await import("../src/archivio.ts");
const { aggiornaCatalogo } = await import("../src/lezione/pubblica.ts");
const { catalogo, paccoPubblicato } = await import("../src/corso.ts");
const { applicaCorrezioni, correzioniInSospeso } = await import("../src/correzioni.ts");
const { STELLE_DEL_CESTO, stelleNelloSchermo } = await import("../src/correzioni/stelle-del-cesto.ts");
const { CorrezioneImpossibile, esercizio, inserisciDopo, sostituisci, verificaGodot } = await import("../src/correzioni/strumenti.ts");
const { registroDiLezione } = await import("../src/traccia.ts");
const { cominciaGiro } = await import("../src/tempo.ts");

impostaCartellaMotore(CONFIG.motore);
impostaCartellaTemporanea(path.join(CONFIG.cache, "temp"));
fs.writeFileSync(path.join(dati, ".gitkeep"), "");
await salva("inizio");

const progetto = { nome: "Pioggia di stelle", scenaPrincipale: "res://basket.tscn", azioni: [], autoload: [], impostazioni: [] };
const gioco = (basket: string) => [
  { percorso: "project.godot", contenuto: costruisciProjectGodot(progetto).testo },
  { percorso: "basket.tscn", contenuto: BASKET_TSCN },
  { percorso: "basket.gd", contenuto: basket },
  { percorso: "star.tscn", contenuto: STAR_TSCN },
  { percorso: "star.gd", contenuto: STAR_GD },
];
const stato = (basket: string) => ({ nome: "Pioggia di stelle", cartella: "pioggia-di-stelle", file: gioco(basket), progetto });
const aParte = EsercizioSchema.parse({ id: "test", tipo: "test", genere: "obiettivo", titolo: "Stampa il punteggio", consegna: "Stampa `Punti: 10` nel pannello Output all'avvio di `main.gd`.", modalita: "progetto", dove: "a-parte", partenza: { file: [] }, soluzione: { file: [{ percorso: "main.gd", contenuto: 'extends Node\n\n\nfunc _ready() -> void:\n\tprint("Punti: 10")\n' }], progetto: { nome: "Punti", scenaPrincipale: "" }, cambiati: ["main.gd"] } });

function pubblica(slug: string, es1: unknown, iniziale: string, finale: string, teoria: string): void {
  const l = lezioneDelCorso(slug)!;
  const pacco = PaccoLezioneSchema.parse({
    formato: FORMATO,
    slug,
    numero: l.numero,
    fase: l.fase.slug,
    titolo: l.titolo,
    tipo: l.tipo,
    minuti: l.minuti,
    versione: 1,
    contenuto: { titolo: l.titolo, sommario: "Il gioco cresce.", blocchi: [{ id: "b1", tipo: "testo", md: teoria }], esercizi: [EsercizioSchema.parse(es1)], test: aParte, statoIniziale: stato(iniziale) },
    statoFinale: stato(finale),
    media: {},
    video: {},
    ripasso: [],
    origine: { pubblicata: "2026-10-19T10:00:00.000Z", modelli: ["gemini/gemini-flash-latest"], richieste: 9, codice: null },
  });
  const file = percorsoLezione(l.fase.slug, slug);
  const testo = JSON.stringify(pacco);
  scriviFile(file, testo);
  aggiornaCatalogo({ slug, numero: l.numero, titolo: l.titolo, versione: 1, file, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
}

pubblica(
  "cicli",
  { id: "es1", tipo: "guidato", genere: "guidato", titolo: "Cinque stelle", consegna: CONSEGNA_1, modalita: "progetto", dove: "gioco", passiGuida: ["Apri `basket.gd`.", "Scrivi il ciclo `for i in range(5):`.", "Crea e aggiungi la stella.", "Premi F5."], verifiche: [{ tipo: "testo_in_file", percorso: "res://basket.gd", regex: "range\\(5\\)", descrizione: "Un ciclo for" }, { tipo: "script_godot", codice: CONTA_STELLE, descrizione: "Cinque stelle" }], soluzione: { file: gioco(BASKET_STELLE), progetto, spiegazione: "Il ciclo crea le stelle.", cambiati: ["basket.gd"] } },
  BASKET_GD,
  BASKET_STELLE,
  "Il ciclo `for i in range(5):` ripete il codice. `load()` carica una scena, `instantiate()` ne crea una copia, `add_child()` la aggiunge come figlia, `Vector2()` è un punto.",
);
pubblica(
  "array",
  { id: "es1", tipo: "guidato", genere: "guidato", titolo: "Una stella alla volta", consegna: "In `basket.gd` aggiungi la funzione `spawn_star()`: carica `res://star.tscn`, crea la stella con `instantiate()` e aggiungila con `add_child()`.", modalita: "progetto", dove: "gioco", passiGuida: ["Apri `basket.gd`.", "Scrivi `func spawn_star() -> void:`.", "Crea e aggiungi la stella.", "Salva."], verifiche: [{ tipo: "testo_in_file", percorso: "res://basket.gd", regex: "func spawn_star", descrizione: "La funzione spawn_star" }], soluzione: { file: gioco(BASKET_SPAWN), progetto, spiegazione: "spawn_star crea una stella.", cambiati: ["basket.gd"] } },
  BASKET_STELLE,
  BASKET_SPAWN,
  "Una funzione dà un nome a un pezzo di lavoro.",
);
await salva("due lezioni del gioco");

/** La correzione delle stelle con i testi di queste due lezioni finte (quelli veri sono per le lezioni vere). */
const correzione = (id: string, cicli: (l: Parameters<typeof esercizio>[0]) => void, codice = STELLE_DEL_CESTO.codice) => ({ ...STELLE_DEL_CESTO, id, codice, lezioni: { cicli } });
const testiGiusti = (l: Parameters<typeof esercizio>[0]) => {
  const es1 = esercizio(l, "es1");
  es1.consegna = sostituisci(es1.consegna, "aggiungi la stella con `add_child(star)`", "scrivi `star.top_level = true`, aggiungi la stella con `add_child(star)`");
  inserisciDopo(es1.passiGuida, "Scrivi il ciclo", "Scrivi `star.top_level = true` prima di `add_child(star)`.");
  const v = verificaGodot(es1, "Cinque stelle");
  // Il codice delle verifiche arriva senza l'a capo finale (lo schema lo toglie).
  v.codice = `${v.codice.trimEnd()}\n\tfor node in stars:\n\t\tcheck("on_screen", (node as Node2D).global_position.y < 648.0, "La stella deve vedersi: serve star.top_level = true")\n`;
};
const versioni = () => Object.fromEntries(catalogo().lezioni.map((v) => [v.slug, v.versione]));

test("la modifica del codice: top_level prima di add_child degli oggetti, immagine alle stelle nuove, una volta sola", () => {
  const prima = 'func _ready() -> void:\n\tfor i in range(3):\n\t\tvar star: Sprite2D = Sprite2D.new()\n\t\tadd_child(star)\n\tget_parent().add_child(item)\n\tadd_child(score_pop)\n\tif ok:\n\t\tadd_child(new_item)\n';
  const dopo = stelleNelloSchermo(prima);
  assert.equal(dopo, 'func _ready() -> void:\n\tfor i in range(3):\n\t\tvar star: Sprite2D = Sprite2D.new()\n\t\tstar.texture = load("res://icon.svg")\n\t\tstar.top_level = true\n\t\tadd_child(star)\n\tget_parent().add_child(item)\n\tadd_child(score_pop)\n\tif ok:\n\t\tnew_item.top_level = true\n\t\tadd_child(new_item)\n');
  assert.equal(stelleNelloSchermo(dopo), dopo, "rifarla non cambia niente");
  const conImmagine = '\tvar star: Sprite2D = Sprite2D.new()\n\tstar.texture = load("res://icon.svg")\n';
  assert.equal(stelleNelloSchermo(conImmagine), conImmagine, "un'immagine già assegnata non si ripete");
});

test("i testi da cambiare devono esserci esattamente una volta", () => {
  assert.equal(sostituisci("a b c", "b", "B"), "a B c");
  assert.throws(() => sostituisci("a b c", "x", "X"), (e: unknown) => e instanceof CorrezioneImpossibile && /non trovo il testo «x»/.test(e.message));
  assert.throws(() => sostituisci("b b", "b", "B"), /trovo 2 volte/);
  const elenco = ["uno", "due"];
  inserisciDopo(elenco, "uno", "uno e mezzo");
  assert.deepEqual(elenco, ["uno", "uno e mezzo", "due"]);
});

test("correzioni: preparazione del Godot di servizio", { timeout: 20 * 60_000 }, async () => {
  impostaGodot(await installaGodot(path.join(CONFIG.cache, "strumenti")));
});

test("una correzione che non trova il suo testo non cambia niente", { timeout: 10 * 60_000 }, async () => {
  cominciaGiro();
  const prima = versioni();
  const c = correzione("testo-sparito", (l) => {
    esercizio(l, "es1").consegna = sostituisci(esercizio(l, "es1").consegna, "un testo che non c'è", "x");
  });
  assert.equal(await applicaCorrezioni([c]), 0);
  assert.deepEqual(versioni(), prima);
  const stato = leggiJson<Record<string, { esito: string; motivo: string }>>("stato/correzioni.json", {})["testo-sparito"];
  assert.equal(stato.esito, "fallita");
  assert.match(stato.motivo, /1\.9 cicli: non trovo il testo «un testo che non c'è»/);
  assert.equal(correzioniInSospeso([c]), false, "non si riprova");
});

test("una correzione il cui esercizio non supera i controlli non cambia niente", { timeout: 10 * 60_000 }, async () => {
  cominciaGiro();
  const prima = versioni();
  // Il controllo «si vede nello schermo» senza la riga nel codice: le stelle restano sotto, la verifica fallisce.
  const c = correzione("senza-codice", testiGiusti, (t) => t);
  assert.equal(await applicaCorrezioni([c]), 0);
  assert.deepEqual(versioni(), prima);
  const stato = leggiJson<Record<string, { esito: string }>>("stato/correzioni.json", {})["senza-codice"];
  assert.equal(stato.esito, "fallita");
  const traccia = registroDiLezione("cicli").filter((r) => r.azione === "correzione del gioco");
  assert.ok(traccia.some((r) => r.esito === "fallito" && /es1: la soluzione di riferimento NON supera le verifiche[\s\S]*serve star\.top_level = true/.test(r.spiegazione)), "la traccia dice quale controllo fallisce");
});

test("la correzione delle stelle: tutta la catena in una versione nuova, che parte ancora da dove finisce la lezione prima", { timeout: 20 * 60_000 }, async () => {
  cominciaGiro();
  const c = correzione("stelle", testiGiusti);
  assert.equal(correzioniInSospeso([c]), true);
  assert.equal(await applicaCorrezioni([c]), 2);
  assert.deepEqual(versioni(), { cicli: 2, array: 2 });

  const cicli = paccoPubblicato("cicli")!;
  const array = paccoPubblicato("array")!;
  const basket = (f: { percorso: string; contenuto: string }[]) => f.find((x) => x.percorso === "basket.gd")!.contenuto;
  assert.match(basket(cicli.contenuto.esercizi[0].soluzione.file), /\t\tstar\.top_level = true\n\t\tadd_child\(star\)/);
  assert.match(basket(array.statoFinale!.file), /\tnew_star\.top_level = true\n\tadd_child\(new_star\)/);
  assert.equal(basket(cicli.contenuto.statoIniziale!.file), BASKET_GD, "il gioco prima della 1.9 non cambia");
  assert.deepEqual(array.contenuto.statoIniziale!.file, cicli.statoFinale!.file, "la 1.10 parte da dove finisce la 1.9");
  assert.match(cicli.contenuto.esercizi[0].consegna, /scrivi `star\.top_level = true`/);
  assert.deepEqual(cicli.contenuto.test, aParte, "l'esercizio a parte non cambia");

  // La verifica nuova: chi dimentica la riga non passa, e il messaggio dice perché.
  const es1 = cicli.contenuto.esercizi[0];
  const senza = es1.soluzione.file.map((f) => (f.percorso === "basket.gd" ? { ...f, contenuto: f.contenuto.replace("\t\tstar.top_level = true\n", "") } : f));
  const esito = await verifica({ tipo: "file", file: senza, daLezione: true }, es1.verifiche);
  assert.equal(esito.superato, false);
  assert.ok(esito.controlli.some((x) => !x.superato && /serve star\.top_level = true/.test(`${x.descrizione} ${x.dettaglio ?? ""}`)));

  const registro = leggiJson<Record<string, { esito: string; versioni: Record<string, number> }>>("stato/correzioni.json", {}).stelle;
  assert.deepEqual([registro.esito, registro.versioni], ["fatta", { cicli: 2, array: 2 }]);
  assert.ok(registroDiLezione("array").some((r) => r.azione === "correzione del gioco" && r.esito === "ok" && /Versione 2/.test(r.spiegazione)));
  assert.equal(correzioniInSospeso([c]), false);
  assert.equal(await applicaCorrezioni([c]), 0, "fatta una volta, non si rifà");
});
