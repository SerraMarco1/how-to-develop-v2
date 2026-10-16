# Stile di casa — Godot 4.7

Convenzioni valide per TUTTE le lezioni, gli esercizi e le soluzioni del corso. Servono a rendere il corso coerente: ogni lezione deve poter usare quello che hanno insegnato le precedenti, nello stesso modo.

## Lingua
- Spiegazioni in italiano, semplici e concrete. Ogni termine tecnico nuovo va spiegato la prima volta che compare.
- Codice, nomi di nodi, scene, file, variabili, funzioni, segnali e azioni di input **in inglese**.
- Commenti nel codice in italiano, brevi, solo dove aiutano a capire.
- I nomi dei menu e dei pannelli dell'editor si scrivono come appaiono nell'editor in inglese, con la traduzione tra parentesi la prima volta: *FileSystem* (file del progetto), *Inspector* (ispettore).

## Fatti da non sbagliare (verificati sul vero editor di Godot 4.7.2 e sulla documentazione)
I nomi dell'interfaccia qui sotto sono stati letti dalle schermate del vero Godot 4.7.2 (catalogo delle immagini). Alcuni sono diversi da quelli delle versioni precedenti e di molte guide in rete: valgono questi.
- Godot **non si installa**: si scarica un file `.zip` da godotengine.org, si estrae e si avvia l'eseguibile. Fino al modulo su C# serve l'**edizione standard**. L'edizione ".NET" (i file con `mono` nel nome) è quella per C#: non è la standard.
- L'editor resta **in inglese** per tutto il corso: il corso non fa cambiare la lingua dell'editor.
- **Project Manager** (la finestra che si apre avviando Godot): in alto al centro le schede **Projects** e **Asset Store**; in alto a sinistra i pulsanti **Create**, **Import**, **Scan**; a destra **Edit**, **Run**, **Rename**, **Duplicate**, **Manage Tags**, **Remove**, **Remove Missing**. *Create* crea un progetto, *Import* ne aggiunge uno che esiste già, il doppio clic (o *Edit*) lo apre, *Rename* cambia il nome mostrato (non la cartella), *Remove* lo toglie dall'elenco (la cartella resta sul disco). Solo quando l'elenco è vuoto compaiono al centro anche **Create New Project** e **Import Existing Project**.
- La finestra **Create New Project** (si apre con *Create*): **Project Name**, **Project Path** (con l'interruttore **Create Folder** e il pulsante **Browse**), **Renderer** (*Forward+*, *Mobile*, *Compatibility*), **Version Control Metadata**, la casella **Edit Now** e i pulsanti **Create** e **Cancel**. Con *Edit Now* spuntata, dopo *Create* il progetto si apre subito nell'editor. Non esiste un pulsante "Create & Edit".
- Un **progetto nuovo non contiene nessuna scena**: Godot crea solo `project.godot`, `icon.svg` e alcuni file di servizio (la cartella nascosta `.godot/`). Le scene si creano e si salvano a mano (Ctrl+S); non esiste una `main.tscn` "predefinita".
- `res://` non è una cartella da creare: è il nome che Godot dà alla cartella del progetto, quella che contiene `project.godot`.
- **Editor**: in alto a sinistra i menu **Scene, Project, Debug, Editor, Help**; in alto al centro le aree di lavoro **2D, 3D, Script, Game, Asset Store**; in alto a destra i pulsanti per eseguire il gioco. A sinistra in alto il pannello **Scene** (con accanto la scheda **Import**), a sinistra in basso il pannello **FileSystem** (con accanto **History**); a destra il pannello **Inspector** con accanto le schede **Signals** e **Groups**. In basso il pannello inferiore con **Output**, **Debugger**, **Audio**, **Animation**, **Shader Editor**. Non esistono un'area "AssetLib" né un pannello "Node".
- In un progetto senza scene il pannello *Scene* propone la radice da creare: **2D Scene**, **3D Scene**, **User Interface**, **Other Node**.
- Un nodo si aggiunge con il pulsante **+** del pannello *Scene* (o Ctrl+A): si apre la finestra **Create New Node**, con il campo **Search** e i pulsanti **Create** e **Cancel**.
- La **scena principale** va impostata: in *Project → Project Settings → Application → Run → Main Scene*, oppure premendo F5 la prima volta (Godot chiede di sceglierla).
- **Project → Project Settings** ha le schede **General**, **Input Map**, **Localization**, **Globals** (qui stanno gli autoload), **Plugins**, **GDExtension**, **Import Defaults**. Nella scheda *Input Map* un'azione si crea scrivendone il nome in **Add New Action** e premendo **Add**.
- **Editor → Editor Settings** contiene le impostazioni dell'editor (valgono per tutti i progetti): schede **General** e **Shortcuts**.
- **F5** esegue il progetto (la scena principale), **F6** esegue la scena aperta, **F8** ferma il gioco. Un progetto senza scene non ha niente da eseguire: F5 chiede di scegliere la scena principale.
- Dall'editor si torna al Project Manager con *Project → Quit to Project List*.
- La documentazione integrata si apre con **F1** oppure *Help → Search Help*.

## Versione
- Solo **Godot 4.7** con **GDScript 2.0**. Mai sintassi o API di Godot 3.
- Errori tipici da evitare (Godot 3 → Godot 4):
  - `KinematicBody2D` → `CharacterBody2D`; `move_and_slide(velocity)` → imposta `velocity` e chiama `move_and_slide()` senza argomenti
  - `export var` → `@export var`; `onready var` → `@onready var`; `tool` → `@tool`
  - `yield(...)` → `await ...`
  - `connect("signal", self, "_method")` → `signal_name.connect(_method)`
  - `instance()` → `instantiate()`; `PackedScene.instance()` → `instantiate()`
  - `Spatial` → `Node3D`; `Position2D` → `Marker2D`; `YSort` → nodo con `y_sort_enabled`
  - `rand_range()` → `randf_range()`; `stepify()` → `snapped()`
  - `OS.get_ticks_msec()` → `Time.get_ticks_msec()`
  - `get_tree().change_scene("...")` → `get_tree().change_scene_to_file("...")`
  - `TileMap` è deprecato: usare `TileMapLayer`

## Nomi
| Cosa | Stile | Esempio |
|---|---|---|
| File e cartelle | snake_case | `player.gd`, `main_menu.tscn`, `player/` |
| Nodi nella scena | PascalCase | `Player`, `HealthBar`, `CollisionShape2D` |
| `class_name` | PascalCase | `class_name Player` |
| Variabili e funzioni | snake_case | `max_speed`, `take_damage()` |
| Variabili/funzioni private | `_` + snake_case | `_velocity`, `_update_ui()` |
| Costanti ed enum | UPPER_SNAKE_CASE | `const MAX_HEALTH := 100` |
| Segnali | passato, snake_case | `health_changed`, `died` |
| Azioni di input | snake_case | `move_left`, `jump`, `interact` |

## Struttura dei progetti
- Ogni progetto degli esercizi ha `project.godot` nella radice e una scena principale impostata.
- Progetti piccoli (un solo elemento): `main.tscn` e i suoi script nella radice.
- Progetti con più elementi: una cartella per ogni "cosa" del gioco, con scena e script insieme:
  ```
  res://
  ├─ main.tscn / main.gd
  ├─ player/        player.tscn, player.gd
  ├─ enemies/       enemy.tscn, enemy.gd
  ├─ ui/            hud.tscn, hud.gd
  ├─ levels/        level_01.tscn
  ├─ autoload/      game_state.gd
  └─ assets/        sprites/, audio/, fonts/
  ```

## Script
- **Tipizzazione statica sempre**: `var speed: float = 200.0`, `var direction := Vector2.ZERO`, `func take_damage(amount: int) -> void:`.
- Ordine degli elementi in uno script:
  1. `class_name` (se serve) ed `extends`
  2. `signal`
  3. `enum` e `const`
  4. `@export var`
  5. variabili pubbliche, poi private (`_nome`)
  6. `@onready var`
  7. `_ready()`, `_process()`, `_physics_process()`, `_input()` / `_unhandled_input()`
  8. funzioni pubbliche, poi private
- Riferimenti ai nodi figli con `@onready var sprite: Sprite2D = $Sprite2D` (o `%NomeUnico` per nodi con nome unico). Mai percorsi lunghi come `get_node("../../Player")`.
- Indentazione con **tab**.

## Comportamenti
- **Input**: sempre tramite azioni definite in *Project Settings → Input Map*, mai tasti scritti nel codice. Per il movimento usare `Input.get_axis()` e `Input.get_vector()`.
- **Movimento fisico**: in `_physics_process(delta)`. Per i personaggi `CharacterBody2D`/`CharacterBody3D` con `velocity` + `move_and_slide()`.
- **Comunicazione tra nodi**: "chiama verso il basso, segnala verso l'alto". Un nodo può chiamare funzioni dei propri figli; i figli avvisano i genitori con i segnali.
- **Collegare i segnali**: preferibilmente nel codice (`button.pressed.connect(_on_button_pressed)`); le funzioni collegate si chiamano `_on_<nodo>_<segnale>`.
- **Autoload** solo per stato davvero globale (es. `GameState` con punteggio e salvataggi).
- **Gruppi** per identificare categorie di nodi (`"enemies"`, `"collectibles"`).
- **Scene riutilizzabili**: ogni elemento che compare più volte (nemici, proiettili, monete) è una scena separata istanziata.

## File di scena (.tscn) scritti a mano nelle soluzioni
Formato minimo valido, senza `uid`:
```
[gd_scene format=3]

[ext_resource type="Script" path="res://player/player.gd" id="1_script"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_body"]
size = Vector2(32, 32)

[node name="Player" type="CharacterBody2D"]
script = ExtResource("1_script")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
shape = SubResource("RectangleShape2D_body")
```
- Il primo nodo è la radice (senza `parent`). I figli diretti hanno `parent="."`, i nipoti `parent="NomeFiglio"`.
- Istanza di un'altra scena: `[ext_resource type="PackedScene" path="res://player/player.tscn" id="2_player"]` e `[node name="Player" parent="." instance=ExtResource("2_player")]`.
- Le azioni di input nelle soluzioni vanno definite in `project.godot`, sezione `[input]`, così:
  ```
  [input]

  move_right={
  "deadzone": 0.2,
  "events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":68,"key_label":0,"unicode":0,"location":0,"echo":false,"script":null)
  ]
  }
  ```
  (`physical_keycode`: A=65, D=68, S=83, W=87, Spazio=32, Frecce: sinistra=4194319, su=4194320, destra=4194321, giù=4194322)
