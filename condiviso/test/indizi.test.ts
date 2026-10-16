import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { impostaGodot } from "../src/godot/esegui.ts";
import { installaGodot } from "../src/godot/installa.ts";
import { impostaCartellaTemporanea, verifica } from "../src/godot/verifica.ts";
import { impostaCartellaMotore } from "../src/motore.ts";
import type { Verifica } from "../src/schemi.ts";

// Gli indizi della base di verifica, con il Godot vero. Il caso nato il 16 ottobre: rock.gd scritto bene ma non
// attaccato al nodo Rock di rock.tscn, nove controlli falliti e nessuna spiegazione. Ora la verifica dice la causa,
// e solo quando qualcosa fallisce e la causa è quella.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cache = process.env.HTD_CACHE ?? path.join(REPO, "lavoro", "cache");

const PROJECT = { percorso: "project.godot", contenuto: 'config_version=5\n\n[application]\n\nconfig/name="Indizi"\nconfig/features=PackedStringArray("4.7")\n' };
const ROCK_GD = { percorso: "rock.gd", contenuto: 'extends Sprite2D\n\nconst MAX_DAMAGE: int = 3\n\nvar damage: int = 1\n\n\nfunc _ready() -> void:\n\tmodulate = Color.RED\n' };
const STAR_GD = { percorso: "star.gd", contenuto: "extends Sprite2D\n\nvar star_name: String = \"Stella\"\n" };
const scena = (corpo: string, risorse = "") => ({ percorso: "rock.tscn", contenuto: `[gd_scene format=3]\n\n${risorse}[node name="Rock" type="Sprite2D"]\n${corpo}` });
const CON_ROCK = scena('script = ExtResource("1_r")\n', '[ext_resource type="Script" path="res://rock.gd" id="1_r"]\n\n');
const SENZA_SCRIPT = scena("");
const CON_STAR = scena('script = ExtResource("1_s")\n', '[ext_resource type="Script" path="res://star.gd" id="1_s"]\n\n');
const SCRIPT_SU_FIGLIO = scena('\n[node name="Inner" type="Node2D" parent="."]\nscript = ExtResource("1_r")\n', '[ext_resource type="Script" path="res://rock.gd" id="1_r"]\n\n');

const VERIFICA_ROCK: Verifica = {
  tipo: "script_godot",
  descrizione: "La roccia",
  codice: 'extends "res://htd/htd_test.gd"\n\n\nfunc _run_tests() -> void:\n\tvar rock := await instantiate_scene("res://rock.tscn")\n\tif not check("loaded", rock != null, "rock.tscn si carica"):\n\t\treturn\n\tcheck("dmg", get_prop(rock, "damage") == 1, "damage vale 1")\n\tcheck("max", rock.get("MAX_DAMAGE") == 3, "MAX_DAMAGE vale 3")\n\tcheck("red", rock.modulate == Color.RED, "la roccia è rossa")\n',
};

const prova = (file: { percorso: string; contenuto: string }[], verifiche: Verifica[] = [VERIFICA_ROCK]) => verifica({ tipo: "file", file: [PROJECT, ...file], daLezione: false }, verifiche);

test("indizi: preparazione del Godot di servizio", { timeout: 20 * 60_000 }, async () => {
  impostaCartellaMotore(path.join(REPO, "motori", "godot"));
  impostaCartellaTemporanea(path.join(cache, "temp"));
  impostaGodot(await installaGodot(path.join(cache, "strumenti")));
});

test("indizi: script scritto ma non attaccato al nodo → la verifica dice quale e come attaccarlo", { timeout: 5 * 60_000 }, async () => {
  const esito = await prova([ROCK_GD, SENZA_SCRIPT]);
  assert.equal(esito.superato, false);
  assert.equal(esito.controlli.filter((c) => !c.superato).length, 3, JSON.stringify(esito.controlli));
  assert.equal(esito.indizi?.length, 1, JSON.stringify(esito.indizi));
  assert.match(esito.indizi![0], /^Il nodo Rock di rock\.tscn non ha nessuno script attaccato, e rock\.gd non è attaccato a nessun nodo della scena/);
  assert.match(esito.indizi![0], /trascina rock\.gd dal pannello FileSystem sul nodo Rock nel pannello Scene e salva la scena \(Ctrl\+S\)/);
});

test("indizi: con lo script attaccato tutto passa e non c'è nessun indizio", { timeout: 5 * 60_000 }, async () => {
  const esito = await prova([ROCK_GD, CON_ROCK]);
  assert.equal(esito.superato, true, JSON.stringify(esito.controlli));
  assert.deepEqual(esito.indizi, []);
});

test("indizi: al nodo è attaccato un altro script → lo dice", { timeout: 5 * 60_000 }, async () => {
  const esito = await prova([ROCK_GD, STAR_GD, CON_STAR]);
  assert.equal(esito.superato, false);
  assert.equal(esito.indizi?.length, 1, JSON.stringify(esito.indizi));
  assert.match(esito.indizi![0], /^Al nodo Rock di rock\.tscn è attaccato star\.gd, non rock\.gd/);
});

test("indizi: nessun indizio se lo script è attaccato a un altro nodo della scena, o se non c'è uno script con lo stesso nome", { timeout: 5 * 60_000 }, async () => {
  const suFiglio = await prova([ROCK_GD, SCRIPT_SU_FIGLIO]);
  assert.equal(suFiglio.superato, false, "i controlli sul nodo principale falliscono comunque");
  assert.deepEqual(suFiglio.indizi, []);
  const senzaGd = await prova([SENZA_SCRIPT]);
  assert.equal(senzaGd.superato, false);
  assert.deepEqual(senzaGd.indizi, []);
});

test("indizi: la scena principale scritta come uid:// (come fa l'editor) dà l'indizio con i nomi dei file", { timeout: 5 * 60_000 }, async () => {
  const conUid = { percorso: "rock.tscn", contenuto: SENZA_SCRIPT.contenuto.replace("[gd_scene format=3]", '[gd_scene format=3 uid="uid://b4htdindizi1"]') };
  const progetto = { percorso: "project.godot", contenuto: PROJECT.contenuto.replace('config/name="Indizi"', 'config/name="Indizi"\nrun/main_scene="uid://b4htdindizi1"') };
  const principale: Verifica = {
    tipo: "script_godot",
    descrizione: "La scena principale",
    codice: 'extends "res://htd/htd_test.gd"\n\n\nfunc _run_tests() -> void:\n\tvar main := await instantiate_main_scene()\n\tif not check("main", main != null, "la scena principale si apre"):\n\t\treturn\n\tcheck("dmg", get_prop(main, "damage") == 1, "damage vale 1")\n',
  };
  const esito = await verifica({ tipo: "file", file: [progetto, ROCK_GD, conUid], daLezione: false }, [principale]);
  assert.equal(esito.superato, false, JSON.stringify(esito.controlli));
  assert.ok(esito.controlli.some((c) => c.descrizione === "la scena principale si apre" && c.superato), `la scena uid:// si apre: ${JSON.stringify(esito.controlli)}`);
  assert.equal(esito.indizi?.length, 1, JSON.stringify(esito.indizi));
  assert.match(esito.indizi![0], /^Il nodo Rock di rock\.tscn non ha nessuno script attaccato/);
});
