// Le risposte del finto fornitore per la prova della catena: due lezioni della fase 1 scritte a mano, più una terza
// con un esercizio rotto. Vengono dalla prova della versione 1 (scripts/prova-catena.ts), dove erano già state
// verificate con il Godot vero.

export const teoria = (titolo: string, cosa: string, codice: string) => ({
  titolo,
  sommario: `In questa lezione ${cosa}. Si lavora sul gioco Pioggia di stelle.`,
  concetti: ["script", "_ready", "print"],
  obiettivi: ["Collegare uno script a un nodo", "Cambiare una proprietà dal codice"],
  durataMinuti: 60,
  blocchi: [
    { tipo: "testo", md: `Un gioco è fatto di oggetti che fanno qualcosa. Per dire a un oggetto cosa fare gli si scrive un programma: in questa lezione ${cosa}.` },
    { tipo: "testo", md: "Uno **script** è un file di testo con delle istruzioni. In Godot ogni script si collega a un nodo: da quel momento le istruzioni riguardano proprio quel nodo, e non gli altri." },
    { tipo: "passi", titolo: "Collegare uno script al cesto", passi: ["Nel pannello *Scene* seleziona il nodo `Basket`.", "Premi l'icona della pergamena con il più verde, in alto nel pannello.", "Nella finestra che si apre lascia il nome proposto e conferma."] },
    { tipo: "codice", linguaggio: "gdscript", codice, spiegazione: "La funzione `_ready()` viene eseguita una volta sola, quando il nodo entra nella scena." },
    { tipo: "testo", md: "Le righe dentro la funzione sono rientrate con un TAB: è così che GDScript capisce che fanno parte di quella funzione. Una riga non rientrata la chiude." },
    { tipo: "attenzione", md: "Se scrivi le istruzioni fuori da una funzione, Godot segnala un errore e la scena non parte: tutto ciò che deve *succedere* va dentro una funzione." },
    { tipo: "riepilogo", md: "- Uno script si collega a un nodo\n- `_ready()` parte una volta all'avvio\n- Le righe di una funzione sono rientrate con un TAB" },
  ],
});

export const SCENA_1 = `[gd_scene format=3]

[ext_resource type="Script" path="res://basket.gd" id="1_basket"]
[ext_resource type="Texture2D" path="res://icon.svg" id="2_icon"]

[node name="Main" type="Node2D"]

[node name="Basket" type="Sprite2D" parent="."]
texture = ExtResource("2_icon")
script = ExtResource("1_basket")
`;

export const SCENA_2 = `[gd_scene format=3]

[ext_resource type="Script" path="res://basket.gd" id="1_basket"]
[ext_resource type="Texture2D" path="res://icon.svg" id="2_icon"]
[ext_resource type="Script" path="res://title.gd" id="3_title"]

[node name="Main" type="Node2D"]

[node name="Basket" type="Sprite2D" parent="."]
texture = ExtResource("2_icon")
script = ExtResource("1_basket")

[node name="Title" type="Label" parent="."]
script = ExtResource("3_title")
`;

export const CESTO_1 = 'extends Sprite2D\n\n\nfunc _ready() -> void:\n\tposition = Vector2(576, 600)\n\tprint("Il cesto è in posizione ", position)\n';
export const CESTO_2 = 'extends Sprite2D\n\n\nfunc _ready() -> void:\n\tposition = Vector2(576, 600)\n\tmodulate = Color(1.0, 0.8, 0.2)\n\tprint("Il cesto è in posizione ", position)\n';
export const CESTO_3 = 'extends Sprite2D\n\nconst START_POSITION := Vector2(576, 600)\n\nvar speed: float = 400.0\nvar player_name: String = "Marco"\n\n\nfunc _ready() -> void:\n\tposition = START_POSITION\n\tmodulate = Color(1.0, 0.8, 0.2)\n\tprint("Il cesto è in posizione ", position)\n';
export const TITOLO_1 = 'extends Label\n\n\nfunc _ready() -> void:\n\ttext = "Pioggia di stelle"\n\tposition = Vector2(40, 20)\n';
export const TITOLO_2 = 'extends Label\n\nvar player_name: String = "Marco"\nvar lives: int = 3\n\n\nfunc _ready() -> void:\n\ttext = "Giocatore: " + player_name + " - Vite: " + str(lives)\n\tposition = Vector2(40, 20)\n';
export const TITOLO_3 = 'extends Label\n\nvar player_name: String = "Marco"\nvar lives: int = 3\nvar score: int = 0\n\n\nfunc _ready() -> void:\n\ttext = "Giocatore: " + player_name + " - Vite: " + str(lives) + " - Punti: " + str(score)\n\tposition = Vector2(40, 20)\n';

/** Uno script di verifica: apre la scena principale, prende un nodo per nome e fa i controlli indicati. */
export const controllo = (nodo: string, righe: string[]) =>
  [
    'extends "res://htd/htd_test.gd"',
    "",
    "",
    "func _run_tests() -> void:",
    "\tvar main := await instantiate_main_scene()",
    '\tif not check("main", main != null, "La scena principale deve essere impostata e aprirsi senza errori"):',
    "\t\treturn",
    `\tvar node = find_by_name(main, "${nodo}")`,
    `\tif not check("node", node != null, "Nella scena serve un nodo chiamato ${nodo}"):`,
    "\t\treturn",
    ...righe.map((r) => `\t${r}`),
    "",
  ].join("\n");

export const VERIFICA_COLORE = { tipo: "script_godot", descrizione: "All'avvio il cesto diventa arancione chiaro", codice: controllo("Basket", ['check("color", node.modulate.is_equal_approx(Color(1.0, 0.8, 0.2)), "All\'avvio il modulate del cesto deve valere Color(1.0, 0.8, 0.2)")']) };

export const ES2_LEZIONE_1 = (verifiche: unknown[]) => ({
  genere: "obiettivo",
  dove: "gioco",
  titolo: "Un cesto arancione",
  consegna: "Fai in modo che all'avvio il cesto `Basket` cambi colore: la sua proprietà `modulate` deve valere `Color(1.0, 0.8, 0.2)`. Il resto del comportamento di `basket.gd` deve restare com'è.",
  modalita: "progetto",
  suggerimenti: ["Le istruzioni che devono partire all'avvio stanno già in una funzione: quale?", "Una proprietà si cambia con il segno di uguale, come hai fatto per la posizione."],
  verifiche,
  soluzione: { file: [{ percorso: "basket.gd", contenuto: CESTO_2 }], spiegazione: "Dentro `_ready()` basta una riga in più: `modulate = Color(1.0, 0.8, 0.2)`." },
});

export const PRATICA_1 = (verificheEs2: unknown[]) => ({
  esercizi: [
    {
      genere: "guidato",
      dove: "gioco",
      titolo: "Il cesto si mette al suo posto",
      consegna: "Nel progetto crea la scena `main.tscn` con un `Node2D` chiamato `Main` come radice e impostala come scena principale. Dentro `Main` aggiungi uno `Sprite2D` chiamato `Basket` con l'immagine `icon.svg` e collegagli lo script `basket.gd`: all'avvio il cesto deve mettersi in posizione `(576, 600)` e scrivere nell'Output dove si trova.",
      modalita: "progetto",
      passiGuida: [
        "Nel pannello *Scene* scegli **2D Scene**, rinomina la radice in `Main` e salva la scena come `main.tscn`.",
        "Con `Main` selezionato premi **+** e aggiungi uno `Sprite2D`; rinominalo `Basket`.",
        "Trascina `icon.svg` dal pannello *FileSystem* nella proprietà **Texture** dell'*Inspector*.",
        "Seleziona `Basket` e collegagli un nuovo script `basket.gd`.",
        "Dentro `_ready()` scrivi `position = Vector2(576, 600)` e una riga con `print()` che mostra la posizione.",
        "Premi F5 e scegli `main.tscn` come scena principale.",
      ],
      verifiche: [
        { tipo: "nodo", scena: "res://main.tscn", tipoNodo: "Sprite2D", nome: "Basket", descrizione: "La scena main.tscn contiene uno Sprite2D chiamato Basket" },
        { tipo: "script_collegato", scena: "res://main.tscn", nodo: "Basket", descrizione: "Il nodo Basket ha uno script collegato" },
        { tipo: "script_godot", descrizione: "All'avvio il cesto si mette in (576, 600) e lo scrive nell'Output", codice: controllo("Basket", ['check("position", node.position.distance_to(Vector2(576, 600)) < 1.0, "All\'avvio lo script deve mettere il cesto in (576, 600)")', 'check("print", printed_text().contains("576"), "Lo script deve scrivere nell\'Output la posizione del cesto")']) },
      ],
      soluzione: { progetto: { scenaPrincipale: "res://main.tscn" }, file: [{ percorso: "main.tscn", contenuto: SCENA_1 }, { percorso: "basket.gd", contenuto: CESTO_1 }], spiegazione: "`_ready()` parte all'avvio: lì si scrive la posizione e la si stampa." },
    },
    ES2_LEZIONE_1(verificheEs2),
  ],
  test: {
    genere: "obiettivo",
    dove: "gioco",
    titolo: "Il titolo del gioco",
    consegna: "Aggiungi a `Main` un nodo `Label` chiamato `Title` con uno script `title.gd`. All'avvio lo script deve scrivere nel `Label` il testo `Pioggia di stelle` e metterlo in posizione `(40, 20)`.",
    modalita: "progetto",
    suggerimenti: ["Il testo mostrato da un Label è una sua proprietà."],
    verifiche: [
      { tipo: "nodo", scena: "res://main.tscn", tipoNodo: "Label", nome: "Title", descrizione: "La scena contiene un Label chiamato Title" },
      { tipo: "script_godot", descrizione: "All'avvio il Label mostra il titolo, in alto a sinistra", codice: controllo("Title", ['check("text", node.text == "Pioggia di stelle", "Il Label deve mostrare: Pioggia di stelle")', 'check("position", node.position.distance_to(Vector2(40, 20)) < 1.0, "Il Label deve stare in (40, 20)")']) },
    ],
    soluzione: { file: [{ percorso: "main.tscn", contenuto: SCENA_2 }, { percorso: "title.gd", contenuto: TITOLO_1 }], spiegazione: "Un altro nodo, un altro script, la stessa funzione `_ready()`." },
  },
});

export const previsione = (corpo: string, domanda: string) => ({ codice: `extends RefCounted\n\n\nfunc run():\n${corpo}`, domanda, spiegazione: "Segui il codice una riga alla volta, tenendo a mente il tipo di ogni valore." });

export const PRATICA_2 = {
  esercizi: [
    {
      genere: "guidato",
      dove: "gioco",
      titolo: "Il cesto ricorda i suoi valori",
      consegna: "In `basket.gd` aggiungi una costante `START_POSITION` con la posizione di partenza `Vector2(576, 600)` e due variabili con il tipo: `speed`, un `float` che vale `400.0`, e `player_name`, una `String` con il tuo nome. In `_ready()` usa `START_POSITION` al posto dei numeri.",
      modalita: "progetto",
      passiGuida: ["Apri `basket.gd`.", "Sotto `extends` scrivi la costante `START_POSITION`.", "Aggiungi le variabili `speed` e `player_name`, ognuna con il suo tipo.", "In `_ready()` sostituisci `Vector2(576, 600)` con `START_POSITION`."],
      verifiche: [
        {
          tipo: "script_godot",
          descrizione: "Il cesto ha le variabili speed e player_name con il tipo giusto, e parte da START_POSITION",
          codice: controllo("Basket", [
            'var speed = get_prop(node, "speed")',
            'check("speed", typeof(speed) == TYPE_FLOAT and is_equal_approx(speed, 400.0), "speed deve essere un float che vale 400.0")',
            'var player_name = get_prop(node, "player_name")',
            'check("name", typeof(player_name) == TYPE_STRING and player_name != "", "player_name deve essere una String non vuota")',
            'check("const", count_in_code("res://basket.gd", "START_POSITION") >= 2, "In basket.gd serve la costante START_POSITION, usata in _ready()")',
            'check("position", node.position.distance_to(Vector2(576, 600)) < 1.0, "Il cesto deve partire ancora da (576, 600)")',
          ]),
        },
      ],
      soluzione: { file: [{ percorso: "basket.gd", contenuto: CESTO_3 }], spiegazione: "Costante in alto, variabili con il tipo, e `_ready()` che usa i nomi invece dei numeri." },
    },
    {
      genere: "prevedi",
      titolo: "Cosa restituisce?",
      consegna: "Leggi ogni pezzo di codice e scrivi cosa restituisce `run()`, senza eseguirlo.",
      modalita: "previsioni",
      previsioni: [
        previsione("\tvar apples: int = 7\n\tvar people: int = 2\n\treturn apples / people\n", "Che numero restituisce `run()`?"),
        previsione("\tvar apples: float = 7.0\n\tvar people: int = 2\n\treturn apples / people\n", "Che numero restituisce `run()`?"),
        previsione('\tvar lives: int = 3\n\treturn "Vite: " + str(lives)\n', "Che testo restituisce `run()`?"),
        previsione("\tvar position := Vector2(100, 50)\n\tposition += Vector2(20, 0) * 2\n\treturn position\n", "Quanto vale `position` alla fine?"),
      ],
    },
    {
      genere: "obiettivo",
      dove: "gioco",
      titolo: "Una frase fatta di variabili",
      consegna: "In `title.gd` aggiungi le variabili `player_name` (una `String` che vale `Marco`) e `lives` (un `int` che vale `3`). All'avvio il `Label` deve mostrare il testo `Giocatore: Marco - Vite: 3`, composto usando le due variabili.",
      modalita: "progetto",
      suggerimenti: ["Due testi si uniscono con il segno più.", "Un numero va trasformato in testo prima di unirlo a un altro testo."],
      verifiche: [
        {
          tipo: "script_godot",
          descrizione: "Il Label mostra la frase composta con le variabili",
          codice: controllo("Title", ['check("text", node.text == "Giocatore: Marco - Vite: 3", "Il Label deve mostrare: Giocatore: Marco - Vite: 3")', 'check("lives", typeof(get_prop(node, "lives")) == TYPE_INT, "lives deve essere una variabile di tipo int")']),
        },
      ],
      soluzione: { file: [{ percorso: "title.gd", contenuto: TITOLO_2 }], spiegazione: "`str(lives)` trasforma il numero in testo; il più unisce i pezzi." },
    },
  ],
  test: {
    genere: "obiettivo",
    dove: "gioco",
    titolo: "Anche i punti",
    consegna: "In `title.gd` aggiungi la variabile `score`, un `int` che vale `0`, e fai comparire anche i punti: il `Label` deve mostrare `Giocatore: Marco - Vite: 3 - Punti: 0`.",
    modalita: "progetto",
    suggerimenti: [],
    verifiche: [
      {
        tipo: "script_godot",
        descrizione: "Il Label mostra anche i punti, presi dalla variabile score",
        codice: controllo("Title", ['check("text", node.text == "Giocatore: Marco - Vite: 3 - Punti: 0", "Il Label deve mostrare: Giocatore: Marco - Vite: 3 - Punti: 0")', 'check("score", typeof(get_prop(node, "score")) == TYPE_INT, "score deve essere una variabile di tipo int")']),
      },
    ],
    soluzione: { file: [{ percorso: "title.gd", contenuto: TITOLO_3 }], spiegazione: "Una variabile in più e un pezzo in più nella frase." },
  },
};

export const TITOLO_4 = 'extends Label\n\nvar player_name: String = "Marco"\nvar lives: int = 3\nvar score: int = 0\nvar level: int = 1\n\n\nfunc _ready() -> void:\n\ttext = "Giocatore: " + player_name + " - Vite: " + str(lives) + " - Punti: " + str(score) + " - Livello: " + str(level)\n\tposition = Vector2(40, 20)\n';
export const CESTO_4 = 'extends Sprite2D\n\nconst START_POSITION := Vector2(576, 600)\n\nvar speed: float = 400.0\nvar max_speed: float = 600.0\nvar player_name: String = "Marco"\n\n\nfunc _ready() -> void:\n\tposition = START_POSITION\n\tmodulate = Color(1.0, 0.8, 0.2)\n\tprint("Il cesto è in posizione ", position)\n';

/** Un esercizio che prosegue il gioco e non può riuscire: lo script della soluzione non è GDScript valido. */
export const ES1_ROTTO = {
  genere: "guidato",
  dove: "gioco",
  titolo: "Una stella che cade",
  consegna: "Aggiungi a `Main` uno `Sprite2D` chiamato `Star` con lo script `star.gd`: a ogni fotogramma la stella deve scendere di 200 pixel al secondo.",
  modalita: "progetto",
  passiGuida: ["Seleziona `Main` e aggiungi uno `Sprite2D`; rinominalo `Star`.", "Collegagli un nuovo script `star.gd`.", "Scrivi la funzione `_process(delta)`.", "Dentro, aumenta `position.y` di `200 * delta`."],
  verifiche: [{ tipo: "script_godot", descrizione: "La stella scende", codice: controllo("Star", ["var start_y = node.position.y", "await wait_frames(10)", 'check("falls", node.position.y > start_y, "La stella deve scendere")']) }],
  soluzione: { file: [{ percorso: "star.gd", contenuto: "extends Sprite2D\n\n\nfunc _process(delta: float -> void:\n\tposition.y += 200 * delta\n" }], spiegazione: "La posizione cresce a ogni fotogramma." },
};

/** La pratica della terza lezione come arriva la prima volta: gli esercizi dopo il primo danno per fatta la stella. */
export const PRATICA_3 = {
  esercizi: [
    ES1_ROTTO,
    PRATICA_2.esercizi[1],
    {
      genere: "obiettivo",
      dove: "gioco",
      titolo: "La stella più veloce",
      consegna: "Fai scendere la stella `Star` al doppio della velocità, cambiando solo `star.gd`.",
      modalita: "progetto",
      suggerimenti: ["La velocità è il numero che moltiplica `delta`."],
      verifiche: [{ tipo: "script_godot", descrizione: "La stella scende più in fretta", codice: controllo("Star", ["var start_y = node.position.y", "await wait_frames(10)", 'check("fast", node.position.y > start_y + 20.0, "La stella deve scendere in fretta")']) }],
      soluzione: { file: [{ percorso: "star.gd", contenuto: "extends Sprite2D\n\n\nfunc _process(delta: float) -> void:\n\tposition.y += 400 * delta\n" }], spiegazione: "Basta raddoppiare il numero." },
    },
  ],
  test: {
    genere: "obiettivo",
    dove: "gioco",
    titolo: "La stella torna su",
    consegna: "Quando la stella `Star` supera il fondo della finestra deve ripartire dall'alto.",
    modalita: "progetto",
    suggerimenti: [],
    verifiche: [{ tipo: "script_godot", descrizione: "La stella riparte dall'alto", codice: controllo("Star", ['check("exists", node != null, "Serve la stella")']) }],
    soluzione: { file: [{ percorso: "star.gd", contenuto: "extends Sprite2D\n\n\nfunc _process(delta: float) -> void:\n\tposition.y += 400 * delta\n\tif position.y > 700:\n\t\tposition.y = 0\n" }], spiegazione: "Un controllo sulla posizione." },
  },
};

/** Ciò che viene riscritto dopo che il primo esercizio è stato tolto: parte dal gioco com'è davvero, senza la stella. */
export const RESTO_3 = {
  esercizi: [
    PRATICA_2.esercizi[1],
    {
      genere: "obiettivo",
      dove: "gioco",
      titolo: "Anche il livello",
      consegna: "In `title.gd` aggiungi la variabile `level`, un `int` che vale `1`, e fai comparire anche il livello: il `Label` deve mostrare `Giocatore: Marco - Vite: 3 - Punti: 0 - Livello: 1`.",
      modalita: "progetto",
      suggerimenti: ["La frase si allunga come hai già fatto per i punti."],
      verifiche: [{ tipo: "script_godot", descrizione: "Il Label mostra anche il livello", codice: controllo("Title", ['check("text", node.text == "Giocatore: Marco - Vite: 3 - Punti: 0 - Livello: 1", "Il Label deve mostrare anche il livello")', 'check("level", typeof(get_prop(node, "level")) == TYPE_INT, "level deve essere una variabile di tipo int")']) }],
      soluzione: { file: [{ percorso: "title.gd", contenuto: TITOLO_4 }], spiegazione: "Una variabile in più e un pezzo in più nella frase." },
    },
  ],
  test: {
    genere: "obiettivo",
    dove: "gioco",
    titolo: "Un limite alla velocità",
    consegna: "In `basket.gd` aggiungi la variabile `max_speed`, un `float` che vale `600.0`.",
    modalita: "progetto",
    suggerimenti: [],
    verifiche: [{ tipo: "script_godot", descrizione: "Il cesto ha la variabile max_speed", codice: controllo("Basket", ['var max_speed = get_prop(node, "max_speed")', 'check("max_speed", typeof(max_speed) == TYPE_FLOAT and is_equal_approx(max_speed, 600.0), "max_speed deve essere un float che vale 600.0")']) }],
    soluzione: { file: [{ percorso: "basket.gd", contenuto: CESTO_4 }], spiegazione: "Una variabile con il suo tipo, accanto alle altre." },
  },
};

/** Il cesto che si muove da solo (lezione 1.2, scritta giusta al primo colpo nella prova di scrittura). */
export const CESTO_MOTO = 'extends Sprite2D\n\nconst START_POSITION := Vector2(576, 600)\n\nvar speed: float = 400.0\nvar player_name: String = "Marco"\n\n\nfunc _ready() -> void:\n\tposition = START_POSITION\n\tmodulate = Color(1.0, 0.8, 0.2)\n\tprint("Il cesto è in posizione ", position)\n\n\nfunc _process(delta: float) -> void:\n\tposition.x += speed * delta\n';
export const CESTO_MOTO_MAX = CESTO_MOTO.replace('var speed: float = 400.0\n', 'var speed: float = 400.0\nvar max_speed: float = 600.0\n');

/** La pratica della terza lezione scritta giusta: i tre esercizi del piano (guidato, prevedi, obiettivo) e il test. */
export const PRATICA_3_GIUSTA = {
  esercizi: [
    {
      genere: "guidato",
      dove: "gioco",
      titolo: "Il cesto si muove da solo",
      consegna: "In `basket.gd` aggiungi la funzione `_process(delta)`: a ogni fotogramma il cesto deve spostarsi a destra di `speed * delta` pixel.",
      modalita: "progetto",
      passiGuida: ["Apri `basket.gd`.", "Sotto `_ready()` scrivi `func _process(delta: float) -> void:`.", "Dentro, aumenta `position.x` di `speed * delta`.", "Avvia il gioco e guarda il cesto."],
      verifiche: [{ tipo: "script_godot", descrizione: "Il cesto si sposta a destra", codice: controllo("Basket", ["var start_x = node.position.x", "await wait_frames(10)", 'check("moves", node.position.x > start_x, "Il cesto deve spostarsi a destra a ogni fotogramma")']) }],
      soluzione: { file: [{ percorso: "basket.gd", contenuto: CESTO_MOTO }], spiegazione: "`_process` viene chiamata a ogni fotogramma; `delta` è il tempo passato dal precedente." },
    },
    RESTO_3.esercizi[0],
    RESTO_3.esercizi[1],
  ],
  test: {
    ...RESTO_3.test,
    soluzione: { file: [{ percorso: "basket.gd", contenuto: CESTO_MOTO_MAX }], spiegazione: "Una variabile con il suo tipo, accanto alle altre." },
  },
};
