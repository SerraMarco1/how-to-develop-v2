extends SceneTree
## Script usato dalla piattaforma per registrare il video del risultato con Movie Maker.
## Carica la scena indicata, simula gli input secondo una sequenza temporale e chiude alla fine.
##
## Legge la configurazione da res://htd/demo.json:
##   { "scene": "res://main.tscn", "duration": 6.0,
##     "actions": [ { "action": "move_right", "start": 0.5, "end": 2.0 } ] }

var _config: Dictionary = {}
var _time := 0.0
var _pressed := {}


func _initialize() -> void:
	var text := FileAccess.get_file_as_string("res://htd/demo.json")
	_config = JSON.parse_string(text) if text != "" else {}
	var scene_path: String = _config.get("scene", ProjectSettings.get_setting("application/run/main_scene", ""))
	if scene_path == "" or not ResourceLoader.exists(scene_path):
		push_error("HTD_DEMO scena non trovata: " + scene_path)
		quit(1)
		return
	change_scene_to_file.call_deferred(scene_path)


func _physics_process(delta: float) -> bool:
	_time += delta
	for step in _config.get("actions", []):
		var action: String = step.get("action", "")
		if not InputMap.has_action(action):
			continue
		var active: bool = _time >= float(step.get("start", 0.0)) and _time < float(step.get("end", 0.0))
		if active and not _pressed.get(action, false):
			Input.action_press(action)
			_pressed[action] = true
		elif not active and _pressed.get(action, false):
			Input.action_release(action)
			_pressed[action] = false
	if _time >= float(_config.get("duration", 6.0)):
		quit(0)
	return false
