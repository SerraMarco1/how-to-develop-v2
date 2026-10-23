import { blocco, esercizio, inserisciDopo, sostituisci, verificaGodot, type CorrezioneGioco } from "./strumenti.ts";

// Le stelle figlie del cesto (20 ottobre 2026). Dalla 1.9 il cesto crea le stelle con `add_child(star)`: un figlio si
// disegna spostato della posizione del genitore e lo segue. Il cesto sta a (576, 600), quindi la stella a `position`
// (150, 80) si disegnava a (726, 680), sotto uno schermo alto 648, e scivolava con il cesto. Le stelle cadono fino a
// `position.y` = 680 e ripartono da 80: sullo schermo restavano sempre fra y = 680 e y = 1280. Lo stesso per sassi,
// rubini e oggetti creati dal cesto fino alla 3.5; e il test della 1.9 creava stelle con `Sprite2D.new()` senza immagine.
// Lo misurò il controllo dei video «Il risultato atteso»: 1.9, 1.10, 1.11 e 2.2 senza video, «risultato invisibile».
//
// La correzione: `x.top_level = true` prima di `add_child(x)`. Il nodo resta figlio del cesto (array, gruppi,
// `remove_child`, `get_children()` restano come sono) ma la sua `position` è una posizione nello schermo e il cesto non
// lo sposta più. Nessun valore di `position` cambia, quindi le verifiche scritte finora valgono ancora. Provato il 20
// ottobre su tutta la catena pubblicata: 62 esercizi in 24 lezioni, tutti i controlli superati.

/** I nodi che il cesto crea e che devono cadere per conto loro nello schermo (i nomi usati nelle lezioni pubblicate). */
const OGGETTI = new Set(["star", "rock", "new_star", "new_item", "ruby", "item"]);

/**
 * `x.top_level = true` prima di ogni `add_child(x)` di un oggetto che cade (non `get_parent().add_child(x)`: quelli sono
 * già figli di un nodo fermo); e l'immagine alle stelle create con `Sprite2D.new()`, che non ne hanno una.
 */
export function stelleNelloSchermo(testo: string): string {
  const righe = testo.split("\n");
  const fuori: string[] = [];
  for (const [i, riga] of righe.entries()) {
    const figlio = riga.match(/^(\s*)add_child\((\w+)\)\s*$/);
    if (figlio && OGGETTI.has(figlio[2]) && !(fuori.at(-1) ?? "").includes(`${figlio[2]}.top_level = true`)) fuori.push(`${figlio[1]}${figlio[2]}.top_level = true`);
    fuori.push(riga);
    const nuova = riga.match(/^(\s*)var star: Sprite2D = Sprite2D\.new\(\)\s*$/);
    if (nuova && !(righe[i + 1] ?? "").includes("star.texture")) fuori.push(`${nuova[1]}star.texture = load("res://icon.svg")`);
  }
  return fuori.join("\n");
}

/** Le righe GDScript che, in una verifica, preparano il rettangolo dello schermo del progetto. */
const SCHERMO = [
  '\tvar screen := Rect2(Vector2.ZERO, Vector2(float(ProjectSettings.get_setting("display/window/size/viewport_width", 1152)), float(ProjectSettings.get_setting("display/window/size/viewport_height", 648))))',
  "\tvar outside := PackedStringArray()",
];

/** Il controllo «si vedono nello schermo» su un elenco di nodi già trovato dalla verifica. */
function controlloNelloSchermo(elenco: string, id: string, cosa: string, rimedio: string): string {
  return [
    "",
    ...SCHERMO,
    `\tfor node in ${elenco}:`,
    "\t\tvar where: Vector2 = (node as Node2D).global_position",
    "\t\tif not screen.has_point(where):",
    '\t\t\toutside.append("(%d, %d)" % [int(where.x), int(where.y)])',
    `\tcheck("${id}", outside.is_empty(), "${cosa} devono vedersi nello schermo, che va da (0, 0) a (%d, %d): %d sono fuori, a %s. ${rimedio}" % [int(screen.size.x), int(screen.size.y), outside.size(), ", ".join(outside)])`,
  ].join("\n");
}

export const STELLE_DEL_CESTO: CorrezioneGioco = {
  id: "stelle-figlie-del-cesto",
  titolo: "gli oggetti creati dal cesto si vedono nello schermo",
  gioco: "pioggia-di-stelle",
  daLezione: "cicli",
  codice: stelleNelloSchermo,
  lezioni: {
    // 1.9 Cicli: qui chi studia crea le prime stelle dal codice, e impara perché serve top_level.
    cicli: (l) => {
      const b3 = blocco(l, "b3", "testo");
      b3.md = sostituisci(
        b3.md,
        "inserendolo nell'albero della scena in modo che compaia e si aggiorni a schermo.",
        "inserendolo nell'albero della scena in modo che compaia e si aggiorni a schermo.\n\nAttenzione a **dove** compare. Un nodo figlio si disegna rispetto al suo genitore: la sua `position` si somma a quella del genitore, e quando il genitore si sposta il figlio lo segue. Il cesto sta in basso, a `(576, 600)`, e si muove con le frecce: una stella figlia del cesto con `position` uguale a `(150, 80)` comparirebbe a `(726, 680)`, sotto lo schermo, e scivolerebbe a destra e a sinistra insieme al cesto. Per questo, prima di `add_child()`, si scrive `star.top_level = true`: la stella resta figlia del cesto, ma la sua `position` diventa una posizione nello schermo e i movimenti del cesto non la spostano più.",
      );
      const b4 = blocco(l, "b4", "codice");
      b4.spiegazione = sostituisci(b4.spiegazione, "- `add_child(star)` la rende visibile", "- `star.top_level = true` le fa usare le coordinate dello schermo invece di quelle del cesto.\n- `add_child(star)` la rende visibile");
      const b10 = blocco(l, "b10", "riepilogo");
      b10.md = sostituisci(
        b10.md,
        "mentre `add_child()` lo aggancia alla scena rendendolo visibile.",
        "mentre `add_child()` lo aggancia alla scena rendendolo visibile.\n- Un nodo figlio si disegna rispetto al genitore e lo segue quando si sposta: con `top_level = true` usa invece le coordinate dello schermo.",
      );
      inserisciDopo(l.concetti, "add_child()", "Figli che usano le coordinate dello schermo: top_level");

      const es1 = esercizio(l, "es1");
      es1.consegna = sostituisci(
        es1.consegna,
        "Aggiungi ciascuna stella come nodo figlio del cesto con `add_child(star)` e subito dopo",
        "Prima di aggiungerla, scrivi `star.top_level = true`: il cesto sta in basso (y = 600) e si muove, e senza questa riga la stella si disegnerebbe spostata della posizione del cesto, sotto lo schermo. Poi aggiungi ciascuna stella come nodo figlio del cesto con `add_child(star)` e subito dopo",
      );
      inserisciDopo(es1.passiGuida, "load(\"res://star.tscn\").instantiate()", "Prima di aggiungerla, scrivi `star.top_level = true`: così la stella usa le coordinate dello schermo e non quelle del cesto, che sta in basso e si muove.");
      es1.soluzione.spiegazione = sostituisci(es1.soluzione.spiegazione, "la aggiungiamo con `add_child(star)`", "le facciamo usare le coordinate dello schermo con `star.top_level = true`, la aggiungiamo con `add_child(star)`");
      const v1 = verificaGodot(es1, "All'avvio vengono create esattamente 5 stelle figlie con posizioni scalate");
      v1.descrizione = "All'avvio vengono create esattamente 5 stelle figlie con posizioni scalate, e si vedono nello schermo";
      v1.codice = `${v1.codice.trimEnd()}\n${controlloNelloSchermo("stars", "stars_on_screen", "Le stelle", "Una stella figlia del cesto si disegna spostata della posizione del cesto, che sta in basso (y = 600): prima di add_child(star) serve star.top_level = true")}\n`;

      const es3 = esercizio(l, "es3");
      es3.consegna = sostituisci(
        es3.consegna,
        "5. Aggiungere la roccia come figlia chiamando `add_child()`.",
        "5. Impostare `rock.top_level = true` (come per le stelle: senza, la fila finirebbe sotto lo schermo, a y = 800) e aggiungere la roccia come figlia chiamando `add_child()`.",
      );
      es3.soluzione.spiegazione = `${es3.soluzione.spiegazione.trimEnd()} Come per le stelle, \`rock.top_level = true\` tiene la fila a y = 200 nello schermo, invece che 600 pixel più in basso insieme al cesto.`;
      const v3 = verificaGodot(es3, "Vengono istanziate esattamente 5 rocce alla coordinata Y di 200.0 con spaziatura di 200 pixel");
      v3.descrizione = "Vengono istanziate esattamente 5 rocce alla coordinata Y di 200.0 con spaziatura di 200 pixel, dentro lo schermo";
      v3.codice = `${v3.codice.trimEnd()}\n${controlloNelloSchermo("rocks", "rocks_on_screen", "Le rocce", "Come per le stelle, prima di add_child(rock) serve rock.top_level = true: senza, la roccia si disegna spostata della posizione del cesto")}\n`;

      const test = esercizio(l, "test");
      test.consegna = sostituisci(
        test.consegna,
        "usando `Sprite2D.new()` e configurandoli da codice prima di aggiungerli con `add_child()`.",
        "usando `Sprite2D.new()` e configurandoli da codice prima di aggiungerli con `add_child()`: un nodo creato con `new()` non ha un'immagine, quindi assegnagli `star.texture = load(\"res://icon.svg\")`, e come per le altre stelle imposta `star.top_level = true`.",
      );
      test.soluzione.spiegazione = `${test.soluzione.spiegazione.trimEnd()} Ogni stella riceve l'immagine con \`texture\` (uno \`Sprite2D\` nuovo non ne ha) e \`top_level = true\`, così si vede nello schermo.`;
      const vt = verificaGodot(test, "La chiamata a spawn_stars genera 5 stelle posizionate secondo i parametri richiesti");
      vt.descrizione = "La chiamata a spawn_stars genera 5 stelle posizionate secondo i parametri richiesti, con un'immagine e dentro lo schermo";
      vt.codice = [
        vt.codice.trimEnd(),
        "\tvar without_texture := 0",
        "\tfor node in stars:",
        "\t\tif (node as Sprite2D).texture == null:",
        "\t\t\twithout_texture += 1",
        '\tcheck("stars_texture", without_texture == 0, "%d stelle su %d non hanno un\'immagine: uno Sprite2D creato con new() è vuoto, assegnagli star.texture = load(\\"res://icon.svg\\")" % [without_texture, stars.size()])',
        controlloNelloSchermo("stars", "stars_on_screen", "Le stelle", "Una stella figlia del cesto si disegna spostata della posizione del cesto: prima di add_child(star) serve star.top_level = true"),
        "",
      ].join("\n");
    },

    // 1.10 Array: spawn_star() crea le stelle una alla volta.
    array: (l) => {
      const b4 = blocco(l, "b4", "codice");
      b4.spiegazione = sostituisci(b4.spiegazione, "crea una nuova istanza da `star.tscn`, la inserisce", "crea una nuova istanza da `star.tscn`, le fa usare le coordinate dello schermo con `top_level = true` (come nella lezione sui cicli), la inserisce");
      const es1 = esercizio(l, "es1");
      es1.consegna = sostituisci(
        es1.consegna,
        "crea un'istanza come `Sprite2D`, la aggiunge alla scena con `add_child()`",
        "crea un'istanza come `Sprite2D`, imposta `top_level = true` (come nella lezione sui cicli: così la stella usa le coordinate dello schermo e non quelle del cesto), la aggiunge alla scena con `add_child()`",
      );
      const passo = es1.passiGuida.findIndex((p) => p.includes("func spawn_star() -> void:"));
      if (passo < 0) throw new Error("non trovo il passo di spawn_star()");
      es1.passiGuida[passo] = sostituisci(es1.passiGuida[passo], "istanziandola e facendo `add_child(new_star)`", "istanziandola, scrivendo `new_star.top_level = true` e facendo `add_child(new_star)`");
    },

    // 2.2 Scene riutilizzabili: spawn_item_at() e spawn_ruby().
    "scene-riutilizzabili": (l) => {
      const b8 = blocco(l, "b8", "codice");
      b8.spiegazione = sostituisci(b8.spiegazione, "`add_child(new_item)` inserisce il nuovo elemento come figlio del cesto,", "`new_item.top_level = true` gli fa usare le coordinate dello schermo invece di quelle del cesto, e `add_child(new_item)` lo inserisce come figlio del cesto,");
      const es3 = esercizio(l, "es3");
      es3.consegna = sostituisci(es3.consegna, "   - Aggiungere il nuovo oggetto come figlio con `add_child()`.", "   - Impostare `top_level = true` sul nuovo oggetto (come per le stelle, così usa le coordinate dello schermo) e aggiungerlo come figlio con `add_child()`.");
      const consiglio = es3.suggerimenti.findIndex((s) => s.includes("add_child(new_item)"));
      if (consiglio < 0) throw new Error("non trovo il suggerimento su add_child(new_item)");
      es3.suggerimenti[consiglio] = sostituisci(es3.suggerimenti[consiglio], " e chiama `new_item.apply_item_type(item_type)` prima di aggiungerlo", ", chiama `new_item.apply_item_type(item_type)` e scrivi `new_item.top_level = true` prima di aggiungerlo");
      const test = esercizio(l, "test");
      test.consegna = sostituisci(test.consegna, "ne imposta la `position` a `spawn_pos`, la aggiunge come figlia con `add_child()`", "ne imposta la `position` a `spawn_pos` e `top_level = true` (come per le stelle), la aggiunge come figlia con `add_child()`");
    },

    // 2.7 Gruppi: l'alchimia trasforma i sassi in stelle nuove.
    gruppi: (l) => {
      const es1 = esercizio(l, "es1");
      es1.consegna = sostituisci(es1.consegna, "aggiungila come figlia del cesto (`add_child`)", "impostale `top_level = true` come per le altre stelle e aggiungila come figlia del cesto (`add_child`)");
    },
  },
};
