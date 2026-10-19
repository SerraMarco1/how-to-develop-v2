extends SceneTree
## Script usato dalla piattaforma per il video «Il risultato atteso» di un esercizio, e per controllarlo.
##
## Carica la scena del copione, simula i tasti, e a ogni fotogramma misura i «soggetti» del copione: quanti nodi ci sono,
## quanti si vedono davvero (dentro lo schermo, non nascosti, non trasparenti), dove sono, se si muovono, se cambiano
## colore, che testo mostrano. Se il copione lo chiede disegna sopra il gioco le scritte, un riquadro con un'etichetta
## intorno ai soggetti e il tasto premuto. Alla fine stampa una riga che inizia con HTD_VIDEO, in JSON: le misure le
## giudica la piattaforma, non questo script.
##
## Legge il copione da res://htd/copione.json:
##   { "scena": "res://star.tscn", "durata": 6.0, "disegna": true,
##     "azioni": [ { "azione": "move_right", "inizio": 0.5, "fine": 2.0, "tasto": "D" } ],
##     "soggetti": [ { "id": "stella", "cerca": { "scena": "res://star.tscn" }, "quanti": 1, "da": 0.5, "a": 4.0,
##                     "deve": "muoversi", "etichetta": "Stella" } ],
##     "scritte": [ { "testo": "La stella scende", "da": 0.5, "a": 4.0, "soggetto": "stella" } ] }
##
## Il tempo è quello del video: con --fixed-fps 30 il fotogramma k è all'istante k / 30.

const FPS := 30.0
## Ogni quanti fotogrammi si annotano i conteggi (per il giudizio), i riquadri (per il controllo dei fotogrammi) e
## gli esempi (per spiegare cosa non va): 0,1 s, 0,5 s, 1 s.
const PASSO_CONTEGGI := 3
const PASSO_RIQUADRI := 15
const PASSO_ESEMPI := 30
const DENTRO_MINIMO := 0.8
const ALFA_MINIMO := 0.15
const MAX_NODI := 30

var _copione: Dictionary = {}
var _frame := -1
var _t := 0.0
var _premuti := {}
var _logger: _HtdLogger = null
## Per ogni soggetto: «campioni» [t, trovati, visibili, con il testo cercato] ogni 0,1 s, «nodi» (i nodi visti, con
## spostamento e cambio di colore massimi), «esempi» ogni secondo, «riquadri» ogni 0,5 s.
var _misure := {}
var _strato: CanvasLayer = null
var _disegno: _Disegno = null
var _scritta: Label = null
var _tasto: Label = null
var _finito := false
var _dimensione := Vector2i.ZERO


## Gli errori del progetto (non gli avvisi), per dire perché qualcosa non si vede.
class _HtdLogger extends Logger:
	var _mutex := Mutex.new()
	var errori: PackedStringArray = []

	func _log_message(_message: String, _error: bool) -> void:
		pass

	func _log_error(function: String, file: String, line: int, code: String, rationale: String, _editor_notify: bool, error_type: int, _script_backtraces: Array[ScriptBacktrace]) -> void:
		if error_type == ERROR_TYPE_WARNING:
			return
		_mutex.lock()
		if errori.size() < 10:
			errori.append("%s (%s:%d in %s)" % [rationale if rationale != "" else code, file, line, function])
		_mutex.unlock()

	func copia() -> PackedStringArray:
		_mutex.lock()
		var r := errori.duplicate()
		_mutex.unlock()
		return r


## Il nodo che misura e disegna: gira dopo tutti i nodi del gioco nello stesso fotogramma (priorità alta), così misure e
## riquadri corrispondono a ciò che il fotogramma mostra.
class _Disegno extends Control:
	const GIALLO := Color(1.0, 0.82, 0.1)
	var harness = null
	var riquadri: Array = []

	func _process(_delta: float) -> void:
		if harness:
			harness._misura_fotogramma()

	func _draw() -> void:
		var font := ThemeDB.fallback_font
		for r in riquadri:
			var rett: Rect2 = r[0].grow(6.0)
			draw_rect(rett, GIALLO, false, 3.0)
			var y := rett.position.y - 6.0 if rett.position.y > 30.0 else rett.end.y + 20.0
			var pos := Vector2(rett.position.x, y)
			var largo := font.get_string_size(r[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
			draw_rect(Rect2(pos + Vector2(-3, -17), Vector2(largo + 6, 22)), Color(0, 0, 0, 0.65))
			draw_string(font, pos, r[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 18, GIALLO)


func _initialize() -> void:
	_logger = _HtdLogger.new()
	OS.add_logger(_logger)
	var testo := FileAccess.get_file_as_string("res://htd/copione.json")
	var letto = JSON.parse_string(testo) if testo != "" else null
	if not (letto is Dictionary):
		_esci_con_errore("copione illeggibile")
		return
	_copione = letto
	seed(int(_copione.get("seed", 1)))
	var scena: String = str(_copione.get("scena", ""))
	if scena == "" or not ResourceLoader.exists(scena):
		_esci_con_errore("la scena %s non esiste nel progetto" % scena)
		return
	for s in _copione.get("soggetti", []):
		_misure[str(s.get("id", ""))] = {"campioni": [], "nodi": {}, "esempi": [], "riquadri": []}
		var cerca: Dictionary = s.get("cerca", {})
		if cerca.has("classe") and not ClassDB.class_exists(str(cerca.classe)) and not _classe_di_script(str(cerca.classe)):
			push_warning("HTD_VIDEO classe sconosciuta: " + str(cerca.classe))
	# Senza schermo Godot usa una finestra di 64x64: la si riporta alla dimensione del gioco, perché l'interfaccia
	# (ancore, contenitori) si disponga come nella finestra vera.
	if DisplayServer.get_name() == "headless":
		var w: int = ProjectSettings.get_setting("display/window/size/window_width_override", 0)
		var h: int = ProjectSettings.get_setting("display/window/size/window_height_override", 0)
		if w <= 0 or h <= 0:
			w = ProjectSettings.get_setting("display/window/size/viewport_width", 1152)
			h = ProjectSettings.get_setting("display/window/size/viewport_height", 648)
		_dimensione = Vector2i(w, h)
		root.size = _dimensione
	change_scene_to_file.call_deferred(scena)
	_prepara_disegno.call_deferred()


func _classe_di_script(nome: String) -> bool:
	for c in ProjectSettings.get_global_class_list():
		if str(c.get("class", "")) == nome:
			return true
	return false


func _prepara_disegno() -> void:
	_strato = CanvasLayer.new()
	_strato.name = "HtdVideo"
	_strato.layer = 128
	_strato.process_mode = Node.PROCESS_MODE_ALWAYS
	root.add_child(_strato)
	_disegno = _Disegno.new()
	_disegno.harness = self
	_disegno.process_priority = 100000
	_disegno.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_disegno.set_anchors_preset(Control.PRESET_FULL_RECT)
	_strato.add_child(_disegno)
	var fondo := StyleBoxFlat.new()
	fondo.bg_color = Color(0, 0, 0, 0.72)
	fondo.set_content_margin_all(10)
	fondo.set_corner_radius_all(4)
	_scritta = Label.new()
	_scritta.add_theme_font_size_override("font_size", 26)
	_scritta.add_theme_stylebox_override("normal", fondo)
	_scritta.visible = false
	_strato.add_child(_scritta)
	_tasto = Label.new()
	_tasto.add_theme_font_size_override("font_size", 26)
	_tasto.add_theme_stylebox_override("normal", fondo)
	_tasto.visible = false
	_strato.add_child(_tasto)


func _process(_delta: float) -> bool:
	if _finito:
		return true
	_frame += 1
	_t = _frame / FPS
	if _dimensione != Vector2i.ZERO and root.size != _dimensione:
		root.size = _dimensione
	_premi_tasti()
	if _t >= float(_copione.get("durata", 6.0)):
		_chiudi()
		return true
	return false


func _premi_tasti() -> void:
	var tasti: PackedStringArray = []
	for passo in _copione.get("azioni", []):
		var azione: String = str(passo.get("azione", ""))
		if not InputMap.has_action(azione):
			continue
		var attiva: bool = _t >= float(passo.get("inizio", 0.0)) and _t < float(passo.get("fine", 0.0))
		if attiva:
			tasti.append(str(passo.get("tasto", azione)))
		if attiva and not _premuti.get(azione, false):
			Input.action_press(azione)
			_premuti[azione] = true
		elif not attiva and _premuti.get(azione, false):
			Input.action_release(azione)
			_premuti[azione] = false
	if _tasto:
		_tasto.text = "Tasto: " + ", ".join(tasti)
		_tasto.visible = tasti.size() > 0 and _disegna()


func _disegna() -> bool:
	return bool(_copione.get("disegna", false))


func _schermo() -> Rect2:
	return root.get_visible_rect()


## Il rettangolo di ciò che un nodo disegna, nelle coordinate dello schermo (con camera e CanvasLayer).
func _rettangolo_proprio(n: CanvasItem):
	var x := n.get_global_transform_with_canvas()
	if n is Control:
		return x * Rect2(Vector2.ZERO, (n as Control).size)
	if n is Sprite2D and (n as Sprite2D).texture:
		return x * (n as Sprite2D).get_rect()
	if n is AnimatedSprite2D and (n as AnimatedSprite2D).sprite_frames:
		var a := n as AnimatedSprite2D
		var tex := a.sprite_frames.get_frame_texture(a.animation, a.frame)
		if tex:
			var dim := tex.get_size()
			var origine := a.offset - (dim / 2.0 if a.centered else Vector2.ZERO)
			return x * Rect2(origine, dim)
	if n is Polygon2D and (n as Polygon2D).polygon.size() > 0:
		var p := (n as Polygon2D).polygon
		var r := Rect2(p[0], Vector2.ZERO)
		for v in p:
			r = r.expand(v)
		return x * Rect2(r.position + (n as Polygon2D).offset, r.size)
	if n is Line2D and (n as Line2D).points.size() > 0:
		var q := (n as Line2D).points
		var r2 := Rect2(q[0], Vector2.ZERO)
		for v in q:
			r2 = r2.expand(v)
		return x * r2.grow((n as Line2D).width / 2.0)
	return null


## Il rettangolo di ciò che un nodo mostra: il suo, se disegna qualcosa (uno sprite, un Control: non i figli, come
## l'etichetta del cesto che può sbordare); altrimenti quello dei figli che disegnano (un CharacterBody2D con lo sprite
## dentro, un Node2D che raggruppa). Se nessuno disegna niente, un quadratino intorno alla sua posizione.
func _rettangolo(n: CanvasItem) -> Rect2:
	var r = _rettangolo_proprio(n)
	if r != null:
		return r
	var coda: Array = n.get_children()
	var visti := 0
	while not coda.is_empty() and visti < 60:
		var c = coda.pop_front()
		visti += 1
		if c is CanvasLayer:
			continue
		if c is CanvasItem:
			if not (c as CanvasItem).visible:
				continue
			var rc = _rettangolo_proprio(c)
			if rc != null:
				r = rc if r == null else (r as Rect2).merge(rc)
		coda.append_array(c.get_children())
	if r == null:
		var p := n.get_global_transform_with_canvas().origin
		return Rect2(p - Vector2(8, 8), Vector2(16, 16))
	return r


func _alfa(n: CanvasItem) -> float:
	var a := n.self_modulate.a
	var x: Node = n
	while x is CanvasItem:
		a *= (x as CanvasItem).modulate.a
		x = x.get_parent()
	return a


func _colore(n: CanvasItem) -> Color:
	var c := n.self_modulate
	var x: Node = n
	while x is CanvasItem:
		c *= (x as CanvasItem).modulate
		x = x.get_parent()
	return c


func _testo(n: Node) -> String:
	if n is RichTextLabel:
		return (n as RichTextLabel).get_parsed_text()
	if n is Label or n is Button or n is LineEdit:
		return str(n.get("text"))
	return ""


func _corrisponde(n: Node, cerca: Dictionary) -> bool:
	if cerca.has("scena") and n.scene_file_path != str(cerca.scena):
		return false
	if cerca.has("script"):
		var s: Script = n.get_script()
		if s == null or s.resource_path != str(cerca.script):
			return false
	if cerca.has("nome") and not String(n.name).match(str(cerca.nome)):
		return false
	if cerca.has("gruppo") and not n.is_in_group(str(cerca.gruppo)):
		return false
	if cerca.has("classe"):
		var classe := str(cerca.classe)
		var s2: Script = n.get_script()
		if not n.is_class(classe) and not (s2 != null and s2.get_global_name() == classe):
			return false
	return true


func _raccogli(n: Node, cerca: Dictionary, trovati: Array) -> void:
	if n == _strato:
		return
	if _corrisponde(n, cerca):
		trovati.append(n)
	for c in n.get_children():
		_raccogli(c, cerca, trovati)


func _arrotonda(r: Rect2) -> Array:
	return [snappedf(r.position.x, 0.1), snappedf(r.position.y, 0.1), snappedf(r.size.x, 0.1), snappedf(r.size.y, 0.1)]


func _misura_fotogramma() -> void:
	if _finito or current_scene == null or _frame < 0:
		return
	var schermo := _schermo()
	var conta := _frame % PASSO_CONTEGGI == 0
	var riquadra := _frame % PASSO_RIQUADRI == 0
	var esempio := _frame % PASSO_ESEMPI == 0
	var da_disegnare: Array = []
	var scritta_soggetto := ""
	var scritta_testo := ""
	for w in _copione.get("scritte", []):
		if _t >= float(w.get("da", 0.0)) and _t < float(w.get("a", 0.0)):
			scritta_soggetto = str(w.get("soggetto", ""))
			scritta_testo = str(w.get("testo", ""))
	for s in _copione.get("soggetti", []):
		var id := str(s.get("id", ""))
		var dentro_intervallo: bool = _t >= float(s.get("da", 0.0)) - 0.0001 and _t <= float(s.get("a", 0.0)) + 0.0001
		if not dentro_intervallo:
			continue
		var m: Dictionary = _misure[id]
		var trovati: Array = []
		_raccogli(root, s.get("cerca", {}), trovati)
		var visibili := 0
		var con_testo := 0
		var cercato := str(s.get("testo", "")).to_lower().strip_edges()
		var esempi_nodi: Array = []
		var riquadri: Array = []
		for n in trovati:
			if not (n is CanvasItem):
				continue
			var ci := n as CanvasItem
			var r := _rettangolo(ci)
			var area := r.get_area()
			var dentro := r.intersection(schermo).get_area() / area if area > 0.0 else (1.0 if schermo.has_point(r.position) else 0.0)
			var alfa := _alfa(ci)
			var nascosto := not ci.is_visible_in_tree()
			var si_vede := not nascosto and alfa > ALFA_MINIMO and dentro >= DENTRO_MINIMO
			var testo := _testo(n)
			if si_vede:
				visibili += 1
				if cercato != "" and testo.to_lower().contains(cercato):
					con_testo += 1
				da_disegnare.append([r, str(s.get("etichetta", n.name))])
				var chiave := str(n.get_instance_id())
				var nodi: Dictionary = m.nodi
				if nodi.has(chiave) or nodi.size() < MAX_NODI:
					var centro := r.get_center()
					var col := _colore(ci)
					if not nodi.has(chiave):
						nodi[chiave] = {"nome": String(n.name), "fotogrammi": 0, "primo": [centro.x, centro.y], "spostamento": 0.0, "colore_primo": [col.r, col.g, col.b], "cambio_colore": 0.0}
					var d: Dictionary = nodi[chiave]
					d.fotogrammi += 1
					d.spostamento = maxf(float(d.spostamento), centro.distance_to(Vector2(d.primo[0], d.primo[1])))
					var c0: Array = d.colore_primo
					d.cambio_colore = maxf(float(d.cambio_colore), maxf(absf(col.r - c0[0]), maxf(absf(col.g - c0[1]), absf(col.b - c0[2]))))
					d.ultimo = [snappedf(centro.x, 0.1), snappedf(centro.y, 0.1)]
				if riquadra and riquadri.size() < 3:
					riquadri.append(_arrotonda(r))
			if esempio and esempi_nodi.size() < 6:
				var perche := "" if si_vede else ("nascosto" if nascosto else ("trasparente" if alfa <= ALFA_MINIMO else "fuori dallo schermo"))
				var voce := {"nome": String(n.name), "rett": _arrotonda(r), "dentro": snappedf(dentro, 0.01), "si_vede": si_vede, "perche": perche}
				if testo != "":
					voce.testo = testo.substr(0, 60)
				esempi_nodi.append(voce)
		if conta:
			m.campioni.append([snappedf(_t, 0.01), trovati.size(), visibili, con_testo])
		if riquadra and riquadri.size() > 0:
			m.riquadri.append({"f": _frame, "t": snappedf(_t, 0.01), "rett": riquadri})
		if esempio:
			m.esempi.append({"t": snappedf(_t, 0.01), "nodi": esempi_nodi})
	if _disegno and _disegna():
		_disegno.riquadri = da_disegnare
		_disegno.queue_redraw()
		_sistema_scritta(da_disegnare, schermo, scritta_soggetto, scritta_testo)
		_sistema_tasto(da_disegnare, schermo)


## Mette il testo nella scritta e la riporta alla sua misura su una riga (o due, se il testo ha un a capo).
func _dimensione_scritta(testo: String) -> Vector2:
	_scritta.text = testo
	_scritta.size = Vector2.ZERO
	return _scritta.size


## La scritta in alto; in basso se in alto coprirebbe un soggetto. Si vede nel suo intervallo.
func _sistema_scritta(riquadri: Array, schermo: Rect2, soggetto: String, testo: String) -> void:
	if _scritta == null:
		return
	if soggetto == "" or testo == "":
		_scritta.visible = false
		return
	var dim := _dimensione_scritta(testo)
	# Troppo lunga per una riga: va a capo allo spazio più vicino a metà (le scritte sono al massimo 80 caratteri).
	if dim.x > schermo.size.x - 32.0:
		var taglio := -1
		for i in testo.length():
			if testo[i] == " " and (taglio < 0 or absi(i - testo.length() / 2) < absi(taglio - testo.length() / 2)):
				taglio = i
		if taglio > 0:
			dim = _dimensione_scritta(testo.substr(0, taglio) + "\n" + testo.substr(taglio + 1))
	var sopra := Rect2(Vector2(16, 16), dim)
	var alto := dim.y
	var copre := false
	for r in riquadri:
		if (r[0] as Rect2).grow(28.0).intersects(sopra):
			copre = true
	_scritta.position = sopra.position if not copre else Vector2(16, schermo.size.y - alto - 16)
	_scritta.visible = true


## Il tasto premuto in un angolo libero: in basso a destra, se lì non copre un soggetto né la scritta; altrimenti in un
## altro angolo.
func _sistema_tasto(riquadri: Array, schermo: Rect2) -> void:
	if _tasto == null or not _tasto.visible:
		return
	_tasto.size = Vector2.ZERO
	var dim := _tasto.size
	var angoli := [
		Vector2(schermo.size.x - dim.x - 16, schermo.size.y - dim.y - 16),
		Vector2(schermo.size.x - dim.x - 16, 16),
		Vector2(16, schermo.size.y - dim.y - 16),
		Vector2(16, 16),
	]
	var occupati: Array = riquadri.map(func(r): return (r[0] as Rect2).grow(12.0))
	if _scritta and _scritta.visible:
		occupati.append(Rect2(_scritta.position, _scritta.size).grow(8.0))
	for angolo in angoli:
		var qui := Rect2(angolo, dim)
		if not occupati.any(func(o): return (o as Rect2).intersects(qui)):
			_tasto.position = angolo
			return
	_tasto.position = angoli[0]


func _chiudi() -> void:
	_finito = true
	for azione in _premuti.keys():
		if _premuti[azione]:
			Input.action_release(azione)
	var schermo := _schermo()
	var resoconto := {
		"schermo": [schermo.size.x, schermo.size.y],
		"fotogrammi": _frame,
		"fps": FPS,
		"soggetti": _misure,
		"errori": _logger.copia() if _logger else [],
	}
	print("HTD_VIDEO " + JSON.stringify(resoconto))
	quit(0)


func _esci_con_errore(messaggio: String) -> void:
	_finito = true
	print("HTD_VIDEO " + JSON.stringify({"errore": messaggio, "errori": _logger.copia() if _logger else []}))
	quit(1)
