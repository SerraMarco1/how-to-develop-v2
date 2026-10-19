import fs from "node:fs";
import path from "node:path";
import { eseguiGodot, importaProgetto, togliCartella } from "@htd/condiviso/godot/esegui.ts";
import { costruisciProjectGodot } from "@htd/condiviso/godot/progetto.ts";
import { erroriGodot, nuovaCartellaTemporanea, verifica } from "@htd/condiviso/godot/verifica.ts";
import { percorsoMotore } from "@htd/condiviso/motore.ts";
import { percorsoRelativo } from "@htd/condiviso/percorsi.ts";
import type { Esercizio, Progetto, StatoProgetto, TipoEsercizio } from "@htd/condiviso/schemi.ts";
import { controllaGDScript, descriviViolazioni } from "@htd/condiviso/sicurezza.ts";
import { preparaEsercizio, validaEsercizio, type OpzioniValidazione } from "./esercizio.ts";

// La pratica di una lezione nel corso a fasi.
//
// Quasi tutti gli esercizi proseguono il gioco della fase, che cresce di un pezzo alla volta. Ogni esercizio viene
// preparato e controllato rispetto a uno STATO DI PARTENZA (il gioco com'era prima), e le sue verifiche devono superare
// due prove: fallire sullo stato di partenza e passare sulla soluzione.

/** I tipi di esercizio che di norma si fanno su un progetto a parte, con un punto di partenza scritto apposta. */
const CON_PARTENZA: TipoEsercizio[] = ["ripara", "estendi", "ottimizza", "collauda"];

export function progettoVuoto(nome: string, cartella: string): StatoProgetto {
  const progetto: Progetto = { nome, scenaPrincipale: "", azioni: [], autoload: [], impostazioni: [] };
  return { nome, cartella, progetto, file: [{ percorso: "project.godot", contenuto: costruisciProjectGodot(progetto).testo }] };
}

function unisciProgetto(base: Progetto, nuove: Progetto | null | undefined): Progetto {
  if (!nuove) return base;
  const perNome = <T extends { nome: string }>(a: T[], b: T[]) => [...a.filter((x) => !b.some((y) => y.nome === x.nome)), ...b];
  const chiave = (i: { sezione: string; chiave: string }) => `${i.sezione}/${i.chiave}`;
  return {
    nome: base.nome,
    scenaPrincipale: nuove.scenaPrincipale || base.scenaPrincipale,
    azioni: perNome(base.azioni ?? [], nuove.azioni ?? []),
    autoload: perNome(base.autoload ?? [], nuove.autoload ?? []),
    impostazioni: [...(base.impostazioni ?? []).filter((x) => !(nuove.impostazioni ?? []).some((y) => chiave(y) === chiave(x))), ...(nuove.impostazioni ?? [])],
  };
}

/** Mette in forma un esercizio rispetto allo stato di partenza (per il gioco della fase il modello scrive solo i file che cambiano). */
export function preparaPezzo(grezzo: Esercizio, id: string, ruolo: Esercizio["tipo"], genere: TipoEsercizio, base: StatoProgetto): Esercizio {
  const e: Esercizio = structuredClone(grezzo);
  e.genere = genere;
  if (genere === "prevedi") e.modalita = "previsioni";
  if (genere !== "guidato") e.passiGuida = [];
  if (genere !== "trova") e.daTrovare = [];
  e.suggerimenti = genere === "guidato" ? [] : (e.suggerimenti ?? []).slice(0, ruolo === "test" ? 1 : 3);
  if (e.modalita !== "progetto") return { ...preparaEsercizio(e, id, ruolo), genere, dove: "a-parte" };
  if (e.dove === "gioco") {
    const rimossi = new Set(e.soluzione.rimossi.map(percorsoRelativo));
    const cambiati = e.soluzione.file.map((f) => ({ ...f, percorso: percorsoRelativo(f.percorso) })).filter((f) => f.percorso !== "project.godot");
    const file = [...base.file.filter((f) => f.percorso !== "project.godot" && !rimossi.has(f.percorso) && !cambiati.some((c) => c.percorso === f.percorso)), ...cambiati];
    const pronto = preparaEsercizio({ ...e, cartella: base.cartella, partenza: undefined, soluzione: { ...e.soluzione, file, progetto: unisciProgetto(base.progetto, e.soluzione.progetto) } }, id, ruolo);
    const prima = new Map(base.file.map((f) => [f.percorso, f.contenuto]));
    return {
      ...pronto,
      genere,
      dove: "gioco",
      cartella: base.cartella,
      soluzione: { ...pronto.soluzione, rimossi: [...rimossi], cambiati: pronto.soluzione.file.filter((f) => prima.get(f.percorso) !== f.contenuto).map((f) => f.percorso) },
    };
  }
  const pronto = preparaEsercizio({ ...e, dove: "a-parte" }, id, ruolo);
  const prima = new Map((pronto.partenza?.file ?? []).map((f) => [f.percorso, f.contenuto]));
  return { ...pronto, genere, dove: "a-parte", soluzione: { ...pronto.soluzione, cambiati: pronto.soluzione.file.filter((f) => prima.get(f.percorso) !== f.contenuto && f.percorso !== "project.godot").map((f) => f.percorso) } };
}

/** Lo stato del gioco dopo un esercizio riuscito (per gli esercizi a parte il gioco resta com'era). */
export function statoDopo(base: StatoProgetto, e: Esercizio): StatoProgetto {
  if (e.modalita !== "progetto" || e.dove !== "gioco") return base;
  return { ...base, file: e.soluzione.file, progetto: e.soluzione.progetto ?? base.progetto };
}

/** Tutti i controlli su un esercizio preparato: problemi trovati (vuoto = accettato) ed esercizio con le previsioni calcolate. */
export async function controllaPezzo(e: Esercizio, base: StatoProgetto, opzioni: Omit<OpzioniValidazione, "nonFatto"> = {}): Promise<{ esercizio: Esercizio; problemi: string[] }> {
  const problemi: string[] = [];
  const genere = e.genere ?? "obiettivo";
  if (genere === "guidato" && e.modalita !== "previsioni" && (e.passiGuida.length < 3 || e.passiGuida.length > 12)) {
    problemi.push(`un esercizio "guidato" ha da 4 a 10 passi in \`passiGuida\` (ce ne sono ${e.passiGuida.length})`);
  }
  if (genere === "trova") {
    if (e.daTrovare.length === 0) problemi.push('un esercizio "trova" deve elencare in `daTrovare` i nomi (proprietà, metodi, nodi) che vanno cercati nella documentazione');
    const testo = [e.consegna, ...e.suggerimenti].join("\n").toLowerCase();
    const svelati = e.daTrovare.filter((nome) => nome.trim() && new RegExp(`(?<![\\w])${nome.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`).test(testo));
    if (svelati.length) problemi.push(`la consegna o i suggerimenti dicono già ${svelati.map((s) => `"${s}"`).join(", ")}, che invece va trovato nella documentazione: descrivi il risultato da ottenere senza nominarlo`);
  }
  if (e.modalita === "progetto" && e.dove === "a-parte") {
    if (CON_PARTENZA.includes(genere) && !e.partenza) problemi.push(`un esercizio "${genere}" ha bisogno del progetto da cui si parte: scrivilo in \`partenza\` (impostazioni e tutti i file)`);
    if (e.partenza && genere !== "ripara") {
      const avvio = await verifica({ tipo: "file", file: e.partenza.file, daLezione: true }, [], { provaAvvio: true });
      const falliti = (avvio.avvio ?? []).filter((c) => !c.superato);
      if (falliti.length) problemi.push(`il progetto di partenza (\`partenza\`) deve aprirsi e partire senza errori, invece:\n${falliti.map((c) => `  - ${c.descrizione}${c.dettaglio ? `: ${c.dettaglio}` : ""}`).join("\n")}`);
    }
  }
  if (problemi.length > 0) return { esercizio: e, problemi };
  if (e.modalita === "previsioni") {
    const forma = await validaEsercizio(e);
    if (forma.length > 0) return { esercizio: e, problemi: forma };
    return calcolaPrevisioni(e);
  }
  const nonFatto = e.modalita !== "progetto" ? undefined : e.dove === "gioco" ? base.file : e.partenza?.file;
  return { esercizio: e, problemi: await validaEsercizio(e, { ...opzioni, nonFatto }) };
}

/**
 * Esegue in Godot il codice di ogni voce di un esercizio "prevedi" e scrive la risposta giusta: quella vera, non quella
 * che pensa il modello. Una voce che non si esegue, o che dà un risultato diverso a ogni esecuzione, è un problema.
 */
export async function calcolaPrevisioni(e: Esercizio): Promise<{ esercizio: Esercizio; problemi: string[] }> {
  const sicurezza = e.previsioni.flatMap((p, i) => descriviViolazioni(controllaGDScript(`previsione ${i + 1}`, p.codice)));
  if (sicurezza.length) return { esercizio: e, problemi: sicurezza.map((p) => `controllo di sicurezza — ${p}`) };
  const cartella = nuovaCartellaTemporanea("previsioni");
  try {
    fs.mkdirSync(path.join(cartella, "htd"), { recursive: true });
    fs.mkdirSync(path.join(cartella, "prev"), { recursive: true });
    fs.copyFileSync(percorsoMotore("harness", "htd_test.gd"), path.join(cartella, "htd", "htd_test.gd"));
    fs.copyFileSync(percorsoMotore("harness", "icon.svg"), path.join(cartella, "icon.svg"));
    fs.writeFileSync(path.join(cartella, "project.godot"), costruisciProjectGodot({ nome: "Previsioni" }).testo);
    e.previsioni.forEach((p, i) => fs.writeFileSync(path.join(cartella, "prev", `p${i + 1}.gd`), p.codice));
    const script = [
      'extends "res://htd/htd_test.gd"',
      "",
      "",
      "func _run_tests() -> void:",
      `\tfor i in range(1, ${e.previsioni.length + 1}):`,
      "\t\tvar values: Array = []",
      "\t\tfor attempt in 2:",
      '\t\t\tvar instance = await instantiate_script("res://prev/p%d.gd" % i)',
      '\t\t\tif instance == null or not instance.has_method("run"):',
      "\t\t\t\tbreak",
      "\t\t\tvalues.append(str(await instance.run()))",
      "\t\t\tif instance is Node:",
      "\t\t\t\tinstance.queue_free()",
      '\t\tprint("HTD_PREV " + JSON.stringify({"i": i, "values": values}))',
      '\tcheck("done", true, "Previsioni eseguite")',
      "",
    ].join("\n");
    fs.writeFileSync(path.join(cartella, "htd", "previsioni.gd"), script);
    await importaProgetto(cartella);
    const esito = await eseguiGodot(["--headless", "--path", cartella, "-s", "res://htd/previsioni.gd"], { timeoutMs: 45_000, cwd: cartella });
    const valori = new Map<number, string[]>();
    for (const riga of esito.output.split(/\r?\n/)) {
      if (!riga.startsWith("HTD_PREV ")) continue;
      try {
        const dati = JSON.parse(riga.slice("HTD_PREV ".length)) as { i: number; values: string[] };
        valori.set(dati.i, dati.values);
      } catch {
        // Una riga rovinata vale come voce non eseguita.
      }
    }
    const righe = esito.output.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/);
    const erroriDi = (numero: number) => {
      const trovati = new Set<string>();
      righe.forEach((riga, k) => {
        if (k > 0 && riga.includes(`res://prev/p${numero}.gd`) && /ERROR/i.test(righe[k - 1])) trovati.add(`${righe[k - 1].trim()} (${riga.trim().replace(/^at:\s*/, "")})`);
      });
      return [...trovati].slice(0, 3);
    };
    const problemi: string[] = [];
    const previsioni = e.previsioni.map((p, i) => {
      const v = valori.get(i + 1) ?? [];
      const errori = erroriDi(i + 1);
      if (v.length < 2) problemi.push(`la previsione ${i + 1} non si esegue in Godot 4.7: lo script deve essere GDScript valido con \`func run():\` che restituisce un valore${i === 0 || valori.size === 0 ? `\n${erroriGodot(esito.output)}` : ""}`);
      else if (v[0] !== v[1]) problemi.push(`la previsione ${i + 1} dà un risultato diverso a ogni esecuzione (${v[0]} e poi ${v[1]}): deve essere sempre lo stesso`);
      else if (v[0] === "<null>" || v[0] === "")
        problemi.push(
          errori.length
            ? `la previsione ${i + 1} si interrompe con un errore prima di restituire un valore:\n${errori.map((x) => `  - ${x}`).join("\n")}\nLo script deve bastare a sé stesso: usa solo le variabili e le funzioni che dichiara lui (un nodo creato con \`.new()\` NON ha le variabili di questo script)`
            : `la previsione ${i + 1} non restituisce niente: \`run()\` deve finire con \`return\` e il valore su cui si chiede la previsione`,
        );
      else if (v[0].length > 80) problemi.push(`la previsione ${i + 1} restituisce un valore troppo lungo da scrivere a mano (${v[0].slice(0, 60)}…): chiedi un numero, un testo breve, vero/falso o un Vector2`);
      return { ...p, risposta: v[0] ?? "" };
    });
    if (new Set(previsioni.map((p) => p.risposta)).size === 1 && previsioni.length > 2) problemi.push("tutte le previsioni hanno la stessa risposta: ogni voce deve mettere alla prova una cosa diversa");
    return { esercizio: { ...e, previsioni }, problemi };
  } finally {
    togliCartella(cartella);
  }
}

/** Il progetto come testo, per mostrarlo a un modello: ogni file con il suo percorso. */
export function progettoPerPrompt(stato: StatoProgetto, massimo = 24000): string {
  const file = stato.file.filter((f) => f.percorso !== "project.godot");
  if (file.length === 0) return "(il progetto è appena stato creato: non contiene ancora nessun file oltre a project.godot e icon.svg)";
  const p = stato.progetto;
  const impostazioni = [
    p.scenaPrincipale ? `Scena principale: ${p.scenaPrincipale}` : "Scena principale: non ancora impostata",
    (p.azioni ?? []).length ? `Azioni di input: ${(p.azioni ?? []).map((a) => `${a.nome} (${a.tasti.join(", ") || "nessun tasto"})`).join("; ")}` : "",
    (p.autoload ?? []).length ? `Autoload: ${(p.autoload ?? []).map((a) => `${a.nome} → ${a.percorso}`).join("; ")}` : "",
  ].filter(Boolean);
  const recinto = "```";
  return `${impostazioni.join("\n")}\n\n${file.map((f) => `#### ${f.percorso}\n${recinto}\n${f.contenuto.trimEnd()}\n${recinto}`).join("\n\n")}`.slice(0, massimo);
}
