// Porta nel ramo `corso` le lezioni già scritte dalla versione 1 della piattaforma (una volta sola, a mano):
//
//   npx tsx fabbrica/strumenti/importa-v1.ts <database della versione 1> <cartella del ramo corso>
//
// Per ogni lezione pronta scrive importate/<lezione>.json (contenuto, gioco finale, ripasso, video) e copia il suo
// registro della generazione in tracce/<lezione>/. Non pubblica niente: al giro successivo la fabbrica ricontrolla ogni
// lezione in Godot con le regole della versione 2 e pubblica solo quelle che passano (vedi src/ricontrollo.ts).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [fileDb, cartellaCorso] = process.argv.slice(2);
if (!fileDb || !cartellaCorso) {
  console.error("Uso: npx tsx fabbrica/strumenti/importa-v1.ts <database v1> <cartella del ramo corso>");
  process.exit(2);
}
const cartellaDatiV1 = path.dirname(fileDb);
const db = new DatabaseSync(fileDb, { readOnly: true });
const mappa = db.prepare("SELECT id FROM skill_maps WHERE status = 'approvata' ORDER BY id DESC LIMIT 1").get() as { id: number };

const scrivi = (relativo: string, contenuto: string | Buffer) => {
  const completo = path.join(cartellaCorso, relativo);
  fs.mkdirSync(path.dirname(completo), { recursive: true });
  fs.writeFileSync(completo, contenuto);
};
const iso = (ms: number | null) => (ms ? new Date(Number(ms)).toISOString() : new Date().toISOString());

type Riga = { lesson_id: number; skill_id: number; slug: string; content: string; project_state: string | null; media: string | null; updated_at: number };
const lezioni = db
  .prepare("SELECT l.id AS lesson_id, s.id AS skill_id, s.slug, l.content, l.project_state, l.media, l.updated_at FROM lessons l JOIN skills s ON s.id = l.skill_id WHERE s.map_id = ? AND l.status = 'pronta' ORDER BY s.module_id, s.\"order\"")
  .all(mappa.id) as Riga[];

for (const l of lezioni) {
  const contenuto = JSON.parse(l.content) as { blocchi: { id: string; tipo: string }[] };
  const media: Record<string, { sha256: string; estensione: string; byte: number }> = {};
  for (const [blocco, file] of Object.entries((l.media ? JSON.parse(l.media) : {}) as Record<string, string>)) {
    const origine = path.join(cartellaDatiV1, "video", file);
    if (!fs.existsSync(origine)) continue;
    const dati = fs.readFileSync(origine);
    const sha256 = crypto.createHash("sha256").update(dati).digest("hex");
    scrivi(`media/${sha256}.mp4`, dati);
    media[`video:${blocco}`] = { sha256, estensione: "mp4", byte: dati.length };
  }
  const voci = (db.prepare("SELECT items FROM reviews WHERE skill_id = ?").get(l.skill_id) as { items: string | null } | undefined)?.items;
  const ripasso = voci ? (JSON.parse(voci) as { codice?: string; risposta?: string }[]).filter((v) => v.codice && v.risposta).map((v, i) => ({ ...v, id: `r${i + 1}` })) : [];
  const passi = db.prepare("SELECT * FROM generation_steps WHERE skill_id = ? ORDER BY id").all(l.skill_id) as { id: number; piece: string; action: string; outcome: string; failure_class: string | null; title: string; detail: string; model: string | null; requests: number; duration_ms: number | null; data_path: string | null; created_at: number }[];
  const modelli = [...new Set(passi.map((p) => p.model).filter((m): m is string => Boolean(m)))];
  const righe = passi.map((p, i) => {
    let dati: string | undefined;
    if (p.data_path) {
      const origine = path.join(cartellaDatiV1, "tracce", p.data_path);
      if (fs.existsSync(origine)) {
        dati = `v1-${String(i + 1).padStart(4, "0")}-${p.piece}-${p.action}.json`;
        scrivi(`tracce/${l.slug}/${dati}`, fs.readFileSync(origine));
      }
    }
    return JSON.stringify({ n: i + 1, quando: iso(p.created_at), pezzo: p.piece, azione: p.action, esito: p.outcome, guasto: p.failure_class ?? undefined, titolo: p.title, spiegazione: p.detail, modello: p.model ?? undefined, richieste: p.requests, durataMs: p.duration_ms ?? undefined, dati, versione1: true });
  });
  righe.push(JSON.stringify({ n: righe.length + 1, quando: new Date().toISOString(), pezzo: "lezione", azione: "importazione", esito: "ok", titolo: "Lezione portata dalla versione 1", spiegazione: `Scritta dalla versione 1 della piattaforma e portata qui per essere ricontrollata in Godot con le regole della versione 2 prima della pubblicazione. ${Object.keys(media).length} video, ${ripasso.length} voci di ripasso.`, richieste: 0 }));
  scrivi(`tracce/${l.slug}/registro.jsonl`, `${righe.join("\n")}\n`);
  scrivi(
    `importate/${l.slug}.json`,
    `${JSON.stringify({ slug: l.slug, contenuto, statoFinale: l.project_state ? JSON.parse(l.project_state) : null, ripasso, media, pubblicata: iso(l.updated_at), modelli }, null, 1)}\n`,
  );
  console.log(`${l.slug}: ${contenuto.blocchi.length} blocchi, ${Object.keys(media).length} video, ${ripasso.length} voci di ripasso, ${passi.length} passi nel registro`);
}
console.log(`Importate ${lezioni.length} lezioni in ${cartellaCorso}`);
