import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { impostaGodot } from "../src/godot/esegui.ts";
import { installaGodot } from "../src/godot/installa.ts";
import { impostaCartellaTemporanea, nuovaCartellaTemporanea, scriviFileProgetto } from "../src/godot/verifica.ts";
import { accorciaCopione, comeSiAvvia, controllaFotogrammi, leggiResoconto, misuraCopione, nodiCheNonSiVedono, problemiDelCopione, registraVideo, valutaCopione } from "../src/godot/video.ts";
import { impostaCartellaMotore } from "../src/motore.ts";
import { CopioneSchema, type Copione, type FileProgetto } from "../src/schemi.ts";

// Il video «Il risultato atteso», con il Godot vero e ffmpeg. I casi veri da cui è nato: nella 1.2 la stella che cade si
// vede solo avviando star.tscn con F6 (il vecchio video riprendeva il cesto); nella 1.9 le cinque stelle create all'avvio
// sono figlie del cesto, che sta a y = 600, e finiscono a y = 700–1070, sotto lo schermo alto 648.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cache = process.env.HTD_CACHE ?? path.join(REPO, "lavoro", "cache");

const progetto = (principale: string, azioni = "") => ({
  percorso: "project.godot",
  contenuto: `config_version=5\n\n[application]\n\nconfig/name="Video"\nrun/main_scene="${principale}"\nconfig/features=PackedStringArray("4.7")\n${azioni}`,
});
const AZIONE_DESTRA =
  '\n[input]\n\nmove_right={\n"deadzone": 0.2,\n"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":68,"key_label":0,"unicode":0,"location":0,"echo":false,"script":null)]\n}\n';
const sprite = (nome: string, script: string, corpo = "") => ({
  percorso: `${nome.toLowerCase()}.tscn`,
  contenuto: `[gd_scene format=3]\n\n[ext_resource type="Script" path="res://${script}" id="1_s"]\n[ext_resource type="Texture2D" path="res://icon.svg" id="2_t"]\n\n[node name="${nome}" type="Sprite2D"]\ntexture = ExtResource("2_t")\nscript = ExtResource("1_s")\n${corpo}`,
});
const STAR_FERMA = { percorso: "star.gd", contenuto: "extends Sprite2D\n\nvar fall_speed: float = 180.0\n\n\nfunc _ready() -> void:\n\tposition = Vector2(512, 80)\n\tmodulate = Color.YELLOW\n" };
const STAR_CADE = { percorso: "star.gd", contenuto: STAR_FERMA.contenuto + "\n\nfunc _process(delta: float) -> void:\n\tposition.y += fall_speed * delta\n" };
// Il cesto della 1.9: a y = 600, crea cinque stelle come sue figlie, alle coordinate scritte nella consegna.
const BASKET_BASE = { percorso: "basket.gd", contenuto: "extends Sprite2D\n\n\nfunc _ready() -> void:\n\tposition = Vector2(576, 600)\n\tmodulate = Color.GREEN\n" };
const BASKET_STELLE = {
  percorso: "basket.gd",
  contenuto: BASKET_BASE.contenuto + '\tfor i in range(5):\n\t\tvar star: Sprite2D = load("res://star.tscn").instantiate()\n\t\tadd_child(star)\n\t\tstar.position = Vector2(150.0 + i * 180.0, 80.0 + i * 50.0)\n',
};
// Le stesse cinque stelle messe nella scena del gioco (come figlie del suo nodo principale, fermo in (0, 0)).
const MAIN_STELLE = {
  percorso: "main.gd",
  contenuto: 'extends Node2D\n\n\nfunc _ready() -> void:\n\tfor i in range(5):\n\t\tvar star: Sprite2D = load("res://star.tscn").instantiate()\n\t\tadd_child(star)\n\t\tstar.position = Vector2(150.0 + i * 180.0, 80.0 + i * 50.0)\n',
};
const MAIN_TSCN = (script: boolean, extra = "") => ({
  percorso: "main.tscn",
  contenuto: `[gd_scene format=3]\n\n${script ? '[ext_resource type="Script" path="res://main.gd" id="1_m"]\n\n' : ""}[node name="Main" type="Node2D"]\n${script ? 'script = ExtResource("1_m")\n' : ""}${extra}`,
});
const STAR_STATICA = { percorso: "star.gd", contenuto: "extends Sprite2D\n" };

function cartellaCon(file: FileProgetto[]): string {
  const c = nuovaCartellaTemporanea("video-prova");
  scriviFileProgetto(c, file, "Video");
  return c;
}

const copione = (c: Partial<Copione> & Pick<Copione, "scena" | "soggetti">): Copione => CopioneSchema.parse({ durata: 4, azioni: [], scritte: [{ testo: "Guarda qui", da: c.soggetti[0].da, a: c.soggetti[0].a, soggetto: c.soggetti[0].id }], ...c });

const STELLA_CHE_CADE = copione({ scena: "res://star.tscn", soggetti: [{ id: "stella", cerca: { scena: "res://star.tscn" }, quanti: 1, da: 0.2, a: 2.5, deve: "muoversi", etichetta: "Stella" }] });
const CINQUE_STELLE = copione({ scena: "res://basket.tscn", durata: 5, soggetti: [{ id: "stelle", cerca: { scena: "res://star.tscn" }, quanti: 5, da: 0.3, a: 3, deve: "esserci", etichetta: "Stella" }] });

test("video: preparazione del Godot di servizio", { timeout: 20 * 60_000 }, async () => {
  impostaCartellaMotore(path.join(REPO, "motori", "godot"));
  impostaCartellaTemporanea(path.join(cache, "temp"));
  impostaGodot(await installaGodot(path.join(cache, "strumenti")));
});

test("video: la stella che cade (1.2) si registra, si vede nei fotogrammi, e non passa sul progetto di prima", { timeout: 10 * 60_000 }, async () => {
  const soluzione = cartellaCon([progetto("res://basket.tscn"), sprite("Star", "star.gd"), STAR_CADE]);
  const uscita = nuovaCartellaTemporanea("video-prova-mp4");
  const mp4 = path.join(uscita, "risultato.mp4");
  const resoconto = await registraVideo({ cartellaProgetto: soluzione, copione: STELLA_CHE_CADE, fileMp4: mp4 });
  assert.deepEqual(valutaCopione(STELLA_CHE_CADE, resoconto), { problemi: [], superati: ["stella"] });
  assert.ok(fs.statSync(mp4).size > 5000, "il video è stato scritto");
  assert.deepEqual(resoconto.schermo, [1152, 648]);
  assert.deepEqual(await controllaFotogrammi(mp4, STELLA_CHE_CADE, resoconto), []);

  // Senza registrare (senza finestra) le misure sono le stesse.
  const senzaVideo = await misuraCopione({ cartellaProgetto: cartellaCon([progetto("res://basket.tscn"), sprite("Star", "star.gd"), STAR_CADE]), copione: STELLA_CHE_CADE });
  assert.deepEqual(valutaCopione(STELLA_CHE_CADE, senzaVideo).superati, ["stella"]);
  assert.deepEqual(senzaVideo.soggetti.stella.campioni, resoconto.soggetti.stella.campioni);

  // Prima dell'esercizio la stella c'è ma sta ferma: il video non mostrerebbe il risultato.
  const prima = await misuraCopione({ cartellaProgetto: cartellaCon([progetto("res://basket.tscn"), sprite("Star", "star.gd"), STAR_FERMA]), copione: STELLA_CHE_CADE });
  const giudizio = valutaCopione(STELLA_CHE_CADE, prima);
  assert.equal(giudizio.superati.length, 0);
  assert.match(giudizio.problemi[0], /si sono spostati di almeno 24 pixel solo 0 nodi su 1/);
});

test("video: le cinque stelle della 1.9, create ma sotto lo schermo, vengono scartate e il motivo è detto", { timeout: 5 * 60_000 }, async () => {
  const cartella = cartellaCon([progetto("res://basket.tscn"), sprite("Basket", "basket.gd"), BASKET_STELLE, sprite("Star", "star.gd"), STAR_STATICA]);
  const resoconto = await misuraCopione({ cartellaProgetto: cartella, copione: CINQUE_STELLE });
  const { problemi } = valutaCopione(CINQUE_STELLE, resoconto);
  assert.equal(problemi.length, 1);
  assert.match(problemi[0], /trovati fino a 5, visibili al massimo 0/);
  assert.match(problemi[0], /fuori dallo schermo \(dentro per il 0%\)/);
  assert.match(problemi[0], /Lo schermo va da \(0, 0\) a \(1152, 648\)/);
  assert.equal(nodiCheNonSiVedono(CINQUE_STELLE, resoconto).length, 1, "il risultato non si vede: è un problema dell'esercizio");

  // Le stesse stelle in una scena che parte da (0, 0) si vedono tutte.
  const giuste = copione({ ...CINQUE_STELLE, scena: "res://main.tscn" });
  const bene = await misuraCopione({ cartellaProgetto: cartellaCon([progetto("res://main.tscn"), MAIN_TSCN(true), MAIN_STELLE, sprite("Star", "star.gd"), STAR_STATICA]), copione: giuste });
  assert.deepEqual(valutaCopione(giuste, bene).problemi, []);
});

test("video: una stella coperta da un pannello passa le misure dei nodi ma non quelle dei fotogrammi", { timeout: 10 * 60_000 }, async () => {
  // Il pannello è disegnato dopo la stella (viene dopo nella scena) e la copre: per Godot la stella «si vede».
  const pannello = '\n[node name="Panel" type="ColorRect" parent="."]\noffset_left = 300.0\noffset_top = 0.0\noffset_right = 800.0\noffset_bottom = 648.0\ncolor = Color(0.2, 0.3, 0.8, 1)\n';
  const conStella = '\n[node name="Star" parent="." instance=ExtResource("3_star")]\n';
  const scena = {
    percorso: "main.tscn",
    contenuto: `[gd_scene format=3]\n\n[ext_resource type="PackedScene" path="res://star.tscn" id="3_star"]\n\n[node name="Main" type="Node2D"]\n${conStella}${pannello}`,
  };
  const c = copione({ scena: "res://main.tscn", soggetti: [{ id: "stella", cerca: { scena: "res://star.tscn" }, quanti: 1, da: 0.2, a: 2.5, deve: "muoversi", etichetta: "Stella" }] });
  const cartella = cartellaCon([progetto("res://main.tscn"), scena, sprite("Star", "star.gd"), STAR_CADE]);
  const mp4 = path.join(nuovaCartellaTemporanea("video-prova-mp4"), "coperta.mp4");
  const resoconto = await registraVideo({ cartellaProgetto: cartella, copione: c, fileMp4: mp4 });
  assert.deepEqual(valutaCopione(c, resoconto).problemi, []);
  const fotogrammi = await controllaFotogrammi(mp4, c, resoconto);
  assert.equal(fotogrammi.length, 1);
  assert.match(fotogrammi[0], /c'è solo lo sfondo/);
});

test("video: il testo dell'interfaccia, ancorata in basso a destra, si misura anche senza finestra", { timeout: 5 * 60_000 }, async () => {
  const ui = {
    percorso: "ui.tscn",
    contenuto:
      '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://ui.gd" id="1_u"]\n\n[node name="UI" type="Control"]\nlayout_mode = 3\nanchors_preset = 15\nanchor_right = 1.0\nanchor_bottom = 1.0\nscript = ExtResource("1_u")\n\n[node name="Score" type="Label" parent="."]\nlayout_mode = 1\nanchors_preset = 3\nanchor_left = 1.0\nanchor_top = 1.0\nanchor_right = 1.0\nanchor_bottom = 1.0\noffset_left = -200.0\noffset_top = -40.0\ntext = "Punti: 0"\n',
  };
  const conPunti = { percorso: "ui.gd", contenuto: 'extends Control\n\nvar score: int = 0\n\n\nfunc _process(_delta: float) -> void:\n\tif Input.is_action_just_pressed("move_right"):\n\t\tscore += 10\n\t\t$Score.text = "Punti: %d" % score\n' };
  const senzaPunti = { percorso: "ui.gd", contenuto: "extends Control\n" };
  const c = copione({
    scena: "res://ui.tscn",
    azioni: [{ azione: "move_right", inizio: 1, fine: 1.3, tasto: "D" }],
    soggetti: [{ id: "punti", cerca: { nome: "Score" }, quanti: 1, da: 1.5, a: 3.5, deve: "mostrare testo", testo: "Punti: 10", etichetta: "Punteggio" }],
  });
  const dopo = await misuraCopione({ cartellaProgetto: cartellaCon([progetto("res://ui.tscn", AZIONE_DESTRA), ui, conPunti]), copione: c });
  assert.deepEqual(valutaCopione(c, dopo).problemi, []);
  const rett = dopo.soggetti.punti.esempi[0].nodi[0].rett;
  assert.deepEqual(rett.slice(0, 2), [952, 608], "la Label ancorata sta nell'angolo dello schermo 1152×648, non di una finestra 64×64");
  const prima = await misuraCopione({ cartellaProgetto: cartellaCon([progetto("res://ui.tscn", AZIONE_DESTRA), ui, senzaPunti]), copione: c });
  assert.match(valutaCopione(c, prima).problemi[0] ?? "", /il testo «Punti: 10» si vede solo nel 0%/);
});

test("video: comparire e sparire", { timeout: 5 * 60_000 }, async () => {
  const scena = {
    percorso: "main.tscn",
    contenuto: '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://main.gd" id="1_m"]\n\n[node name="Main" type="Node2D"]\nscript = ExtResource("1_m")\n\n[node name="Message" type="Label" parent="."]\noffset_left = 400.0\noffset_top = 300.0\noffset_right = 700.0\noffset_bottom = 340.0\ntext = "Game Over"\nvisible = false\n\n[node name="Hint" type="Label" parent="."]\noffset_left = 400.0\noffset_top = 100.0\noffset_right = 700.0\noffset_bottom = 140.0\ntext = "Premi D"\n',
  };
  const main = { percorso: "main.gd", contenuto: "extends Node2D\n\nvar elapsed: float = 0.0\n\n\nfunc _process(delta: float) -> void:\n\telapsed += delta\n\tif elapsed > 1.5:\n\t\t$Message.visible = true\n\t\t$Hint.visible = false\n" };
  const c = copione({
    scena: "res://main.tscn",
    soggetti: [
      { id: "messaggio", cerca: { nome: "Message" }, quanti: 1, da: 0.5, a: 3.5, deve: "comparire", etichetta: "Messaggio" },
      { id: "suggerimento", cerca: { nome: "Hint" }, quanti: 1, da: 0.5, a: 3.5, deve: "sparire", etichetta: "Suggerimento" },
    ],
  });
  const r = await misuraCopione({ cartellaProgetto: cartellaCon([progetto("res://main.tscn"), scena, main]), copione: c });
  assert.deepEqual(valutaCopione(c, r), { problemi: [], superati: ["messaggio", "suggerimento"] });
  const fermo = await misuraCopione({ cartellaProgetto: cartellaCon([progetto("res://main.tscn"), scena, { percorso: "main.gd", contenuto: "extends Node2D\n" }]), copione: c });
  assert.equal(valutaCopione(c, fermo).problemi.length, 2);
});

test("video: i problemi del copione che si vedono senza eseguirlo", () => {
  const file = [progetto("res://basket.tscn"), sprite("Basket", "basket.gd"), BASKET_BASE, sprite("Star", "star.gd"), STAR_CADE];
  const contesto = { file, azioni: ["move_left", "move_right"], scenaPrincipale: "res://basket.tscn", testi: "Modifica basket.gd" };
  assert.deepEqual(problemiDelCopione(CINQUE_STELLE, contesto), []);
  // La stella che cade sta in star.tscn: se la consegna non la nomina, chi studia non sa di doverla avviare con F6.
  assert.match(problemiDelCopione(STELLA_CHE_CADE, contesto)[0], /non è la principale/);
  assert.deepEqual(problemiDelCopione(STELLA_CHE_CADE, { ...contesto, testi: "Apri star.tscn e premi F6" }), []);
  const sbagliato = copione({
    scena: "res://basket.tscn",
    durata: 5,
    azioni: [{ azione: "jump", inizio: 1, fine: 2 }],
    soggetti: [{ id: "stelle", cerca: { script: "res://stella.gd" }, quanti: 1, da: 0, a: 6, deve: "esserci", etichetta: "S" }],
    scritte: [{ testo: "Fuori tempo", da: 0, a: 7, soggetto: "stelle" }],
  });
  const problemi = problemiDelCopione(sbagliato, contesto).join("\n");
  assert.match(problemi, /lo script res:\/\/stella.gd non c'è/);
  assert.match(problemi, /dopo la fine del video/);
  assert.match(problemi, /L'azione «jump» non è nella Input Map/);
  assert.match(problemi, /deve stare dentro l'intervallo/);
  assert.equal(comeSiAvvia(STELLA_CHE_CADE, "res://basket.tscn"), "Apri star.tscn e premi F6");
  // Niente secondi vuoti in fondo: il video finisce un secondo dopo l'ultimo soggetto (ma dura almeno 4 secondi).
  assert.equal(accorciaCopione({ ...STELLA_CHE_CADE, durata: 12 }).durata, 4);
  assert.equal(accorciaCopione({ ...CINQUE_STELLE, durata: 12, soggetti: [{ ...CINQUE_STELLE.soggetti[0], a: 6.5 }] }).durata, 7.5);
  assert.equal(comeSiAvvia(CINQUE_STELLE, "res://basket.tscn"), "Avvia il gioco con F5");
  // Percorsi fuori dal progetto: rifiutati dal formato.
  assert.throws(() => copione({ scena: "res://../fuori.tscn", soggetti: CINQUE_STELLE.soggetti }));
  assert.throws(() => copione({ scena: "user://a.tscn", soggetti: CINQUE_STELLE.soggetti }));
});

test("video: un resoconto mancante o falso non passa", () => {
  assert.match(leggiResoconto("ERROR: qualcosa\naltro").errore ?? "", /nessun resoconto/);
  assert.match(leggiResoconto('HTD_VIDEO {"soggetti": 3}').errore ?? "", /illeggibile/);
  const vuoto = leggiResoconto('HTD_VIDEO {"schermo": [1152, 648], "soggetti": {}}');
  assert.match(valutaCopione(CINQUE_STELLE, vuoto).problemi[0], /nessuna misura/);
});
