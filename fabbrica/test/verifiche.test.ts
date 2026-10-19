import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fornitoreFinto, preparaAmbiente } from "./aiuto.ts";
import { teoria } from "./risposte.ts";

// Verifiche che bocciano un lavoro giusto. Il 17 ottobre la verifica del sottomarino (lezione 1.4) teneva premuto «giù»
// per tre secondi e voleva il sottomarino sul fondale: con la velocità della soluzione (250) ci arrivava, con quella
// scelta da chi studiava (150) no; e misurava la salita da dove il sottomarino partiva, che chi studiava aveva messo a
// 5 pixel dalla superficie. Qui, con il Godot VERO e un fornitore finto: la variante lecita della soluzione scopre la
// verifica fragile, una verifica scritta come chiedono le istruzioni supera il progetto vero di chi studiava, e il
// ricontrollo delle lezioni pubblicate corregge la verifica senza toccare il resto.

const { dati } = preparaAmbiente("verifiche");

const SCENA = '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://submarine.gd" id="1_sub"]\n[ext_resource type="Texture2D" path="res://icon.svg" id="2_icon"]\n\n[node name="Submarine" type="Sprite2D"]\nposition = Vector2(576, 300)\ntexture = ExtResource("2_icon")\nscript = ExtResource("1_sub")\n';
const PARTENZA = "extends Sprite2D\n\nvar speed: float = 250.0\n\n\nfunc _ready() -> void:\n\tmodulate = Color.CYAN\n";
const MOVIMENTO = '\n\nfunc _process(delta: float) -> void:\n\tvar direction: float = 0.0\n\tif Input.is_action_pressed("surface"):\n\t\tdirection -= 1.0\n\tif Input.is_action_pressed("dive"):\n\t\tdirection += 1.0\n\tposition.y += direction * speed * delta\n\tposition.y = clamp(position.y, 80.0, 560.0)\n';
// Il progetto di chi studiava, com'era sul suo PC: velocità 150 e partenza a y = 85, tutto giusto per la consegna.
const STUDENTE = "extends Sprite2D\nvar speed: float = 150.0\n\n\nfunc _ready() -> void:\n\tposition = Vector2(300.0, 85.0)\n" + MOVIMENTO;

const verificaGodot = (righe: string[]) => ['extends "res://htd/htd_test.gd"', "", "", "func _run_tests() -> void:", "\tvar main := await instantiate_main_scene()", '\tif not check("main", main != null, "La scena principale deve caricarsi senza errori"):', "\t\treturn", '\tvar sub := find_by_name(main, "Submarine") as Sprite2D', '\tif not check("sub", sub != null, "La scena deve contenere il nodo Submarine"):', "\t\treturn", ...righe.map((r) => `\t${r}`), ""].join("\n");
// La verifica pubblicata: misura dalla posizione di partenza e aspetta un numero fisso di frame.
const FRAGILE = verificaGodot([
  "var start_y: float = sub.position.y",
  'await hold_action("surface", 20)',
  'check("surface", sub.position.y < start_y - 10.0, "Tenendo premuto surface il sottomarino deve salire verso l\'alto")',
  "var up_y: float = sub.position.y",
  'await hold_action("dive", 30)',
  'check("dive", sub.position.y > up_y + 10.0, "Tenendo premuto dive il sottomarino deve scendere verso il basso")',
  'await hold_action("surface", 100)',
  'check("clamp_surface", sub.position.y >= 79.9 and sub.position.y <= 80.1, "Continuando a salire il sottomarino deve fermarsi a 80 pixel alla superficie")',
  'await hold_action("dive", 180)',
  'check("clamp_dive", sub.position.y >= 559.9 and sub.position.y <= 560.1, "Continuando a scendere il sottomarino deve fermarsi a 560 pixel sul fondale")',
]);
// La stessa verifica scritta come chiedono le istruzioni: un punto noto per il movimento, oltre il limite per il clamp.
const ROBUSTA = verificaGodot([
  "sub.position.y = 320.0",
  'await hold_action("surface", 20)',
  'check("surface", sub.position.y < 315.0, "Tenendo premuto surface il sottomarino deve salire (partito da y = 320, è a y = %.1f)" % sub.position.y)',
  "sub.position.y = 320.0",
  'await hold_action("dive", 20)',
  'check("dive", sub.position.y > 325.0, "Tenendo premuto dive il sottomarino deve scendere (partito da y = 320, è a y = %.1f)" % sub.position.y)',
  "sub.position.y = -500.0",
  'await hold_action("surface", 5)',
  'check("clamp_surface", absf(sub.position.y - 80.0) < 0.5, "Salendo il sottomarino deve fermarsi a y = 80 (è a y = %.1f)" % sub.position.y)',
  "sub.position.y = 2000.0",
  'await hold_action("dive", 5)',
  'check("clamp_dive", absf(sub.position.y - 560.0) < 0.5, "Scendendo il sottomarino deve fermarsi a y = 560 (è a y = %.1f)" % sub.position.y)',
]);

const CONSEGNA =
  "Nel progetto `Sottomarino` presente nella cartella `sottomarino`, rendi pilotabile un sottomarino lungo l'asse verticale.\n\n1. Nella **Input Map** crea le azioni `surface` (tasti **W** e **Freccia Su**) e `dive` (tasti **S** e **Freccia Giù**).\n2. Nello script `submarine.gd` scrivi `_process(delta: float) -> void`: `direction` vale `-1.0` con `surface` e `1.0` con `dive`; somma `direction * speed * delta` a `position.y` e blocca `position.y` con `clamp()` tra la superficie a `80.0` pixel e il fondale a `560.0` pixel.";

/** L'esercizio come lo scrive un modello. */
const sottomarino = (codice: string) => ({
  titolo: "Controlla la profondità del sottomarino",
  consegna: CONSEGNA,
  modalita: "progetto",
  genere: "obiettivo",
  cartella: "sottomarino",
  suggerimenti: ["In 2D la Y cresce verso il basso: per salire `direction` deve diminuire."],
  verifiche: [
    { tipo: "azione_input", nome: "surface", descrizione: "L'azione surface è configurata nella Input Map" },
    { tipo: "azione_input", nome: "dive", descrizione: "L'azione dive è configurata nella Input Map" },
    { tipo: "script_godot", codice, descrizione: "Il sottomarino sale, scende e non supera superficie e fondale" },
  ],
  partenza: {
    file: [
      { percorso: "submarine.tscn", contenuto: SCENA },
      { percorso: "submarine.gd", contenuto: PARTENZA },
    ],
    progetto: { nome: "Sottomarino", scenaPrincipale: "res://submarine.tscn" },
  },
  soluzione: {
    progetto: {
      nome: "Sottomarino",
      scenaPrincipale: "res://submarine.tscn",
      azioni: [
        { nome: "surface", tasti: ["W", "Up"] },
        { nome: "dive", tasti: ["S", "Down"] },
      ],
    },
    file: [
      { percorso: "submarine.tscn", contenuto: SCENA },
      { percorso: "submarine.gd", contenuto: PARTENZA + MOVIMENTO },
    ],
    spiegazione: "Si somma a `position.y` lo spostamento del frame e lo si blocca con `clamp()`.",
  },
});

// La lezione 1.9 del 18 ottobre in piccolo: la soluzione crea le rocce in punti precisi, ma per farlo cambia anche
// rock.gd (la roccia tiene la posizione data); la consegna nomina solo main.gd. Il rock.gd di chi studia, giusto per le
// lezioni prima, rimette la roccia in un punto a caso: nessun lavoro fatto come dice la consegna può passare.
const SCENA_MAIN = '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://main.gd" id="1_main"]\n\n[node name="Main" type="Node2D"]\nscript = ExtResource("1_main")\n';
const SCENA_ROCCIA = '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://rock.gd" id="1_rock"]\n[ext_resource type="Texture2D" path="res://icon.svg" id="2_icon"]\n\n[node name="Rock" type="Sprite2D"]\ntexture = ExtResource("2_icon")\nscript = ExtResource("1_rock")\n';
const ROCCIA_PRIMA = "extends Sprite2D\n\n\nfunc _ready() -> void:\n\tposition = Vector2(randf_range(100.0, 1000.0), 80.0)\n";
const ROCCIA_DOPO = "extends Sprite2D\n\n\nfunc _ready() -> void:\n\tif position == Vector2.ZERO:\n\t\tposition = Vector2(randf_range(100.0, 1000.0), 80.0)\n";
const MAIN_DOPO = 'extends Node2D\n\n\nfunc _ready() -> void:\n\tfor i in range(3):\n\t\tvar rock: Sprite2D = load("res://rock.tscn").instantiate()\n\t\trock.position = Vector2(200.0 + i * 300.0, 200.0)\n\t\tadd_child(rock)\n';
const CONSEGNA_ROCCE = "In `main.gd`, dentro `_ready()`, crea tre rocce con un ciclo `for i in range(3)`: per ognuna crea una copia della scena con `load(\"res://rock.tscn\").instantiate()`, mettila in `Vector2(200 + i * 300, 200)` e aggiungila alla scena con `add_child()`.";
const rocce = (consegna = CONSEGNA_ROCCE) => ({
  titolo: "Una fila di rocce",
  consegna,
  modalita: "progetto",
  genere: "obiettivo",
  cartella: "rocce",
  verifiche: [
    {
      tipo: "script_godot",
      descrizione: "Tre rocce in fila, nei punti chiesti",
      codice: ['extends "res://htd/htd_test.gd"', "", "", "func _run_tests() -> void:", "\tvar main := await instantiate_main_scene()", '\tif not check("main", main != null, "La scena principale deve aprirsi"):', "\t\treturn", '\tvar rocks := find_all_by_class(main, "Sprite2D")', '\tif not check("tre", rocks.size() == 3, "Servono tre rocce (ce ne sono %d)" % rocks.size()):', "\t\treturn", '\tcheck("x", absf(rocks[0].position.x - 200.0) < 0.5 and absf(rocks[2].position.x - 800.0) < 0.5, "Le rocce devono stare a x = 200, 500 e 800 (la prima è a x = %.1f)" % rocks[0].position.x)', ""].join("\n"),
    },
  ],
  partenza: {
    file: [
      { percorso: "main.tscn", contenuto: SCENA_MAIN },
      { percorso: "main.gd", contenuto: "extends Node2D\n" },
      { percorso: "rock.tscn", contenuto: SCENA_ROCCIA },
      { percorso: "rock.gd", contenuto: ROCCIA_PRIMA },
    ],
    progetto: { nome: "Rocce", scenaPrincipale: "res://main.tscn" },
  },
  soluzione: {
    progetto: { nome: "Rocce", scenaPrincipale: "res://main.tscn" },
    file: [
      { percorso: "main.tscn", contenuto: SCENA_MAIN },
      { percorso: "main.gd", contenuto: MAIN_DOPO },
      { percorso: "rock.tscn", contenuto: SCENA_ROCCIA },
      { percorso: "rock.gd", contenuto: ROCCIA_DOPO },
    ],
    spiegazione: "Il ciclo crea tre copie della scena della roccia e le mette in fila.",
  },
});
const CONSEGNA_ROCCE_GIUSTA = `${CONSEGNA_ROCCE}\n\nPrima, in \`rock.gd\`, fai in modo che la roccia scelga un punto a caso solo se nessuno le ha già dato una posizione: dentro \`_ready()\` metti la riga che sceglie il punto sotto \`if position == Vector2.ZERO:\`.`;

const PASSI = ["Apri **Project → Project Settings** nella scheda **Input Map**.", "Crea le azioni `surface` e `dive` con i loro tasti.", "Apri `submarine.gd` e scrivi `_process(delta: float) -> void`.", "Somma lo spostamento a `position.y` e bloccalo con `clamp()`, poi salva con Ctrl+S."];

// Le risposte del fornitore finto. Le correzioni delle verifiche: una lista consumata in ordine, poi sempre la fragile.
const correzioni: string[] = [];
const finto = await fornitoreFinto(({ testo }) => {
  // La correzione delle rocce: la consegna dice la modifica a rock.gd; tutto il resto come prima.
  if (testo.includes("RIFIUTATO dai controlli automatici") && testo.includes("la soluzione cambia anche rock.gd")) return { dati: rocce(CONSEGNA_ROCCE_GIUSTA) };
  if (testo.includes("RIFIUTATO dai controlli automatici") && testo.includes("VERIFICHE FRAGILI")) return { dati: { ...sottomarino(correzioni.shift() ?? FRAGILE), titolo: "Il sottomarino più lento" } };
  if (testo.startsWith("Scrivi la PARTE TEORICA")) return { dati: teoria("Input: leggere la tastiera", "leggi la tastiera con le azioni della Input Map", 'func _process(delta: float) -> void:\n\tif Input.is_action_pressed("dive"):\n\t\tposition.y += 100.0 * delta\n') };
  if (testo.startsWith("Scrivi per intero la PARTE PRATICA")) {
    return {
      dati: {
        esercizi: [
          { ...sottomarino(ROBUSTA), genere: "guidato", passiGuida: PASSI },
          { ...sottomarino(FRAGILE), genere: "obiettivo", titolo: "Il sottomarino più lento" },
        ],
        test: { ...sottomarino(ROBUSTA), genere: "obiettivo", titolo: "Il sottomarino da solo" },
      },
    };
  }
  return { dati: { approvata: true, problemi: [] } };
});

// I moduli della fabbrica leggono l'ambiente quando vengono caricati: dopo preparaAmbiente.
const { impostaCartellaMotore } = await import("@htd/condiviso/motore.ts");
const { impostaGodot } = await import("@htd/condiviso/godot/esegui.ts");
const { installaGodot } = await import("@htd/condiviso/godot/installa.ts");
const { impostaCartellaTemporanea, verifica } = await import("@htd/condiviso/godot/verifica.ts");
const { lezioneDelCorso } = await import("@htd/condiviso/piano.ts");
const { costruisciProjectGodot } = await import("@htd/condiviso/godot/progetto.ts");
const { FORMATO, PaccoLezioneSchema, percorsoLezione, sha256 } = await import("@htd/condiviso/pacchetto.ts");
const { EsercizioSchema } = await import("@htd/condiviso/schemi.ts");
const { CONFIG } = await import("../src/configurazione.ts");
const { FORNITORI } = await import("../src/ai/catalogo.ts");
const { salva, scriviFile, leggiJson } = await import("../src/archivio.ts");
const { preparaDocumentazione } = await import("../src/documentazione.ts");
const { avvisoFragile, chiamateNonSpiegate, preparaEsercizio, soloProblemiMinori, validaEsercizio, varianteLecita, varianteLetterale, VERIFICHE_FRAGILI } = await import("../src/lezione/esercizio.ts");
const { aggiornaCatalogo } = await import("../src/lezione/pubblica.ts");
const { catalogo, paccoPubblicato } = await import("../src/corso.ts");
const { rendiRobusteLeVerifiche } = await import("../src/robustezza.ts");
const { scriviLezione } = await import("../src/lezione/catena.ts");
const { registroDiLezione } = await import("../src/traccia.ts");
const { cominciaGiro } = await import("../src/tempo.ts");

FORNITORI.find((f) => f.id === "gemini")!.baseUrl = finto.url;
impostaCartellaMotore(CONFIG.motore);
impostaCartellaTemporanea(path.join(CONFIG.cache, "temp"));
fs.writeFileSync(path.join(dati, ".gitkeep"), "");
await salva("inizio");

const esercizio = (codice: string, id = "es1", tipo: "autonomo" | "test" = "autonomo") => preparaEsercizio(EsercizioSchema.parse(sottomarino(codice)), id, tipo);

test("variante lecita: si dimezzano solo i valori iniziali che il testo dell'esercizio non dice", () => {
  const e = esercizio(FRAGILE);
  assert.deepEqual(varianteLecita(e)!.cambi, ["submarine.gd: `speed` da 250.0 a 125.0"]);
  assert.match(varianteLecita(e)!.file.find((f) => f.percorso === "submarine.gd")!.contenuto, /^var speed: float = 125\.0$/m);
  assert.equal(varianteLecita({ ...e, consegna: `${e.consegna}\nIl sottomarino va a 250 pixel al secondo.` }), null, "un valore scritto nella consegna è imposto");

  const script = [
    "extends Node2D",
    "",
    "const LIVES := 3",
    "@export var jump: float = -400.0 # salto",
    '@export_range(0, 10) var level: int = 5',
    "static var count: int = 7",
    "var zero := 0",
    "var one: float = 1.0",
    "var half: float = 0.5",
    'var label: String = "250"',
    "",
    "",
    "func _ready() -> void:",
    "\tvar local := 50.0",
    "",
  ].join("\n");
  const altro = { ...e, soluzione: { ...e.soluzione, file: [...e.soluzione.file.filter((f) => f.percorso !== "submarine.gd"), { percorso: "submarine.gd", contenuto: script }] } };
  const v = varianteLecita(altro)!;
  assert.deepEqual(v.cambi, ["submarine.gd: `LIVES` da 3 a 2", "submarine.gd: `jump` da -400.0 a -200.0", "submarine.gd: `level` da 5 a 3", "submarine.gd: `count` da 7 a 4", "submarine.gd: `half` da 0.5 a 0.25"]);
  const nuovo = v.file.find((f) => f.percorso === "submarine.gd")!.contenuto;
  assert.match(nuovo, /^@export var jump: float = -200\.0 # salto$/m, "il commento resta");
  assert.match(nuovo, /^var zero := 0$/m);
  assert.match(nuovo, /^var one: float = 1\.0$/m);
  assert.match(nuovo, /^\tvar local := 50\.0$/m, "le variabili dentro le funzioni restano");
});

test("preparazione: Godot di servizio verificato e documentazione indicizzata", { timeout: 20 * 60_000 }, async () => {
  impostaGodot(await installaGodot(path.join(CONFIG.cache, "strumenti")));
  assert.ok(fs.existsSync(await preparaDocumentazione()));
});

test("la verifica pubblicata boccia il progetto giusto di chi studiava; la variante lecita lo scopre prima di pubblicare", { timeout: 10 * 60_000 }, async () => {
  const fragile = esercizio(FRAGILE);
  const robusta = esercizio(ROBUSTA);
  const progettoStudente = [
    { percorso: "project.godot", contenuto: costruisciProjectGodot(fragile.soluzione.progetto!).testo },
    { percorso: "submarine.tscn", contenuto: SCENA.replace("position = Vector2(576, 300)\n", "") },
    { percorso: "submarine.gd", contenuto: STUDENTE },
  ];
  const sulloStudente = await verifica({ tipo: "file", file: progettoStudente, daLezione: false }, fragile.verifiche);
  assert.deepEqual(
    sulloStudente.controlli.filter((c) => !c.superato).map((c) => c.descrizione),
    ["Tenendo premuto surface il sottomarino deve salire verso l'alto", "Continuando a scendere il sottomarino deve fermarsi a 560 pixel sul fondale"],
    "il caso del 17 ottobre",
  );

  const problemi = await validaEsercizio(fragile, { nonFatto: fragile.partenza!.file });
  assert.equal(problemi.length, 1);
  assert.ok(problemi[0].startsWith(VERIFICHE_FRAGILI), problemi[0]);
  assert.match(problemi[0], /`speed` da 250\.0 a 125\.0/);
  assert.match(problemi[0], /fermarsi a 560 pixel sul fondale/);
  assert.ok(soloProblemiMinori(problemi));
  assert.ok(!soloProblemiMinori([...problemi, "la consegna è troppo breve"]));

  assert.deepEqual(await validaEsercizio(robusta, { nonFatto: robusta.partenza!.file }), [], "la verifica scritta bene passa sulla soluzione e sulla variante, e fallisce sulla partenza");
  const robustaSulloStudente = await verifica({ tipo: "file", file: progettoStudente, daLezione: false }, robusta.verifiche);
  assert.ok(robustaSulloStudente.superato, JSON.stringify(robustaSulloStudente.controlli));
  assert.ok(robustaSulloStudente.controlli.some((c) => c.descrizione === "Scendendo il sottomarino deve fermarsi a y = 560 (è a y = 560.0)"), "il messaggio dice il valore misurato");
});

test("funzioni non spiegate: solo teoria, consegna e progetto di partenza contano, non passi e suggerimenti", () => {
  const e = preparaEsercizio(EsercizioSchema.parse({ ...rocce(), consegna: "In `main.gd` crea tre rocce in fila con un ciclo.", passiGuida: ['Scrivi `var rock: Sprite2D = load("res://rock.tscn").instantiate()`.'], suggerimenti: ["Usa `instantiate()` e `add_child()`."] }), "es1", "autonomo");
  const prima = e.partenza!.file;
  // range, load e Vector2 sono di base; randf_range sta nel progetto di partenza; _ready è definita nella soluzione.
  assert.deepEqual(chiamateNonSpiegate(e, new Set(), prima), ["instantiate", "add_child"]);
  assert.deepEqual(chiamateNonSpiegate(e, new Set(["add_child"]), prima), ["instantiate"], "add_child spiegata in una lezione prima");
  assert.deepEqual(chiamateNonSpiegate({ ...e, consegna: CONSEGNA_ROCCE }, new Set(), prima), [], "la consegna le nomina e dice che cosa fanno");
  assert.deepEqual(chiamateNonSpiegate({ ...e, genere: "trova", daTrovare: ["instantiate", "add_child"] }, new Set(), prima), [], "negli esercizi «trova» si cercano apposta");
});

test("modifiche nascoste: la variante letterale rimette com'erano gli script che la consegna non nomina", () => {
  const e = preparaEsercizio(EsercizioSchema.parse(rocce()), "es1", "autonomo");
  const v = varianteLetterale(e, e.partenza!.file)!;
  assert.deepEqual(v.tornati.map((t) => t.percorso), ["rock.gd"], "main.gd la consegna lo nomina");
  assert.equal(v.file.find((f) => f.percorso === "rock.gd")!.contenuto, ROCCIA_PRIMA);
  assert.deepEqual(v.tornati[0].differenze, ["- riga 5:   position = Vector2(randf_range(100.0, 1000.0), 80.0)", "+ riga 5:   if position == Vector2.ZERO:", "+ riga 6:     position = Vector2(randf_range(100.0, 1000.0), 80.0)"]);
  assert.equal(varianteLetterale({ ...e, consegna: CONSEGNA_ROCCE_GIUSTA }, e.partenza!.file), null);
});

test("modifiche nascoste e verifiche instabili: trovate in Godot prima di pubblicare", { timeout: 10 * 60_000 }, async () => {
  const nascosta = preparaEsercizio(EsercizioSchema.parse(rocce()), "es1", "autonomo");
  const [problema] = await validaEsercizio(nascosta, { nonFatto: nascosta.partenza!.file });
  assert.match(problema, /^la soluzione cambia anche rock\.gd, ma il testo dell'esercizio non lo nomina/);
  assert.match(problema, /\+ riga 5: {3}if position == Vector2\.ZERO:/);
  assert.match(problema, /Le rocce devono stare a x = 200, 500 e 800/);
  assert.ok(!soloProblemiMinori([problema]), "una consegna che non dice tutto è un problema vero");
  const detta = preparaEsercizio(EsercizioSchema.parse(rocce(CONSEGNA_ROCCE_GIUSTA)), "es1", "autonomo");
  assert.deepEqual(await validaEsercizio(detta, { nonFatto: detta.partenza!.file }), []);

  // Una verifica difettosa apposta: passa solo la prima volta che gira in questo progetto (conta le esecuzioni in
  // user://, e alla seconda cancella il conto). È il caso della 1.11: la stessa soluzione, un'altra volta, non passa.
  const instabile = preparaEsercizio(
    EsercizioSchema.parse({
      titolo: `Somma instabile ${Date.now()}`,
      consegna: "Scrivi in `solution.gd` la funzione `somma(a: int, b: int) -> int` che restituisce la somma dei due numeri.",
      modalita: "codice",
      verifiche: [
        {
          tipo: "script_godot",
          descrizione: "somma restituisce la somma",
          codice: ['extends "res://htd/htd_test.gd"', "", "", "func _run_tests() -> void:", '\tvar obj := await instantiate_script("res://solution.gd")', '\tif not check("script", obj != null, "Lo script deve caricarsi"):', "\t\treturn", '\tif not check("funzione", has_function(obj, "somma"), "Serve la funzione somma"):', "\t\treturn", "\tvar volte := 1", '\tif FileAccess.file_exists("user://esecuzioni.txt"):', '\t\tvolte = int(FileAccess.get_file_as_string("user://esecuzioni.txt")) + 1', "\tif volte >= 2:", '\t\tDirAccess.remove_absolute("user://esecuzioni.txt")', "\telse:", '\t\tvar f := FileAccess.open("user://esecuzioni.txt", FileAccess.WRITE)', "\t\tf.store_string(str(volte))", "\t\tf.close()", '\tcheck("somma", call_if_exists(obj, "somma", [2, 3]) == 5 and volte == 1, "somma(2, 3) deve restituire 5 (esecuzione %d)" % volte)', ""].join("\n"),
        },
      ],
      soluzione: { file: [{ percorso: "solution.gd", contenuto: "extends Node\n\n\nfunc somma(a: int, b: int) -> int:\n\treturn a + b\n" }], spiegazione: "Si restituisce a + b." },
    }),
    "es1",
    "autonomo",
  );
  const problemi = await validaEsercizio(instabile);
  assert.equal(problemi.length, 1, problemi.join("\n"));
  assert.match(problemi[0], /^VERIFICHE FRAGILI: le verifiche danno esiti diversi sulla stessa soluzione/);
  assert.match(problemi[0], /esecuzione 2/);
  assert.ok(soloProblemiMinori(problemi));
});

test("scrittura: un esercizio le cui verifiche restano fragili dopo le correzioni esce lo stesso, con un avviso", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  const l = lezioneDelCorso("input-da-tastiera")!;
  const scritta = await scriviLezione(l);
  const [es1, es2] = scritta.lezione.esercizi;
  assert.equal(es1.genere, "guidato");
  assert.equal(es2.titolo, "Il sottomarino più lento", "l'esercizio non viene tolto");
  assert.ok(es2.verifiche.some((v) => v.tipo === "script_godot" && v.codice.includes("hold_action(\"dive\", 180)")));
  assert.deepEqual(scritta.lezione.avvisi, [avvisoFragile("Il sottomarino più lento")]);
  const correzioniDiEs2 = finto.richieste.filter((r) => r.testo.includes("VERIFICHE FRAGILI"));
  assert.equal(correzioniDiEs2.length, 2, "le due correzioni previste, non una riscrittura");
  assert.equal(correzioniDiEs2[0].modello, "gemini-flash-lite-latest", "la prima al ritocco");
  assert.ok(!finto.richieste.some((r) => r.testo.includes("PIÙ SEMPLICE")), "nessuna riscrittura semplificata");
  const passo = registroDiLezione(l.slug).findLast((p) => p.pezzo === "es2" && p.azione === "verifica")!;
  assert.equal(passo.esito, "saltato");
  assert.match(passo.spiegazione, /il pezzo esce lo stesso, con un avviso nella lezione/);
  assert.ok(registroDiLezione(l.slug).some((p) => p.pezzo === "es1" && p.azione === "verifica" && p.esito === "ok"), "la verifica scritta bene passa al primo colpo");
  finto.richieste.length = 0;
});

test("lezione pubblicata con una verifica fragile: corretta solo la verifica, con tentativi contati e poi basta", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  const l = lezioneDelCorso("input-da-tastiera")!;
  const es1 = esercizio(FRAGILE);
  const prova = esercizio(ROBUSTA, "test", "test");
  const pubblica = (versione: number, e1 = es1) => {
    const pacco = PaccoLezioneSchema.parse({
      formato: FORMATO,
      slug: l.slug,
      numero: l.numero,
      fase: l.fase.slug,
      titolo: l.titolo,
      tipo: l.tipo,
      minuti: l.minuti,
      versione,
      contenuto: { titolo: l.titolo, sommario: "Leggere la tastiera con la Input Map.", blocchi: [{ id: "b1", tipo: "testo", md: "Le azioni di input: `Input.is_action_pressed(\"dive\")` è vero finché il tasto è premuto." }], esercizi: [e1], test: prova, avvisi: [avvisoFragile(es1.titolo), "Un altro avviso che resta."] },
      statoFinale: null,
      media: {},
      ripasso: [],
      origine: { pubblicata: "2026-10-15T14:51:09.116Z", modelli: ["gemini/gemini-flash-latest"], richieste: 19, codice: null },
    });
    const file = percorsoLezione(l.fase.slug, l.slug);
    const testo = JSON.stringify(pacco);
    scriviFile(file, testo);
    aggiornaCatalogo({ slug: l.slug, numero: l.numero, titolo: l.titolo, versione, file, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
    return pacco;
  };
  const prima = pubblica(1);
  // Le risposte conservate della lezione (quelle della scrittura della prova prima restano lì: il cantiere è aperto).
  const conservate = () => (fs.existsSync(path.join(dati, "risposte", l.slug)) ? fs.readdirSync(path.join(dati, "risposte", l.slug)).sort() : []);
  const giaConservate = conservate();
  const richieste = () => finto.richieste.filter((r) => r.testo.includes("VERIFICHE FRAGILI"));

  // 1) Il modello del ritocco risponde con verifiche ancora fragili: la lezione resta com'era, il tentativo conta.
  correzioni.push(FRAGILE);
  assert.equal(await rendiRobusteLeVerifiche(), 0);
  assert.deepEqual(richieste().map((r) => r.modello), ["gemini-flash-lite-latest"], "una richiesta, al modello del ritocco");
  assert.match(richieste()[0].testo, /correggi SOLO il campo `verifiche`/);
  assert.match(richieste()[0].testo, /`speed` da 250\.0 a 125\.0/);
  assert.deepEqual(paccoPubblicato(l.slug), prima, "nessuna versione nuova");
  assert.deepEqual(leggiJson<Record<string, unknown>>("stato/verifiche.json", {})[l.slug], { versione: 1, fragili: ["es1"], tentativi: { es1: 1 } });
  assert.equal(registroDiLezione(l.slug).at(-1)!.esito, "fallito");

  // 2) Al giro dopo arriva una verifica giusta: esce la versione 2, cambiano solo le verifiche di es1 e l'avviso.
  correzioni.push(ROBUSTA);
  assert.equal(await rendiRobusteLeVerifiche(), 1);
  const dopo = paccoPubblicato(l.slug)!;
  assert.equal(dopo.versione, 2);
  const [nuovo] = dopo.contenuto.esercizi;
  assert.ok(nuovo.verifiche.some((v) => v.tipo === "script_godot" && v.codice.includes("sub.position.y = 2000.0")));
  assert.deepEqual({ ...nuovo, verifiche: [] }, { ...prima.contenuto.esercizi[0], verifiche: [] }, "consegna, soluzione e partenza non cambiano");
  assert.deepEqual(dopo.contenuto.test, prima.contenuto.test);
  assert.deepEqual(dopo.contenuto.avvisi, ["Un altro avviso che resta."], "l'avviso sulla verifica fragile se ne va");
  assert.equal(dopo.origine.pubblicata, prima.origine.pubblicata);
  const voce = catalogo().lezioni.find((v) => v.slug === l.slug)!;
  assert.equal(voce.versione, 2);
  assert.equal(voce.sha256, sha256(fs.readFileSync(path.join(dati, voce.file), "utf8")));
  assert.deepEqual(leggiJson<Record<string, unknown>>("stato/verifiche.json", {})[l.slug], { versione: 2, fragili: [], tentativi: { es1: 1 } });
  assert.deepEqual(conservate(), giaConservate, "le risposte usate per correggere le verifiche non restano conservate");

  // 3) Niente più da correggere: nessuna richiesta e nessuna versione nuova.
  const n = finto.richieste.length;
  assert.equal(await rendiRobusteLeVerifiche(), 0);
  assert.equal(finto.richieste.length, n);
  assert.equal(paccoPubblicato(l.slug)!.versione, 2);

  // 4) Una versione nuova torna fragile e il modello non la corregge mai: dopo i due tentativi del ritocco ne fa uno
  //    uno scrittore, poi si smette (la lezione resta com'è, con il suo avviso).
  pubblica(3);
  const prima4 = richieste().length;
  for (let giro = 0; giro < 4; giro++) {
    correzioni.push(FRAGILE);
    assert.equal(await rendiRobusteLeVerifiche(), 0);
  }
  correzioni.length = 0;
  const modelli = richieste().slice(prima4).map((r) => r.modello);
  assert.equal(modelli.length, 2, "i tentativi si contano anche fra le versioni: uno era già stato fatto");
  assert.equal(modelli[0], "gemini-flash-lite-latest");
  assert.notEqual(modelli[1], "gemini-flash-lite-latest", "l'ultimo tentativo va a uno scrittore");
  assert.deepEqual(leggiJson<Record<string, unknown>>("stato/verifiche.json", {})[l.slug], { versione: 3, fragili: ["es1"], tentativi: { es1: 3 } });
  assert.equal(paccoPubblicato(l.slug)!.versione, 3);
});

test("lezione pubblicata con una modifica nascosta: la consegna corretta la dice, la soluzione resta identica", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  const l = lezioneDelCorso("cicli")!;
  const es1 = preparaEsercizio(EsercizioSchema.parse(rocce()), "es1", "autonomo");
  const pacco = PaccoLezioneSchema.parse({
    formato: FORMATO,
    slug: l.slug,
    numero: l.numero,
    fase: l.fase.slug,
    titolo: l.titolo,
    tipo: l.tipo,
    minuti: l.minuti,
    versione: 1,
    contenuto: { titolo: l.titolo, sommario: "Ripetere con for.", blocchi: [{ id: "b1", tipo: "testo", md: "Con `for i in range(3)` le righe dentro il ciclo si ripetono tre volte. `Input.is_action_pressed(\"dive\")` resta come nella lezione sull'input." }], esercizi: [es1], test: esercizio(ROBUSTA, "test", "test") },
    statoFinale: null,
    media: {},
    ripasso: [],
    origine: { pubblicata: "2026-10-18T10:00:00.000Z", modelli: ["gemini/gemini-flash-latest"], richieste: 12, codice: null },
  });
  const file = percorsoLezione(l.fase.slug, l.slug);
  const testo = JSON.stringify(pacco);
  scriviFile(file, testo);
  aggiornaCatalogo({ slug: l.slug, numero: l.numero, titolo: l.titolo, versione: 1, file, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  finto.richieste.length = 0;

  assert.equal(await rendiRobusteLeVerifiche(), 1);
  const chieste = finto.richieste.filter((r) => r.testo.includes("RIFIUTATO dai controlli automatici"));
  assert.equal(chieste.length, 1, "una correzione sola, solo per le rocce: la lezione sull'input aveva finito i tentativi");
  assert.equal(chieste[0].modello, "gemini-flash-lite-latest");
  assert.match(chieste[0].testo, /la soluzione cambia anche rock\.gd, ma il testo dell'esercizio non lo nomina/);
  assert.match(chieste[0].testo, /Correggi solo ciò che serve fra `consegna`, `passiGuida`, `suggerimenti` e `verifiche`/);
  assert.match(chieste[0].testo, /scrivi nella consegna, con il nome del file, cosa cambiare e perché/);
  const dopo = paccoPubblicato(l.slug)!;
  assert.equal(dopo.versione, 2);
  const [corretto] = dopo.contenuto.esercizi;
  assert.equal(corretto.consegna, CONSEGNA_ROCCE_GIUSTA, "la consegna dice la modifica a rock.gd");
  assert.deepEqual(corretto.soluzione, es1.soluzione, "la soluzione non cambia");
  assert.deepEqual(corretto.partenza, es1.partenza);
  const senzaFondo = (v: typeof es1.verifiche) => v.map((x) => (x.tipo === "script_godot" ? { ...x, codice: x.codice.trimEnd() } : x));
  assert.deepEqual(senzaFondo(corretto.verifiche), senzaFondo(es1.verifiche), "le verifiche erano giuste: restano quelle");
  assert.deepEqual(dopo.contenuto.test, pacco.contenuto.test);
  assert.deepEqual(leggiJson<Record<string, unknown>>("stato/verifiche.json", {})[l.slug], { versione: 2, fragili: [], tentativi: {} });
  finto.richieste.length = 0;
  assert.equal(await rendiRobusteLeVerifiche(), 0);
  assert.equal(finto.richieste.length, 0, "niente più da correggere");
});

test.after(() => finto.chiuso());
