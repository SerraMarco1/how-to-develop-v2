import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { impostaCartellaMotore, infoMotore } from "@htd/condiviso/motore.ts";
import { leggiPiano, lezioniDelCorso, problemiDelPiano, type FasePiano } from "@htd/condiviso/piano.ts";

// Controlla il piano del corso (motori/godot/corso) e ne scrive la versione leggibile in docs/piano-del-corso.md.
//
//   npm run piano
//
// Il piano è scritto a mano, un file per fase. Qui si controlla che stia in piedi: i controlli di sempre
// (condiviso/src/piano.ts, gli stessi che usano la fabbrica e l'aula), più quelli sulla forma di ogni lezione e, se la
// documentazione è già stata indicizzata in lavoro/cache, che le sezioni citate esistano davvero.
// I numeri delle lezioni sono quelli dell'aula: «1.0» è la prima lezione della fase 1.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
impostaCartellaMotore(path.join(REPO, "motori", "godot"));

type PianoCompleto = ReturnType<typeof leggiPiano> & {
  comeSiMisura: string[];
  scheda: { nome: string; cosa: string; perOgniVoce: string[]; aCosaServe: string[]; formati: string[] };
  scelte: { scelta: string; perche: string }[];
  rami: { slug: string; titolo: string; ore: number; dopo: string; contenuto: string }[];
};
const piano = leggiPiano() as PianoCompleto;
const fasi = piano.fasi;
const tipi = new Map(piano.tipiDiEsercizio.tipi.map((t) => [t.id as string, t]));
const tutte = lezioniDelCorso();

// ─────────────────────────── Controlli ───────────────────────────

const errori = problemiDelPiano(piano);
const avvisi: string[] = [];
const indice = JSON.parse(fs.readFileSync(path.join(REPO, "motori", "godot", "corso", "00-piano.json"), "utf8")) as { fasi: string[] };

fasi.forEach((fase, i) => {
  const file = indice.fasi[i];
  if (file !== `${fase.slug}.json`) errori.push(`${file}: lo slug della fase (${fase.slug}) non corrisponde al nome del file`);
  for (const campo of ["titolo", "descrizione", "gioco", "allaFine", "sezioniDocumentazione", "lezioni", "progetto"] as const) {
    if (fase[campo] === undefined) errori.push(`${file}: manca "${campo}"`);
  }
  for (const l of fase.lezioni) {
    const dove = `${file} › ${l.slug}`;
    for (const campo of ["titolo", "tipo", "minuti", "esercizi", "verifica", "parole"] as const) {
      const v = l[campo] as unknown;
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) errori.push(`${dove}: manca "${campo}"`);
    }
    if (!["lezione", "metodo", "progetto"].includes(l.tipo)) errori.push(`${dove}: tipo "${l.tipo}" sconosciuto`);
    if (!Number.isInteger(l.minuti) || l.minuti < 30 || l.minuti > 360) errori.push(`${dove}: minuti fuori misura (${l.minuti})`);
    const daZero = l.esercizi.includes("da-zero");
    if ((l.tipo === "progetto") !== daZero) errori.push(`${dove}: "da-zero" va usato in tutte e sole le tappe di progetto`);
    if (l.esercizi.length === 1 && l.esercizi[0] === "guidato") errori.push(`${dove}: una lezione non può avere solo l'esercizio guidato`);
    if (l.tipo !== "progetto" && l.impari.length < 2) avvisi.push(`${dove}: meno di due cose da imparare`);
  }
  if (fase.prova && !fase.lezioni.some((l) => l.tipo === "progetto")) errori.push(`${file}: ha una prova finale ma nessuna tappa di progetto`);
});
for (const ramo of piano.rami) if (!fasi.some((f) => f.slug === ramo.dopo)) errori.push(`ramo ${ramo.slug}: la fase "${ramo.dopo}" non esiste`);

// Le sezioni della documentazione citate devono esistere (se l'indice è già stato costruito da una prova o da un giro).
const commit = infoMotore().docs.commit.slice(0, 12);
const fileIndice = path.join(REPO, "lavoro", "cache", `docs-${commit}.sqlite`);
if (fs.existsSync(fileIndice)) {
  const db = new DatabaseSync(fileIndice, { readOnly: true });
  const pagine = (db.prepare("SELECT percorso FROM pagine").all() as { percorso: string }[]).map((p) => p.percorso);
  db.close();
  fasi.forEach((fase, i) => {
    for (const sezione of fase.sezioniDocumentazione) {
      if (!pagine.some((p) => p.startsWith(sezione))) errori.push(`${indice.fasi[i]}: nessuna pagina della documentazione inizia con "${sezione}"`);
    }
  });
} else {
  avvisi.push(`sezioni della documentazione non controllate: manca ${path.relative(REPO, fileIndice)} (si crea con npm run prove)`);
}

// ─────────────────────────── Numeri ───────────────────────────

const ore = (minuti: number) => (Math.round(minuti / 6) / 10).toLocaleString("it-IT");
const minutiFase = (f: FasePiano) => f.lezioni.reduce((s, l) => s + l.minuti, 0);
const totale = fasi.reduce((s, f) => s + minutiFase(f), 0);
const uso = new Map([...tipi.keys()].map((id) => [id, tutte.filter((l) => (l.esercizi as string[]).includes(id)).length]));

// ─────────────────────────── Documento ───────────────────────────

const r: string[] = [];
r.push(`# ${piano.titolo}`, "");
r.push(`> Piano del corso, versione ${piano.versione}${piano.stato === "proposta" ? " — **proposta da approvare**" : ""}. Questo documento è generato da \`motori/godot/corso\` con \`npm run piano\`: per cambiarlo si modificano quei file. I numeri delle lezioni sono quelli che mostra l'aula.`, "");
r.push(`**${fasi.length} fasi · ${tutte.filter((l) => l.tipo !== "progetto").length} lezioni · ${tutte.filter((l) => l.tipo === "progetto").length} tappe di progetto · ${ore(totale)} ore**, più ${piano.rami.length} rami facoltativi (${piano.rami.reduce((s, x) => s + x.ore, 0)} ore).`, "");
r.push("## Il traguardo", "", piano.traguardo, "");
r.push("**Come si misura**", "", ...piano.comeSiMisura.map((x) => `- ${x}`), "");
r.push("## Le regole del corso", "", ...piano.regole.map((x) => `- ${x}`), "");

r.push("## Il corso in una pagina", "", "| | Fase | Ore | Il gioco che cresce | La prova, da un progetto vuoto |", "|---|---|---|---|---|");
fasi.forEach((f, i) => r.push(`| ${i} | [${f.titolo}](#fase-${i}--${f.slug}) | ${ore(minutiFase(f))} | ${f.gioco} | ${f.prova || "—"} |`));
r.push("");

r.push("## I tipi di esercizio", "", piano.tipiDiEsercizio.nota, "", "| Tipo | Cosa fai | Cosa allena | In quante lezioni |", "|---|---|---|---|");
for (const t of tipi.values()) r.push(`| **${t.nome}** | ${t.cosa} | ${t.allena} | ${uso.get(t.id)} |`);
r.push("");

r.push(`## La scheda «${piano.scheda.nome}»`, "", piano.scheda.cosa, "", "Per ogni voce:", "", ...piano.scheda.perOgniVoce.map((x) => `- ${x}`), "", "A cosa serve:", "", ...piano.scheda.aCosaServe.map((x) => `- ${x}`), "", `Formati: ${piano.scheda.formati.join("; ")}.`, "");

r.push("## Le scelte, e perché", "", "| Scelta | Perché |", "|---|---|", ...piano.scelte.map((s) => `| ${s.scelta} | ${s.perche} |`), "");

fasi.forEach((f, i) => {
  r.push(`<a id="fase-${i}--${f.slug}"></a>`, "", `## Fase ${i} — ${f.titolo}`, "");
  const lezioni = f.lezioni.filter((l) => l.tipo !== "progetto").length;
  const tappe = f.lezioni.filter((l) => l.tipo === "progetto").length;
  r.push(`*${ore(minutiFase(f))} ore · ${lezioni} lezioni${tappe ? ` · ${tappe} tappe di progetto` : ""}*`, "");
  r.push(f.descrizione, "");
  r.push(`**Il gioco che cresce:** ${f.gioco}`, "");
  if (f.prova) r.push(`**La prova, da un progetto vuoto:** ${f.prova}`, "");
  r.push("**Alla fine di questa fase:**", "", ...f.allaFine.map((x) => `- ${x}`), "");
  f.lezioni.forEach((l, j) => {
    const segno = l.tipo === "metodo" ? " · lezione di metodo" : l.tipo === "progetto" ? " · progetto" : "";
    r.push(`### ${i}.${j} ${l.titolo}`, "");
    r.push(`*${l.minuti} minuti${segno} · esercizi: ${l.esercizi.map((e) => tipi.get(e)?.nome.toLowerCase() ?? e).join("; ")}*`, "");
    r.push(`- **Impari:** ${l.impari.join("; ")}.`.replace(/\.\.$/, "."));
    r.push(`- **Costruisci:** ${l.costruisci}`);
    r.push(`- **Come viene controllato:** ${l.verifica}`, "");
  });
});

r.push("## Rami facoltativi", "", "Si attivano uno alla volta, quando ti interessano, dopo la fase indicata. Le loro lezioni vengono dettagliate al momento dell'attivazione.", "", "| Ramo | Ore | Dopo la fase | Contenuto |", "|---|---|---|---|");
for (const ramo of piano.rami) r.push(`| **${ramo.titolo}** | ${ramo.ore} | ${fasi.findIndex((f) => f.slug === ramo.dopo)} | ${ramo.contenuto} |`);
r.push("");

// ─────────────────────────── Riepilogo ───────────────────────────

fasi.forEach((f, i) => console.log(`${String(i).padStart(2)}  ${ore(minutiFase(f)).padStart(5)} h  ${String(f.lezioni.length).padStart(2)} voci  ${f.titolo}`));
console.log(`\nTotale: ${ore(totale)} ore, ${tutte.length} voci (${tutte.filter((l) => l.tipo === "metodo").length} di metodo, ${tutte.filter((l) => l.tipo === "progetto").length} tappe di progetto)`);
console.log(`Tipi di esercizio: ${[...uso].map(([id, n]) => `${id} ${n}`).join(" · ")}`);
for (const a of avvisi) console.log(`avviso: ${a}`);
if (errori.length) {
  for (const e of errori) console.error(`✗ ${e}`);
  process.exit(1);
}

// Con --controlla (nei controlli automatici) il documento non si scrive: si controlla che sia aggiornato.
const documento = path.join(REPO, "docs", "piano-del-corso.md");
const testo = r.join("\n");
if (process.argv.includes("--controlla")) {
  const attuale = fs.existsSync(documento) ? fs.readFileSync(documento, "utf8").replace(/\r\n/g, "\n") : "";
  if (attuale !== testo) {
    console.error("✗ docs/piano-del-corso.md non corrisponde al piano: eseguire npm run piano e salvare il risultato");
    process.exit(1);
  }
  console.log("✓ Piano coerente · docs/piano-del-corso.md aggiornato");
} else {
  fs.writeFileSync(documento, testo);
  console.log("✓ Piano coerente · docs/piano-del-corso.md scritto");
}
