extends SceneTree
## Base comune per gli script di verifica della piattaforma How to Develop.
##
## Uno script di verifica estende questo file e implementa _run_tests():
##
##   extends "res://htd/htd_test.gd"
##
##   func _run_tests() -> void:
##       var player := await instantiate_scene("res://player.tscn")
##       check("player_exists", player != null, "La scena player.tscn deve esistere")
##
## Il risultato viene stampato su una riga che inizia con HTD_RESULT, in JSON.

## Tempo massimo di una verifica: oltre, viene chiusa e segnata come non superata.
const _MAX_SECONDS := 25.0

var _checks: Array = []
var _finished := false
var _started_msec := 0
var _logger: _HtdLogger = null


## Raccoglie ciò che il progetto stampa e gli errori, per poterli controllare nelle verifiche.
class _HtdLogger extends Logger:
	var _mutex := Mutex.new()
	var lines: PackedStringArray = []
	var errors: PackedStringArray = []
	## Errori nati dentro lo script di verifica stesso (res://htd/...).
	var test_errors: PackedStringArray = []

	func _log_message(message: String, error: bool) -> void:
		if error:
			return
		_mutex.lock()
		lines.append(message)
		_mutex.unlock()

	func _log_error(function: String, file: String, line: int, code: String, rationale: String, _editor_notify: bool, error_type: int, _script_backtraces: Array[ScriptBacktrace]) -> void:
		if error_type == ERROR_TYPE_WARNING:
			return
		var text := "%s (%s:%d in %s)" % [rationale if rationale != "" else code, file, line, function]
		_mutex.lock()
		errors.append(text)
		if file.begins_with("res://htd/"):
			test_errors.append(text)
		_mutex.unlock()

	func copy_lines() -> PackedStringArray:
		_mutex.lock()
		var result := lines.duplicate()
		_mutex.unlock()
		return result

	func copy_errors(only_test := false) -> PackedStringArray:
		_mutex.lock()
		var result := (test_errors if only_test else errors).duplicate()
		_mutex.unlock()
		return result

	func clear() -> void:
		_mutex.lock()
		lines.clear()
		errors.clear()
		_mutex.unlock()


func _initialize() -> void:
	_started_msec = Time.get_ticks_msec()
	_logger = _HtdLogger.new()
	OS.add_logger(_logger)
	_start.call_deferred()


func _start() -> void:
	await _run_tests()
	finish()


func _process(_delta: float) -> bool:
	if _finished:
		return false
	# Un errore dentro lo script di verifica interrompe _run_tests(): senza questo controllo resterebbe in attesa.
	if _logger.copy_errors(true).size() > 0:
		finish()
	elif (Time.get_ticks_msec() - _started_msec) / 1000.0 > _MAX_SECONDS:
		check("htd_timeout", false, "HTD_TIMEOUT La verifica non è terminata entro %d secondi" % int(_MAX_SECONDS))
		finish()
	return false


## Da implementare negli script di verifica.
func _run_tests() -> void:
	pass


## Registra un controllo. `message` spiega cosa ci si aspettava (in italiano). Restituisce `passed`.
func check(id: String, passed: bool, message: String) -> bool:
	_checks.append({"id": id, "passed": passed, "message": message})
	return passed


## Termina la verifica e stampa il risultato. Viene chiamata da sola alla fine di _run_tests().
func finish() -> void:
	if _finished:
		return
	_finished = true
	# Un errore dentro lo script di verifica interrompe _run_tests() a metà: i controlli fatti fin lì non bastano.
	var own_errors := _logger.copy_errors(true)
	if own_errors.size() > 0 and not _checks.any(func(c): return c["id"] == "htd_script_error"):
		_checks.append({"id": "htd_script_error", "passed": false, "message": "HTD_SCRIPT_ERROR Lo script di verifica contiene un errore: " + own_errors[0]})
	var all_passed := _checks.size() > 0
	for c in _checks:
		if not c["passed"]:
			all_passed = false
	OS.remove_logger(_logger)
	print("HTD_RESULT " + JSON.stringify({"passed": all_passed, "checks": _checks}))
	quit(0 if all_passed else 1)


## Carica e istanzia una scena, la aggiunge all'albero e aspetta un frame. Restituisce null se non esiste o non si carica.
func instantiate_scene(path: String) -> Node:
	if not ResourceLoader.exists(path):
		return null
	var packed = load(path)
	if not packed is PackedScene:
		return null
	var node: Node = packed.instantiate()
	if node == null:
		return null
	root.add_child(node)
	if current_scene == null:
		current_scene = node
	await process_frame
	return node


## Istanzia la scena principale del progetto (Project Settings → Run → Main Scene). Restituisce null se non è impostata.
func instantiate_main_scene() -> Node:
	var path: String = ProjectSettings.get_setting("application/run/main_scene", "")
	if path == "":
		return null
	return await instantiate_scene(path)


## Crea un'istanza di uno script (per esercizi di solo codice); se è un Node lo aggiunge all'albero, così parte _ready(). Restituisce null se non esiste o ha errori.
func instantiate_script(path: String) -> Object:
	if not ResourceLoader.exists(path):
		return null
	var script = load(path)
	if script == null or not script is Script or not script.can_instantiate():
		return null
	var instance = script.new()
	if instance is Node:
		root.add_child(instance)
		await process_frame
	return instance


## Aspetta un certo numero di frame di processo.
func wait_frames(count: int) -> void:
	for i in count:
		await process_frame


## Aspetta un certo numero di frame di fisica (60 al secondo).
func wait_physics_frames(count: int) -> void:
	for i in count:
		await physics_frame


## Aspetta un certo numero di secondi (massimo 10).
func wait_seconds(seconds: float) -> void:
	await create_timer(clampf(seconds, 0.0, 10.0)).timeout


## Tiene premuta un'azione di input per un certo numero di frame di fisica, poi la rilascia.
func hold_action(action: String, physics_frames: int) -> void:
	if not InputMap.has_action(action):
		return
	Input.action_press(action)
	await wait_physics_frames(physics_frames)
	Input.action_release(action)
	await physics_frame


## Preme e rilascia subito un'azione di input (per salti, spari, conferme).
func tap_action(action: String) -> void:
	await hold_action(action, 2)


## Simula il clic su un pulsante (emette il segnale pressed) e aspetta due frame.
func click_button(button: BaseButton) -> void:
	if button == null:
		return
	button.pressed.emit()
	await wait_frames(2)


## Cerca un nodo per tipo (classe di Godot o class_name) tra i discendenti, compreso il nodo stesso. Restituisce null se non c'è.
func find_by_class(node: Node, class_name_to_find: String) -> Node:
	if node == null:
		return null
	if _is_of_class(node, class_name_to_find):
		return node
	for child in node.get_children():
		var found := find_by_class(child, class_name_to_find)
		if found != null:
			return found
	return null


## Come find_by_class, ma restituisce tutti i nodi di quel tipo.
func find_all_by_class(node: Node, class_name_to_find: String) -> Array[Node]:
	var result: Array[Node] = []
	if node == null:
		return result
	if _is_of_class(node, class_name_to_find):
		result.append(node)
	for child in node.get_children():
		result.append_array(find_all_by_class(child, class_name_to_find))
	return result


## Cerca un nodo per nome tra i discendenti, compreso il nodo stesso. Restituisce null se non c'è.
func find_by_name(node: Node, node_name: String) -> Node:
	if node == null:
		return null
	if String(node.name) == node_name:
		return node
	return node.find_child(node_name, true, false)


## Vero se l'oggetto ha una funzione con quel nome. È il modo giusto per controllare che una funzione esista (anche se non restituisce niente).
func has_function(obj: Object, method: String) -> bool:
	return obj != null and obj.has_method(method)


## Quanti parametri ha una funzione dell'oggetto (-1 se la funzione non esiste).
func function_argument_count(obj: Object, method: String) -> int:
	if obj == null or not obj.has_method(method):
		return -1
	return obj.get_method_argument_count(method)


## Chiama un metodo solo se esiste: restituisce `fallback` se l'oggetto è null o il metodo manca. Attenzione: una funzione `-> void` restituisce sempre null.
func call_if_exists(obj: Object, method: String, args: Array = [], fallback = null):
	if obj == null or not obj.has_method(method):
		return fallback
	return obj.callv(method, args)


## Legge una proprietà solo se esiste: restituisce `fallback` se l'oggetto è null o la proprietà manca.
func get_prop(obj: Object, property: String, fallback = null):
	if obj == null or not property in obj:
		return fallback
	return obj.get(property)


## Tutto ciò che il progetto ha stampato con print() finora, una riga per stampa.
func printed_text() -> String:
	return "\n".join(_logger.copy_lines())


## Dimentica le stampe e gli errori raccolti finora (utile prima di una nuova azione da controllare).
func clear_printed() -> void:
	_logger.clear()


## Gli errori comparsi finora durante l'esecuzione (stringa vuota se non ce ne sono).
func errors_text() -> String:
	return "\n".join(_logger.copy_errors())


## Il testo di un file del progetto, es. source_of("res://player.gd") (stringa vuota se non esiste). Serve per controllare COME è scritto il codice.
func source_of(path: String) -> String:
	if not FileAccess.file_exists(path):
		return ""
	return FileAccess.get_file_as_string(path)


## Quante righe di codice ha la funzione più lunga di uno script (0 se non ne ha). Righe vuote e commenti non contano.
func longest_function_lines(path: String) -> int:
	var longest := 0
	var current := -1
	for line in _code_lines(path):
		var top_level := not (line.begins_with("\t") or line.begins_with(" "))
		if top_level:
			if current > longest:
				longest = current
			current = 0 if (line.begins_with("func ") or line.begins_with("static func ")) else -1
		elif current >= 0:
			current += 1
	return maxi(longest, current)


## Quante dichiarazioni di uno script non hanno il tipo: variabili senza `: Tipo` né `:=`, parametri senza tipo, funzioni senza `-> Tipo`.
func untyped_declarations(path: String) -> int:
	var count := 0
	var untyped_var := RegEx.create_from_string("^\\s*(@\\w+(\\([^)]*\\))?\\s+)*(static\\s+)?var\\s+\\w+\\s*(=|$)")
	var function := RegEx.create_from_string("^\\s*(static\\s+)?func\\s+\\w+\\s*\\((.*)\\)\\s*(->\\s*[\\w\\[\\], .]+)?\\s*:")
	for line in _code_lines(path):
		if untyped_var.search(line) != null:
			count += 1
		var found := function.search(line)
		if found == null:
			continue
		if found.get_string(3) == "":
			count += 1
		for parameter in _split_top_level(found.get_string(2)):
			if parameter.strip_edges() != "" and not ":" in parameter:
				count += 1
	return count


## I numeri scritti direttamente dentro alle funzioni di uno script, come elenco di testi (es. ["400", "0.25"]). Non contano 0, 1, 2, -1, 0.5 e le righe `const`.
func magic_numbers(path: String) -> PackedStringArray:
	var result: PackedStringArray = []
	var number := RegEx.create_from_string("(?<![\\w.])\\d+(\\.\\d+)?(?![\\w.])")
	var allowed := ["0", "1", "2", "0.0", "1.0", "2.0", "0.5"]
	for line in _code_lines(path):
		if not (line.begins_with("\t") or line.begins_with(" ")) or line.strip_edges().begins_with("const "):
			continue
		for found in number.search_all(line):
			if not found.get_string() in allowed:
				result.append(found.get_string())
	return result


## Quante volte una parola intera (un nome di funzione, di variabile, una parola chiave) compare nel codice di uno script, commenti e testi tra virgolette esclusi.
func count_in_code(path: String, word: String) -> int:
	var whole_word := RegEx.create_from_string("(?<![\\w])" + word + "(?![\\w])")
	var count := 0
	for line in _code_lines(path):
		count += whole_word.search_all(line).size()
	return count


## Le righe di codice di uno script: senza righe vuote, senza commenti e con i testi tra virgolette svuotati.
func _code_lines(path: String) -> PackedStringArray:
	var result: PackedStringArray = []
	var quoted := RegEx.create_from_string("\"(\\\\.|[^\"\\\\])*\"|'(\\\\.|[^'\\\\])*'")
	for raw in source_of(path).split("\n"):
		var line := quoted.sub(raw.replace("\r", ""), "\"\"", true)
		var comment := line.find("#")
		if comment >= 0:
			line = line.substr(0, comment)
		if line.strip_edges() != "":
			result.append(line.rstrip(" \t"))
	return result


## Divide un elenco separato da virgole senza spezzare ciò che sta tra parentesi.
func _split_top_level(text: String) -> PackedStringArray:
	var result: PackedStringArray = []
	var depth := 0
	var current := ""
	for character in text:
		if character in "([{":
			depth += 1
		elif character in ")]}":
			depth -= 1
		if character == "," and depth == 0:
			result.append(current)
			current = ""
		else:
			current += character
	if current.strip_edges() != "":
		result.append(current)
	return result


## Percorso della scena attualmente in esecuzione (cambia dopo change_scene_to_file). Stringa vuota se non c'è.
func current_scene_path() -> String:
	return current_scene.scene_file_path if current_scene != null else ""


## Carica ogni scena e script del progetto e avvia la scena principale per qualche frame: fallisce se compaiono errori.
func smoke_test() -> void:
	# Un progetto senza scene né script è valido (es. "crea un progetto con questo nome").
	check("project", true, "Il progetto si apre in Godot")
	for path in _project_files("res://"):
		clear_printed()
		var resource = load(path)
		var problems := errors_text()
		var loaded := resource != null and problems == ""
		if loaded and resource is GDScript:
			loaded = resource.can_instantiate() or resource.is_abstract()
		check("load " + path, loaded, "Il file %s deve caricarsi senza errori%s" % [path, (": " + problems.left(600)) if problems != "" else ""])
	var main_path: String = ProjectSettings.get_setting("application/run/main_scene", "")
	if main_path == "":
		return
	clear_printed()
	var main := await instantiate_scene(main_path)
	if not check("main_scene", main != null, "La scena principale %s deve esistere e aprirsi" % main_path):
		return
	await wait_frames(10)
	await wait_physics_frames(20)
	var runtime_errors := errors_text()
	check("run", runtime_errors == "", "La scena principale deve funzionare senza errori%s" % ((": " + runtime_errors.left(800)) if runtime_errors != "" else ""))


func _project_files(dir_path: String) -> PackedStringArray:
	var result: PackedStringArray = []
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return result
	for sub in dir.get_directories():
		if sub.begins_with(".") or sub == "htd":
			continue
		result.append_array(_project_files(dir_path.path_join(sub)))
	for file in dir.get_files():
		if file.get_extension() in ["gd", "tscn", "tres", "gdshader"]:
			result.append(dir_path.path_join(file))
	return result


func _is_of_class(node: Node, class_name_to_find: String) -> bool:
	if node.is_class(class_name_to_find):
		return true
	var script: Script = node.get_script()
	while script != null:
		if script.get_global_name() == class_name_to_find:
			return true
		script = script.get_base_script()
	return false


# ── Scorciatoie: nelle verifiche non c'è un nodo "self", ma queste funzioni rendono validi gli usi più comuni. ──

func get_tree() -> SceneTree:
	return self


func get_node(path: NodePath) -> Node:
	return get_node_or_null(path)


func get_node_or_null(path: NodePath) -> Node:
	var base: Node = current_scene if current_scene != null else root
	return base.get_node_or_null(path)


func has_node(path: NodePath) -> bool:
	return get_node_or_null(path) != null


func add_child(node: Node) -> void:
	root.add_child(node)
