import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fornitoreFinto, preparaAmbiente } from "./aiuto.ts";

// I video «Il risultato atteso» delle lezioni pubblicate, con il Godot VERO e un fornitore finto che scrive i copioni.
// Una lezione con tre esercizi da filmare:
// - es1 (guidato): la stella che cade, da avviare con F6 su star.tscn. Il primo copione riprende la scena principale
//   (il cesto, dove la stella non c'è): scartato, e le misure tornano al modello; il secondo è giusto e diventa il video;
// - es2 (imita): un risultato che si legge solo nel pannello Output: il modello dice che il video non si fa;
// - test (imita): le cinque stelle della 1.9, create come figlie del cesto e quindi sotto lo schermo: tre copioni
//   scartati, poi niente video e una nota nella traccia («il risultato non si vede nello schermo»).

const { dati } = preparaAmbiente("video");

const BASKET_TSCN = '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://basket.gd" id="1_b"]\n[ext_resource type="Texture2D" path="res://icon.svg" id="2_t"]\n\n[node name="Basket" type="Sprite2D"]\ntexture = ExtResource("2_t")\nscript = ExtResource("1_b")\n';
const STAR_TSCN = '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://star.gd" id="1_s"]\n[ext_resource type="Texture2D" path="res://icon.svg" id="2_t"]\n\n[node name="Star" type="Sprite2D"]\ntexture = ExtResource("2_t")\nscript = ExtResource("1_s")\n';
const BASKET_GD = "extends Sprite2D\n\n\nfunc _ready() -> void:\n\tposition = Vector2(576, 600)\n\tmodulate = Color.GREEN\n";
const BASKET_STELLE = BASKET_GD + '\tfor i in range(5):\n\t\tvar star: Sprite2D = load("res://star.tscn").instantiate()\n\t\tadd_child(star)\n\t\tstar.position = Vector2(150.0 + i * 180.0, 80.0 + i * 50.0)\n';
const STAR_FERMA = "extends Sprite2D\n\nvar fall_speed: float = 180.0\n\n\nfunc _ready() -> void:\n\tif position == Vector2.ZERO:\n\t\tposition = Vector2(512, 80)\n";
const STAR_CADE = STAR_FERMA + "\n\nfunc _process(delta: float) -> void:\n\tposition.y += fall_speed * delta\n";

const COPIONE_CESTO = { video: true, scena: "res://basket.tscn", durata: 6, azioni: [], soggetti: [{ id: "stella", cerca: { scena: "res://star.tscn" }, quanti: 1, da: 0.5, a: 3, deve: "muoversi", etichetta: "Stella" }], scritte: [{ testo: "La stella scende", da: 0.5, a: 3, soggetto: "stella" }] };
const COPIONE_STELLA = { ...COPIONE_CESTO, scena: "res://star.tscn", scritte: [{ testo: "La stella scende di 180 pixel al secondo", da: 0.5, a: 3, soggetto: "stella" }] };
const COPIONE_CINQUE = { video: true, scena: "res://basket.tscn", durata: 5, azioni: [], soggetti: [{ id: "stelle", cerca: { scena: "res://star.tscn" }, quanti: 5, da: 0.3, a: 3, deve: "esserci", etichetta: "Stella" }], scritte: [{ testo: "Il ciclo for crea cinque stelle", da: 0.3, a: 3, soggetto: "stelle" }] };

let sovraccarico = false;
const finto = await fornitoreFinto(({ testo }) => {
  if (!testo.startsWith("Scrivi il COPIONE del video")) return { dati: { approvata: true, problemi: [] } };
  if (sovraccarico) return { stato: 503 };
  if (testo.includes("Titolo: Fai cadere la stella")) return { dati: testo.includes("Il copione di prima è stato scartato") && testo.includes("nessun nodo della scena in esecuzione corrisponde") ? COPIONE_STELLA : COPIONE_CESTO };
  if (testo.includes("Titolo: Stampa il punteggio")) return { dati: { video: false, perche: "Il punteggio si legge solo nel pannello Output." } };
  return { dati: COPIONE_CINQUE };
});
const copioni = () => finto.richieste.filter((r) => r.testo.startsWith("Scrivi il COPIONE del video"));

// I moduli della fabbrica leggono l'ambiente quando vengono caricati: dopo preparaAmbiente.
const { impostaCartellaMotore } = await import("@htd/condiviso/motore.ts");
const { impostaGodot } = await import("@htd/condiviso/godot/esegui.ts");
const { installaGodot } = await import("@htd/condiviso/godot/installa.ts");
const { impostaCartellaTemporanea } = await import("@htd/condiviso/godot/verifica.ts");
const { lezioneDelCorso } = await import("@htd/condiviso/piano.ts");
const { costruisciProjectGodot } = await import("@htd/condiviso/godot/progetto.ts");
const { FORMATO, PaccoLezioneSchema, percorsoLezione, percorsoMedia, sha256 } = await import("@htd/condiviso/pacchetto.ts");
const { EsercizioSchema } = await import("@htd/condiviso/schemi.ts");
const { CONFIG } = await import("../src/configurazione.ts");
const { FORNITORI } = await import("../src/ai/catalogo.ts");
const { salva, scriviFile, scriviJson, leggiJson } = await import("../src/archivio.ts");
const { aggiornaCatalogo } = await import("../src/lezione/pubblica.ts");
const { catalogo: catalogoAttuale, paccoPubblicato } = await import("../src/corso.ts");
const { completaVideo, videoAncoraValidi } = await import("../src/lezione/video.ts");
const { registroDiLezione } = await import("../src/traccia.ts");
const { cominciaGiro } = await import("../src/tempo.ts");

FORNITORI.find((f) => f.id === "gemini")!.baseUrl = finto.url;
impostaCartellaMotore(CONFIG.motore);
impostaCartellaTemporanea(path.join(CONFIG.cache, "temp"));
fs.writeFileSync(path.join(dati, ".gitkeep"), "");
await salva("inizio");

const progetto = { nome: "Pioggia di stelle", scenaPrincipale: "res://basket.tscn", azioni: [{ nome: "move_right", tasti: ["D"] }], autoload: [], impostazioni: [] };
const gioco = (basket: string, star: string) => [
  { percorso: "project.godot", contenuto: costruisciProjectGodot(progetto).testo },
  { percorso: "basket.tscn", contenuto: BASKET_TSCN },
  { percorso: "basket.gd", contenuto: basket },
  { percorso: "star.tscn", contenuto: STAR_TSCN },
  { percorso: "star.gd", contenuto: star },
];
const l = lezioneDelCorso("cicli")!;

function pubblica(es1Star = STAR_CADE) {
  const es1 = EsercizioSchema.parse({ id: "es1", tipo: "guidato", genere: "guidato", titolo: "Fai cadere la stella", consegna: "In `star.gd` aggiungi `_process(delta)` e somma `fall_speed * delta` a `position.y`. Apri `star.tscn` e premi F6.", modalita: "progetto", dove: "gioco", passiGuida: ["Apri star.gd", "Scrivi _process", "Somma lo spostamento", "Premi F6"], soluzione: { file: gioco(BASKET_GD, es1Star), progetto, cambiati: ["star.gd"] } });
  const es2 = EsercizioSchema.parse({ id: "es2", genere: "imita", titolo: "Stampa il punteggio", consegna: "Stampa `Punti: 10` nel pannello Output all'avvio.", modalita: "progetto", dove: "a-parte", partenza: { file: [{ percorso: "main.tscn", contenuto: '[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n' }] }, soluzione: { file: [{ percorso: "main.tscn", contenuto: '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://main.gd" id="1"]\n\n[node name="Main" type="Node2D"]\nscript = ExtResource("1")\n' }, { percorso: "main.gd", contenuto: 'extends Node2D\n\n\nfunc _ready() -> void:\n\tprint("Punti: 10")\n' }], progetto: { nome: "Punti", scenaPrincipale: "res://main.tscn" }, cambiati: ["main.gd"] } });
  const prova = EsercizioSchema.parse({ id: "test", tipo: "test", genere: "imita", titolo: "Cinque stelle all'avvio", consegna: "In `basket.gd` crea cinque stelle con un ciclo for, figlie del cesto, in (150 + i * 180, 80 + i * 50).", modalita: "progetto", dove: "gioco", soluzione: { file: gioco(BASKET_STELLE, es1Star), progetto, cambiati: ["basket.gd"] } });
  const precedente = paccoPubblicato(l.slug);
  const pacco = PaccoLezioneSchema.parse({
    formato: FORMATO,
    slug: l.slug,
    numero: l.numero,
    fase: l.fase.slug,
    titolo: l.titolo,
    tipo: l.tipo,
    minuti: l.minuti,
    versione: (precedente?.versione ?? 0) + 1,
    contenuto: { titolo: l.titolo, sommario: "Cicli.", blocchi: [{ id: "b1", tipo: "testo", md: "Il ciclo for." }], esercizi: [es1, es2], test: prova, statoIniziale: { nome: "Pioggia di stelle", cartella: "pioggia-di-stelle", file: gioco(BASKET_GD, STAR_FERMA), progetto } },
    statoFinale: null,
    media: precedente?.media ?? {},
    video: precedente?.video ?? {},
    ripasso: [],
    origine: { pubblicata: "2026-10-19T10:00:00.000Z", modelli: ["gemini/gemini-flash-latest"], richieste: 9, codice: null },
  });
  const file = percorsoLezione(l.fase.slug, l.slug);
  const testo = JSON.stringify(pacco);
  scriviFile(file, testo);
  aggiornaCatalogo({ slug: l.slug, numero: l.numero, titolo: l.titolo, versione: pacco.versione, file, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  return pacco;
}

test("video: preparazione del Godot di servizio", { timeout: 20 * 60_000 }, async () => {
  impostaGodot(await installaGodot(path.join(CONFIG.cache, "strumenti")));
});

test("video delle lezioni pubblicate: copione corretto con le misure, niente video quando non si vede, nota per il risultato invisibile", { timeout: 20 * 60_000 }, async () => {
  cominciaGiro();
  const prima = pubblica();
  assert.equal(await completaVideo(), 1, "la lezione esce in una versione nuova");

  const nuovo = paccoPubblicato(l.slug)!;
  assert.equal(nuovo.versione, prima.versione + 1);
  assert.deepEqual(Object.keys(nuovo.video), ["es1"]);
  assert.equal(nuovo.video.es1.copione.scena, "res://star.tscn");
  const media = nuovo.media["video:es1"];
  assert.ok(media && fs.statSync(path.join(dati, percorsoMedia(media))).size > 5000, "il video è nei media della lezione");
  assert.deepEqual(nuovo.contenuto, prima.contenuto, "teoria ed esercizi non cambiano");

  // Le richieste: es1 due (la seconda con le misure del primo copione), es2 una, il test tre (tutte scartate).
  const fatte = copioni();
  assert.deepEqual(fatte.map((r) => r.modello), Array(6).fill("gemini-flash-lite-latest"), "tutte al modello del ritocco");
  const es1 = fatte.filter((r) => r.testo.includes("Titolo: Fai cadere la stella"));
  assert.equal(es1.length, 2);
  assert.match(es1[1].testo, /Il copione di prima è stato scartato[\s\S]*nessun nodo della scena in esecuzione corrisponde a scena = res:\/\/star.tscn/);
  assert.match(es1[0].testo, /Scena principale \(si avvia con F5\): res:\/\/basket.tscn/);
  const prove = fatte.filter((r) => r.testo.includes("Titolo: Cinque stelle all'avvio"));
  assert.equal(prove.length, 3);
  assert.match(prove[2].testo, /visibili al massimo 0[\s\S]*fuori dallo schermo/);

  const registro = leggiJson<Record<string, Record<string, { esito: string; tentativi: number }>>>("stato/video.json", {})[l.slug];
  assert.equal(registro.es1.esito, "fatto");
  assert.equal(registro.es2.esito, "niente");
  assert.deepEqual([registro.test.esito, registro.test.tentativi], ["invisibile", 3]);
  const traccia = registroDiLezione(l.slug);
  assert.ok(traccia.some((r) => r.pezzo === "test" && r.titolo === "Test: il risultato dell'esercizio non si vede nello schermo" && /trovati, al massimo 0 visibili/.test(r.spiegazione)), "la nota sul risultato invisibile è nella traccia");
  assert.ok(traccia.some((r) => r.pezzo === "es2" && r.esito === "saltato" && /pannello Output/.test(r.spiegazione)));

  // Al giro dopo non si chiede niente: tutto è deciso per queste soluzioni.
  assert.equal(await completaVideo(), 0);
  assert.equal(copioni().length, 6);
});

test("video ancora validi: restano finché l'esercizio non cambia", () => {
  const pacco = paccoPubblicato(l.slug)!;
  assert.deepEqual(Object.keys(videoAncoraValidi(pacco, pacco.contenuto).video), ["es1"]);
  const cambiato = { ...pacco.contenuto, esercizi: [{ ...pacco.contenuto.esercizi[0], soluzione: { ...pacco.contenuto.esercizi[0].soluzione, file: gioco(BASKET_GD, STAR_CADE.replace("180.0", "200.0")) } }, pacco.contenuto.esercizi[1]] };
  assert.deepEqual(videoAncoraValidi(pacco, cambiato), { video: {}, media: {} });
  assert.deepEqual(videoAncoraValidi(null, pacco.contenuto), { video: {}, media: {} });
});

test("regole nuove: un video con due scritte insieme si rifà, un «niente» deciso con le regole vecchie si richiede una volta", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  // Come la sera del 19 ottobre: il registro scritto prima delle regole 2, e un video (3.0 es2) con le scritte sovrapposte.
  const registro = leggiJson<Record<string, Record<string, Record<string, unknown>>>>("stato/video.json", {});
  delete registro[l.slug].es2.regole;
  delete registro[l.slug].test.regole;
  scriviJson("stato/video.json", registro);
  const pacco = paccoPubblicato(l.slug)!;
  const copione = { ...pacco.video.es1.copione, scritte: [{ testo: "Una", da: 0.5, a: 3, soggetto: "stella" }, { testo: "Due", da: 0.5, a: 3, soggetto: "stella" }] };
  const vecchio = PaccoLezioneSchema.parse({ ...pacco, versione: pacco.versione + 1, video: { es1: { ...pacco.video.es1, copione } } });
  const voce = catalogoAttuale().lezioni.find((x) => x.slug === l.slug)!;
  const testo = JSON.stringify(vecchio);
  scriviFile(voce.file, testo);
  aggiornaCatalogo({ ...voce, versione: vecchio.versione, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  const primaDi = copioni().length;

  assert.equal(await completaVideo(), 1);
  const nuove = copioni().slice(primaDi);
  assert.deepEqual(nuove.map((r) => r.testo.match(/Titolo: ([^\n]+)/)![1]), ["Fai cadere la stella", "Fai cadere la stella", "Stampa il punteggio"], "es1 rifatto (due copioni), es2 richiesto una volta, il test (risultato invisibile) no");
  const dopo = paccoPubblicato(l.slug)!;
  assert.equal(dopo.versione, vecchio.versione + 1);
  assert.deepEqual(dopo.video.es1.copione.scritte.map((w) => w.testo), ["La stella scende di 180 pixel al secondo"]);
  const ora = leggiJson<Record<string, Record<string, { esito: string; regole?: number; motivo?: string; ultimo?: unknown }>>>("stato/video.json", {})[l.slug];
  assert.deepEqual([ora.es1.esito, ora.es1.regole, ora.es1.motivo, ora.es1.ultimo], ["fatto", 2, undefined, undefined], "dopo un video fatto il registro non tiene il copione scartato");
  assert.deepEqual([ora.es2.esito, ora.es2.regole], ["niente", 2]);
  assert.equal(ora.test.esito, "invisibile");
  assert.equal(await completaVideo(), 0);
  assert.equal(copioni().length, primaDi + 3);
});

test("video: con il modello del copione sovraccarico non si conta nessun tentativo, si riprova al giro dopo", { timeout: 10 * 60_000 }, async () => {
  cominciaGiro();
  // La stella di es1 cambia velocità (una correzione della lezione): il video di prima non vale più.
  pubblica(STAR_CADE.replace("180.0", "240.0"));
  sovraccarico = true;
  const versione = paccoPubblicato(l.slug)!.versione;
  assert.equal(await completaVideo(), 0);
  assert.equal(paccoPubblicato(l.slug)!.versione, versione, "nessuna versione nuova");
  const registro = leggiJson<Record<string, Record<string, { esito: string; tentativi: number }>>>("stato/video.json", {})[l.slug];
  assert.deepEqual([registro.es1.esito, registro.es1.tentativi], ["in corso", 0]);
  assert.ok(registroDiLezione(l.slug).some((r) => r.pezzo === "es1" && r.esito === "attesa" && r.guasto === "fornitore"));
  finto.chiuso();
});
