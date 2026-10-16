## Come si scrive un esercizio in modalità "codice"
Lo studente scrive UN solo script GDScript e lo incolla nella piattaforma: niente scene, niente editor. La piattaforma mette lo script in `res://solution.gd`, lo esegue in Godot 4.7 e controlla cosa fanno le sue funzioni o cosa stampa. Tu scrivi la consegna, gli aiuti, le verifiche e la SOLUZIONE di riferimento: se la soluzione non supera tutte le verifiche, l'esercizio viene rifiutato.

### Consegna
- Dice con precisione cosa scrivere: la riga `extends` da usare (di solito `extends Node`), il nome di ogni funzione con parametri e tipo restituito (es. `func is_even(number: int) -> bool`), i nomi delle variabili richieste, il testo esatto da stampare se serve.
- Lo script deve funzionare da solo: non può usare nodi figli, scene, azioni di input o altri file.

### Soluzione
- `fileCodice`: sempre "res://solution.gd".
- `soluzione.file`: UN solo file, {"percorso": "solution.gd", "contenuto": "..."}, con lo script completo. GDScript 2.0 di Godot 4.7, indentazione con TAB, tipizzazione statica.
- Niente `soluzione.progetto` (non serve).

### Verifiche (`verifiche`)
Una o due verifiche di tipo `script_godot`: {"tipo": "script_godot", "codice": "...", "descrizione": "cosa viene controllato, in italiano"}.
Regole dello script di verifica:
- Prima riga `extends "res://htd/htd_test.gd"`, poi `func _run_tests() -> void:` con i controlli. Indenta con TAB.
- Crea lo script dello studente con `var obj := await instantiate_script("res://solution.gd")` e controlla subito che esista: `if not check("script", obj != null, "Lo script deve caricarsi senza errori"): return`.
- Chiama le funzioni dello studente SEMPRE con `call_if_exists(obj, "nome_funzione", [argomenti], null)`: se la funzione manca restituisce null invece di bloccare la verifica. Leggi le variabili con `get_prop(obj, "nome", null)`.
- Ogni controllo è `check("id", condizione, "messaggio in italiano: cosa ci si aspetta")`. Prova più casi (valori normali e casi limite).
- Con `get_prop` e `call_if_exists` scrivi `var valore = get_prop(...)` con `=`, MAI con `:=`: restituiscono un valore senza tipo e `:=` non compila.
- Per controllare il tipo di un valore usa `typeof(valore) == TYPE_INT` (oppure `TYPE_FLOAT`, `TYPE_STRING`, `TYPE_BOOL`, `TYPE_ARRAY`, `TYPE_DICTIONARY`). Non esiste una funzione `type()`.
- Per controllare che una funzione ESISTA usa `has_function(obj, "nome_funzione")`. Non usare "il risultato è diverso da null": una funzione che non restituisce niente (`-> void`, per esempio una che stampa soltanto) restituisce sempre null anche se esiste.
- Una funzione `-> void` si verifica dal suo effetto: ciò che stampa (`clear_printed()`, poi la chiami con `call_if_exists`, poi `printed_text().contains("...")`) oppure una variabile che modifica (`get_prop`).
- Per controllare ciò che lo script stampa con `print()`: `printed_text()` restituisce tutto il testo stampato finora (lo `_ready()` dello script parte dentro `instantiate_script`). Usa `printed_text().contains("...")`.
- Le funzioni che aspettano vanno chiamate con `await`: `instantiate_script`, `wait_frames`, `wait_seconds`.
- Non usare `assert`, `quit()`, `$Nodo`.

Funzioni disponibili:
{{harness}}

### Esempio completo (è un modello per il FORMATO: non copiarne il contenuto)
{{esempio}}
