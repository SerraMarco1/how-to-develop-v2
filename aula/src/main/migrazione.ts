import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { database, leggiImpostazione, scriviImpostazione } from "./db.ts";
import { impostaCartellaProgetti, salvaChiave, type FornitoreAula } from "./impostazioni.ts";

// L'importazione dalla versione 1 della piattaforma (una volta sola, quando premi «Importa» e scegli il suo database,
// data/how-to-develop.db nella cartella della versione 1): i tuoi progressi, i tentativi, la chat con il tutor, le
// spiegazioni alternative, il ripasso, la scheda «Cosa so fare», il profilo, la cartella dei progetti e le chiavi dei
// fornitori per il tutor. Il database vecchio viene solo letto, mai modificato.

const iso = (ms: number | null | undefined) => (ms ? new Date(Number(ms)).toISOString() : null);

const PROGRAMMAZIONE: Record<string, string> = {
  mai: "non ha mai programmato",
  poco: "ha programmato pochissimo, senza basi solide",
  basi: "conosce le basi della programmazione ma non sa realizzare un programma da solo",
  buona: "programma con sicurezza",
};
const GODOT: Record<string, string> = { mai: "non ha mai usato Godot", aperto: "ha aperto Godot qualche volta senza realizzare nulla", piccoli_progetti: "ha fatto piccoli progetti in Godot" };

function profiloInParole(p: Record<string, string>): string {
  return [
    `- Programmazione: ${PROGRAMMAZIONE[p.programmazione] ?? "livello non indicato"}${p.linguaggi ? ` (linguaggi visti: ${p.linguaggi})` : ""}.`,
    `- Motori provati: ${p.motoriProvati || "nessuno"}.`,
    `- Godot: ${GODOT[p.godot] ?? "non indicato"}. Il corso parte comunque da zero.`,
    `- Obiettivo: ${p.obiettivo || "saper usare Godot in modo completo"}.`,
    p.generi ? `- Generi di gioco che gli interessano: ${p.generi}.` : "",
    p.preferenze ? `- Preferenze sull'insegnamento: ${p.preferenze}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Il file scelto è davvero il database della versione 1? (le tabelle che servono ci sono) */
function problemaDatabase(file: string): string | null {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return "Il file scelto non esiste.";
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const tabelle = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name));
    const mancanti = ["lessons", "attempts", "settings", "ai_providers"].filter((t) => !tabelle.has(t));
    return mancanti.length ? "Il file scelto non è il database della versione 1 (si chiama how-to-develop.db, nella cartella data)." : null;
  } catch {
    return "Il file scelto non è un database leggibile.";
  } finally {
    db?.close();
  }
}

/** La cartella dei progetti della versione 1: quella scritta nella sua configurazione (.env.local, .env o .env.example). */
function cartellaProgettiVersione1(file: string): string | null {
  const radice = path.dirname(path.dirname(path.resolve(file)));
  for (const nome of [".env.local", ".env", ".env.example"]) {
    const config = path.join(radice, nome);
    if (!fs.existsSync(config)) continue;
    const valore = fs.readFileSync(config, "utf8").match(/^\s*PROGETTI_CORSO_DIR\s*=\s*(.+?)\s*$/m)?.[1]?.replace(/^["']|["']$/g, "");
    if (valore && path.isAbsolute(valore) && fs.existsSync(valore) && fs.statSync(valore).isDirectory()) return valore;
  }
  return null;
}

export function giaImportata(): string | null {
  return leggiImpostazione<string | null>("importata_v1", null);
}

export function importaVersione1(file: string): { ok: boolean; riepilogo: string } {
  if (giaImportata()) return { ok: false, riepilogo: `I dati della versione 1 sono già stati importati (${giaImportata()}).` };
  const problema = problemaDatabase(file);
  if (problema) return { ok: false, riepilogo: problema };
  const vecchio = new DatabaseSync(file, { readOnly: true });
  const db = database();
  const conti: Record<string, number> = {};
  const conta = (cosa: string) => (conti[cosa] = (conti[cosa] ?? 0) + 1);
  try {
    const mappa = vecchio.prepare("SELECT id FROM skill_maps WHERE status = 'approvata' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
    if (!mappa) return { ok: false, riepilogo: "Nel database della versione 1 non c'è un corso approvato." };
    const slugDiCompetenza = new Map((vecchio.prepare("SELECT id, slug FROM skills WHERE map_id = ?").all(mappa.id) as { id: number; slug: string }[]).map((r) => [r.id, r.slug]));
    const slugDiLezione = new Map((vecchio.prepare("SELECT id, skill_id FROM lessons").all() as { id: number; skill_id: number }[]).flatMap((r) => (slugDiCompetenza.has(r.skill_id) ? [[r.id, slugDiCompetenza.get(r.skill_id)!] as const] : [])));

    db.exec("BEGIN");
    for (const r of vecchio.prepare("SELECT * FROM skill_progress").all() as { skill_id: number; status: string; help_level: number; solution_seen: number; started_at: number; completed_at: number | null; rating: number | null; note: string | null }[]) {
      const slug = slugDiCompetenza.get(r.skill_id);
      if (!slug) continue;
      db.prepare("INSERT INTO progressi (slug, stato, aiuto, soluzione_vista, iniziata, completata, voto, nota) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING").run(slug, r.status, r.help_level, r.solution_seen, iso(r.started_at)!, iso(r.completed_at), r.rating, r.note);
      conta("progressi");
    }
    for (const r of vecchio.prepare("SELECT * FROM attempts ORDER BY id").all() as { lesson_id: number; item_id: string; submission: string; result: string; passed: number; created_at: number }[]) {
      const slug = slugDiLezione.get(r.lesson_id);
      if (!slug) continue;
      db.prepare("INSERT INTO tentativi (slug, pezzo, consegna, esito, superato, quando) VALUES (?, ?, ?, ?, ?, ?)").run(slug, r.item_id, r.submission, r.result, r.passed, iso(r.created_at)!);
      conta("tentativi");
    }
    for (const r of vecchio.prepare("SELECT * FROM tutor_messages ORDER BY id").all() as { lesson_id: number; role: string; content: string; help_level: number; model: string | null; created_at: number }[]) {
      const slug = slugDiLezione.get(r.lesson_id);
      if (!slug) continue;
      db.prepare("INSERT INTO tutor (slug, ruolo, testo, livello, modello, quando) VALUES (?, ?, ?, ?, ?, ?)").run(slug, r.role, r.content, r.help_level, r.model, iso(r.created_at)!);
      conta("messaggi del tutor");
    }
    for (const r of vecchio.prepare("SELECT * FROM lesson_extras ORDER BY id").all() as { lesson_id: number; block_id: string; content: string; created_at: number }[]) {
      const slug = slugDiLezione.get(r.lesson_id);
      if (!slug) continue;
      db.prepare("INSERT INTO spiegazioni (slug, blocco, testo, quando) VALUES (?, ?, ?, ?)").run(slug, r.block_id, r.content, iso(r.created_at)!);
      conta("spiegazioni alternative");
    }
    for (const r of vecchio.prepare("SELECT * FROM reviews").all() as { skill_id: number; due_at: number; interval_days: number; ease: number; reps: number; lapses: number; last_at: number | null }[]) {
      const slug = slugDiCompetenza.get(r.skill_id);
      if (!slug) continue;
      db.prepare("INSERT INTO ripassi (slug, scadenza, intervallo, facilita, ripetizioni, errori, ultimo) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING").run(slug, iso(r.due_at)!, r.interval_days, r.ease, r.reps, r.lapses, iso(r.last_at));
      conta("ripassi");
    }
    for (const r of vecchio.prepare("SELECT * FROM self_ratings").all() as { item_key: string; level: number; note: string | null; updated_at: number }[]) {
      db.prepare("INSERT INTO autovalutazioni (chiave, livello, nota, quando) VALUES (?, ?, ?, ?) ON CONFLICT(chiave) DO NOTHING").run(r.item_key, r.level, r.note, iso(r.updated_at)!);
      conta("autovalutazioni");
    }
    for (const r of vecchio.prepare("SELECT * FROM portfolio ORDER BY id").all() as { skill_id: number; title: string; project_path: string | null; help_level: number; created_at: number }[]) {
      const slug = slugDiCompetenza.get(r.skill_id);
      if (!slug) continue;
      db.prepare("INSERT INTO portfolio (slug, titolo, cartella, aiuto, quando) VALUES (?, ?, ?, ?, ?)").run(slug, r.title, r.project_path, r.help_level, iso(r.created_at)!);
      conta("lavori nella cronologia");
    }
    const profilo = vecchio.prepare("SELECT value FROM settings WHERE key = 'studente.profilo'").get() as { value: string } | undefined;
    if (profilo) {
      scriviImpostazione("profilo_testo", profiloInParole(JSON.parse(profilo.value) as Record<string, string>));
      conta("profilo");
    }
    db.exec("COMMIT");
  } catch (errore) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Niente da annullare.
    }
    return { ok: false, riepilogo: `Importazione non riuscita, niente è stato cambiato: ${(errore as Error).message}` };
  } finally {
    vecchio.close();
  }

  // La cartella dei progetti: quella che usava la versione 1, se esiste ancora.
  const cartellaVecchia = cartellaProgettiVersione1(file);
  if (cartellaVecchia) {
    impostaCartellaProgetti(cartellaVecchia);
    conta("cartella dei progetti");
  }
  // Le chiavi dei fornitori per il tutor: cifrate da Windows con il tuo account.
  const chiavi = new DatabaseSync(file, { readOnly: true });
  try {
    for (const r of chiavi.prepare("SELECT id, api_key FROM ai_providers WHERE api_key IS NOT NULL AND api_key <> ''").all() as { id: string; api_key: string }[]) {
      if (!["groq", "mistral", "gemini"].includes(r.id)) continue;
      salvaChiave(r.id as FornitoreAula, r.api_key);
      conta("chiavi per il tutor");
    }
  } finally {
    chiavi.close();
  }
  const quando = new Date().toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
  scriviImpostazione("importata_v1", quando);
  const riepilogo = Object.entries(conti).map(([cosa, n]) => `${cosa}: ${n}`).join(", ");
  return { ok: true, riepilogo: `Importati dalla versione 1 — ${riepilogo || "niente da importare"}.` };
}
