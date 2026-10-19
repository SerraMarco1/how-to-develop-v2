## Come si scrive un esercizio in modalità "progetto"
Lo studente lavora nell'editor di Godot dentro una cartella di progetto. Tu scrivi la consegna, gli aiuti, le verifiche automatiche e la SOLUZIONE di riferimento (i file del progetto finito). La piattaforma esegue la soluzione in Godot 4.7 insieme alle verifiche: se la soluzione non si carica o non le supera tutte, l'esercizio viene rifiutato.

### Soluzione
- `soluzione.progetto` descrive le impostazioni del progetto. NON scrivere il file `project.godot`: lo crea la piattaforma a partire da questi campi.
  - `nome`: il nome del progetto (se la consegna chiede un nome preciso, usa quello).
  - `scenaPrincipale`: la scena che parte con F5, es. "res://main.tscn". Mettila se il progetto ha una scena; lasciala vuota ("") se l'esercizio non fa creare scene (un progetto nuovo non ne ha: `soluzione.file` può restare vuoto e le verifiche controllano solo il progetto e le sue impostazioni).
  - `azioni`: le azioni di input, es. [{"nome": "move_right", "tasti": ["D", "Right"]}]. Tasti validi: {{tasti}}.
  - `autoload`: solo se servono, es. [{"nome": "GameState", "percorso": "res://autoload/game_state.gd"}].
  - `impostazioni`: solo per altre impostazioni del progetto, es. [{"sezione": "display", "chiave": "window/size/viewport_width", "valore": "800"}].
- `soluzione.file`: tutti gli altri file del progetto (scene `.tscn`, script `.gd`), ognuno con `percorso` relativo alla radice del progetto ("main.tscn", "player/player.gd") e `contenuto` completo. Un solo progetto per esercizio, niente sottocartelle con altri progetti.
- Script: GDScript 2.0 di Godot 4.7, indentazione con TAB, tipizzazione statica, come nello stile di casa.
- Scene: formato `.tscn` scritto a mano come nello stile di casa e nell'esempio sotto. Prima tutti gli `[ext_resource]`, poi i `[sub_resource]`, poi i nodi. Ogni risorsa usata da un nodo (script, immagine, forma, scena istanziata) va dichiarata in cima e usata con `ExtResource("id")` o `SubResource("id")`.
- File utilizzabili senza scriverli:
{{asset}}

- Azioni di input: usa azioni tue con nomi come `move_left`, `jump`, `shoot`, dichiarate in `soluzione.progetto.azioni`. Non usare le azioni predefinite `ui_left`, `ui_accept`… per il gioco.
- Risorse complicate (animazioni, forme, materiali) vanno definite DENTRO la scena con `[sub_resource]`: mai file `.tres` o `.res` a parte.

### Ricette già verificate (copiane la struttura quando servono)
{{ricette}}

### Verifiche (`verifiche`)
Ogni verifica ha una `descrizione` in italiano che dice allo studente cosa viene controllato.
- {"tipo": "progetto_godot", "descrizione": "..."} — nella cartella c'è un progetto di Godot 4
- {"tipo": "file_esiste", "percorso": "res://player/player.tscn", "descrizione": "..."}
- {"tipo": "nodo", "scena": "res://main.tscn", "tipoNodo": "CharacterBody2D", "nome": "Player", "genitore": "Main", "descrizione": "..."} — nella scena c'è un nodo di quel tipo. `nome` e `genitore` sono facoltativi: mettili solo se la consegna impone quel nome. Se il nodo è l'istanza di un'altra scena, `tipoNodo` è il tipo della radice di quella scena.
- {"tipo": "script_collegato", "scena": "res://main.tscn", "nodo": "Player", "descrizione": "..."} — il nodo con quel nome ha uno script
- {"tipo": "azione_input", "nome": "move_right", "descrizione": "..."} — l'azione esiste nella Input Map
- {"tipo": "impostazione", "sezione": "application", "chiave": "run/main_scene", "contiene": "main.tscn", "descrizione": "..."} — un'impostazione di project.godot (per il nome del progetto: sezione "application", chiave "config/name")
- {"tipo": "testo_in_file", "percorso": "res://player.gd", "regex": "move_and_slide\\(", "descrizione": "..."} — il file contiene una parola chiave
- {"tipo": "script_godot", "codice": "...", "descrizione": "..."} — esegue il progetto e controlla un COMPORTAMENTO (vedi sotto)
- {"tipo": "progetto_in_elenco", "presente": true, "descrizione": "..."} — il progetto compare nell'elenco del Project Manager di Godot (`presente: false`: è stato tolto dall'elenco con Remove, ma la cartella esiste ancora). Solo per le lezioni sul Project Manager.
- {"tipo": "godot_aperto", "finestra": "editor", "progetto": "NomeDelProgetto", "descrizione": "..."} — il progetto è aperto in questo momento nell'editor di Godot 4.7 (`progetto` è il nome scritto in `soluzione.progetto.nome`). Solo quando la consegna chiede di lasciare il progetto aperto.

Regole delle verifiche:
- Da 2 a 6 verifiche. Controllano quello che chiede la consegna e niente di più: mai nomi, posizioni o valori che la consegna non impone.
- Ogni nome che una verifica controlla (progetto, file, nodo, azione) deve essere scritto uguale nella consegna.
- Preferisci le verifiche semplici (`nodo`, `script_collegato`, `azione_input`, `impostazione`, `file_esiste`). Usa UNA `script_godot` solo quando serve controllare un comportamento (movimento, punteggio, segnale, cambio scena).
- `testo_in_file` solo per una parola chiave breve (es. `@export`, `move_and_slide\\(`, `signal `): mai una riga intera di codice, perché lo studente può scriverla in un altro modo corretto.

### Come si scrive una verifica `script_godot`
È uno script GDScript che la piattaforma esegue dentro il progetto. Regole:
- Prima riga `extends "res://htd/htd_test.gd"`, poi `func _run_tests() -> void:` con i controlli. Indenta con TAB.
- Ogni controllo è `check("id", condizione, "messaggio in italiano: cosa ci si aspetta")`.
- Lo script NON è un nodo della scena: non usare `$Nodo` né `self`. Ottieni i nodi dalla scena istanziata: `var main := await instantiate_main_scene()`, poi `find_by_name(main, "Player")`, `find_by_class(main, "CharacterBody2D")` o `main.get_node_or_null("Player")`.
- Prima di usare un nodo controlla che esista: `if not check("player", player != null, "…"): return`.
- Le funzioni che aspettano vanno chiamate con `await`: `instantiate_scene`, `instantiate_main_scene`, `instantiate_script`, `wait_frames`, `wait_physics_frames`, `wait_seconds`, `hold_action`, `tap_action`, `click_button`.
- Con `get_prop` e `call_if_exists` scrivi `var valore = get_prop(...)` con `=`, MAI con `:=`: restituiscono un valore senza tipo e `:=` non compila.
- Per controllare il tipo di un valore usa `typeof(valore) == TYPE_INT` (oppure `TYPE_FLOAT`, `TYPE_STRING`, `TYPE_BOOL`, `TYPE_ARRAY`, `TYPE_DICTIONARY`). Non esiste una funzione `type()`.
- Niente confronti fragili: per un movimento confronta la posizione prima e dopo con `>` o `<`, non con valori esatti.
- Le verifiche girano anche su una copia della soluzione in cui i valori che la consegna non fissa (velocità, durate, quantità) sono dimezzati, e devono passare anche lì: chi fa l'esercizio può averli scelti diversi. Quindi:
  - Prima di misurare un movimento metti il nodo in un punto noto, lontano dai limiti (`player.position = Vector2(400, 300)`): da dove parte lo decide chi fa l'esercizio.
  - Per un limite (`clamp`, il bordo dello schermo) porta il nodo OLTRE il limite e tieni premuta l'azione per pochi frame, poi controlla che sia sul limite: `sub.position.y = 2000.0`, `await hold_action("dive", 5)`, `check("fondale", absf(sub.position.y - 560.0) < 0.5, "…")`. Non aspettare che ci arrivi da solo in un tempo fisso: con una velocità più bassa non ci arriva.
  - Non scrivere nella verifica numeri che la consegna non dice: se ti serve un valore del gioco, leggilo dal nodo con `get_prop`.
- Quando un controllo misura un numero, scrivi nel messaggio anche il valore misurato: `"Scendendo il sottomarino deve fermarsi a y = 560 (è a y = %.1f)" % sub.position.y`. Chi studia vede subito cosa non va.
- Non usare `assert`, `quit()`, `get_tree().quit()`.

Funzioni disponibili:
{{harness}}

### Esempio completo (è un modello per il FORMATO: non copiarne il contenuto)
{{esempio}}
