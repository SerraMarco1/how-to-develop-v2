import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
// Poi la lezione cambia come in una correzione del gioco (una riga nel cesto di tutta la catena, o una stella più
// veloce): il copione del video di prima si registra di nuovo prima di chiederne uno nuovo.

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
const { CopioneSchema, EsercizioSchema } = await import("@htd/condiviso/schemi.ts");
const { CONFIG } = await import("../src/configurazione.ts");
const { FORNITORI } = await import("../src/ai/catalogo.ts");
const { salva, scriviFile, scriviJson, leggiJson } = await import("../src/archivio.ts");
const { aggiornaCatalogo } = await import("../src/lezione/pubblica.ts");
const { catalogo: catalogoAttuale, paccoPubblicato } = await import("../src/corso.ts");
const { completaVideo, eserciziDaFilmare, videoAncoraValidi } = await import("../src/lezione/video.ts");
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

/** Pubblica la lezione; `basket` cambia il cesto in tutta la catena, come una correzione del gioco. */
function pubblica(es1Star = STAR_CADE, basket = BASKET_GD) {
  const es1 = EsercizioSchema.parse({ id: "es1", tipo: "guidato", genere: "guidato", titolo: "Fai cadere la stella", consegna: "In `star.gd` aggiungi `_process(delta)` e somma `fall_speed * delta` a `position.y`. Apri `star.tscn` e premi F6.", modalita: "progetto", dove: "gioco", passiGuida: ["Apri star.gd", "Scrivi _process", "Somma lo spostamento", "Premi F6"], soluzione: { file: gioco(basket, es1Star), progetto, cambiati: ["star.gd"] } });
  const es2 = EsercizioSchema.parse({ id: "es2", genere: "imita", titolo: "Stampa il punteggio", consegna: "Stampa `Punti: 10` nel pannello Output all'avvio.", modalita: "progetto", dove: "a-parte", partenza: { file: [{ percorso: "main.tscn", contenuto: '[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n' }] }, soluzione: { file: [{ percorso: "main.tscn", contenuto: '[gd_scene format=3]\n\n[ext_resource type="Script" path="res://main.gd" id="1"]\n\n[node name="Main" type="Node2D"]\nscript = ExtResource("1")\n' }, { percorso: "main.gd", contenuto: 'extends Node2D\n\n\nfunc _ready() -> void:\n\tprint("Punti: 10")\n' }], progetto: { nome: "Punti", scenaPrincipale: "res://main.tscn" }, cambiati: ["main.gd"] } });
  const prova = EsercizioSchema.parse({ id: "test", tipo: "test", genere: "imita", titolo: "Cinque stelle all'avvio", consegna: "In `basket.gd` crea cinque stelle con un ciclo for, figlie del cesto, in (150 + i * 180, 80 + i * 50).", modalita: "progetto", dove: "gioco", soluzione: { file: gioco(basket + BASKET_STELLE.slice(BASKET_GD.length), es1Star), progetto, cambiati: ["basket.gd"] } });
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
    contenuto: { titolo: l.titolo, sommario: "Cicli.", blocchi: [{ id: "b1", tipo: "testo", md: "Il ciclo for." }], esercizi: [es1, es2], test: prova, statoIniziale: { nome: "Pioggia di stelle", cartella: "pioggia-di-stelle", file: gioco(basket, STAR_FERMA), progetto } },
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

test("un video giusto che comincia tardi si registra di nuovo e si taglia, senza chiedere un copione nuovo", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  // Una stella lenta, che a 4-6 secondi è ancora sullo schermo; il video pubblicato prima del taglio, con inizio 0.
  pubblica(STAR_CADE.replace("180.0", "60.0"));
  const pacco = paccoPubblicato(l.slug)!;
  const { impronta } = eserciziDaFilmare(pacco.contenuto).find((x) => x.e.id === "es1")!;
  const copione = CopioneSchema.parse({ ...COPIONE_STELLA, durata: 7, soggetti: [{ ...COPIONE_STELLA.soggetti[0], da: 4, a: 6 }], scritte: [{ testo: "Dopo quattro secondi la stella scende ancora", da: 4, a: 6, soggetto: "stella" }] });
  const vecchio = PaccoLezioneSchema.parse({ ...pacco, versione: pacco.versione + 1, video: { es1: { copione, impronta, inizio: 0 } } });
  const voce = catalogoAttuale().lezioni.find((x) => x.slug === l.slug)!;
  const testo = JSON.stringify(vecchio);
  scriviFile(voce.file, testo);
  aggiornaCatalogo({ ...voce, versione: vecchio.versione, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  const primaDi = copioni().length;

  await completaVideo();
  assert.ok(!copioni().slice(primaDi).some((r) => r.testo.includes("Titolo: Fai cadere la stella")), "nessun copione nuovo per es1");
  const dopo = paccoPubblicato(l.slug)!;
  assert.deepEqual([dopo.video.es1.inizio, dopo.video.es1.copione], [2.5, copione]);
  const durata = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(dati, percorsoMedia(dopo.media["video:es1"]))]).toString());
  assert.ok(Math.abs(durata - 4.5) < 0.2, `il video pubblicato dura 7 - 2,5 = 4,5 secondi (${durata})`);
  assert.equal(leggiJson<Record<string, Record<string, { esito: string }>>>("stato/video.json", {})[l.slug].es1.esito, "fatto");
  assert.ok(registroDiLezione(l.slug).some((r) => r.pezzo === "es1" && r.titolo === "Esercizio 1: video tagliato all'inizio"));
});

type VoceRegistro = { impronta: string; esito: string; tentativi: number; regole?: number; motivo?: string; copione?: unknown; riprovato?: string; ultimo?: { copione: unknown; problemi: string[]; videoDiPrima?: boolean } };
const registroVideo = () => leggiJson<Record<string, Record<string, VoceRegistro>>>("stato/video.json", {});
const improntaDi = (id: string) => eserciziDaFilmare(paccoPubblicato(l.slug)!.contenuto).find((x) => x.e.id === id)!.impronta;
const quante = (titolo: string) => registroDiLezione(l.slug).filter((r) => r.pezzo === "es1" && r.titolo === titolo).length;
/** Il test della lezione (risultato invisibile) già deciso per la soluzione di oggi: non chiede copioni. */
function testGiaDeciso() {
  const registro = registroVideo();
  registro[l.slug].test = { impronta: improntaDi("test"), tentativi: 3, esito: "invisibile", regole: 2 };
  scriviJson("stato/video.json", registro);
}

test("soluzione cambiata, risultato uguale (come la correzione delle stelle): lo stesso copione torna senza richieste", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  const prima = paccoPubblicato(l.slug)!;
  // Una riga nel cesto di tutta la catena: la soluzione di es1 e il progetto di partenza cambiano, il video di prima non vale più.
  pubblica(STAR_CADE.replace("180.0", "60.0"), BASKET_GD + "\tz_index = 1\n");
  const primaDi = copioni().length;

  assert.equal(await completaVideo(), 1);
  assert.ok(!copioni().slice(primaDi).some((r) => r.testo.includes("Titolo: Fai cadere la stella")), "nessun copione chiesto per es1");
  const dopo = paccoPubblicato(l.slug)!;
  assert.deepEqual([dopo.video.es1.copione, dopo.video.es1.impronta, dopo.video.es1.inizio], [prima.video.es1.copione, improntaDi("es1"), 2.5], "lo stesso copione, sulla soluzione di oggi, tagliato all'inizio come prima");
  assert.notEqual(dopo.video.es1.impronta, prima.video.es1.impronta);
  assert.ok(fs.statSync(path.join(dati, percorsoMedia(dopo.media["video:es1"]))).size > 5000, "il video è nei media della lezione");
  const es1 = registroVideo()[l.slug].es1;
  assert.deepEqual([es1.esito, es1.copione], ["fatto", prima.video.es1.copione], "il registro tiene il copione del video");
  assert.equal(quante("Esercizio 1: video rifatto con lo stesso copione"), 1);

  // Al giro dopo non si fa niente.
  const richieste = finto.richieste.length;
  assert.equal(await completaVideo(), 0);
  assert.equal(finto.richieste.length, richieste);
});

test("come la 2.5: registro scritto prima del 23 ottobre (niente copione, «niente» già deciso), il copione è solo nella traccia", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  const prima = paccoPubblicato(l.slug)!;
  pubblica(STAR_CADE.replace("180.0", "60.0"), BASKET_GD + "\tz_index = 2\n");
  // Il registro della 2.5 es1 il 23 ottobre: copioni nuovi chiesti e rifiutati per la soluzione corretta, niente copione.
  const registro = registroVideo();
  registro[l.slug].es1 = { impronta: improntaDi("es1"), tentativi: 2, esito: "niente", regole: 2, motivo: "Il gioco raggiunge la condizione di vittoria prima dei 10 secondi." };
  scriviJson("stato/video.json", registro);
  testGiaDeciso();
  const richieste = finto.richieste.length;

  assert.equal(await completaVideo(), 1);
  assert.equal(finto.richieste.length, richieste, "nessuna richiesta");
  const dopo = paccoPubblicato(l.slug)!;
  assert.deepEqual([dopo.video.es1.copione, dopo.video.es1.impronta], [prima.video.es1.copione, improntaDi("es1")]);
  assert.deepEqual([registroVideo()[l.slug].es1.esito, registroVideo()[l.slug].es1.copione], ["fatto", prima.video.es1.copione]);
});

test("lo stesso copione non passa più: una sola riprova, poi il modello parte da lui con le misure", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  const prima = paccoPubblicato(l.slug)!;
  // La stella torna veloce: a 4 secondi, dove il copione di prima la mostra, è già sotto lo schermo.
  pubblica(STAR_CADE, BASKET_GD + "\tz_index = 3\n");
  testGiaDeciso();
  const primaDi = copioni().length;
  const nonPassa = quante("Esercizio 1: lo stesso copione non supera più i controlli");

  assert.equal(await completaVideo(), 1);
  assert.equal(quante("Esercizio 1: lo stesso copione non supera più i controlli"), nonPassa + 1);
  const es1 = copioni().slice(primaDi).filter((r) => r.testo.includes("Titolo: Fai cadere la stella"));
  assert.equal(es1.length, 2, "il copione di prima scartato, poi un copione nuovo scartato e uno giusto");
  assert.match(es1[0].testo, /Il copione del video di prima non passa più[\s\S]*Dopo quattro secondi la stella scende ancora[\s\S]*fuori dallo schermo[\s\S]*Parti da lui/);
  assert.doesNotMatch(es1[0].testo, /Il copione di prima è stato scartato/);
  const dopo = paccoPubblicato(l.slug)!;
  assert.deepEqual(dopo.video.es1.copione.scritte.map((w) => w.testo), ["La stella scende di 180 pixel al secondo"]);
  assert.notDeepEqual(dopo.video.es1.copione, prima.video.es1.copione);
  const voce = registroVideo()[l.slug].es1;
  assert.deepEqual([voce.esito, voce.copione, voce.riprovato, voce.ultimo], ["fatto", dopo.video.es1.copione, undefined, undefined], "il registro tiene il copione nuovo");
  const richieste = finto.richieste.length;
  assert.equal(await completaVideo(), 0);
  assert.equal(finto.richieste.length, richieste);
});

test("giro che aspetta i modelli, subito dopo una correzione: solo lo stesso copione, nessuna richiesta", { timeout: 15 * 60_000 }, async () => {
  cominciaGiro();
  const prima = paccoPubblicato(l.slug)!;
  pubblica(STAR_CADE, BASKET_GD + "\tz_index = 4\n");
  const primaDelTest = registroVideo()[l.slug].test;
  const richieste = finto.richieste.length;

  assert.equal(await completaVideo({ senzaModelli: true }), 1);
  assert.equal(finto.richieste.length, richieste, "nessuna richiesta");
  const dopo = paccoPubblicato(l.slug)!;
  assert.deepEqual([dopo.video.es1.copione, dopo.video.es1.impronta], [prima.video.es1.copione, improntaDi("es1")]);
  assert.deepEqual(registroVideo()[l.slug].test, primaDelTest, "il test (nessun copione riuscito) aspetta il giro normale");
  assert.equal(await completaVideo({ senzaModelli: true }), 0);
  assert.equal(finto.richieste.length, richieste);
});

test("video: con il modello del copione sovraccarico non si conta nessun tentativo, si riprova al giro dopo", { timeout: 10 * 60_000 }, async () => {
  cominciaGiro();
  // La stella di es1 cambia velocità (una correzione della lezione): il video di prima non vale più, e il suo copione
  // non passa (a 600 pixel al secondo la stella esce dallo schermo in meno di un secondo).
  pubblica(STAR_CADE.replace("180.0", "600.0"));
  sovraccarico = true;
  const versione = paccoPubblicato(l.slug)!.versione;
  const nonPassa = quante("Esercizio 1: lo stesso copione non supera più i controlli");
  assert.equal(await completaVideo(), 0);
  assert.equal(paccoPubblicato(l.slug)!.versione, versione, "nessuna versione nuova");
  const registro = registroVideo()[l.slug];
  assert.deepEqual([registro.es1.esito, registro.es1.tentativi, registro.es1.riprovato, registro.es1.ultimo?.videoDiPrima], ["in corso", 0, improntaDi("es1"), true]);
  assert.ok(registroDiLezione(l.slug).some((r) => r.pezzo === "es1" && r.esito === "attesa" && r.guasto === "fornitore"));
  assert.equal(quante("Esercizio 1: lo stesso copione non supera più i controlli"), nonPassa + 1);
  // Al giro dopo, ancora sovraccarico: il copione di prima non si riprova, e il modello partirà da lui.
  assert.equal(await completaVideo(), 0);
  assert.equal(quante("Esercizio 1: lo stesso copione non supera più i controlli"), nonPassa + 1);
  assert.equal(registroVideo()[l.slug].es1.ultimo?.videoDiPrima, true);
  finto.chiuso();
});
