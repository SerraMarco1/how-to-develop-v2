import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { BrowserWindow } from "electron";
import { diceCheSupera } from "../src/main/correttore.ts";

// La prova completa dell'aula, dentro l'aula vera (Electron, finestra vera, Godot vero). La lancia
// aula/strumenti/prova.mjs, che prepara un finto GitHub con un ramo `corso` locale.
// Variabili: HTD_PROVA_CORSO (la cartella del ramo corso servito), HTD_PROVA_SERVER (l'indirizzo del finto GitHub),
// HTD_PROVA_SCHERMATE (dove salvare le schermate da guardare).

type Js = <T = unknown>(codice: string) => Promise<T>;

const attendi = async (condizione: () => Promise<boolean>, ms = 120_000, cosa = "condizione") => {
  const fine = Date.now() + ms;
  while (Date.now() < fine) {
    if (await condizione().catch(() => false)) return;
    await new Promise((ok) => setTimeout(ok, 300));
  }
  throw new Error(`Tempo scaduto aspettando: ${cosa}`);
};

let passi = 0;
const ok = (messaggio: string) => console.log(`✓ ${++passi}. ${messaggio}`);

type FileLezione = { percorso: string; contenuto: string };
type EsercizioProva = { id: string; modalita: string; verifiche: { tipo: string; codice?: string }[]; soluzione: { file: FileLezione[] } };

/**
 * Un esercizio su progetto la cui verifica istanzia una scena che ha sul nodo principale lo script con lo stesso nome
 * (rock.tscn e rock.gd): la sua soluzione, con quello script staccato dalla scena.
 */
function scriptStaccato(esercizi: EsercizioProva[]): { id: string; nodo: string; script: string; file: FileLezione[] } | null {
  for (const e of esercizi) {
    if (e.modalita !== "progetto" || e.verifiche.some((v) => ["godot_aperto", "progetto_in_elenco", "impostazione_editor"].includes(v.tipo))) continue;
    for (const v of e.verifiche) {
      for (const m of (v.codice ?? "").matchAll(/instantiate_scene\("res:\/\/([\w/-]+)\.tscn"\)/g)) {
        const base = m[1];
        const scena = e.soluzione.file.find((f) => f.percorso === `${base}.tscn`);
        if (!scena || !e.soluzione.file.some((f) => f.percorso === `${base}.gd`)) continue;
        const risorsa = scena.contenuto.match(new RegExp(`^\\[ext_resource [^\\]]*path="res://${base}\\.gd"[^\\]]*id="([^"]+)"\\]\\n`, "m"));
        const radice = scena.contenuto.match(/^\[node name="([^"]+)"(?![^\]]*parent=)[^\]]*\]\n((?:[^[\n][^\n]*\n|\n)*)/m);
        if (!risorsa || !radice || !radice[2].includes(`script = ExtResource("${risorsa[1]}")`)) continue;
        if (scena.contenuto.split(`ExtResource("${risorsa[1]}")`).length !== 2) continue;
        const senza = scena.contenuto.replace(risorsa[0], "").replace(`script = ExtResource("${risorsa[1]}")\n`, "");
        return { id: e.id, nodo: radice[1], script: `${base}.gd`, file: e.soluzione.file.map((f) => (f === scena ? { ...f, contenuto: senza } : f)) };
      }
    }
  }
  return null;
}

export async function esegui(finestra: BrowserWindow): Promise<number> {
  // Ogni richiesta alla finestra ha un tempo massimo: una prova non deve mai restare appesa.
  const js: Js = (codice) => Promise.race([finestra.webContents.executeJavaScript(codice, true), new Promise<never>((_, no) => setTimeout(() => no(new Error(`La finestra non ha risposto entro 90 secondi: ${codice.slice(0, 120)}`)), 90_000))]);
  finestra.webContents.on("console-message", (e) => {
    if (e.level === "error" || e.level === "warning") console.log(`   [finestra ${e.level}] ${e.message.slice(0, 1500)} (${e.sourceId}:${e.lineNumber})`);
  });
  const schermate = process.env.HTD_PROVA_SCHERMATE!;
  fs.mkdirSync(schermate, { recursive: true });
  const schermata = async (nome: string) => {
    await new Promise((r) => setTimeout(r, 700));
    fs.writeFileSync(path.join(schermate, `${nome}.png`), (await finestra.webContents.capturePage()).toPNG());
  };
  const vai = async (rotta: string, attesa: string) => {
    await js(`window.location.hash = ${JSON.stringify(rotta)}`);
    await attendi(() => js(`document.body.innerText.toLowerCase().includes(${JSON.stringify(attesa.toLowerCase())})`), 30_000, `pagina ${rotta} con «${attesa}»`);
  };
  try {
    await attendi(() => js("document.readyState === 'complete' && typeof window.htd === 'object'"), 30_000, "finestra pronta");

    // 1. La finestra non ha niente del PC.
    assert.equal(await js("typeof require"), "undefined");
    assert.equal(await js("typeof process"), "undefined");
    assert.equal(await js("typeof window.htd.consegna"), "function");
    assert.equal(await js("Object.keys(window.htd).includes('invoke')"), false);
    ok("la finestra non ha Node, require, process né ipcRenderer: solo le richieste dell'aula");

    // 2. Le lezioni vengono scaricate e controllate.
    await attendi(async () => Boolean((await js<{ sincronizzazione: { ultima: string | null } }>("window.htd.oggi()")).sincronizzazione.ultima), 180_000, "prima sincronizzazione");
    const oggi = await js<{ pubblicate: number; totali: number; daImpostare: string[]; sincronizzazione: { avvisi: string[] } }>("window.htd.oggi()");
    const catalogo = JSON.parse(fs.readFileSync(path.join(process.env.HTD_PROVA_CORSO!, "catalogo.json"), "utf8")) as { lezioni: { slug: string; file: string }[] };
    assert.equal(oggi.pubblicate, catalogo.lezioni.length, `scaricate ${oggi.pubblicate} lezioni, il catalogo ne ha ${catalogo.lezioni.length}`);
    assert.deepEqual(oggi.sincronizzazione.avvisi, []);
    assert.ok(oggi.totali >= 170);
    ok(`${oggi.pubblicate} lezioni scaricate, ognuna con l'impronta controllata, su ${oggi.totali} del piano`);
    await schermata("01-oggi-prima-volta");

    // 3. L'importazione dalla versione 1.
    assert.equal((await js<{ datiImportati: string | null }>("window.htd.impostazioni()")).datiImportati, null, "niente importato prima di premere Importa");
    const importazione = await js<{ ok: boolean; riepilogo: string }>("window.htd.importaVersione1()");
    assert.ok(importazione.ok, importazione.riepilogo);
    console.log(`   ${importazione.riepilogo.replace(/chiavi per il tutor: \d+/, "chiavi per il tutor: (n)")}`);
    const dopo = await js<{ completate: number; daImpostare: string[] }>("window.htd.oggi()");
    assert.ok(dopo.completate >= 2, "i progressi della versione 1 ci sono");
    assert.ok((await js<{ datiImportati: string | null }>("window.htd.impostazioni()")).datiImportati, "le impostazioni dicono quando sono stati importati");
    const secondaVolta = await js<{ ok: boolean }>("window.htd.importaVersione1()");
    assert.equal(secondaVolta.ok, false, "l'importazione si fa una volta sola");
    ok(`importazione dalla versione 1: ${dopo.completate} lezioni completate ritrovate, e non si può ripetere`);

    // 4. Le pagine.
    await vai("#/oggi", "Da studiare adesso");
    await schermata("02-oggi");
    await vai("#/corso", "Fase 0");
    await schermata("03-corso");
    const corso = await js<{ lezioni: { slug: string; stato: string }[] }[]>("window.htd.corso()");
    const tutte = corso.flatMap((f) => f.lezioni);
    const prima = tutte.findIndex((l) => l.stato !== "completata");
    assert.ok(tutte.slice(0, prima).every((l) => l.stato === "completata"));
    assert.equal(tutte[prima].stato, "disponibile", "la prima lezione non completata è aperta");
    assert.ok(tutte.slice(prima + 1).every((l) => l.stato === "bloccata" || l.stato === "in_arrivo"), "le altre sono chiuse");
    ok(`il corso: ${prima} completate, la ${prima + 1}ª aperta, le altre chiuse`);

    // 5. Una lezione aperta, con le immagini e i video serviti dal programma.
    const aperta = tutte[prima].slug;
    await vai(`#/lezione/${aperta}`, "Test finale");
    await schermata("04-lezione");
    await js("document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; })");
    const immagini = await js<{ src: string; ok: boolean }[]>("Promise.all([...document.querySelectorAll('img, video')].map(e => new Promise(r => { if (e.tagName === 'IMG') { if (e.complete) r({ src: e.src, ok: e.naturalWidth > 0 }); else { e.onload = () => r({ src: e.src, ok: true }); e.onerror = () => r({ src: e.src, ok: false }); } } else { e.onloadedmetadata = () => r({ src: e.src, ok: true }); e.onerror = () => r({ src: e.src, ok: false }); if (e.readyState > 0) r({ src: e.src, ok: true }); } })))");
    assert.ok(immagini.every((i) => i.ok && i.src.startsWith("htd://media/")), JSON.stringify(immagini));
    const chiusa = tutte.find((l) => l.stato === "bloccata");
    if (chiusa) assert.equal(await js(`window.htd.lezione(${JSON.stringify(chiusa.slug)})`), null, "una lezione chiusa non si apre nemmeno chiedendola direttamente");
    ok(`lezione «${aperta}» aperta: ${immagini.length} immagini e video caricati dal programma; le lezioni chiuse non si aprono`);

    // 6. Una consegna verificata in Godot: prima del lavoro non passa, con la soluzione sì.
    const voce = catalogo.lezioni.find((l) => l.slug === aperta)!;
    const pacco = JSON.parse(fs.readFileSync(path.join(process.env.HTD_PROVA_CORSO!, voce.file), "utf8")) as {
      contenuto: { esercizi: (EsercizioProva & { dove: string; partenza?: { file: FileLezione[] } })[]; test: Omit<EsercizioProva, "id"> };
    };
    const esercizio = pacco.contenuto.esercizi.find((e) => e.modalita === "progetto" && !e.verifiche.some((v) => ["godot_aperto", "progetto_in_elenco", "impostazione_editor"].includes(v.tipo)));
    if (esercizio) {
      const cartella = path.join(process.env.HTD_DATI_AULA!, "progetto-prova");
      fs.mkdirSync(cartella, { recursive: true });
      fs.writeFileSync(path.join(cartella, "project.godot"), esercizio.soluzione.file.find((f) => f.percorso === "project.godot")!.contenuto.replace(/run\/main_scene=.*\n/, ""));
      const prima = await js<{ superato: boolean; errore?: string }>(`window.htd.consegna(${JSON.stringify(aperta)}, ${JSON.stringify(esercizio.id)}, { cartella: ${JSON.stringify(cartella)} })`);
      assert.equal(prima.superato, false, "un progetto vuoto non supera l'esercizio");
      assert.equal(prima.errore, undefined, `la verifica del progetto vuoto deve funzionare: ${prima.errore}`);
      for (const f of esercizio.soluzione.file) {
        fs.mkdirSync(path.dirname(path.join(cartella, f.percorso)), { recursive: true });
        fs.writeFileSync(path.join(cartella, f.percorso), f.contenuto);
      }
      const dopo = await js<{ superato: boolean; errore?: string; controlli: { descrizione: string; superato: boolean; dettaglio?: string }[] }>(`window.htd.consegna(${JSON.stringify(aperta)}, ${JSON.stringify(esercizio.id)}, { cartella: ${JSON.stringify(cartella)} })`);
      assert.equal(dopo.superato, true, `la soluzione supera l'esercizio: ${dopo.errore ?? ""} ${JSON.stringify(dopo.controlli.filter((c) => !c.superato))}`);
      ok(`esercizio ${esercizio.id} di «${aperta}» verificato in Godot: progetto vuoto rifiutato, soluzione accettata (${dopo.controlli.length} controlli)`);
    } else ok(`«${aperta}» non ha un esercizio su progetto senza verifiche di ambiente: consegna non provata qui`);

    // 6b. Lo script giusto c'è ma non è attaccato al nodo (il caso del 16 ottobre): dalla finestra, la verifica mostra
    // la causa e l'analisi del codice non dice che il lavoro supera le verifiche.
    const staccato = scriptStaccato([...pacco.contenuto.esercizi, { ...pacco.contenuto.test, id: "test" }]);
    if (staccato) {
      const cartella = path.join(process.env.HTD_DATI_AULA!, "progetto-staccato");
      for (const f of staccato.file) {
        fs.mkdirSync(path.dirname(path.join(cartella, f.percorso)), { recursive: true });
        fs.writeFileSync(path.join(cartella, f.percorso), f.contenuto);
      }
      const id = staccato.id;
      await vai(`#/lezione/${aperta}`, "Test finale");
      await js(`(() => { const campo = document.getElementById(${JSON.stringify(`cartella-${id}`)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, ${JSON.stringify(cartella)}); campo.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await js(`[...document.querySelectorAll(${JSON.stringify(`#${id} .azioni button`)})].find((b) => b.textContent === "Verifica").click()`);
      await attendi(() => js(`Boolean(document.querySelector(${JSON.stringify(`#${id} .esito`)}))`), 120_000, "esito della verifica");
      const indizio = await js<string>(`document.querySelector(${JSON.stringify(`#${id} .indizio`)})?.innerText ?? ""`);
      assert.ok(indizio.includes(staccato.nodo) && indizio.includes(staccato.script), `la causa (nodo ${staccato.nodo}, ${staccato.script}) è mostrata: «${indizio}» — ${await js<string>(`document.querySelector(${JSON.stringify(`#${id} .esito`)}).innerText`)}`);
      await js(`document.querySelector(${JSON.stringify(`#${id} .esito`)}).scrollIntoView({ block: "start" })`);
      await schermata("08-causa-probabile");
      await attendi(() => js(`!document.querySelector(${JSON.stringify(`#${id}`)}).innerText.includes("Guardo il tuo codice")`), 300_000, "analisi del codice");
      const analisi = await js<string>(`document.querySelector(${JSON.stringify(`#${id} .esito`)}).nextElementSibling?.innerText ?? ""`);
      assert.ok(analisi.trim(), "l'analisi del codice risponde (o dice perché no)");
      assert.equal(diceCheSupera(analisi), false, `l'analisi non dice che il lavoro supera le verifiche: «${analisi}»`);
      await schermata("09-analisi-script-staccato");
      console.log(`   causa mostrata: ${indizio.slice(0, 160)}…\n   analisi del codice: ${analisi.replace(/\s+/g, " ").slice(0, 600)}`);
      ok(`${id} di «${aperta}» con ${staccato.script} non attaccato al nodo ${staccato.nodo}: causa mostrata, analisi coerente con le verifiche`);
    } else ok(`«${aperta}» non ha un esercizio con uno script da staccare: caso dello script non attaccato non provato qui`);

    // 7. Le protezioni della finestra.
    assert.equal(await js("window.open('https://example.com') === null"), true);
    await js("window.location.href = 'https://example.com'");
    await new Promise((r) => setTimeout(r, 1500));
    assert.ok((await js<string>("window.location.href")).startsWith("htd://app/"), "la finestra non esce verso altri siti");
    await assert.rejects(js("window.htd.lezione('../../segreti')"), /non valida/);
    await assert.rejects(js("window.htd.consegna('il-primo-script', 'es1; rm', {})"), /non valida/);
    await assert.rejects(js("window.htd.salvaChiave('groq', 'a\\nb')"), /non valida/);
    const rispostaFetch = await js<string>("fetch('https://example.com').then(() => 'aperta', e => 'bloccata')");
    assert.equal(rispostaFetch, "bloccata", "la finestra non può collegarsi a internet");
    await js("window.htd.apriCartella('C:\\\\Windows')");
    ok("protezioni: niente nuove finestre, niente navigazione, niente rete dalla finestra, richieste malformate rifiutate");

    // 8. Un file alterato durante il download viene scartato.
    const r = await fetch(`${process.env.HTD_PROVA_SERVER}/__altera`, { method: "POST" });
    assert.equal(r.status, 204);
    const s = await js<{ avvisi: string[] }>("window.htd.sincronizza()");
    assert.ok(s.avvisi.some((a) => /impronta/.test(a)), `atteso un avviso sull'impronta: ${JSON.stringify(s.avvisi)}`);
    const primaLezione = catalogo.lezioni[0].slug;
    assert.ok(await js(`window.htd.lezione(${JSON.stringify(primaLezione)}).then((l) => l !== null && l.versione === 1)`), "la lezione già scaricata resta quella buona");
    ok(`lezione alterata scartata, quella buona resta: «${s.avvisi[0].slice(0, 110)}…»`);
    await fetch(`${process.env.HTD_PROVA_SERVER}/__ripristina`, { method: "POST" });

    // 9. Le altre pagine.
    await vai("#/scheda", "Cosa so fare");
    await schermata("05-scheda");
    await vai("#/ripasso", "Ripasso");
    await schermata("06-ripasso");
    await vai("#/impostazioni", "Chiavi del tutor");
    await schermata("07-impostazioni");
    const impostazioni = await js<{ chiavi: Record<string, boolean> }>("window.htd.impostazioni()");
    assert.equal(JSON.stringify(impostazioni).match(/gsk_|AIza/), null, "le chiavi non tornano mai alla finestra");
    ok("pagine Cosa so fare, Ripasso e Impostazioni; le chiavi non tornano alla finestra");
    console.log(`Tutto a posto: ${passi} controlli superati.`);
    return 0;
  } catch (errore) {
    console.error(`✗ ${(errore as Error).stack ?? errore}`);
    await schermata("errore").catch(() => {});
    return 1;
  }
}
