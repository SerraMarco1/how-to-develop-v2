import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// La documentazione ufficiale di Godot: i file .rst del repository godot-docs, a una revisione fissata (engine.json),
// divisi in sezioni e indicizzati con la ricerca full-text di SQLite (FTS5).
// La fabbrica costruisce l'indice e lo pubblica (media/<impronta>.sqlite.gz); l'aula lo scarica e lo usa per il tutor.
// Così chi scrive le lezioni e chi risponde alle domande leggono la stessa documentazione.

/** Cartelle della documentazione che non servono per imparare a usare il motore. */
const CARTELLE_ESCLUSE = ["contributing/", "engine_details/development/", "community/", "_", "img/"];

// ─────────────────────────── Lettura dei file .rst ───────────────────────────

const SIMBOLI_TITOLO = /^([=\-~^"*+#`'.:_])\1{2,}\s*$/;

function pulisciInline(riga: string): string {
  return riga
    .replace(/:(?:ref|doc|class|meth|member|signal|enum|constant|annotation|operator|abbr)?:`([^`<]*?)\s*<[^>]*>`/g, "$1")
    .replace(/:(?:ref|doc|class|meth|member|signal|enum|constant|annotation|operator|abbr|kbd|menu|code):`([^`]*)`/g, "$1")
    .replace(/`([^`<]+?)\s*<[^>]+>`_{1,2}/g, "$1")
    .replace(/``([^`]+)``/g, "`$1`")
    .replace(/\|([a-zA-Z_]+)\|/g, "$1")
    .replace(/\\\s?/g, "");
}

type Sezione = { titolo: string; testo: string };

export function leggiRst(contenuto: string): { titolo: string; sezioni: Sezione[] } {
  const righe = contenuto.replace(/\r\n/g, "\n").split("\n");
  const sezioni: Sezione[] = [];
  let corrente: Sezione = { titolo: "", testo: "" };
  let titoloPagina = "";
  let saltaIndentazione: number | null = null;
  for (let i = 0; i < righe.length; i++) {
    const riga = righe[i];
    const successiva = righe[i + 1] ?? "";
    if (saltaIndentazione !== null) {
      const rientro = riga.length - riga.trimStart().length;
      if (riga.trim() === "" || rientro > saltaIndentazione) continue;
      saltaIndentazione = null;
    }
    if (riga.trim() !== "" && !SIMBOLI_TITOLO.test(riga) && SIMBOLI_TITOLO.test(successiva) && successiva.trim().length >= riga.trim().length) {
      if (corrente.testo.trim() || corrente.titolo) sezioni.push(corrente);
      const titolo = pulisciInline(riga.trim());
      if (!titoloPagina) titoloPagina = titolo;
      corrente = { titolo, testo: "" };
      i++;
      continue;
    }
    if (SIMBOLI_TITOLO.test(riga)) continue;
    if (/^\s*[+|][-=+|\s]*$/.test(riga) && /[-=]/.test(riga)) continue;
    const direttiva = riga.match(/^(\s*)\.\.\s+([\w-]+)::\s*(.*)$/);
    if (direttiva) {
      const [, spazi, nome, argomento] = direttiva;
      const rientro = spazi.length;
      if (["image", "figure", "toctree", "raw", "meta", "only", "video", "rst-class", "highlight", "seealso"].includes(nome)) saltaIndentazione = rientro;
      else if (nome === "code-tab" && !/gdscript/i.test(argomento)) saltaIndentazione = rientro;
      else if (["note", "warning", "tip", "important", "caution", "danger", "attention"].includes(nome)) corrente.testo += `\n${nome.toUpperCase()}: ${pulisciInline(argomento)}\n`;
      else if (nome === "code-block" || nome === "code-tab") corrente.testo += `\n[codice ${argomento.split(" ")[0] || ""}]\n`;
      continue;
    }
    if (/^\s*\.\.\s/.test(riga) || /^\s*\.\.$/.test(riga)) {
      saltaIndentazione = riga.length - riga.trimStart().length;
      continue;
    }
    corrente.testo += pulisciInline(riga) + "\n";
  }
  sezioni.push(corrente);
  const pulite = sezioni.map((s) => ({ titolo: s.titolo || titoloPagina, testo: s.testo.replace(/\n{3,}/g, "\n\n").trim() })).filter((s) => s.testo.length > 40);
  return { titolo: titoloPagina || "Senza titolo", sezioni: pulite };
}

function dividi(testo: string, massimo = 2200): string[] {
  if (testo.length <= massimo) return [testo];
  const pezzi: string[] = [];
  let attuale = "";
  for (const paragrafo of testo.split(/\n\n/)) {
    if (attuale && attuale.length + paragrafo.length > massimo) {
      pezzi.push(attuale.trim());
      attuale = "";
    }
    attuale += paragrafo + "\n\n";
  }
  if (attuale.trim()) pezzi.push(attuale.trim());
  return pezzi.flatMap((p) => (p.length > massimo * 1.5 ? p.match(new RegExp(`[\\s\\S]{1,${massimo}}`, "g"))! : [p]));
}

function elencaRst(cartella: string, base = cartella): string[] {
  if (!fs.existsSync(cartella)) return [];
  return fs.readdirSync(cartella, { withFileTypes: true }).flatMap((voce) => {
    const completo = path.join(cartella, voce.name);
    if (voce.isDirectory()) return elencaRst(completo, base);
    return voce.isFile() && voce.name.endsWith(".rst") ? [path.relative(base, completo).replaceAll("\\", "/")] : [];
  });
}

// ─────────────────────────── Indice ───────────────────────────

/** Costruisce l'indice (un file SQLite) dalla cartella dei file .rst. Restituisce quante pagine e sezioni contiene. */
export function costruisciIndice(cartellaRst: string, fileIndice: string, siteBase: string): { pagine: number; pezzi: number } {
  const file = elencaRst(cartellaRst).filter((p) => !CARTELLE_ESCLUSE.some((e) => p.startsWith(e)));
  if (file.length < 100) throw new Error(`Documentazione incompleta: ${file.length} pagine in ${cartellaRst}`);
  fs.rmSync(fileIndice, { force: true });
  const db = new DatabaseSync(fileIndice);
  try {
    db.exec(`
      CREATE TABLE pagine (id INTEGER PRIMARY KEY, percorso TEXT NOT NULL, titolo TEXT NOT NULL, url TEXT NOT NULL, sezione TEXT NOT NULL, classe INTEGER NOT NULL);
      CREATE TABLE pezzi (id INTEGER PRIMARY KEY, pagina INTEGER NOT NULL, intestazione TEXT NOT NULL, testo TEXT NOT NULL);
      CREATE VIRTUAL TABLE pezzi_fts USING fts5(intestazione, testo, content='pezzi', content_rowid='id');
      CREATE INDEX pezzi_pagina ON pezzi(pagina);
    `);
    const inserisciPagina = db.prepare("INSERT INTO pagine (percorso, titolo, url, sezione, classe) VALUES (?, ?, ?, ?, ?)");
    const inserisciPezzo = db.prepare("INSERT INTO pezzi (pagina, intestazione, testo) VALUES (?, ?, ?)");
    let pezzi = 0;
    db.exec("BEGIN");
    for (const percorso of file.sort()) {
      const { titolo, sezioni } = leggiRst(fs.readFileSync(path.join(cartellaRst, percorso), "utf8"));
      if (sezioni.length === 0) continue;
      const classe = percorso.startsWith("classes/");
      const sezione = classe ? "classes" : percorso.split("/").slice(0, -1).slice(0, 2).join("/") || "about";
      const { lastInsertRowid } = inserisciPagina.run(percorso, titolo, siteBase + percorso.replace(/\.rst$/, ".html"), sezione, classe ? 1 : 0);
      for (const s of sezioni) {
        for (const testo of dividi(s.testo)) {
          inserisciPezzo.run(lastInsertRowid, s.titolo, testo);
          pezzi++;
        }
      }
    }
    db.exec("INSERT INTO pezzi_fts(pezzi_fts) VALUES('rebuild')");
    db.exec("COMMIT");
    db.exec("VACUUM");
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM pagine").get() as { n: number };
    return { pagine: n, pezzi };
  } finally {
    db.close();
  }
}

// ─────────────────────────── Ricerca ───────────────────────────

const PAROLE_VUOTE = new Set(
  "the and for with you your this that from are how what when use using into can will not una uno per con che del della dei delle nel nella come cosa sono gli le il lo la di da in su tra fra non più".split(" "),
);

export type RisultatoDocs = { titolo: string; sezione: string; url: string; testo: string; classe: boolean };

let aperto: { file: string; db: DatabaseSync } | null = null;

/** Apre l'indice in sola lettura (una volta sola). */
export function apriIndice(fileIndice: string): void {
  if (aperto?.file === fileIndice) return;
  aperto?.db.close();
  aperto = { file: fileIndice, db: new DatabaseSync(fileIndice, { readOnly: true }) };
}

export function indiceAperto(): boolean {
  return aperto !== null;
}

/**
 * Cerca nella documentazione: i pezzi più pertinenti, prima le guide (prima quelle nei `prefissi` indicati per
 * l'argomento) poi le classi nominate nel testo.
 */
export function cercaDocumentazione(testo: string, opzioni: { guide?: number; classi?: number; maxCaratteri?: number; prefissi?: string[] } = {}): RisultatoDocs[] {
  if (!aperto) return [];
  const db = aperto.db;
  const termini = [...new Set(testo.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? [])];
  const parole = [...new Set(termini.map((p) => p.toLowerCase()))].filter((p) => !PAROLE_VUOTE.has(p));
  if (parole.length === 0) return [];
  const query = parole.slice(0, 20).map((p) => `"${p}"`).join(" OR ");
  const nGuide = opzioni.guide ?? 5;
  const nClassi = opzioni.classi ?? 2;
  const colonne = "p.titolo AS titolo, c.intestazione AS sezione, p.url AS url, c.testo AS testo, p.classe AS classe, c.id AS id";
  type Riga = RisultatoDocs & { id: number };
  const cerca = (q: string, classi: boolean, limite: number, prefissi: string[] = []): Riga[] => {
    if (limite <= 0) return [];
    const filtro = prefissi.length ? ` AND (${prefissi.map(() => "p.percorso LIKE ?").join(" OR ")})` : "";
    return db
      .prepare(`SELECT ${colonne} FROM pezzi_fts f JOIN pezzi c ON c.id = f.rowid JOIN pagine p ON p.id = c.pagina WHERE pezzi_fts MATCH ? AND p.classe = ?${filtro} ORDER BY bm25(pezzi_fts, 3.0, 1.0) LIMIT ?`)
      .all(q, classi ? 1 : 0, ...prefissi.map((x) => `${x}%`), limite) as unknown as Riga[];
  };
  const guide = cerca(query, false, nGuide, opzioni.prefissi ?? []);
  if (guide.length < nGuide) {
    const visti = new Set(guide.map((g) => g.id));
    guide.push(...cerca(query, false, nGuide).filter((g) => !visti.has(g.id)).slice(0, nGuide - guide.length));
  }
  const classi: Riga[] = [];
  const descrizione = db.prepare(`SELECT ${colonne} FROM pagine p JOIN pezzi c ON c.pagina = p.id WHERE p.classe = 1 AND p.titolo = ? COLLATE NOCASE ORDER BY (c.intestazione = 'Description') DESC, c.id LIMIT 1`);
  for (const t of termini) {
    if (classi.length >= nClassi) break;
    if (!/^[A-Z]/.test(t)) continue;
    const trovata = descrizione.get(t) as unknown as Riga | undefined;
    if (trovata && !classi.some((c) => c.id === trovata.id)) classi.push(trovata);
  }
  const tecnici = termini.filter((t) => /_/.test(t) || /[a-z][A-Z]|[A-Za-z]\d/.test(t)).map((t) => t.toLowerCase());
  if (classi.length < nClassi && tecnici.length > 0) {
    const visti = new Set(classi.map((c) => c.id));
    const altre = cerca([...new Set(tecnici)].slice(0, 12).map((p) => `"${p}"`).join(" OR "), true, nClassi);
    classi.push(...altre.filter((c) => !visti.has(c.id)).slice(0, nClassi - classi.length));
  }
  const massimo = opzioni.maxCaratteri ?? 9000;
  const scelti: RisultatoDocs[] = [];
  let totale = 0;
  for (const r of [...guide, ...classi]) {
    // Un pezzo che non ci sta per intero entra tagliato, se resta spazio per qualcosa di utile.
    const tagliato = r.testo.slice(0, Math.min(1800, massimo - totale));
    if (tagliato.length < 400 && scelti.length > 0) break;
    totale += tagliato.length;
    scelti.push({ titolo: r.titolo, sezione: r.sezione, url: r.url, testo: tagliato, classe: Boolean(r.classe) });
  }
  return scelti;
}

export function formattaDocumentazione(risultati: RisultatoDocs[]): string {
  if (risultati.length === 0) return "(nessun estratto trovato)";
  return risultati.map((r) => `### ${r.titolo} › ${r.sezione}\nFonte: ${r.url}\n${r.testo}`).join("\n\n");
}
