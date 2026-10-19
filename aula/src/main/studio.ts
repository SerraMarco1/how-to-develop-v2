import fs from "node:fs";
import path from "node:path";
import { shell } from "electron";
import { cercaDocumentazione, formattaDocumentazione } from "@htd/condiviso/documentazione.ts";
import { scriviFileProgetto, stessiFallimenti, verifica, type Controllo, type EsitoVerifica } from "@htd/condiviso/godot/verifica.ts";
import { leggiFileMotore } from "@htd/condiviso/motore.ts";
import type { Media, PaccoLezione } from "@htd/condiviso/pacchetto.ts";
import { descrizioneTipo, lezioniDelCorso } from "@htd/condiviso/piano.ts";
import { percorsoRelativo } from "@htd/condiviso/percorsi.ts";
import { previsioneGiusta } from "@htd/condiviso/previsioni.ts";
import { FeedbackCodiceSchema, eVerificaAmbiente, type Esercizio } from "@htd/condiviso/schemi.ts";
import type { BloccoVista, Consegna, EsercizioVista, EsitoConsegna, LezioneVista, MessaggioTutor } from "../comune/api.ts";
import { chiedi, type Messaggio, NessunModello } from "./ai.ts";
import { trovaCartellaProgetto } from "./ambiente.ts";
import { codiceDelleVerifiche, diceCheSupera, differenzeDallaSoluzione, verifichePerCorrettore } from "./correttore.ts";
import { assicuraGodot } from "./godot.ts";
import { apribile, cartellaDiLavoro, pacco, prossima, voci } from "./corso.ts";
import { adesso, database, leggiImpostazione } from "./db.ts";
import { REPOSITORY } from "./percorsi.ts";
import { programmaPrimoRipasso } from "./ripasso.ts";
import { codiceHtml, markdownHtml, testoSemplice } from "./testo.ts";

// Tutto ciò che succede mentre studi una lezione: la lezione da mostrare, le consegne, il progetto di partenza, la
// soluzione, il tutor, le spiegazioni alternative, il voto, le segnalazioni.

// ─────────────────────────── Istruzioni per i modelli ───────────────────────────

function prompt(nome: string, valori: Record<string, string | number | undefined>): string {
  return leggiFileMotore("prompts", `${nome}.md`).replace(/\{\{(\w+)\}\}/g, (_, chiave: string) => {
    const v = valori[chiave];
    return v === undefined || v === "" ? "(nessuno)" : String(v);
  });
}

/** Il tuo profilo per le istruzioni del tutor (importato dalla versione 1; senza, una descrizione generica). */
function profilo(): string {
  return leggiImpostazione<string>("profilo_testo", "Parte da zero con Godot e conosce le basi della programmazione. Preferisce spiegazioni semplici, chiare e dettagliate, con esempi pratici.");
}

function giaInsegnato(slug: string): string {
  const tutte = lezioniDelCorso();
  const indice = tutte.findIndex((l) => l.slug === slug);
  const prima = tutte.slice(0, Math.max(0, indice));
  if (prima.length === 0) return "Niente: è la prima lezione del corso.";
  const vicine = prima.slice(-4).map((l) => {
    const p = pacco(l.slug);
    return p ? `- ${l.titolo}: ${p.contenuto.sommario} (concetti: ${p.contenuto.concetti.join(", ")})` : `- ${l.titolo}`;
  });
  return `Lezioni più vicine:\n${vicine.join("\n")}\n\nTutte le lezioni precedenti: ${prima.map((l) => l.titolo).join("; ")}`;
}

// ─────────────────────────── La lezione da mostrare ───────────────────────────

const urlMedia = (m: Media | undefined) => (m ? `htd://media/${m.sha256}.${m.estensione}` : "");

function superati(slug: string): Set<string> {
  return new Set((database().prepare("SELECT DISTINCT pezzo FROM tentativi WHERE slug = ? AND superato = 1").all(slug) as { pezzo: string }[]).map((r) => r.pezzo));
}

function progresso(slug: string): { stato: string; aiuto: number; soluzione_vista: number; voto: number | null; nota: string | null } | null {
  return (database().prepare("SELECT stato, aiuto, soluzione_vista, voto, nota FROM progressi WHERE slug = ?").get(slug) as never) ?? null;
}

function segnaIniziata(slug: string): void {
  database().prepare("INSERT INTO progressi (slug, stato, iniziata) VALUES (?, 'in_corso', ?) ON CONFLICT(slug) DO NOTHING").run(slug, adesso());
}

/** Il gioco com'era PRIMA di un esercizio che lo prosegue: la soluzione dell'esercizio prima, o l'inizio della lezione. */
function giocoPrimaDi(p: PaccoLezione, pezzo: string): { percorso: string; contenuto: string }[] | null {
  const catena = [...p.contenuto.esercizi, p.contenuto.test].filter((e) => e.modalita === "progetto" && e.dove === "gioco");
  const posizione = catena.findIndex((e) => e.id === pezzo);
  if (posizione < 0) return null;
  if (posizione > 0) return catena[posizione - 1].soluzione.file;
  return p.contenuto.statoIniziale?.file ?? null;
}

async function vistaEsercizio(p: PaccoLezione, e: Esercizio, fatti: Set<string>): Promise<EsercizioVista> {
  const tipo = e.genere ? descrizioneTipo(e.genere) : undefined;
  return {
    id: e.id!,
    ruolo: e.tipo,
    titolo: e.titolo,
    consegnaHtml: await markdownHtml(e.consegna),
    modalita: e.modalita,
    genere: tipo ? { nome: tipo.nome, allena: tipo.allena } : null,
    cartellaPredefinita: e.modalita === "progetto" ? cartellaDiLavoro(p, e) : null,
    partenza: e.modalita !== "progetto" ? null : e.dove === "gioco" ? (giocoPrimaDi(p, e.id!) ? "gioco" : null) : e.partenza?.file.length ? "progetto" : null,
    fileCodice: e.fileCodice ?? null,
    passiHtml: await Promise.all(e.passiGuida.map((x) => markdownHtml(x))),
    suggerimenti: e.suggerimenti,
    previsioni: await Promise.all(e.previsioni.map(async (x) => ({ id: x.id!, domandaHtml: await markdownHtml(x.domanda), codiceHtml: await codiceHtml(x.codice) }))),
    verifiche: e.verifiche.map((v) => v.descrizione).filter(Boolean),
    superato: fatti.has(e.id!),
  };
}

export async function vistaLezione(slug: string): Promise<LezioneVista | null> {
  const p = pacco(slug);
  if (!p || !apribile(slug)) return null;
  const fatti = superati(slug);
  const blocchi: BloccoVista[] = [];
  for (const b of p.contenuto.blocchi) {
    const id = b.id ?? `b${blocchi.length + 1}`;
    switch (b.tipo) {
      case "testo":
      case "attenzione":
      case "riepilogo":
        blocchi.push({ id, tipo: b.tipo, html: await markdownHtml(b.md) });
        break;
      case "codice":
        blocchi.push({ id, tipo: "codice", html: await codiceHtml(b.codice, b.linguaggio), spiegazioneHtml: b.spiegazione ? await markdownHtml(b.spiegazione) : "" });
        break;
      case "passi":
        blocchi.push({ id, tipo: "passi", titolo: b.titolo, passiHtml: await Promise.all(b.passi.map((x) => markdownHtml(x))) });
        break;
      case "immagine": {
        const m = p.media[`immagine:${b.immagine}`];
        if (m) blocchi.push({ id, tipo: "immagine", url: urlMedia(m), didascalia: b.didascalia });
        break;
      }
      // I video delle lezioni non si mostrano: il 18 ottobre risultarono tutti inutili (riprendevano il cesto mezzo
      // fuori dallo schermo, non ciò di cui parlava la lezione). La fabbrica non li fa più; quelli già pubblicati restano
      // nei file, ma qui si saltano.
      case "video":
        break;
    }
  }
  const alternative: Record<string, string[]> = {};
  for (const r of database().prepare("SELECT blocco, testo FROM spiegazioni WHERE slug = ? ORDER BY id").all(slug) as { blocco: string; testo: string }[]) (alternative[r.blocco] ??= []).push(await markdownHtml(r.testo));
  const pr = progresso(slug);
  const tutte = voci();
  const posizione = tutte.findIndex((v) => v.slug === slug);
  const dopo = tutte[posizione + 1];
  const fase = tutte[posizione]?.lezione.fase;
  return {
    slug,
    numero: p.numero,
    fase: { numero: tutte[posizione]?.lezione.numeroFase ?? 0, titolo: fase?.titolo ?? "" },
    titolo: p.contenuto.titolo,
    tipo: p.tipo,
    minuti: p.minuti,
    versione: p.versione,
    obiettivi: p.contenuto.obiettivi,
    avvisi: p.contenuto.avvisi ?? [],
    blocchi,
    alternative,
    esercizi: await Promise.all(p.contenuto.esercizi.map((e) => vistaEsercizio(p, e, fatti))),
    test: await vistaEsercizio(p, { ...p.contenuto.test, id: "test", tipo: "test" }, fatti),
    completata: pr?.stato === "completata",
    voto: pr?.voto ?? null,
    nota: pr?.nota ?? null,
    prossima: dopo && dopo.versione !== null ? { slug: dopo.slug, titolo: dopo.titolo } : null,
    attesaProssima: dopo && dopo.versione === null ? `La lezione dopo, ${dopo.numero} «${dopo.titolo}», la sta ancora preparando la fabbrica.` : null,
  };
}

// ─────────────────────────── Consegne ───────────────────────────

function trovaEsercizio(slug: string, pezzo: string): { p: PaccoLezione; e: Esercizio } | null {
  const p = pacco(slug);
  if (!p || !apribile(slug)) return null;
  const e = pezzo === "test" ? { ...p.contenuto.test, id: "test", tipo: "test" as const } : p.contenuto.esercizi.find((x) => x.id === pezzo);
  return e ? { p, e } : null;
}

export async function consegna(slug: string, pezzo: string, input: Consegna): Promise<EsitoConsegna> {
  const trovato = trovaEsercizio(slug, pezzo);
  if (!trovato) return { superato: false, controlli: [], indizi: [], previsioni: [], riepilogo: "", completata: false, errore: "Esercizio non trovato" };
  const { p, e } = trovato;
  segnaIniziata(slug);
  const controlli: Controllo[] = [];
  const indizi: string[] = [];
  const previsioni: EsitoConsegna["previsioni"] = [];
  let cartellaUsata: string | undefined;
  let nota: string | undefined;
  // Una verifica che controlla il gioco in esecuzione e fallisce si ripete una volta. Il 17 e il 18 ottobre alcune
  // verifiche pubblicate davano esiti diversi sullo stesso progetto (dipendevano dal caso): bocciavano un lavoro che
  // premendo di nuovo Verifica passava. Se la seconda esecuzione passa, il lavoro è superato; se fallisce in un altro
  // modo, lo si dice, perché quei controlli non sono una guida affidabile.
  const conRipetizione = async (esegui: () => Promise<EsitoVerifica>): Promise<EsitoVerifica> => {
    const primo = await esegui();
    if (primo.superato || !e.verifiche.some((v) => v.tipo === "script_godot")) return primo;
    const secondo = await esegui();
    if (secondo.superato) {
      nota = "La prima esecuzione delle verifiche era fallita, la seconda è passata: questa verifica dà esiti diversi da una volta all'altra. È un suo difetto, non del tuo lavoro, che conta come superato.";
      return secondo;
    }
    if (!stessiFallimenti(primo.controlli, secondo.controlli)) indizi.push("Due esecuzioni dello stesso progetto hanno fallito controlli diversi: questa verifica dipende dal caso o dal tempo, quindi i controlli qui sotto non sono una guida sicura. Se pensi che il tuo lavoro sia giusto, usa «Segnala un errore».");
    return secondo;
  };
  try {
    if (e.modalita === "progetto" || e.modalita === "codice") await assicuraGodot();
    for (const x of e.previsioni) {
      const corretta = previsioneGiusta(x.risposta, input.risposte?.[x.id!] ?? "");
      previsioni.push({ id: x.id!, corretta, commentoHtml: await markdownHtml(`${corretta ? "Giusto. " : `Il risultato vero è \`${x.risposta}\`. `}${x.spiegazione}`) });
    }
    if (e.modalita === "progetto") {
      const indicata = input.cartella?.trim() || cartellaDiLavoro(p, e);
      const trovata = await trovaCartellaProgetto(indicata, e.soluzione.progetto?.nome);
      cartellaUsata = trovata?.cartella ?? indicata;
      if (trovata && trovata.come !== "indicata") {
        controlli.push({ descrizione: `Progetto letto da ${cartellaUsata}`, superato: true, dettaglio: trovata.come === "elenco" ? "Non era nella cartella indicata: l'ho trovato per nome nell'elenco del Project Manager." : "Era in una sottocartella di quella indicata." });
      }
      const esito = await conRipetizione(() => verifica({ tipo: "cartella", percorso: cartellaUsata! }, e.verifiche));
      controlli.push(...esito.controlli);
      indizi.push(...(esito.indizi ?? []));
    } else if (e.modalita === "codice") {
      if (!input.codice?.trim()) return { superato: false, controlli: [], indizi: [], previsioni, riepilogo: "", completata: false, errore: "Incolla il tuo codice prima di verificare" };
      const file = [...e.soluzione.file.filter((f) => f.percorso === "project.godot"), { percorso: e.fileCodice || "res://solution.gd", contenuto: input.codice }];
      const esito = await conRipetizione(() => verifica({ tipo: "file", file, daLezione: false }, e.verifiche));
      controlli.push(...esito.controlli);
      indizi.push(...(esito.indizi ?? []));
    } else if (e.modalita === "ambiente") {
      controlli.push(...(await verifica({ tipo: "ambiente" }, e.verifiche)).controlli);
    }
  } catch (errore) {
    return { superato: false, controlli, indizi, previsioni, riepilogo: "", completata: false, errore: `Non è stato possibile completare la verifica: ${(errore as Error).message}` };
  }
  const previsioniOk = previsioni.length === 0 || previsioni.filter((d) => d.corretta).length / previsioni.length >= 0.75;
  const controlliOk = controlli.every((c) => c.superato) && (controlli.length > 0 || e.modalita === "previsioni");
  const superato = previsioniOk && controlliOk && (controlli.length > 0 || previsioni.length > 0);
  const riepilogo = superato
    ? pezzo === "test"
      ? "Test superato! La lezione è completata."
      : "Esercizio completato correttamente."
    : e.modalita === "previsioni"
      ? `${previsioni.filter((d) => d.corretta).length} previsioni giuste su ${previsioni.length}: leggi perché le altre davano un risultato diverso, poi riprova.`
      : `Non ancora: ${controlli.filter((c) => !c.superato).length} controlli non superati.`;
  database().prepare("INSERT INTO tentativi (slug, pezzo, consegna, esito, superato, quando) VALUES (?, ?, ?, ?, ?, ?)").run(slug, pezzo, JSON.stringify({ ...input, codice: input.codice?.slice(0, 50_000) }), JSON.stringify({ controlli, indizi, previsioni, nota }), superato ? 1 : 0, adesso());
  let completata = false;
  if (superato && pezzo === "test") {
    const pr = progresso(slug);
    if (pr?.stato !== "completata") {
      completata = true;
      database().prepare("UPDATE progressi SET stato = 'completata', completata = ? WHERE slug = ?").run(adesso(), slug);
      programmaPrimoRipasso(slug, pr?.aiuto ?? 0);
      database().prepare("INSERT INTO portfolio (slug, titolo, cartella, aiuto, quando) VALUES (?, ?, ?, ?, ?)").run(slug, p.contenuto.titolo, cartellaUsata ?? null, pr?.aiuto ?? 0, adesso());
    }
  }
  return { superato, controlli, indizi: superato ? [] : indizi, previsioni, riepilogo, completata, cartellaUsata, nota };
}

/**
 * Mette nella cartella dell'esercizio il progetto da cui partire. Non sovrascrive mai: se la cartella contiene già
 * qualcosa, la rinomina con la data e la tiene.
 */
export function preparaPartenza(slug: string, pezzo: string): { cartella?: string; spostata?: string; errore?: string } {
  const trovato = trovaEsercizio(slug, pezzo);
  if (!trovato || trovato.e.modalita !== "progetto") return { errore: "Questo esercizio non ha un progetto di partenza" };
  const { p, e } = trovato;
  const file = e.dove === "gioco" ? giocoPrimaDi(p, pezzo) : (e.partenza?.file ?? null);
  if (!file?.length) return { errore: "Questo esercizio parte da un progetto nuovo: crealo tu dal Project Manager" };
  const cartella = cartellaDiLavoro(p, e);
  let spostata: string | undefined;
  try {
    if (fs.existsSync(cartella) && fs.readdirSync(cartella).length > 0) {
      spostata = `${cartella}-copia-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
      fs.renameSync(cartella, spostata);
    }
    fs.mkdirSync(cartella, { recursive: true });
    scriviFileProgetto(cartella, file, e.soluzione.progetto?.nome ?? e.titolo);
  } catch (errore) {
    return { errore: `Non riesco a scrivere in ${cartella}: ${(errore as Error).message}. Se il progetto è aperto in Godot, chiudilo e riprova.` };
  }
  return { cartella, spostata };
}

export async function soluzione(slug: string, pezzo: string): Promise<{ html: string }> {
  const trovato = trovaEsercizio(slug, pezzo);
  if (!trovato) return { html: "" };
  const { e } = trovato;
  if (pezzo === "test") {
    segnaIniziata(slug);
    database().prepare("UPDATE progressi SET soluzione_vista = 1, aiuto = 5 WHERE slug = ?").run(slug);
  }
  if (e.modalita === "previsioni") return { html: await markdownHtml(e.previsioni.map((x, i) => `**${i + 1}. ${x.domanda}** — \`${x.risposta}\`\n\n${x.spiegazione}`).join("\n\n")) };
  const cambiati = new Set(e.soluzione.cambiati ?? []);
  const file = e.soluzione.file.filter((f) => f.percorso !== "project.godot" && (cambiati.size === 0 || cambiati.has(f.percorso)));
  const pr = e.soluzione.progetto;
  const impostazioni = [
    pr?.scenaPrincipale ? `- Scena principale (*Project Settings → Application → Run → Main Scene*): \`${pr.scenaPrincipale}\`` : "",
    ...(pr?.azioni ?? []).map((a) => `- Azione di input \`${a.nome}\` (*Project Settings → Input Map*)${a.tasti.length ? `: ${a.tasti.join(", ")}` : ""}`),
    ...(pr?.autoload ?? []).map((a) => `- Autoload \`${a.nome}\` (*Project Settings → Globals*): \`${a.percorso}\``),
    ...(pr?.impostazioni ?? []).map((i) => `- Impostazione \`${i.sezione}/${i.chiave}\` = \`${i.valore}\``),
  ].filter(Boolean);
  const parti = [await markdownHtml(e.soluzione.spiegazione)];
  if (e.modalita === "progetto" && impostazioni.length) parti.push(await markdownHtml(`**Impostazioni del progetto**\n\n${impostazioni.join("\n")}`));
  for (const f of file) parti.push(`<p><strong>${testoSemplice(f.percorso)}</strong></p>${await codiceHtml(f.contenuto, f.percorso.endsWith(".gd") ? "gdscript" : "ini")}`);
  return { html: parti.join("\n") };
}

// ─────────────────────────── Analisi del codice e tutor ───────────────────────────

/**
 * I file di codice e le scene del progetto di chi studia, con i numeri di riga. Con `solo`, per intero solo quei file
 * (quelli che l'esercizio cambia) e degli altri il nome: con controlli falliti la richiesta resta corta (vedi analisiCodice).
 */
function fileDelProgetto(cartella: string, solo?: Set<string>): string {
  if (!fs.existsSync(cartella)) return "(cartella non trovata)";
  const raccolti: string[] = [];
  const altri: string[] = [];
  let totale = 0;
  const visita = (dir: string, profondita: number) => {
    if (profondita > 8) return;
    for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
      if (voce.name.startsWith(".") || voce.name === "htd" || voce.isSymbolicLink()) continue;
      const completo = path.join(dir, voce.name);
      if (voce.isDirectory()) visita(completo, profondita + 1);
      else if (voce.isFile() && (/\.(gd|tscn)$/.test(voce.name) || voce.name === "project.godot")) {
        const relativo = path.relative(cartella, completo).replaceAll("\\", "/");
        if (solo && !solo.has(relativo)) {
          altri.push(relativo);
          continue;
        }
        const contenuto = fs.readFileSync(completo, "utf8");
        if (totale + contenuto.length > 25_000) continue;
        totale += contenuto.length;
        raccolti.push(`### ${relativo}\n${contenuto.split(/\r?\n/).map((r, i) => `${String(i + 1).padStart(3)} | ${r}`).join("\n")}`);
      }
    }
  };
  visita(cartella, 0);
  if (altri.length) raccolti.push(`(Altri file del progetto, non mostrati: ${altri.join(", ")}.)`);
  return raccolti.join("\n\n") || "(nessun file di codice o scena)";
}

/** Le differenze fra gli script di chi studia (la cartella del progetto, o il codice incollato) e quelli della soluzione. */
function differenzeDelLavoro(e: Esercizio, cartella: string, codice: string | null): string {
  if (e.modalita !== "progetto" && e.modalita !== "codice") return "";
  const leggi = (percorso: string): string | null => {
    if (e.modalita === "codice") return percorsoRelativo(e.fileCodice ?? "solution.gd") === percorso ? codice : null;
    try {
      return fs.readFileSync(path.join(cartella, percorso), "utf8");
    } catch {
      return null;
    }
  };
  return differenzeDallaSoluzione(e.soluzione.file, leggi, e.soluzione.cambiati);
}

export async function analisiCodice(slug: string, pezzo: string, input: Consegna, controlli: Controllo[], indizi: string[]) {
  const trovato = trovaEsercizio(slug, pezzo);
  if (!trovato) return { errore: "Esercizio non trovato" };
  const { p, e } = trovato;
  const cartella = input.cartella?.trim() || cartellaDiLavoro(p, e);
  const verifiche = verifichePerCorrettore(controlli);
  const falliti = controlli.filter((c) => !c.superato).length;
  // Con controlli falliti la richiesta deve stare negli 8.000 token al minuto di Groq, il modello che il 18 ottobre trovò
  // la causa vera (gli altri no): per intero solo i file che l'esercizio cambia e le loro scene; il resto lo dicono le
  // differenze dalla soluzione. Niente stile e niente documentazione: conta solo la causa.
  const cambiati = new Set(e.soluzione.cambiati.flatMap((f) => [f, f.replace(/\.gd$/, ".tscn")]));
  const file =
    e.modalita === "codice"
      ? `### ${e.fileCodice}\n${(input.codice ?? "").split(/\r?\n/).map((r, i) => `${String(i + 1).padStart(3)} | ${r}`).join("\n")}`
      : fileDelProgetto(cartella, falliti > 0 && cambiati.size ? cambiati : undefined);
  const messaggi: Messaggio[] = [
    { role: "system", content: leggiFileMotore("prompts", "sistema.md") },
    {
      role: "user",
      content: prompt("correttore", {
        titolo_esercizio: e.titolo,
        consegna: e.consegna,
        conto: verifiche.conto,
        controlli: verifiche.elenco,
        indizi: indizi.map((i) => `- ${i}`).join("\n"),
        verifiche_codice: codiceDelleVerifiche(e.verifiche),
        differenze: differenzeDelLavoro(e, cartella, input.codice ?? null),
        file_studente: file,
        stile: falliti > 0 ? "(Ci sono controlli falliti: concentrati sulla loro causa. Lo stile si guarda quando tutto passa: non fare osservazioni di stile.)" : leggiFileMotore("stile-di-casa.md"),
        documentazione: falliti > 0 ? "(non serve: concentrati sulla causa dei controlli falliti)" : formattaDocumentazione(cercaDocumentazione(`${p.titolo} ${e.titolo}`, { guide: 1, classi: 1, maxCaratteri: 1500 })),
      }),
    },
  ];
  try {
    let risposta = await chiedi({ ruolo: "correttore", messaggi, schema: FeedbackCodiceSchema, maxTokens: 3000, ragionamento: falliti > 0 ? "medium" : "low" });
    // Una risposta che dà per superato un lavoro con controlli falliti confonderebbe più di quanto aiuta: il modello
    // la riscrive una volta, e se insiste non si mostra.
    if (falliti > 0 && diceCheSupera(risposta.dati.riepilogo)) {
      risposta = await chiedi({
        ruolo: "correttore",
        messaggi: [
          ...messaggi,
          { role: "assistant", content: risposta.testo },
          { role: "user", content: `La tua risposta dice che il lavoro supera le verifiche, ma ${falliti} controlli su ${controlli.length} sono ✗, cioè NON superati. Riscrivila: spiega perché quei controlli non passano. Rispondi con SOLO il JSON.` },
        ],
        schema: FeedbackCodiceSchema,
        maxTokens: 3000,
      });
      if (diceCheSupera(risposta.dati.riepilogo)) return { errore: "L'analisi automatica questa volta si è contraddetta con le verifiche, quindi non te la mostro: guarda i controlli ✗ e la causa probabile qui sopra, oppure chiedi al tutor." };
    }
    const { dati } = risposta;
    return { html: await markdownHtml(dati.riepilogo), righe: dati.righe.map((r) => ({ file: r.file, riga: r.riga ?? null, problema: r.problema, suggerimento: r.suggerimento })) };
  } catch (errore) {
    return { errore: errore instanceof NessunModello ? errore.message : `Analisi non disponibile ora: ${(errore as Error).message}` };
  }
}

const LIVELLI_AIUTO = ["Domanda libera", "Domanda guida", "Indizio", "Spiegazione", "Esempio simile", "Soluzione"];

export async function tutor(slug: string, testo: string, livello: number, pezzo: string | null, codice: string | null): Promise<{ html?: string; errore?: string }> {
  const p = pacco(slug);
  if (!p || !apribile(slug)) return { errore: "Lezione non trovata" };
  const trovato = pezzo ? trovaEsercizio(slug, pezzo) : null;
  // Gli altri esercizi della lezione: se la domanda parla di uno di quelli, il tutor lo dice invece di rispondere su
  // quello sbagliato (il 17 ottobre rispose sul sottomarino a una domanda sul rover).
  const titoli = [...p.contenuto.esercizi.map((x) => `- ${x.titolo}`), `- ${p.contenuto.test.titolo} (test finale)`].join("\n");
  let contesto = `Sta leggendo la lezione e non ha scelto un esercizio. Gli esercizi della lezione:\n${titoli}`;
  if (trovato) {
    const { e } = trovato;
    const ultimo = database().prepare("SELECT consegna, esito FROM tentativi WHERE slug = ? AND pezzo = ? ORDER BY id DESC LIMIT 1").get(slug, pezzo) as { consegna: string; esito: string } | undefined;
    const risultato = ultimo ? (JSON.parse(ultimo.esito) as { controlli?: Controllo[]; indizi?: string[]; nota?: string }) : null;
    // La cartella dell'ultima verifica: è quella in cui chi studia lavora davvero, anche se non è quella proposta.
    const cartella = (ultimo ? (JSON.parse(ultimo.consegna) as Consegna).cartella?.trim() : undefined) || cartellaDiLavoro(p, e);
    const diProgetto = e.modalita === "progetto" || e.modalita === "codice";
    contesto = [
      `Sta chiedendo dell'${e.id === "test" ? "esercizio del TEST FINALE" : "esercizio"} «${e.titolo}». Gli esercizi della lezione:\n${titoli}`,
      `Consegna: ${e.consegna}`,
      risultato?.controlli?.length ? `Ultima verifica:\n${risultato.controlli.map((c) => `${c.superato ? "✓" : "✗"} ${c.descrizione}${c.dettaglio ? ` — ${c.dettaglio}` : ""}`).join("\n")}${risultato.indizi?.length ? `\nCausa trovata dalla piattaforma: ${risultato.indizi.join(" ")}` : ""}${risultato.nota ? `\n${risultato.nota}` : ""}` : "Non ha ancora premuto Verifica.",
      diProgetto ? `Codice delle verifiche eseguite in Godot (\`hold_action(azione, n)\` tiene premuta l'azione per n frame di fisica, 60 al secondo):\n${codiceDelleVerifiche(e.verifiche)}` : "",
      codice ? `Codice dello studente:\n\`\`\`gdscript\n${codice.slice(0, 8000)}\n\`\`\`` : e.modalita === "progetto" ? `File del progetto dello studente (${cartella}):\n${fileDelProgetto(cartella).slice(0, 8000)}` : "",
      diProgetto ? `Differenze fra i suoi script e quelli della soluzione di riferimento (SOLO PER TE: non incollarle e non dire «guarda la soluzione»; «-» = solo nel suo file, con il numero di riga del suo file; «+» = solo nella soluzione):\n${differenzeDelLavoro(e, cartella, codice)}` : "",
      livello >= 4 ? `Soluzione di riferimento (usala per guidare; mostrala per intero solo al livello 5):\n${e.soluzione.spiegazione}\n${e.soluzione.file.map((f) => `### ${f.percorso}\n${f.contenuto}`).join("\n").slice(0, 10_000)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (e.id === "test") {
      segnaIniziata(slug);
      database().prepare("UPDATE progressi SET aiuto = MAX(aiuto, ?), soluzione_vista = CASE WHEN ? >= 5 THEN 1 ELSE soluzione_vista END WHERE slug = ?").run(livello, livello, slug);
    }
  }
  // La conversazione è quella su questo esercizio (o sulla lezione in generale), non quella su un altro.
  const storia = (database().prepare("SELECT ruolo, testo FROM tutor WHERE slug = ? AND pezzo IS ? ORDER BY id DESC LIMIT 8").all(slug, pezzo) as { ruolo: string; testo: string }[]).reverse();
  // Con controlli falliti il tutor deve trovare la causa vera, non elencare quelle possibili. Il 18 ottobre, con le stesse
  // istruzioni e gli stessi dati, gpt-oss-120b rispose con un elenco generico; con questo promemoria accanto alla domanda
  // e più ragionamento trovò la causa (la roccia che in _ready() si rimetteva in un punto a caso) e una correzione giusta.
  const conFalliti = Boolean(trovato) && controlliFallitiUltimaVolta(slug, pezzo);
  const promemoria = conFalliti ? "\n\n[Promemoria per il tutor, non per lo studente: l'ultima verifica ha controlli ✗. Prima di rispondere leggi il codice della verifica fallita e le differenze fra i suoi script e quelli della soluzione: la causa vera è lì. Spiegala con file e numero di riga e di' come correggerla. Niente elenchi di cause possibili.]" : "";
  const sistema = prompt("tutor", {
    profilo: profilo(),
    titolo_lezione: p.contenuto.titolo,
    sommario_lezione: p.contenuto.sommario,
    concetti: p.contenuto.concetti.join(", "),
    gia_insegnato: giaInsegnato(slug),
    contesto_esercizio: contesto,
    documentazione: formattaDocumentazione(cercaDocumentazione(`${testo} ${p.titolo}`, { guide: 2, classi: 2, maxCaratteri: 3000 })),
    livello_aiuto: `${livello} (${LIVELLI_AIUTO[livello] ?? ""})`,
  });
  try {
    const risposta = await chiedi({
      ruolo: "tutor",
      messaggi: [{ role: "system", content: sistema }, ...storia.map((m) => ({ role: m.ruolo === "utente" ? ("user" as const) : ("assistant" as const), content: m.testo })), { role: "user", content: (testo || LIVELLI_AIUTO[livello] || "Aiutami") + promemoria }],
      maxTokens: 2500,
      temperatura: 0.5,
      ragionamento: conFalliti ? "medium" : "low",
    });
    const ora = adesso();
    database().prepare("INSERT INTO tutor (slug, pezzo, ruolo, testo, livello, quando) VALUES (?, ?, 'utente', ?, ?, ?)").run(slug, pezzo, testo || `(${LIVELLI_AIUTO[livello]})`, livello, ora);
    database().prepare("INSERT INTO tutor (slug, pezzo, ruolo, testo, livello, modello, quando) VALUES (?, ?, 'tutor', ?, ?, ?, ?)").run(slug, pezzo, risposta.testo, livello, risposta.modello, ora);
    return { html: await markdownHtml(risposta.testo) };
  } catch (errore) {
    return { errore: errore instanceof NessunModello ? errore.message : `Il tutor non risponde: ${(errore as Error).message}` };
  }
}

/** Vero se l'ultima verifica di un esercizio ha controlli non superati. */
function controlliFallitiUltimaVolta(slug: string, pezzo: string | null): boolean {
  const ultimo = database().prepare("SELECT esito, superato FROM tentativi WHERE slug = ? AND pezzo = ? ORDER BY id DESC LIMIT 1").get(slug, pezzo) as { esito: string; superato: number } | undefined;
  return Boolean(ultimo && !ultimo.superato && ((JSON.parse(ultimo.esito) as { controlli?: Controllo[] }).controlli ?? []).some((c) => !c.superato));
}

/** La conversazione con il tutor su un esercizio (`pezzo`), o sulla lezione in generale (null). */
export async function storiaTutor(slug: string, pezzo: string | null = null): Promise<MessaggioTutor[]> {
  const righe = database().prepare("SELECT id, ruolo, testo FROM tutor WHERE slug = ? AND pezzo IS ? ORDER BY id").all(slug, pezzo) as { id: number; ruolo: "utente" | "tutor"; testo: string }[];
  return Promise.all(righe.map(async (r) => ({ id: r.id, ruolo: r.ruolo, testo: r.testo, html: r.ruolo === "tutor" ? await markdownHtml(r.testo) : "" })));
}

export async function spiegaAltrimenti(slug: string, blocco: string): Promise<{ html?: string; errore?: string }> {
  const p = pacco(slug);
  const b = p?.contenuto.blocchi.find((x) => x.id === blocco);
  if (!p || !b || !apribile(slug)) return { errore: "Blocco non trovato" };
  try {
    const risposta = await chiedi({
      ruolo: "spiegazione",
      messaggi: [
        { role: "system", content: leggiFileMotore("prompts", "sistema.md") },
        { role: "user", content: prompt("spiegazione-alternativa", { titolo_lezione: p.contenuto.titolo, blocco: JSON.stringify(b), gia_insegnato: giaInsegnato(slug), documentazione: formattaDocumentazione(cercaDocumentazione(`${JSON.stringify(b).slice(0, 400)} ${p.titolo}`, { guide: 2, classi: 1, maxCaratteri: 3500 })) }) },
      ],
      maxTokens: 1200,
      temperatura: 0.6,
    });
    database().prepare("INSERT INTO spiegazioni (slug, blocco, testo, quando) VALUES (?, ?, ?, ?)").run(slug, blocco, risposta.testo, adesso());
    return { html: await markdownHtml(risposta.testo) };
  } catch (errore) {
    return { errore: errore instanceof NessunModello ? errore.message : `Spiegazione non disponibile ora: ${(errore as Error).message}` };
  }
}

export function vota(slug: string, voto: number, nota: string): void {
  segnaIniziata(slug);
  database().prepare("UPDATE progressi SET voto = ?, nota = ? WHERE slug = ?").run(voto, nota.slice(0, 2000) || null, slug);
}

/**
 * Apre nel browser il modulo «Segnala un problema» del repository, con la lezione e il punto già scritti. Il testo
 * della segnalazione lo scrivi lì: nell'indirizzo vanno solo il numero della lezione e il punto.
 */
export async function segnala(slug: string, dove: string): Promise<void> {
  const p = pacco(slug);
  if (!p) return;
  const parametri = new URLSearchParams({ template: "segnalazione.yml", title: `Lezione ${p.numero}: problema in ${dove || "la lezione"}`, lezione: `${p.numero} ${p.slug}`, dove: dove.slice(0, 60) });
  await shell.openExternal(`https://github.com/${REPOSITORY}/issues/new?${parametri.toString()}`);
}

export function prossimaDaStudiare() {
  return prossima();
}

export { eVerificaAmbiente };
