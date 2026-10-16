import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { costruisciProjectGodot } from "../src/godot/progetto.ts";
import { dentroCartella, problemaPercorso } from "../src/percorsi.ts";
import { analizzaGDScript, controllaFileLezione, controllaGDScript, controllaRisorsa } from "../src/sicurezza.ts";

const regole = (codice: string) => controllaGDScript("prova.gd", codice).map((v) => v.regola);

describe("controllo di sicurezza del GDScript", () => {
  it("lascia passare il codice normale di un gioco", () => {
    const codice = [
      "extends CharacterBody2D",
      "const SALVATAGGIO := \"user://salvataggio.json\"",
      "@onready var sprite := $\"../Sprite2D\"",
      "func execute() -> void: # una funzione propria può chiamarsi così",
      "\tvar f := FileAccess.open(SALVATAGGIO, FileAccess.WRITE)",
      "\tf.store_string(JSON.stringify({\"punti\": 3}))",
      "\tget_node(\"../Punteggio\").text = str(OS.get_name())",
      "\tadd_child.call_deferred(Node.new())",
      "\tvar t := create_tween()",
      "\tt.kill()",
      "\tget_tree().reload_current_scene()",
      "\tload(\"res://scene/livello_%d.tscn\" % 2)",
    ].join("\n");
    assert.deepEqual(controllaGDScript("prova.gd", codice), []);
  });

  it("rifiuta comandi di sistema, rete e codice costruito al volo", () => {
    assert.ok(regole('OS.execute("cmd", [])').includes("os:execute"));
    assert.ok(regole("var o = OS\no.execute('x', [])").includes("os:indiretto"));
    assert.ok(regole("var h = HTTPRequest.new()").includes("classe:HTTPRequest"));
    assert.ok(regole('var e := Expression.new()\ne.parse("1+1")').includes("classe:Expression"));
    assert.ok(regole('Engine.get_singleton("OS")').includes("nome:get_singleton"));
    assert.ok(regole('Engine.call("get_singleton", "OS")').includes("testo:get_singleton"));
    assert.ok(regole('var s = GDScript.new()\ns.source_code = "x"').includes("gdscript:new"));
    assert.ok(regole('ClassDB.instantiate("HTTPRequest")').includes("classdb:instantiate"));
    assert.ok(regole('OS.call("execute", "cmd")').length > 0);
  });

  it("rifiuta percorsi fuori dal progetto, anche scritti con sequenze di escape", () => {
    assert.ok(regole('FileAccess.open("C:/Windows/system.ini", FileAccess.READ)').includes("percorso-assoluto"));
    assert.ok(regole('FileAccess.open("user://../../x", FileAccess.WRITE)').includes("risalita"));
    assert.ok(regole('FileAccess.open("\\u002e\\u002e/x.txt", FileAccess.WRITE)').includes("risalita"));
    assert.ok(regole('DirAccess.remove_absolute("/home/runner/x")').includes("percorso-assoluto"));
    assert.ok(regole('var p = "%APPDATA%/x"').includes("variabile-ambiente"));
    // Un NodePath con ".." è normale
    assert.deepEqual(regole('var n = get_node("../Fratello")\nvar m = $"../Altro"\nvar k = ^"../Terzo"'), []);
  });

  it("non si fa ingannare da commenti e testi", () => {
    assert.deepEqual(regole('# OS.execute("rm")\nprint("usa HTTPRequest per scaricare")'), []);
    const { letterali, pulito } = analizzaGDScript('var a = """riga 1\nriga 2"""\nvar b = 1');
    assert.equal(letterali[0].valore, "riga 1\nriga 2");
    assert.equal(pulito.split("\n").length, 3, "le righe restano quelle dell'originale");
  });
});

describe("controllo delle scene e dei file", () => {
  it("rifiuta script dentro le scene e risorse fuori dal progetto", () => {
    const scena = '[gd_scene format=3]\n[ext_resource type="Script" path="res://../fuori.gd" id="1"]\n[sub_resource type="GDScript" id="2"]\nscript/source = "extends Node"\n[node name="A" type="Node"]';
    const r = controllaRisorsa("a.tscn", scena).map((v) => v.regola);
    assert.ok(r.includes("risorsa-esterna"));
    assert.ok(r.includes("script-incorporato"));
  });

  it("accetta solo file di testo con percorsi dentro il progetto", () => {
    const v = controllaFileLezione([
      { percorso: "main.gd", contenuto: "extends Node" },
      { percorso: "../fuori.gd", contenuto: "extends Node" },
      { percorso: "lib.dll", contenuto: "MZ" },
      { percorso: "C:/x.gd", contenuto: "extends Node" },
    ]).map((x) => `${x.file}:${x.regola}`);
    assert.ok(v.includes("../fuori.gd:percorso"));
    assert.ok(v.includes("lib.dll:tipo-di-file"));
    assert.ok(v.some((x) => x.startsWith("C:/x.gd")));
    assert.ok(!v.some((x) => x.startsWith("main.gd")));
  });
});

describe("percorsi", () => {
  it("riconosce i percorsi che escono dal progetto", () => {
    for (const p of ["../a", "a/../../b", "C:\\a", "\\\\server\\x", "~/x", "a//b", "con.gd", "a\u0000b"]) assert.ok(problemaPercorso(p), p);
    for (const p of ["res://main.tscn", "scene/livello 1.tscn", "assets/sprites/stella.png"]) assert.equal(problemaPercorso(p), null, p);
    assert.throws(() => dentroCartella("/tmp/progetto", "../segreto"));
  });
});

describe("project.godot scritto dalla piattaforma", () => {
  it("non si lascia aggiungere sezioni con valori su più righe o nomi strani", () => {
    const { testo, problemi } = costruisciProjectGodot({
      nome: 'Gioco"\n[editor_plugins]\nenabled=1',
      impostazioni: [
        { sezione: "display", chiave: "window/size/viewport_width", valore: "1280" },
        { sezione: "application", chiave: "config/description", valore: '"a"\n[editor_plugins]\nenabled=PackedStringArray("res://x")' },
        { sezione: "editor_plugins", chiave: "enabled", valore: "1" },
        { sezione: "display", chiave: "a=b\n[x]", valore: "1" },
      ],
      autoload: [{ nome: "Stato", percorso: "../fuori.gd" }],
    });
    assert.ok(!/^\[editor_plugins\]/m.test(testo), testo);
    assert.ok(testo.includes("window/size/viewport_width=1280"));
    assert.ok(problemi.some((p) => p.includes("editor_plugins")));
    assert.ok(problemi.some((p) => p.includes("autoload")));
    assert.ok(problemi.some((p) => p.includes("a=b")));
  });
});
